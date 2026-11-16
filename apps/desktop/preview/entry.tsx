import { installPreviewBridge, PREVIEW_DIAGNOSTIC_EVENT, previewInstanceGeneration } from './bridge.ts'
import { isPdfeEnvironmentDiagnostic } from '../src/pdfe.ts'
import { PREVIEW_CATALOG } from './catalog.ts'
import zh from './locales/zh.json'
import en from './locales/en.json'
import { previewPdfFrames } from './pdf.ts'

const ALLOWED_NAVIGATION_PROTOCOLS = new Set(['http:', 'https:'])

export function protectPreviewNavigation(): void {
  document.addEventListener(
    'click',
    (event) => {
      const target = event.target instanceof Element ? event.target.closest('a[href]') : null
      if (!(target instanceof HTMLAnchorElement)) return
      const url = new URL(target.href, window.location.href)
      if (
        !target.hasAttribute('download') &&
        ALLOWED_NAVIGATION_PROTOCOLS.has(url.protocol) &&
        url.origin === window.location.origin
      )
        return
      event.preventDefault()
      event.stopImmediatePropagation()
      const detail = { kind: 'navigation-blocked', protocol: url.protocol, origin: url.origin }
      console.warn('[preview-navigation]', detail)
      window.dispatchEvent(new CustomEvent(PREVIEW_DIAGNOSTIC_EVENT, { detail }))
    },
    true
  )
}

async function startPreview(): Promise<void> {
  if (!window.pdfe) throw new Error((navigator.language.startsWith('zh') ? zh : en).nativeRequired)
  protectPreviewNavigation()
  const query = new URLSearchParams(window.location.search)
  const pageId =
    query.get('page') ??
    PREVIEW_CATALOG.find(
      (page) =>
        page.id === query.get('scene') ||
        page.scenarios.some((scene) => scene.id === query.get('scene'))
    )?.id ??
    PREVIEW_CATALOG[0].id
  await installPreviewBridge()
  const scene = PREVIEW_CATALOG.find((page) => page.id === pageId)?.scenarios.find((item) => item.id === query.get('scene'))
  if (scene?.simulation?.browser?.surface?.paperPdf) {
    window.scholarseed.browser.frames = previewPdfFrames(window.scholarseed.browser)
  }
  const native = window.pdfe
  const generation = previewInstanceGeneration()
  window.addEventListener(PREVIEW_DIAGNOSTIC_EVENT, (event) => {
    const code: unknown = event instanceof CustomEvent ? event.detail?.kind : undefined
    if (isPdfeEnvironmentDiagnostic(code)) void native.recordDiagnosticEnvironment(generation, code)
      .catch(() => console.warn('[pdfe] environment diagnostic rejected'))
  })
  if (window.pdfe?.kind === 'product') {
    const { mountPreviewHost } = await import('./host')
    mountPreviewHost(pageId)
    return
  }
  const { mountConsole } = await import('./Console')
  mountConsole()
}

void startPreview().catch((error: unknown) => {
  console.error('[preview-startup]', error)
  const message = document.createElement('p')
  message.setAttribute('role', 'alert')
  message.textContent = (navigator.language.startsWith('zh') ? zh : en).startupFailed
  const diagnostic = document.createElement('pre')
  diagnostic.textContent = error instanceof Error ? error.message : String(error)
  document.getElementById('root')?.replaceChildren(message, diagnostic)
})
