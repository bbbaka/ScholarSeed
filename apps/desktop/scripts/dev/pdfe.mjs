import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import { build } from 'esbuild'
import { createServer } from 'vite'
import { PREVIEW_CATALOG } from '../../preview/catalog.ts'
import { pdfeSceneClipboard } from '../../preview/collaboration.ts'
import i18next from 'i18next'
import zh from '../../preview/locales/zh.json' with { type: 'json' }
import en from '../../preview/locales/en.json' with { type: 'json' }
import { PREVIEW_ORIGIN } from '../../preview/constants.ts'
import { createPreviewDiagnosticAccess, PREVIEW_DIAGNOSTIC_ACCESS_PLUGIN } from '../../preview/access.ts'
import { PDFE_DIAGNOSTIC_ENV, PDFE_RESTART_ENV, PDFE_RESTART_EXIT } from '../../src/pdfe.ts'
import { PDFE_ITERATION_EDIT_ENV, PDFE_ITERATION_WORKTREE_ENV } from '../../src/iterations.ts'

const require = createRequire(import.meta.url)
const { acquire } = require('../../../../scripts/shared/lease.cjs')
const { launchLong } = require('../../../../scripts/shared/execution.cjs')
const { prepareNative, readNative } = require('../cd/seal.cjs')
const { ensurePrivateDirectory } = require('../shared/build-state.cjs')
const { artifactCache, matches } = require('../../../../scripts/shared/artifacts.cjs')
const nativePolicy = require('../../native/toolchain.json')
const desktop = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const artifactRoot = path.join(desktop, 'test-results', 'pdfe-native')
const OS_ENVIRONMENT = /^(PATH|HOME|USER|LOGNAME|SHELL|TMPDIR|TMP|TEMP|LANG|LC_.*|SystemRoot|WINDIR|COMSPEC|USERPROFILE|LOCALAPPDATA|APPDATA|DISPLAY|WAYLAND_DISPLAY|XDG_.*|DBUS_SESSION_BUS_ADDRESS)$/i
export const pdfeEnvironment = (environment = process.env) => Object.fromEntries(Object.entries(environment).filter(([key]) => OS_ENVIRONMENT.test(key)))

export async function createPdfeServer(serverOptions) {
  const access = createPreviewDiagnosticAccess()
  const server = await createServer({
    configFile: path.join(desktop, 'vite.preview.config.ts'),
    clearScreen: false,
    server: serverOptions,
    plugins: [{
      name: PREVIEW_DIAGNOSTIC_ACCESS_PLUGIN,
      api: { authorizeDiagnostics: access.authorize },
    }],
  })
  return { server, grantDiagnostics: access.grant }
}

function pdfeWorktree() {
  try {
    const root = fs.realpathSync(path.resolve(desktop, '../..'))
    const top = execFileSync('git', ['-C', root, 'rev-parse', '--show-toplevel'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true })
    return fs.realpathSync(top.trimEnd()) === root ? root : undefined
  } catch {
    return undefined
  }
}

export function pdfeLaunchEnvironment(grant, environment, editIterations = false) {
  const root = pdfeWorktree()
  return {
    ...pdfeEnvironment(environment),
    [PDFE_DIAGNOSTIC_ENV]: grant.secret,
    ...(root ? { [PDFE_ITERATION_WORKTREE_ENV]: root } : {}),
    ...(root && editIterations && process.platform === 'darwin' ? { [PDFE_ITERATION_EDIT_ENV]: '1' } : {}),
  }
}

async function cachedNativeInputs() {
  const inputs = {}
  const selected = { headers: nativePolicy.headers, license: nativePolicy.license, ...(process.platform === 'win32' ? { compiler: nativePolicy.windows.compiler, library: nativePolicy.windows.library } : {}) }
  for (const [key, artifact] of Object.entries(selected)) {
    const filename = path.join(artifactCache(), artifact.sha256)
    if (!await matches(filename, artifact)) throw new Error('PDFE native prerequisite is not cached: ' + artifact.filename)
    inputs[key] = filename
  }
  return inputs
}

