import {
  app,
  BrowserWindow,
  clipboard,
  ClipboardItem,
  dialog,
  ipcMain,
  Menu,
  nativeImage,
  screen,
  WebContentsView,
  type IpcMainEvent,
  type IpcMainInvokeEvent,
} from 'electron'
import { readFileSync, mkdtempSync } from 'node:fs'
import { join } from 'node:path'
import { type as systemType, tmpdir } from 'node:os'
import { FEEDBACK_SCREENSHOT_MAX_BYTES, FEEDBACK_SCREENSHOT_MIME_TYPE } from '../feedback'
import { captureFeedbackScreenshot, writeFeedbackClipboardImage } from './feedback'
import {
  PDFE_CHANNEL,
  PDFE_CONTROL_SIZE,
  PDFE_DIAGNOSTIC_BUDGET,
  PDFE_DIAGNOSTIC_ENV,
  PDFE_DIAGNOSTIC_HEADER,
  PDFE_DIAGNOSTIC_PATH,
  PDFE_REQUEST_TIMEOUT_MS,
  PDFE_RESET_PATH,
  PDFE_RESTART_ENV,
  PDFE_RESTART_EXIT,
  PDFE_SHORTCUT,
  PREVIEW_INSTANCE_PARAMETER,
  PREVIEW_SCENE_PARAMETER,
  parsePdfeManifest,
  pdfeTargetUrl,
  readPdfeTarget,
  isPdfeTargetUrl,
  isPdfeEnvironmentDiagnostic,
  pdfeDockWidth,
  pdfeWindowWidth,
  type PdfeDock,
  type PdfeDiagnosticStatus,
  type PdfeEnvironmentDiagnostic,
  type PdfeSurface,
  type PdfeTarget,
} from '../pdfe'
import {
  OFFICE_FONT_CATALOG_CHANNEL,
  OFFICE_FONT_READ_CHANNEL,
  OFFICE_FONT_CACHE_READ_CHANNEL,
  OFFICE_FONT_CACHE_WRITE_CHANNEL,
  type OfficeFontCache,
  type NativeFontFace,
} from '../fonts'
import { WINDOW_FULLSCREEN_CHANNEL } from '../window'
import { OfficeFontFiles } from './fontfiles'
import { bindPdfeIterationReader } from './iterations'
import {
  PDFE_ITERATION_EDIT_ENV,
  PDFE_ITERATION_WORKTREE_ENV,
  type PdfeIterationSaveResult,
} from '../iterations'
import { validateFontCache } from './fontcache'
import { createWorkspaceWindowOptions } from './window'
import { installContentSecurityPolicy, mainWindowContentSecurityPolicy } from './csp'
import { formatSystemVersion } from './system'
import { applyMainLanguage, mainLocalization } from './localization'
import zh from '../../preview/locales/zh.json'
import en from '../../preview/locales/en.json'

const MANIFEST_NAME = 'pdfe.json'
const PRELOAD_NAME = 'preload.cjs'
const PROFILE_PREFIX = 'scholarseed-pdfe-'
const FONT_LIBRARY_NAME = './fonts.node'
const PDFE_NAMESPACE = 'preview'
const DIAGNOSTIC_GENERATION_PATTERN = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/
const DIAGNOSTIC_GENERATIONS = 2
const PNG_SIGNATURE = Buffer.from('89504e470d0a1a0a', 'hex')
const PNG_WIDTH_OFFSET = 16
const PNG_HEIGHT_OFFSET = 20
const PNG_DIMENSIONS_END = 24
const diagnosticAccess = process.env[PDFE_DIAGNOSTIC_ENV]
delete process.env[PDFE_DIAGNOSTIC_ENV]
const restartAvailable = process.env[PDFE_RESTART_ENV] === '1'
delete process.env[PDFE_RESTART_ENV]
const iterationRoot = process.env[PDFE_ITERATION_WORKTREE_ENV]
delete process.env[PDFE_ITERATION_WORKTREE_ENV]
const iterationEditing =
  process.platform === 'darwin' && process.env[PDFE_ITERATION_EDIT_ENV] === '1'
