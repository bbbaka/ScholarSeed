import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { chromium, expect } from '@playwright/test'
import { build } from 'esbuild'

const DESKTOP = fileURLToPath(new URL('../../../../../', import.meta.url))
const TRANSLATIONS = Object.fromEntries(
  ['zh', 'en'].map((language) => [
    language,
    JSON.parse(
      readFileSync(join(DESKTOP, `src/localization/locales/${language}/literature.json`), 'utf8')
    ),
  ])
)

test('discovery reader keeps citations in supporting lists and discussion in the top toolbar', async () => {
  const bundle = await build({
    stdin: {
      resolveDir: DESKTOP,
      loader: 'tsx',
      contents: `
        import React, { useState } from 'react'
        import { createRoot } from 'react-dom/client'
        import { Reader } from './src/renderer/src/features/literature/Reader'
        import { CURATED_PAPERS } from './src/renderer/src/features/literature/recommendations'
        window.language = 'zh'
        function App() {
          const [language, setLanguage] = useState('zh')
          const [discussion, setDiscussion] = useState(false)
          return <>
            <button onClick={() => { window.language = 'en'; setLanguage('en') }}>English</button>
            {discussion && <output>Discussion requested</output>}
            <Reader paper={CURATED_PAPERS.find(paper => paper.id === 'psydepth')}
              admission={() => null} admissionReference={() => null}
              onBack={() => {}} onOriginal={() => {}}
              onDiscuss={() => setDiscussion(true)} scroll={0} onScroll={() => {}} />
          </>
        }
        createRoot(document.getElementById('root')).render(<App />)
      `,
    },
    bundle: true,
    write: false,
    platform: 'browser',
    format: 'iife',
    jsx: 'automatic',
    define: { 'import.meta.env.DEV': 'false' },
    loader: { '.css': 'empty', '.png': 'dataurl', '.svg': 'dataurl', '.webp': 'dataurl' },
    plugins: [
      {
        name: 'discovery-translations',
        setup(builder) {
          builder.onResolve({ filter: /^react-i18next$/ }, () => ({
            path: 'i18n',
            namespace: 'fixture',
          }))
          builder.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({
            loader: 'js',
            contents: `const translations = ${JSON.stringify(TRANSLATIONS)};
            export const useTranslation = () => ({
              i18n: { resolvedLanguage: window.language },
              t: (key, values = {}) => {
                const value = key.split('.').reduce((node, part) => node?.[part], translations[window.language]);
                return typeof value === 'string' ? value.replace(/{{(.*?)}}/g, (_, name) => values[name] ?? '') : key
              }
            })`,
          }))
        },
      },
    ],
  })
  const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || undefined })
  try {
    const page = await browser.newPage()
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.setContent('<div id="root"></div>')
    await page.addScriptTag({ content: bundle.outputFiles[0].text })
    await expect(page.getByRole('link', { name: 'arXiv：2611.09061' })).toBeVisible()
    await expect(page.getByRole('tab', { name: '概述', exact: true })).toHaveAttribute(
      'aria-selected',
      'true'
    )
    await expect(page.locator('aside')).toHaveCount(0)
    await expect(page.locator('article > header [aria-label^="引用"]')).toHaveCount(0)
    await expect(page.getByLabel('引用 3250 次').first()).toBeVisible()
    await expect(page.getByLabel('引用 18 次')).toBeVisible()
    await expect(page.getByRole('heading', { name: /^相关推荐\s*4$/ })).toBeVisible()
    await expect(
      page.getByTestId('discovery-reading').getByRole('button', { name: '与书深 AI 对话' })
    ).toHaveCount(0)
    await page.getByRole('tab', { name: '原文', exact: true }).click()
    await expect(page.getByRole('tab', { name: '原文', exact: true })).toHaveAttribute(
      'aria-selected',
      'true'
    )
    await page.getByRole('button', { name: /^相关推荐\s*4$/ }).click()
    await expect(page.getByLabel('引用 18 次')).not.toBeVisible()
    await page.getByRole('button', { name: '与书深 AI 对话', exact: true }).click()
    await expect(page.getByText('Discussion requested')).toBeVisible()
    await page.getByRole('button', { name: 'English', exact: true }).click()
    await expect(page.getByRole('link', { name: 'arXiv:2611.09061' })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Overview', exact: true })).toHaveAttribute(
      'aria-selected',
      'true'
    )
    await expect(page.getByRole('tab', { name: 'Original', exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: /^Related recommendations\s*4$/ })).toBeVisible()
    assert.deepEqual(errors, [])
  } finally {
    await browser.close()
  }
})
