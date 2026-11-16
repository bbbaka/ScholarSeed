import React, { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Button, Collapsible, CollapsibleContent, CollapsibleTrigger, Dialog, DialogContent, DialogDescription, DialogHeader, DialogPortal, DialogTitle, SearchBox, Tabs, TabsContent, TabsList, TabsTrigger } from '../src/renderer/src/components/ui'
import { LocalizationProvider, rendererLocalization } from '../src/renderer/src/app/localization'
import { useThemeEffect } from '../src/renderer/src/theme'
import { PREVIEW_HOME } from './home.ts'
import '../src/renderer/src/styles.css'
import type { PreferenceLanguage, PreferenceTheme, RendererPreferences } from '../src/preferences.ts'
import { rendererLanguagePatch } from '../src/preferences.ts'
import { PREVIEW_CATALOG, type PreviewScenario } from './catalog.ts'
import { DEFAULT_PREVIEW_SCENE, PREVIEW_INSTANCE_PARAMETER, PREVIEW_SCENE_PARAMETER, previewPreferenceWrite, previewStatePath } from './bridge.ts'
import zh from './locales/zh.json'
import en from './locales/en.json'
import type { PdfeDiagnosticStatus } from '../src/pdfe.ts'
import type { PdfeIterationEdit, PdfeIterationSaveResult, PdfeIterationSnapshot } from '../src/iterations.ts'
import { PREVIEW_ARCHIVE } from './archive.ts'
import { PREVIEW_BROWSER } from './browser.ts'
import { PREVIEW_ARTIFACTS } from './publications.ts'
import { PREVIEW_STORAGE_READ } from './directory.ts'
import { PREVIEW_BROWSING } from './listing.ts'
import { PREVIEW_CONTENT } from './content.ts'
import { PREVIEW_SCHEDULE_RECOVERY } from './constants.ts'
import { pdfeFeatureTarget, pdfeGuidance, pdfeNavigationPages, pdfeTitle, pdfeStateLabel, type PdfeTranslate } from './collaboration.ts'
import { PdfeNavigation } from './Navigation'
import { PdfeHeader } from './Header'
import { PdfeDivider } from './Divider'
import { PdfeControls } from './Controls'
import { PdfeIterationFilter } from './Filter'
import { PdfeRequests } from './Requests'
import { PdfeIterationsPanel } from './IterationsPanel'
import { PDFE_ITERATION_DEFAULT, PDFE_ITERATION_INITIAL, PDFE_ITERATION_STORAGE, reducePdfeIterations } from './iterations.ts'
import { pdfeIterationPages } from './collaboration.ts'
import { isPreviewLoginMode, PREVIEW_LOGIN, type PreviewAccountBootstrap, type PreviewLoginMode } from './accounts.ts'