delete process.env[PDFE_ITERATION_EDIT_ENV]
const manifest = parsePdfeManifest(JSON.parse(readFileSync(join(__dirname, MANIFEST_NAME), 'utf8')))
const sceneClipboard = JSON.parse(
  readFileSync(join(__dirname, 'pdfe-clipboard.json'), 'utf8')
) as Record<'zh' | 'en', Record<string, unknown>>
const nativeFonts = require(FONT_LIBRARY_NAME) as {
  enumerateFonts: () => Promise<NativeFontFace[]>
}
const fonts: OfficeFontFiles = new OfficeFontFiles(() => nativeFonts.enumerateFonts())
const caches = new Map<string, OfficeFontCache>()
const profile = mkdtempSync(join(tmpdir(), PROFILE_PREFIX))
const windows = new Map<PdfeSurface, BrowserWindow>()
const views = new Map<PdfeSurface, WebContentsView>()
const diagnosticEnvironment = new Map<string, Set<PdfeEnvironmentDiagnostic>>()
let dock: PdfeDock = 'docked'
let controlsVisible = true
let screenshotRequest = 0
let screenshot: { id: number; width: number; height: number } | undefined
let dockWidth: number = PDFE_CONTROL_SIZE.width
let target: PdfeTarget = manifest.initial
let navigating = false
let quitting = false
let restartRequested = false
let iterationReader: ReturnType<typeof bindPdfeIterationReader> | undefined
let iterationDraft: 'zh' | 'en' | undefined

if (iterationRoot) {
  try {
    iterationReader = bindPdfeIterationReader(
      require('./lease.node'),
      iterationRoot,
      (document) => {
        for (const [identity, scenes] of Object.entries(document.baseline.scenes)) {
          const page = manifest.pages.find((entry) => entry.id === identity && !entry.components)
          if (!page || scenes.some((scene) => !page.scenes.includes(scene)))
            throw new Error('PDFE iteration baseline contains unknown scenes')
        }
      }
    )
  } catch {
    console.warn('[pdfe] iteration worktree unavailable')
  }
}

function confirmIterationDiscard(): boolean {
  if (!iterationDraft) return true
  const strings = iterationDraft === 'en' ? en : zh
  const choice = dialog.showMessageBoxSync({
    type: 'warning',
    message: strings.iterationDiscardTitle,
    detail: strings.iterationDiscardDetail,
    buttons: [strings.iterationKeep, strings.iterationDiscard],
    defaultId: 0,
    cancelId: 0,
  })
  if (choice !== 1) return false
  iterationDraft = undefined
  return true
}

app.setName('PDFE')
app.setPath('userData', profile)
app.setPath('sessionData', profile)
app.commandLine.appendSwitch('remote-debugging-address', '127.0.0.1')
app.commandLine.appendSwitch('remote-debugging-port', '0')

function allowedUrl(input: string, role: PdfeSurface): boolean {
  return isPdfeTargetUrl(manifest, input, role)
}

function sender(event: IpcMainEvent | IpcMainInvokeEvent, expected?: PdfeSurface): PdfeSurface {
  const role = [...views].find(
    ([, view]) => !view.webContents.isDestroyed() && view.webContents === event.sender
  )?.[0]
  if (
    !role ||
    (expected && role !== expected) ||
    !event.senderFrame ||
    event.senderFrame !== event.sender.mainFrame ||
    !allowedUrl(event.senderFrame.url, role)
  )
    throw new Error('Invalid PDFE sender')
  return role
}

function layout(): void {
  const product = windows.get('product')
  const controls = windows.get('controls')
  if (!product || !controls || product.isDestroyed() || controls.isDestroyed()) return
  const [width, height] = product.getContentSize()
  const panel = dock === 'docked' && controlsVisible ? pdfeDockWidth(width, dockWidth) : 0
  views.get('product')?.setBounds({ x: 0, y: 0, width: width - panel, height })
  if (dock === 'docked')
    views
      .get('controls')
      ?.setBounds({ x: width - panel, y: 0, width: panel || PDFE_CONTROL_SIZE.width, height })
  else {
    const [width, height] = controls.getContentSize()
    views.get('controls')?.setBounds({ x: 0, y: 0, width, height })
  }
}

