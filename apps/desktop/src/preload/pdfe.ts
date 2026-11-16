import { contextBridge, ipcRenderer } from 'electron'
import { PDFE_CHANNEL, type PdfeNativeBridge, type PdfeScreenshot } from '../pdfe'
import {
  OFFICE_FONT_CATALOG_CHANNEL,
  OFFICE_FONT_READ_CHANNEL,
  OFFICE_FONT_CACHE_READ_CHANNEL,
  OFFICE_FONT_CACHE_WRITE_CHANNEL,
} from '../fonts'
import { WINDOW_FULLSCREEN_CHANNEL } from '../window'

if (process.isMainFrame) {
  const boot = ipcRenderer.sendSync(PDFE_CHANNEL.boot) as Pick<
    PdfeNativeBridge,
    'kind' | 'platform' | 'systemVersion' | 'version' | 'fullscreen' | 'dock'
  > & { iterationWritable?: boolean; restartAvailable?: boolean }
  if (!boot || (boot.kind !== 'product' && boot.kind !== 'controls'))
    throw new Error('PDFE native bootstrap denied')
  const { iterationWritable, restartAvailable, ...surface } = boot
  const bridge: PdfeNativeBridge = {
    ...surface,
    openScenario: (target) => ipcRenderer.invoke(PDFE_CHANNEL.open, target),
    reload: () => ipcRenderer.invoke(PDFE_CHANNEL.reload),
    hideControls: () => ipcRenderer.invoke(PDFE_CHANNEL.hide),
    setDock: (mode) => ipcRenderer.invoke(PDFE_CHANNEL.dock, mode),
    resizeControls: (width) => ipcRenderer.invoke(PDFE_CHANNEL.resize, width),
    recordDiagnosticEnvironment: (generation, code) =>
      ipcRenderer.invoke(PDFE_CHANNEL.diagnosticEnvironment, generation, code),
    ...(boot.kind === 'controls'
      ? {
          copyScene: (target, locale) => ipcRenderer.invoke(PDFE_CHANNEL.copyScene, target, locale),
          captureScreenshot: () => ipcRenderer.invoke(PDFE_CHANNEL.captureScreenshot),
          ...(restartAvailable ? { restart: () => ipcRenderer.invoke(PDFE_CHANNEL.restart) } : {}),
          readDiagnostics: () => ipcRenderer.invoke(PDFE_CHANNEL.diagnostics),
          copyDiagnostics: (generation, sequences) =>
            ipcRenderer.invoke(PDFE_CHANNEL.copyDiagnostics, generation, sequences),
          readIterations: () => ipcRenderer.invoke(PDFE_CHANNEL.iterations),
        }
      : {
          copyScreenshot: (id, bytes) => ipcRenderer.invoke(PDFE_CHANNEL.copyScreenshot, id, bytes),
          closeScreenshot: (id) => ipcRenderer.invoke(PDFE_CHANNEL.closeScreenshot, id),
          onScreenshotCaptured: (callback) => {
            const receive = (_event: unknown, capture: PdfeScreenshot): void => callback(capture)
            ipcRenderer.on(PDFE_CHANNEL.screenshotCaptured, receive)
            return () => ipcRenderer.removeListener(PDFE_CHANNEL.screenshotCaptured, receive)
          },
        }),
    ...(boot.kind === 'controls' && iterationWritable
      ? {
          saveIteration: (revision, edit) =>
            ipcRenderer.invoke(PDFE_CHANNEL.saveIteration, revision, edit),
          setIterationDraft: (dirty, locale) =>
            ipcRenderer.invoke(PDFE_CHANNEL.iterationDraft, dirty, locale),
        }
      : {}),
    onDockChange: (callback) => {
      const receive = (_event: unknown, mode: PdfeNativeBridge['dock']): void => callback(mode)
      ipcRenderer.on(PDFE_CHANNEL.dockChanged, receive)
      return () => ipcRenderer.removeListener(PDFE_CHANNEL.dockChanged, receive)
    },
    onFullscreenChange: (callback) => {
      const receive = (_event: unknown, value: boolean): void => callback(value)
      ipcRenderer.on(WINDOW_FULLSCREEN_CHANNEL, receive)
      return () => ipcRenderer.removeListener(WINDOW_FULLSCREEN_CHANNEL, receive)
    },
    requestOfficeFontAccess: async () => {
      await ipcRenderer.invoke(OFFICE_FONT_CATALOG_CHANNEL)
      return true
    },
    listOfficeFonts: () => ipcRenderer.invoke(OFFICE_FONT_CATALOG_CHANNEL),
    readOfficeFont: (id) => ipcRenderer.invoke(OFFICE_FONT_READ_CHANNEL, id),
    readOfficeFontCache: (fingerprint) =>
      ipcRenderer.invoke(OFFICE_FONT_CACHE_READ_CHANNEL, fingerprint),
    writeOfficeFontCache: (fingerprint, cache) =>
      ipcRenderer.invoke(OFFICE_FONT_CACHE_WRITE_CHANNEL, fingerprint, cache),
  }
  contextBridge.exposeInMainWorld('pdfe', bridge)
}