const PREVIEW_NAMESPACE = 'preview'
const PREVIEW_PAGE_PARAMETER = 'page'
const PREVIEW_CONSOLE_ROOT_ID = 'scholarseed-preview-console'
const CONSOLE_PANEL_CLASS = 'grid min-h-0 min-w-0 grid-cols-1 content-start gap-[var(--vds-space-4)] overflow-auto break-words text-[length:var(--vds-font-body-lv2)] leading-[var(--vds-lh-body-lv2)] text-[var(--vds-text-primary)]'
const SECTION_CLASS = 'grid min-w-0 grid-cols-1 gap-[var(--vds-space-2)]'
const FEATURE_TARGET_PREFIX = 'pdfe-feature-target:'
const DIAGNOSTIC_REFRESH_INTERVAL_MS = 1000
type PreviewKey = keyof typeof zh
const RECOVERY_CONTROLS: readonly { id: string; path: string; label: PreviewKey; scope: PreviewKey; available: (simulation: PreviewScenario['simulation'], scenario?: PreviewScenario) => boolean }[] = [
  { id: 'preview-schedules-recover', path: PREVIEW_SCHEDULE_RECOVERY, label: 'scheduleRecovery', scope: 'scheduleRecoveryScope', available: simulation => simulation?.schedules === 'read-failure' },
  { id: 'preview-home-projects-recover', path: PREVIEW_HOME.recoveryPath, label: 'homeProjectRecovery', scope: 'homeProjectRecoveryScope', available: (_simulation, scenario) => scenario?.home?.projectRead === 'failed' },
  { id: 'preview-content-recover', path: PREVIEW_CONTENT.recoveryPath, label: 'contentRecovery', scope: 'contentRecoveryScope', available: simulation => simulation?.contentRead?.mode === 'failed' },
  { id: 'preview-browsing-recover', path: PREVIEW_BROWSING.recoveryPath, label: 'browsingRecovery', scope: 'browsingRecoveryScope', available: simulation => [simulation?.browsing?.listingRead, simulation?.browsing?.explorerRead].includes('failed') },
  { id: 'preview-storage-recover', path: PREVIEW_STORAGE_READ.recoveryPath, label: 'storageRecovery', scope: 'storageRecoveryScope', available: simulation => [simulation?.storage?.homeRead, simulation?.storage?.workspaceRead].includes('failed') },
  { id: 'preview-artifacts-recover', path: PREVIEW_ARTIFACTS.recoveryPath, label: 'artifactRecovery', scope: 'artifactRecoveryScope', available: simulation => [simulation?.artifacts?.catalogRead, simulation?.artifacts?.historyRead, simulation?.artifacts?.contentRead].includes('failed') },
  { id: 'preview-archive-recover', path: PREVIEW_ARCHIVE.recoveryPath, label: 'archiveRecovery', scope: 'archiveRecoveryScope', available: simulation => simulation?.archives?.projectRead === 'failed' },
  { id: 'preview-browser-recover', path: PREVIEW_BROWSER.recoveryPath, label: 'browserRecovery', scope: 'browserRecoveryScope', available: simulation => simulation?.browser?.policyRead === 'failed' },
]

rendererLocalization.addResourceBundle('zh', PREVIEW_NAMESPACE, zh, true, true)
rendererLocalization.addResourceBundle('en', PREVIEW_NAMESPACE, en, true, true)
const translate = rendererLocalization.getFixedT(null, PREVIEW_NAMESPACE as never) as unknown as PdfeTranslate

async function request(path: string, init?: RequestInit): Promise<{ preferences: RendererPreferences; login?: PreviewLoginMode; account?: PreviewAccountBootstrap }> {
  const response = await fetch(path, { ...init, credentials: 'omit' })
  if (!response.ok) throw new Error(`Preview console request failed: ${response.status}`)
  return response.json()
}