function hideControls(): void {
  controlsVisible = false
  if (dock === 'docked') views.get('controls')?.setVisible(false)
  else windows.get('controls')?.hide()
  layout()
  views.get('product')?.webContents.focus()
}

function showControls(): void {
  const controls = windows.get('controls')
  if (!controls || controls.isDestroyed()) return
  controlsVisible = true
  if (dock === 'docked') {
    views.get('controls')?.setVisible(true)
    layout()
    windows.get('product')?.show()
    views.get('controls')?.webContents.focus()
    return
  }
  if (controls.isMinimized()) controls.restore()
  controls.show()
  controls.focus()
  views.get('controls')?.webContents.focus()
}

function clearScreenshot(): void {
  screenshotRequest++
  screenshot = undefined
}

async function loadTarget(next: PdfeTarget): Promise<void> {
  clearScreenshot()
  target = next
  await Promise.all(
    [...views].map(([role, view]) =>
      view.webContents.loadURL(pdfeTargetUrl(manifest, target, role).href)
    )
  )
}

ipcMain.on(PDFE_CHANNEL.boot, (event) => {
  try {
    const role = sender(event)
    const window = windows.get(role)!
    event.returnValue = {
      kind: role,
      platform: process.platform,
      systemVersion: formatSystemVersion(systemType(), process.getSystemVersion(), process.arch),
      version: app.getVersion(),
      fullscreen: window.isFullScreen(),
      dock,
      restartAvailable: role === 'controls' && restartAvailable,
      iterationWritable:
        role === 'controls' && iterationEditing && Boolean(iterationReader?.writable),
    }
  } catch {
    event.returnValue = null
  }
})
ipcMain.handle(PDFE_CHANNEL.open, async (event, value: unknown) => {
  sender(event, 'controls')
  if (navigating) throw new Error('PDFE navigation already pending')
  const next = readPdfeTarget(manifest, value)
  if (!confirmIterationDiscard()) return
  navigating = true
  try {
    const url = new URL(PDFE_RESET_PATH, manifest.origin)
    url.searchParams.set(PREVIEW_INSTANCE_PARAMETER, manifest.instance)
    url.searchParams.set(PREVIEW_SCENE_PARAMETER, next.sceneId)
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ scene: next.sceneId, pageId: next.pageId }),
      signal: AbortSignal.timeout(PDFE_REQUEST_TIMEOUT_MS),
    })
    if (!response.ok) throw new Error('PDFE scenario reset failed')
    await response.body?.cancel()
    await loadTarget(next)
  } finally {
    navigating = false
  }
})
ipcMain.handle(PDFE_CHANNEL.copyScene, async (event, value: unknown, locale: unknown) => {
  sender(event, 'controls')
  if (
    navigating ||
    !controlsVisible ||
    event.senderFrame?.url !== pdfeTargetUrl(manifest, target, 'controls').href
  )
    throw new Error('Invalid PDFE scene copy sender')
  const reference = readPdfeTarget(manifest, value)
  if (locale !== undefined && locale !== 'zh' && locale !== 'en')
    throw new Error('Invalid PDFE reference language')
  const text =
    sceneClipboard[locale ?? 'zh']?.[JSON.stringify([reference.pageId, reference.sceneId])]
  if (typeof text !== 'string') throw new Error('Unknown PDFE scene reference')
  await clipboard.writeText(text)
})
ipcMain.handle(PDFE_CHANNEL.reload, async (event) => {
  sender(event, 'controls')
  if (!confirmIterationDiscard()) return
  await loadTarget(target)
})
ipcMain.handle(PDFE_CHANNEL.restart, (event) => {
  requireScreenshotControls(event)
  if (!restartAvailable || quitting || restartRequested) return
  if (!confirmIterationDiscard()) return
  restartRequested = true
  setImmediate(() => app.quit())
})
function requireScreenshotControls(event: IpcMainInvokeEvent): void {
  sender(event, 'controls')
  if (
    !controlsVisible ||
    navigating ||
    event.senderFrame?.url !== pdfeTargetUrl(manifest, target, 'controls').href
  )
    throw new Error('PDFE screenshot controls are unavailable')
}