export async function buildPdfe(origin = PREVIEW_ORIGIN) {
  execFileSync(process.execPath, [path.join(desktop, 'scripts/pre/security.cjs'), '--check'], { cwd: desktop, stdio: 'inherit' })
  const artifacts = await cachedNativeInputs()
  ensurePrivateDirectory(artifactRoot)
  const output = fs.mkdtempSync(path.join(artifactRoot, 'run-'))
  const application = path.join(output, 'app')
  fs.mkdirSync(application, { mode: 0o700 })
  const packageJson = JSON.parse(fs.readFileSync(path.join(desktop, 'package.json'), 'utf8'))
  const manifest = {
    schema: 1, origin, instance: randomUUID(),
    initial: { pageId: 'page-home', sceneId: 'home-browse' },
    pages: PREVIEW_CATALOG.map(page => ({ id: page.id, scenes: page.scenarios.map(scene => scene.id), available: Boolean(page.target || page.host), components: page.launch?.kind === 'components' })),
  }
  fs.writeFileSync(path.join(application, 'package.json'), JSON.stringify({ name: 'scholarseed-pdfe', version: packageJson.version, main: 'main.cjs' }), { mode: 0o600, flag: 'wx' })
  fs.writeFileSync(path.join(application, 'pdfe.json'), JSON.stringify(manifest), { mode: 0o600, flag: 'wx' })
  const localization = i18next.createInstance()
  await localization.init({ lng: 'zh', fallbackLng: 'zh', resources: { zh: { translation: zh }, en: { translation: en } } })
  const clipboard = Object.fromEntries(['zh', 'en'].map(locale => [
    locale,
    Object.fromEntries(PREVIEW_CATALOG.flatMap(page => page.scenarios.map(scene => [
      JSON.stringify([page.id, scene.id]), pdfeSceneClipboard(page, scene, localization.getFixedT(locale))
    ])))
  ]))
  fs.writeFileSync(path.join(application, 'pdfe-clipboard.json'), JSON.stringify(clipboard), { mode: 0o600, flag: 'wx' })
  await build({ entryPoints: [path.join(desktop, 'src/main/pdfe.ts')], outfile: path.join(application, 'main.cjs'), bundle: true, platform: 'node', format: 'cjs', external: ['electron', './lease.node', './fonts.node'], sourcemap: true })
  await build({ entryPoints: [path.join(desktop, 'src/preload/pdfe.ts')], outfile: path.join(application, 'preload.cjs'), bundle: true, platform: 'node', format: 'cjs', external: ['electron'], sourcemap: true })
  const nativeDirectory = path.join(output, 'native')
  const frozen = await prepareNative({ directory: nativeDirectory, signing: { mode: process.platform === 'darwin' ? 'ad-hoc-local-only' : 'unsigned-dev' }, runContract: false, artifacts })
  const libraries = readNative(nativeDirectory, frozen)
  for (const [name, bytes] of libraries) fs.writeFileSync(path.join(application, name), bytes, { mode: 0o600, flag: 'wx' })
  console.log('[pdfe] application ' + application)
  return application
}

export async function main(args = process.argv.slice(2)) {
  if (args.length && (args.length !== 1 || !['--build-only', '--edit-iterations'].includes(args[0])))
    throw new Error('Usage: pdfe.mjs [--build-only | --edit-iterations]')
  const lease = acquire({ mode: 'read', resources: [path.join(desktop, 'node_modules')] })
  let server
  let diagnosticGrant
  let releaseAllowed = true
  try {
    if (args[0] === '--build-only') {
      await buildPdfe()
      return
    }
    const runtime = await createPdfeServer()
    server = runtime.server
    await server.listen()
    const executable = require('electron')
    while (true) {
      const application = await buildPdfe()
      const manifest = JSON.parse(fs.readFileSync(path.join(application, 'pdfe.json'), 'utf8'))
      diagnosticGrant = runtime.grantDiagnostics(manifest.instance)
      try {
        const result = await launchLong(executable, [application], {
          cwd: desktop,
          env: { ...pdfeLaunchEnvironment(diagnosticGrant, process.env, args[0] === '--edit-iterations'), [PDFE_RESTART_ENV]: '1' },
        })
        releaseAllowed = result.shutdownConfirmed
        break
      } catch (error) {
        if (error.code === 'CHILD_EXIT' && error.exitCode === PDFE_RESTART_EXIT && !error.signal) {
          diagnosticGrant.revoke()
          diagnosticGrant = undefined
          continue
        }
        releaseAllowed = error.shutdownConfirmed !== false
        throw error
      }
    }
  } finally {
    diagnosticGrant?.revoke()
    await server?.close()
    if (releaseAllowed) lease.release()
    else console.error('[pdfe] native process shutdown unconfirmed; dependency lease retained')
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error('[pdfe] ' + error.message); process.exitCode = error.exitCode ?? 1 })
}