function PreviewConsole(): React.JSX.Element {
  const native = window.pdfe
  if (native?.kind !== 'controls') throw new Error('PDFE control window required')
  useThemeEffect(window.scholarseed.preferences.theme)
  const url = new URL(window.location.href)
  const instance = url.searchParams.get(PREVIEW_INSTANCE_PARAMETER) ?? ''
  const currentScene = url.searchParams.get(PREVIEW_SCENE_PARAMETER) ?? DEFAULT_PREVIEW_SCENE
  const initialPage = PREVIEW_CATALOG.find((page) => page.id === url.searchParams.get(PREVIEW_PAGE_PARAMETER))
    ?? PREVIEW_CATALOG.find((page) => page.id === currentScene || page.scenarios.some((scenario) => scenario.id === currentScene))
    ?? PREVIEW_CATALOG[0]
  const materials = initialPage.launch?.kind === 'components'
  const [section, setSection] = useState(materials ? 'materials' : 'features')
  const featuresOpen = section === 'features'
  const showSharedControls = featuresOpen || section === 'materials'
  const featureTargetKey = FEATURE_TARGET_PREFIX + instance
  useEffect(() => {
    if (!materials) sessionStorage.setItem(featureTargetKey, JSON.stringify({ pageId: initialPage.id, sceneId: currentScene }))
  }, [materials, featureTargetKey, initialPage.id, currentScene])
  const changeOpen = (value: boolean): void => {
    if (!value) void native.hideControls()
  }
  const [helpOpen, setHelpOpen] = useState(false)
  const [screenshotFailed, setScreenshotFailed] = useState(false)
  const [dock, setDock] = useState(native.dock)
  useEffect(() => native.onDockChange(setDock), [native])
  const [pageId, setPageId] = useState(initialPage.id)
  const [query, setQuery] = useState('')
  const iterationKey = PDFE_ITERATION_STORAGE + instance
  const [iterations, dispatchIterations] = useReducer(reducePdfeIterations, PDFE_ITERATION_INITIAL)
  const iteration = iterations.filter
  const searchTerm = query.trim().toLocaleLowerCase()
  const autoExpandKey = searchTerm || iteration.version !== PDFE_ITERATION_DEFAULT.version
    ? JSON.stringify([searchTerm, iteration.version, iteration.scope]) : null
  const iterationManifest = iterations.snapshot?.manifest ?? null
  const iterationRequest = useRef(0)
  const [iterationDraft, setIterationDraft] = useState(false)
  const refreshIterations = useCallback(async (): Promise<PdfeIterationSnapshot | undefined> => {
    const sequence = ++iterationRequest.current
    dispatchIterations({ type: 'start', request: sequence })
    try {
      if (!native.readIterations) throw new Error('PDFE iteration bridge unavailable')
      const snapshot = await native.readIterations()
      if (sequence !== iterationRequest.current) return
      dispatchIterations({
        type: 'loaded', request: sequence, snapshot, storedFilter: sessionStorage.getItem(iterationKey),
      })
      return snapshot
    } catch {
      if (sequence === iterationRequest.current) dispatchIterations({ type: 'failed', request: sequence })
    }
  }, [native, iterationKey])
  useEffect(() => {
    void refreshIterations()
    return () => { iterationRequest.current++ }
  }, [refreshIterations])
  useEffect(() => {
    if (iterationManifest) sessionStorage.setItem(iterationKey, JSON.stringify(iteration))
  }, [iterationKey, iterationManifest, iteration])
  const selectedPage = PREVIEW_CATALOG.find((page) => page.id === pageId) ?? initialPage
  const selectedScenario = selectedPage.scenarios.find((scenario) => scenario.id === currentScene) ?? selectedPage.scenarios[0]
  const guidance = pdfeGuidance(selectedPage, selectedScenario, translate)
  const currentScenario = initialPage.scenarios.find((scenario) => scenario.id === currentScene)
  const accountControl = true
  const matches = pdfeNavigationPages(pdfeIterationPages(iterationManifest, PREVIEW_CATALOG, iteration), query, translate)
  const [theme, setTheme] = useState<PreferenceTheme>(window.scholarseed.preferences.theme)
  const [language, setLanguage] = useState<PreferenceLanguage>(window.scholarseed.preferences.language)
  const copyScene = native.copyScene
  const trackIterationDraft = useCallback((dirty: boolean): void => {
    setIterationDraft(dirty)
    void native.setIterationDraft?.(dirty, language).catch(() => setError(true))
  }, [language, native])
  const saveIteration = async (revision: string, edit: PdfeIterationEdit): Promise<PdfeIterationSaveResult> => {
    if (!native.saveIteration) return { status: 'unavailable' }
    let result: PdfeIterationSaveResult
    try { result = await native.saveIteration(revision, edit) }
    catch { result = { status: 'unknown' } }
    if (result.status === 'saved' || result.status === 'unknown' || result.status === 'conflict') {
      const sequence = ++iterationRequest.current
      dispatchIterations({ type: 'start', request: sequence })
      if (result.status === 'saved') dispatchIterations({
        type: 'loaded', request: sequence, snapshot: result.snapshot, storedFilter: sessionStorage.getItem(iterationKey),
      })
      else dispatchIterations({ type: 'failed', request: sequence })
    }
    return result
  }
  const [login, setLogin] = useState<PreviewLoginMode>()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState(false)
  const [activity, setActivity] = useState<PdfeDiagnosticStatus | null>(null)
  const [diagnosticPending, setDiagnosticPending] = useState(false)
  const [diagnosticFailed, setDiagnosticFailed] = useState(false)
  useEffect(() => {
    if (section !== 'requests') return
    let active = true
    let timer: ReturnType<typeof setTimeout> | undefined
    const refresh = async (): Promise<void> => {
      if (!active) return
      try {
        if (!native.readDiagnostics) throw new Error('PDFE diagnostic bridge unavailable')
        const snapshot = await native.readDiagnostics()
        if (snapshot.pageId !== initialPage.id || snapshot.scene !== currentScene)
          throw new Error('PDFE diagnostic target changed')
        if (active) {
          setActivity(snapshot)
          setDiagnosticFailed(false)
        }
      } catch {
        if (active) setDiagnosticFailed(true)
      } finally {
        if (active) {
          setDiagnosticPending(false)
          timer = setTimeout(() => void refresh(), DIAGNOSTIC_REFRESH_INTERVAL_MS)
        }
      }
    }
    setDiagnosticPending(true)
    void refresh()
    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [section, native, initialPage.id, currentScene])
  useEffect(() => {
    document.title = translate('title')
  }, [])
  useEffect(() => {
    if (!accountControl) return
    let active = true
    void request(previewStatePath(instance, currentScene, initialPage.id)).then(state => {
      if (!isPreviewLoginMode(state.login)) throw new Error('Invalid preview login control state')
      if (active) setLogin(state.login)
    }).catch(failure => {
      if (active) { setError(true); console.error('[preview-console]', failure) }
    })
    return () => { active = false }
  }, [accountControl, instance, currentScene, initialPage.id])

  const run = async (action: () => Promise<void>): Promise<void> => {
    setPending(true)
    setError(false)
    try { await action() } catch (failure) { setError(true); console.error('[preview-console]', failure) } finally { setPending(false) }
  }
  const reset = async (scene: string, targetPage: string): Promise<void> => {
    await native.openScenario({ pageId: targetPage, sceneId: scene })
  }
  const saveAppearance = async (patch: Partial<Pick<RendererPreferences, 'theme' | 'language' | 'languageMode'>>): Promise<void> => {
    const saved = await request(previewStatePath(instance, currentScene, initialPage.id), { method: 'POST', headers: { 'content-type': 'application/json' }, body: previewPreferenceWrite(patch, Object.keys(patch) as (keyof typeof patch)[]) })
    setTheme(saved.preferences.theme)
    setLanguage(saved.preferences.language)
    await native.reload()
  }
  const components = PREVIEW_CATALOG.find(page => page.launch?.kind === 'components')
  const restart = native.restart
  const captureScreenshot = async (): Promise<void> => {
    if (!native.captureScreenshot) return
    setScreenshotFailed(false)
    setPending(true)
    try {
      await native.captureScreenshot()
    } catch {
      setScreenshotFailed(true)
    } finally {
      setPending(false)
    }
  }
  return <Dialog modal={false} open onOpenChange={changeOpen}>
    <div id={PREVIEW_CONSOLE_ROOT_ID} className="h-full min-h-0 min-w-0 overflow-hidden">
        <DialogContent hideCloseButton aria-label={translate('title')} className="!relative !top-auto !left-auto !h-full !w-full !max-w-none !transform-none !rounded-none !border-0 !shadow-none grid-rows-[minmax(0,1fr)] overflow-hidden">
          {dock === 'docked' && <PdfeDivider label={translate('resizeWorkbench')} onResize={native.resizeControls} onError={() => setError(true)} />}
          <Tabs value={section} disabled={pending} className="!grid min-h-0 min-w-0 grid-rows-[auto_auto_auto_minmax(0,1fr)] gap-[var(--vds-space-4)]" onValueChange={next => {
            if (iterationDraft && next !== section) return
            if (next === 'materials' && !materials && components) void run(() => reset(components.scenarios[0].id, components.id))
            else if (next === 'features' && materials) void run(() => native.openScenario(pdfeFeatureTarget(sessionStorage.getItem(featureTargetKey))))
            else setSection(next)
          }}>
          <div>
            <PdfeHeader dock={dock} pending={pending} translate={translate} onHelp={() => setHelpOpen(true)} onDock={() => void run(() => native.setDock(dock === 'docked' ? 'detached' : 'docked'))} onReload={() => void run(() => native.reload())} onScreenshot={native.captureScreenshot ? () => void captureScreenshot() : undefined} onRestart={restart ? () => void run(restart) : undefined} />
            {screenshotFailed && <p role="alert">{translate('screenshotFailed')}</p>}
          </div>
          <TabsList aria-label={translate('workbenchSections')} className="w-full">
            <TabsTrigger value="features" className="min-w-0 flex-1 whitespace-normal">{translate('featureSection')}</TabsTrigger>
            <TabsTrigger value="materials" data-testid="preview-components" className="min-w-0 flex-1 whitespace-normal">{translate('componentsEntry')}</TabsTrigger>
            <TabsTrigger value="requests" className="min-w-0 flex-1 whitespace-normal">{translate('diagnosticTab')}</TabsTrigger>
            <TabsTrigger value="iterations" className="min-w-0 flex-1 whitespace-normal">{translate('iterationMaintenance')}</TabsTrigger>
          </TabsList>
          <div className={SECTION_CLASS}>
            {showSharedControls && <>
              <PdfeControls theme={theme} language={language} login={login} accountControl={accountControl} pending={pending} translate={translate} onTheme={theme => void run(() => saveAppearance({ theme }))} onLanguage={language => void run(() => saveAppearance(rendererLanguagePatch(language)))} onLogin={mode => void run(async () => {
                const saved = await request(PREVIEW_LOGIN.path + '?' + new URLSearchParams({ [PREVIEW_INSTANCE_PARAMETER]: instance }), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mode }) })
                if (!isPreviewLoginMode(saved.login)) throw new Error('Invalid preview login control state')
                setLogin(saved.login)
                await native.reload()
              })} />
              {currentScenario?.simulation?.account && <p className="text-[length:var(--vds-font-body-lv3)] text-[var(--vds-text-secondary)]">{translate('loginOverride')}</p>}
            </>}
            {featuresOpen && iterationManifest && <PdfeIterationFilter manifest={iterationManifest} value={iteration} pending={pending} translate={translate} onChange={filter => dispatchIterations({ type: 'filter', filter })} />}
            {featuresOpen && iterations.failed && <p role="status">{translate(iterationManifest ? 'iterationStale' : 'iterationUnavailable')}</p>}
            {featuresOpen && <SearchBox aria-label={translate('discovery')} value={query} onChange={event => setQuery(event.target.value)} placeholder={translate('discoveryPlaceholder')} size="standard" />}
            <p data-testid="preview-current-scene" className="text-[length:var(--vds-font-body-lv3)] leading-[var(--vds-lh-body-lv3)] text-[var(--vds-text-secondary)]">{translate('currentScene')}: {pdfeTitle(initialPage, translate)} · {pdfeTitle(currentScenario ?? initialPage.scenarios[0], translate)}</p>
            {pending && <p role="status">{translate('operationPending')}</p>}
            {error && <p role="alert">{translate('requestFailed')}</p>}
          </div>
          {section === 'requests' && <TabsContent value="requests" className={CONSOLE_PANEL_CLASS}><PdfeRequests key={activity?.generation} snapshot={activity} pending={diagnosticPending} failed={diagnosticFailed} onCopy={native.copyDiagnostics} translate={translate} /></TabsContent>}
          {section === 'iterations' && <TabsContent value="iterations" className={CONSOLE_PANEL_CLASS}><PdfeIterationsPanel
            state={iterations} pages={PREVIEW_CATALOG} onRefresh={refreshIterations}
            onSave={native.saveIteration ? saveIteration : undefined} onDraft={trackIterationDraft} translate={translate}
          /></TabsContent>}
          {section === 'materials' && <TabsContent value="materials" className={CONSOLE_PANEL_CLASS}><section className={SECTION_CLASS} aria-label={translate('componentsEntry')}><h2>{translate('componentsEntry')}</h2><p className="text-[var(--vds-text-secondary)]">{translate('materialsDescription')}</p></section></TabsContent>}
          <TabsContent value="features" className={featuresOpen ? CONSOLE_PANEL_CLASS : 'hidden'}>
            <PdfeNavigation manifest={iterationManifest} pages={matches} selected={selectedPage} activePage={initialPage.id} scene={currentScene} autoExpandKey={autoExpandKey} revealActive={featuresOpen && !iterations.loading} query={query} pending={pending} translate={translate} stateLabel={state => pdfeStateLabel(state, translate)} onSelect={page => setPageId(page.id)} onLaunch={(page, scene) => void run(() => reset(scene, page.id))} onCopy={copyScene ? (reference) => copyScene(reference, language) : undefined} />
            {!matches.length && <p role="status">{translate(iteration.version !== 'all' && !query.trim() ? 'iterationEmpty' : 'discoveryEmpty')}</p>}
            {RECOVERY_CONTROLS.filter(control => control.available(currentScenario?.simulation, currentScenario)).map(control => <Button key={control.id} data-testid={control.id} variant="secondary" disabled={pending} onClick={() => void run(async () => {
              const query = new URLSearchParams({ [PREVIEW_INSTANCE_PARAMETER]: instance })
              await request(control.path + '?' + query, { method: 'POST' })
            })}>{translate(control.label)}</Button>)}
          </TabsContent>
          </Tabs>
            <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
              <DialogPortal><DialogContent aria-label={translate('guide')} className="max-h-[calc(100dvh_-_var(--vds-space-6))] overflow-auto">
                <DialogHeader><DialogTitle>{translate('guide')}</DialogTitle><DialogDescription>{translate('description')}</DialogDescription></DialogHeader>
                <div className={SECTION_CLASS}>
                  <h2>{pdfeTitle(selectedPage, translate)} · {pdfeTitle(selectedScenario, translate)}</h2>
                  {guidance.entry.length > 0 && <section className={SECTION_CLASS}><h3>{translate('entrySteps')}</h3><ol>{guidance.entry.map(step => <li key={step}>{step}</li>)}</ol></section>}
                  <section className={SECTION_CLASS}><h3>{translate('expected')}</h3><ul>{guidance.expected.map(text => <li key={text}>{text}</li>)}</ul><p>{translate(selectedScenario.status)}</p></section>
                  <section className={SECTION_CLASS}><h3>{translate('limitations')}</h3><ul>{guidance.limitations.map(text => <li key={text}>{text}</li>)}</ul></section>
                  {initialPage.pendingStates?.length && <section className={SECTION_CLASS}><h3>{translate('pendingStates')}</h3><p>{initialPage.pendingStates.map(state => pdfeStateLabel(state, translate)).join(' · ')}</p></section>}
                  {RECOVERY_CONTROLS.filter(control => control.available(currentScenario?.simulation, currentScenario)).map(control => <p key={control.id}>{translate(control.scope)}</p>)}
                  <Collapsible>
                    <CollapsibleTrigger asChild><Button variant="ghost" size="content" className="w-full justify-start !whitespace-normal text-left">{translate('guideCommon')}</Button></CollapsibleTrigger>
                    <CollapsibleContent className={SECTION_CLASS}>
                      <p>{translate('guideNavigation')}</p>
                      <p>{translate('sharedFunctions')}</p>
                      <p>{translate('consoleShortcut')}</p>
                      <p>{translate('publicControlScope')}</p>
                      <p>{translate('coverage')}</p>
                      <p>{translate('diagnosticScope')}</p>
                      <p className="break-all">{translate('instance')}: {instance}</p>
                    </CollapsibleContent>
                  </Collapsible>
                </div>
              </DialogContent></DialogPortal>
            </Dialog>
        </DialogContent>
    </div>
  </Dialog>
}

export function mountConsole(): void {
  if (document.getElementById(PREVIEW_CONSOLE_ROOT_ID)) return
  const root = document.getElementById('root')
  if (!root) throw new Error('Preview workbench root is missing')
  root.classList.add('h-dvh', 'min-h-0', 'min-w-0', 'overflow-hidden')
  createRoot(root).render(<LocalizationProvider><PreviewConsole /></LocalizationProvider>)
}