ipcMain.handle(PDFE_CHANNEL.captureScreenshot, async (event) => {
  requireScreenshotControls(event)
  if (screenshot) {
    windows.get('product')?.focus()
    views.get('product')?.webContents.focus()
    return
  }
  const product = views.get('product')?.webContents
  if (
    !product ||
    product.isDestroyed() ||
    product.getURL() !== pdfeTargetUrl(manifest, target, 'product').href
  )
    throw new Error('PDFE screenshot target is unavailable')
  const id = ++screenshotRequest
  const captured = await captureFeedbackScreenshot({ capturePage: () => product.capturePage() })
  requireScreenshotControls(event)
  if (
    !captured.ok ||
    id !== screenshotRequest ||
    product.isDestroyed() ||
    product.getURL() !== pdfeTargetUrl(manifest, target, 'product').href
  )
    throw new Error('PDFE screenshot capture failed')
  screenshot = { id, width: captured.width, height: captured.height }
  windows.get('product')?.focus()
  product.focus()
  product.send(PDFE_CHANNEL.screenshotCaptured, { id, bytes: captured.bytes })
})

function requireScreenshotProduct(event: IpcMainInvokeEvent): void {
  sender(event, 'product')
  if (navigating || event.senderFrame?.url !== pdfeTargetUrl(manifest, target, 'product').href)
    throw new Error('PDFE screenshot target is unavailable')
}

ipcMain.handle(PDFE_CHANNEL.closeScreenshot, (event, id: unknown) => {
  requireScreenshotProduct(event)
  if (!screenshot || id !== screenshot.id) throw new Error('Invalid PDFE screenshot')
  clearScreenshot()
})

