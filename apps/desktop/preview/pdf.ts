import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist/legacy/build/pdf.mjs'
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'
import sampleUrl from './fixtures/psydepth.pdf?url'
import {
  BROWSER_ERROR,
  type BrowserBridge,
  type BrowserFrame,
  type BrowserFrameBridge,
} from '../src/browser.ts'
import { previewPaperPage } from './browser.ts'

const HEADER_HEIGHT = 32
const PAGE_MARGIN = 16
const MAX_WIDTH = 1100

export function previewPdfFrames(browser: BrowserBridge): BrowserFrameBridge {
  GlobalWorkerOptions.workerSrc = workerUrl
  let documentTask: ReturnType<typeof getDocument> | undefined
  let sequence = 0
  const listeners = new Set<(frame: BrowserFrame) => void>()
  const positions = new Map<
    string,
    { width: number; height: number; offset: number; revision: number }
  >()
  const render = async (tabId: string) => {
    const position = positions.get(tabId)
    if (!position) return { ok: false as const, error: BROWSER_ERROR.targetClosed }
    const revision = ++position.revision
    try {
      const reply = await browser.snapshot()
      if (!reply.ok) return reply
      const tab = reply.snapshot.tabs.find((item) => item.tabId === tabId)
      const pageNumber = tab && previewPaperPage(tab.url)
      if (!pageNumber) return { ok: false as const, error: BROWSER_ERROR.permissionDenied }
      documentTask ??= getDocument({ url: sampleUrl })
      const document = await documentTask.promise
      const page = await document.getPage(pageNumber)
      const original = page.getViewport({ scale: 1 })
      const width = Math.min(MAX_WIDTH, Math.max(1, position.width - PAGE_MARGIN * 2))
      const pageViewport = page.getViewport({ scale: width / original.width })
      const pageCanvas = window.document.createElement('canvas')
      pageCanvas.width = Math.ceil(pageViewport.width)
      pageCanvas.height = Math.ceil(pageViewport.height)
      await page.render({ canvas: pageCanvas, viewport: pageViewport }).promise
      if (revision !== position.revision) return { ok: true as const }
      position.offset = Math.min(
        Math.max(0, position.offset),
        Math.max(0, pageCanvas.height - position.height + HEADER_HEIGHT)
      )
      const canvas = window.document.createElement('canvas')
      canvas.width = position.width
      canvas.height = position.height
      const context = canvas.getContext('2d')!
      context.fillStyle = '#e8e8e8'
      context.fillRect(0, 0, canvas.width, canvas.height)
      context.drawImage(
        pageCanvas,
        (canvas.width - pageCanvas.width) / 2,
        HEADER_HEIGHT - position.offset
      )
      context.fillStyle = '#303030'
      context.fillRect(0, 0, canvas.width, HEADER_HEIGHT)
      context.fillStyle = '#ffffff'
      context.font = '14px sans-serif'
      context.fillText(
        `PDFE PDF preview · ${pageNumber} / ${document.numPages} · arXiv:2611.09061`,
        PAGE_MARGIN,
        21
      )
      const frame: BrowserFrame = {
        tabId,
        sequence: ++sequence,
        data: canvas.toDataURL('image/png').split(',')[1],
        format: 'png',
        width: canvas.width,
        height: canvas.height,
      }
      for (const listener of listeners) listener(frame)
      return { ok: true as const }
    } catch {
      return { ok: false as const, error: BROWSER_ERROR.navigationFailed }
    }
  }
  return {
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    acknowledge: async () => ({ ok: true }),
    resize: async (tabId, width, height) => {
      positions.set(tabId, {
        width,
        height,
        offset: positions.get(tabId)?.offset ?? 0,
        revision: 0,
      })
      return render(tabId)
    },
    input: async (tabId, input) => {
      const position = positions.get(tabId)
      if (!position) return { ok: false, error: BROWSER_ERROR.targetClosed }
      if (input.kind === 'wheel') position.offset += input.deltaY
      else if (input.kind === 'key' && input.type === 'keyDown') {
        if (input.key === 'PageDown') position.offset += position.height - HEADER_HEIGHT
        else if (input.key === 'PageUp') position.offset -= position.height - HEADER_HEIGHT
        else return { ok: true }
      } else return { ok: true }
      return render(tabId)
    },
  }
}