ipcMain.handle(PDFE_CHANNEL.copyScreenshot, async (event, id: unknown, bytes: unknown) => {
  requireScreenshotProduct(event)
  if (
    !screenshot ||
    id !== screenshot.id ||
    !(bytes instanceof Uint8Array) ||
    bytes.byteLength < PNG_DIMENSIONS_END ||
    bytes.byteLength > FEEDBACK_SCREENSHOT_MAX_BYTES
  )
    throw new Error('Invalid PDFE screenshot')
  const buffer = Buffer.from(bytes)
  if (
    !buffer.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE) ||
    buffer.readUInt32BE(PNG_WIDTH_OFFSET) !== screenshot.width ||
    buffer.readUInt32BE(PNG_HEIGHT_OFFSET) !== screenshot.height
  )
    throw new Error('Invalid PDFE screenshot PNG')
  const image = nativeImage.createFromBuffer(buffer)
  if (image.isEmpty()) throw new Error('Empty PDFE screenshot')
  const result = await writeFeedbackClipboardImage(
    clipboard,
    new ClipboardItem({
      [FEEDBACK_SCREENSHOT_MIME_TYPE]: new Blob([buffer], { type: FEEDBACK_SCREENSHOT_MIME_TYPE }),
    })
  )
  if (!result.ok) throw new Error('PDFE screenshot copy failed')
})
ipcMain.handle(PDFE_CHANNEL.diagnosticEnvironment, (event, generation: unknown, code: unknown) => {
  const role = sender(event)
  if (
    event.senderFrame?.url !== pdfeTargetUrl(manifest, target, role).href ||
    typeof generation !== 'string' ||
    !DIAGNOSTIC_GENERATION_PATTERN.test(generation) ||
    !isPdfeEnvironmentDiagnostic(code)
  ) {
    throw new Error('Invalid PDFE environment diagnostic')
  }
  let entries = diagnosticEnvironment.get(generation)
  if (!entries) {
    if (diagnosticEnvironment.size >= DIAGNOSTIC_GENERATIONS)
      diagnosticEnvironment.delete(diagnosticEnvironment.keys().next().value!)
    entries = new Set()
    diagnosticEnvironment.set(generation, entries)
  }
  entries.add(code)
})
async function readDiagnostics(event: IpcMainInvokeEvent): Promise<PdfeDiagnosticStatus> {
  sender(event, 'controls')
  const selected = target
  const controlsUrl = pdfeTargetUrl(manifest, selected, 'controls').href
  if (!diagnosticAccess || navigating || event.senderFrame?.url !== controlsUrl) {
    throw new Error('PDFE diagnostics are unavailable')
  }
  const url = new URL(PDFE_DIAGNOSTIC_PATH, manifest.origin)
  url.searchParams.set(PREVIEW_INSTANCE_PARAMETER, manifest.instance)
  const response = await fetch(url, {
    headers: { [PDFE_DIAGNOSTIC_HEADER]: diagnosticAccess },
    redirect: 'error',
    signal: AbortSignal.timeout(PDFE_REQUEST_TIMEOUT_MS),
  })
  if (!response.ok) {
    await response.body?.cancel()
    throw new Error('PDFE diagnostics are unavailable')
  }
  const status = (await response.json()) as Partial<PdfeDiagnosticStatus> | null
  if (
    navigating ||
    target !== selected ||
    event.senderFrame?.url !== controlsUrl ||
    !status ||
    status.pageId !== selected.pageId ||
    status.scene !== selected.sceneId ||
    typeof status.generation !== 'string' ||
    !Array.isArray(status.requests) ||
    !Array.isArray(status.streams) ||
    !Array.isArray(status.unhandled) ||
    typeof status.dropped !== 'number' ||
    !Number.isSafeInteger(status.dropped) ||
    status.dropped < 0
  ) {
    throw new Error('PDFE diagnostic target changed or returned invalid data')
  }
  return {
    pageId: status.pageId,
    scene: status.scene,
    generation: status.generation,
    requests: status.requests,
    streams: status.streams,
    unhandled: status.unhandled,
    dropped: status.dropped,
    environment: [...(diagnosticEnvironment.get(status.generation) ?? [])],
  }
}
ipcMain.handle(PDFE_CHANNEL.diagnostics, readDiagnostics)
ipcMain.handle(
  PDFE_CHANNEL.copyDiagnostics,
  async (event, generation: unknown, sequences: unknown) => {
    sender(event, 'controls')
    if (
      !controlsVisible ||
      typeof generation !== 'string' ||
      !DIAGNOSTIC_GENERATION_PATTERN.test(generation) ||
      !Array.isArray(sequences) ||
      !sequences.length ||
      sequences.length > PDFE_DIAGNOSTIC_BUDGET.records ||
      sequences.some((sequence) => !Number.isSafeInteger(sequence) || sequence <= 0) ||
      new Set(sequences).size !== sequences.length
    )
      throw new Error('Invalid PDFE diagnostic copy selection')
    const snapshot = await readDiagnostics(event)
    if (!controlsVisible || snapshot.generation !== generation)
      throw new Error('PDFE diagnostic copy target changed')
    const bySequence = new Map(
      [...snapshot.requests, ...snapshot.streams].map((record) => [record.sequence, record])
    )
    const records = sequences.map((sequence) => bySequence.get(sequence))
    if (records.some((record) => !record)) throw new Error('PDFE diagnostic copy selection expired')
    clipboard.writeText(
      JSON.stringify(
        { pageId: snapshot.pageId, scene: snapshot.scene, dropped: snapshot.dropped, records },
        null,
        2
      )
    )
  }
)
ipcMain.handle(PDFE_CHANNEL.iterations, (event) => {
  sender(event, 'controls')
  try {
    if (iterationReader) return iterationReader.read()
  } catch {
    throw new Error('PDFE iteration snapshot could not be read')
  }
  throw new Error('PDFE iteration worktree unavailable')
})
ipcMain.handle(
  PDFE_CHANNEL.saveIteration,
  (event, revision: unknown, edit: unknown): PdfeIterationSaveResult => {
    sender(event, 'controls')
    if (
      navigating ||
      quitting ||
      !iterationEditing ||
      !iterationReader?.writable ||
      event.senderFrame?.url !== pdfeTargetUrl(manifest, target, 'controls').href
    )
      return { status: 'unavailable' }
    return iterationReader.save(revision, edit)
  }
)
ipcMain.handle(PDFE_CHANNEL.iterationDraft, (event, dirty: unknown, locale: unknown) => {
  sender(event, 'controls')
  if (
    !iterationEditing ||
    !iterationReader?.writable ||
    typeof dirty !== 'boolean' ||
    (locale !== 'zh' && locale !== 'en') ||
    event.senderFrame?.url !== pdfeTargetUrl(manifest, target, 'controls').href
  )
    throw new Error('Invalid PDFE draft signal')
  iterationDraft = dirty ? locale : undefined
})
ipcMain.handle(PDFE_CHANNEL.hide, (event) => {
  sender(event, 'controls')
  hideControls()
})
ipcMain.handle(PDFE_CHANNEL.dock, (event, mode: unknown) => {
  sender(event, 'controls')
  if (mode !== 'docked' && mode !== 'detached') throw new Error('Invalid PDFE dock mode')
  if (mode === dock) return
  const product = windows.get('product')!
  const controls = windows.get('controls')!
  const view = views.get('controls')!
  const previous = dock === 'docked' ? product : controls
  const next = mode === 'docked' ? product : controls
  previous.contentView.removeChildView(view)
  next.contentView.addChildView(view)
  dock = mode
  view.setVisible(controlsVisible)
  if (dock === 'docked') controls.hide()
  else if (controlsVisible) controls.show()
  layout()
  view.webContents.send(PDFE_CHANNEL.dockChanged, dock)
  if (controlsVisible) view.webContents.focus()
})
ipcMain.handle(PDFE_CHANNEL.resize, (event, width: unknown) => {
  sender(event, 'controls')
  dockWidth = pdfeDockWidth(windows.get('product')!.getContentSize()[0], width)
  layout()
})
ipcMain.handle(OFFICE_FONT_CATALOG_CHANNEL, (event) => {
  sender(event, 'product')
  return fonts.catalog()
})
ipcMain.handle(OFFICE_FONT_READ_CHANNEL, (event, id: unknown) => {
  sender(event, 'product')
  if (typeof id !== 'string') throw new Error('Invalid PDFE font request')
  return fonts.read(id)
})
ipcMain.handle(OFFICE_FONT_CACHE_READ_CHANNEL, (event, fingerprint: unknown) => {
  sender(event, 'product')
  fonts.assertFingerprint(fingerprint)
  return caches.get(fingerprint as string) ?? null
})
ipcMain.handle(OFFICE_FONT_CACHE_WRITE_CHANNEL, (event, fingerprint: unknown, value: unknown) => {
  sender(event, 'product')
  fonts.assertFingerprint(fingerprint)
  caches.set(fingerprint as string, validateFontCache(value))
})

async function start(): Promise<void> {
  await app.whenReady()
  await applyMainLanguage('zh')
  mainLocalization().addResourceBundle('zh', PDFE_NAMESPACE, zh, true, true)
  mainLocalization().addResourceBundle('en', PDFE_NAMESPACE, en, true, true)
  const translate = mainLocalization().getFixedT(null, PDFE_NAMESPACE as never) as unknown as (
    key: keyof typeof zh
  ) => string
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      { role: 'appMenu' },
      { role: 'editMenu' },
      { role: 'viewMenu' },
      { role: 'windowMenu' },
    ])
  )
  for (const role of ['product', 'controls'] as const) {
    const options = createWorkspaceWindowOptions({
      platform: process.platform,
      preload: join(__dirname, PRELOAD_NAME),
    })
    const window = new BrowserWindow({
      ...options,
      ...(role === 'controls'
        ? { ...PDFE_CONTROL_SIZE, titleBarStyle: 'default', trafficLightPosition: undefined }
        : { width: pdfeWindowWidth(screen.getPrimaryDisplay().workAreaSize.width) }),
      title: translate(role === 'product' ? 'productWindowTitle' : 'title'),
      webPreferences: {
        ...options.webPreferences,
        preload: undefined,
        partition: 'pdfe-' + manifest.instance + '-' + role + '-shell',
      },
    })
    windows.set(role, window)
    await window.loadURL('about:blank')
    const view = new WebContentsView({
      webPreferences: {
        ...options.webPreferences,
        partition: 'pdfe-' + manifest.instance + '-' + role,
      },
    })
    views.set(role, view)
    if (role === 'controls')
      view.webContents.on('page-title-updated', (_event, title) => {
        if (!window.isDestroyed()) window.setTitle(title)
      })
    const host = role === 'controls' && dock === 'docked' ? windows.get('product')! : window
    host.contentView.addChildView(view)
    window.on('resize', layout)
    installContentSecurityPolicy(
      view,
      mainWindowContentSecurityPolicy('', { frames: role === 'product' })
    )
    const session = view.webContents.session
    await session.setProxy({ mode: 'direct' })
    session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false))
    session.setPermissionCheckHandler(() => false)
    session.webRequest.onBeforeRequest((details, callback) => {
      const url = new URL(details.url)
      const origin = new URL(manifest.origin)
      const allowed =
        (url.protocol === 'http:' || url.protocol === 'ws:') &&
        url.hostname === origin.hostname &&
        url.port === origin.port
      callback({ cancel: !allowed && !['data:', 'blob:', 'about:'].includes(url.protocol) })
    })
    view.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
    if (role === 'product') {
      view.webContents.on('did-start-navigation', ({ isMainFrame, isSameDocument }) => {
        if (isMainFrame && !isSameDocument) clearScreenshot()
      })
    }
    view.webContents.on('will-navigate', (event, url) => {
      if (!allowedUrl(url, role)) event.preventDefault()
    })
    view.webContents.on('before-input-event', (event, input) => {
      if (
        input.type !== 'keyDown' ||
        input.key !== PDFE_SHORTCUT ||
        input.alt ||
        input.control ||
        input.meta ||
        input.shift ||
        input.isAutoRepeat
      )
        return
      event.preventDefault()
      if (controlsVisible) hideControls()
      else showControls()
    })
    window.on('enter-full-screen', () => view.webContents.send(WINDOW_FULLSCREEN_CHANNEL, true))
    window.on('leave-full-screen', () => view.webContents.send(WINDOW_FULLSCREEN_CHANNEL, false))
    if (role === 'controls')
      window.on('close', (event) => {
        if (!quitting) {
          event.preventDefault()
          hideControls()
        }
      })
    else {
      window.on('close', (event) => {
        if (!quitting && !confirmIterationDiscard()) event.preventDefault()
      })
      window.on('closed', () => app.quit())
    }
  }
  await loadTarget(target)
  layout()
  const product = windows.get('product')!
  const controls = windows.get('controls')!
  const bounds = product.getBounds()
  const area = screen.getDisplayMatching(bounds).workArea
  controls.setPosition(
    Math.min(bounds.x + bounds.width, area.x + area.width - PDFE_CONTROL_SIZE.width),
    Math.max(bounds.y, area.y)
  )
  product.show()
  if (dock === 'detached') controls.show()
  console.log(
    '[pdfe] native-ready ' +
      JSON.stringify({
        pid: process.pid,
        profile,
        origin: manifest.origin,
        instance: manifest.instance,
      })
  )
}

app.on('before-quit', (event) => {
  if (!confirmIterationDiscard()) {
    event.preventDefault()
    return
  }
  quitting = true
  try {
    iterationReader?.close()
  } catch {
    console.warn('[pdfe] iteration reader release failed')
  }
  for (const view of views.values()) if (!view.webContents.isDestroyed()) view.webContents.close()
})
app.on('window-all-closed', () => app.quit())
app.on('will-quit', () => {
  if (restartRequested) app.exit(PDFE_RESTART_EXIT)
})
void start().catch((error) => {
  console.error('[pdfe] startup failed', error)
  app.exit(1)
})
