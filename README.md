<p align="center">
  <a href="https://scholarseed.damo.alibaba.com/">
    <img src="./assets/readme/brand/brand-mark.svg" alt="ScholarSeed" width="96">
  </a>
</p>
<p align="center">
  <a href="https://scholarseed.damo.alibaba.com/">
    <img src="./assets/readme/brand/brand-wordmark.svg" alt="ScholarSeed 书深" width="260">
  </a>
</p>

<h2 align="center">Where your ideas, documents, and AI stay connected.</h2>
<p align="center">Search, read, ask, verify, and build, with your own models, using your own skills and plugins, on your own machine.</p>
<p align="center">Keep your papers, notes, and conversations together as your research evolves.</p>

<p align="center">
  <b>PDF reader</b> · <b>Literature library</b> · <b>Evidence-linked answers</b> · <b>Research skills</b> · <b>Your models</b> · <b>Local-first</b>
</p>

<p align="center">
  <a href="https://scholarseed.damo.alibaba.com/"><img src="https://img.shields.io/badge/homepage-scholarseed.damo.alibaba.com-2f5744" alt="Homepage"></a>
  <a href="https://scholarseed.damo.alibaba.com/download.html"><img src="https://img.shields.io/badge/download-macOS%20%7C%20Windows-2f5744" alt="Download"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-Apache--2.0-blue" alt="License"></a>
  <a href="https://github.com/alibaba-damo-academy/ScholarSeed/releases"><img src="https://img.shields.io/github/v/release/alibaba-damo-academy/ScholarSeed" alt="Release"></a>
</p>

<p align="center">
  <a href="#quick-start">Quick start</a> ·
  <a href="#why-scholarseed">Why</a> ·
  <a href="#what-it-does">Features</a> ·
  <a href="#recipes">Recipes</a> ·
  <a href="#integrations">Integrations</a> ·
  <a href="#research-paper">Research paper</a> ·
  <a href="#for-developers">For developers</a> ·
  <a href="README_zh.md">中文</a>
</p>

<p align="center">
  <img src="./assets/readme/brand/core-02-context-smaller.gif" alt="AI that builds on your project context" width="400">
</p>

---

## Why ScholarSeed?

Most "AI for research" tools are a chat box next to your real work. You paste in a PDF, get an answer, and lose track of where it came from. Next week you start over.

| The pain | What ScholarSeed does |
|---|---|
| "Research is scattered across applications." | Search, read, discuss, and write around the same research project. |
| "Each new task requires rebuilding context." | Keep papers, notes, conversations, and outputs organized so you can bring relevant materials into later tasks. |
| "Cannot always trust AI answers." | Follow source-linked citations and inspect supporting evidence. |
| "AI agents are difficult to control." | Use research workflows with review checkpoints, decision cards, and permission controls to guide the next step. |
| "I don't want my library and notes on someone else's server." | Store research materials and project data locally; external models, search, and connectors process the requests you send to them. |
| "Every researcher and lab works differently." | Encode your methods in Skills and customize interactions with plugins and connected tools. |

---

## Quick start

**1. Install** — grab the installer from **[scholarseed.damo.alibaba.com/download.html](https://scholarseed.damo.alibaba.com/download.html)** (macOS Apple silicon, macOS Intel, Windows x64)

**2. Connect a model** — Configure a model service in Settings → Models, or sign in to use services available to your ScholarSeed account.

**3. Add papers** — import local PDFs, BibTeX or RIS files, or connect Zotero.

**4. Read and ask** — Open the PDF, select a passage, and use **Explain** or **Translate**. Add relevant papers, notes, or project files to a conversation for broader questions.

**5. Inspect and save** — Follow citations to check supporting sources and passages where available. Save your notes or draft in the project for later work.

---

## What it does

### Read — Keep your thinking beside the paper

Read PDFs, highlight passages, and record questions and observations without leaving your research workspace.

- Navigate paper outlines and revisit annotations.
- Select passages for AI explanation or translation.
- Use AI assistance to examine methods, equations, and figures, then compare the explanation with the original paper.
- Keep notes and project materials available for follow-up discussions.

<p align="center">
  <img src="./assets/readme/demos/ScholarSeed-Read.gif" alt="Read papers with AI assistance in the PDF reader" width="800">
</p>

### Find — Turn a research question into a reading list

Describe what you want to investigate, discover relevant literature, and decide which papers belong in your project.

- Use `agentic-search` for literature discovery and `precise-literature-search` for targeted retrieval and full-text workflows.
- Work with literature metadata from sources including OpenAlex and arXiv.
- Import local papers or connect Zotero, then organize materials around a research question.
- Review candidate papers and available evidence before moving into deeper analysis.

<p align="center">
  <img src="./assets/readme/demos/ScholarSeed-Find.gif" alt="Find relevant papers with literature search" width="800">
</p>

### Verify — Know where AI answers come from

Follow citations back to sources and supporting passages, returning to the original text where a location is available.

- Compare an AI interpretation with what the source actually reports.
- Keep reported findings, your own interpretations, and open questions distinct in your notes and drafts.
- Use DamoATrace diagnostics to inspect recorded, product-visible events when debugging a task.

Citations help you inspect an answer; they do not establish that its claims are correct or fully supported. Research conclusions still require judgment against the original evidence.

<p align="center">
  <img src="./assets/readme/demos/ScholarSeed-Verify.gif" alt="Verify AI answers against cited source passages" width="800">
</p>

### Write — Develop materials into research outputs

Turn selected literature and project context into a draft you can examine and revise.

- Use `literature-review` to develop a structured review with evidence processing and review checkpoints.
- Refine the scope, outline, supporting evidence, and wording.
- Produce Markdown or LaTeX/PDF through the review workflow; LaTeX compilation uses the bundled toolchain.
- Save outputs as project files and bring them into subsequent discussions.

<p align="center">
  <img src="./assets/readme/demos/ScholarSeed-Write-Fast.gif" alt="Generate a literature review from selected papers" width="800">
</p>

### Extend — Turn your research methods into reusable AI workflows

Turn your methods into reusable workflows and add tools or interactions for your field.

- **Skills** describe research steps, required materials, decision points, and expected outputs.
- **Plugins** combine Skills with conversation cards for reviewing results and collecting decisions. Plugins are in **developer preview**.
- **MCP servers** connect external tools and services through the Model Context Protocol.
- **Runtime interfaces** provide a development route for adding agent engines. Codex is the currently included executable agent provider.

Bundled Skill sources include `agentic-search`, `precise-literature-search`, `literature-review`, `research-idea-partner`, `design-research-validation`, `pdf-evidence`, `project-literature`, `web-search`, `fast-search`, `find-skill`, and `plugin-create`. Browse the [Skill sources](https://github.com/alibaba-damo-academy/ScholarSeed/tree/main/skills/community) for their contracts and supporting tools.

<p align="center">
  <img src="./assets/readme/demos/ScholarSeed-Extend.gif" alt="Extend research workflows with skills" width="800">
</p>

## Recipes

Start with a concrete question and review the evidence as you go. These examples use Skills present in the repository; outputs depend on the materials, model, and services available.

| Goal | Workflow | What to review |
| --- | --- | --- |
| Build a literature review | `agentic-search` → review candidates → `literature-review` | Paper selection, evidence coverage, outline, citations, and final draft |
| Understand a difficult paper | Import PDF → annotate → select-to-explain → `pdf-evidence` | Source passages, assumptions, methods, and limitations |
| Explore a research idea | `research-idea-partner` → targeted literature discovery | Related work, unresolved questions, and assumptions worth testing |
| Plan research validation | `design-research-validation` with your idea and project context | Validation criteria, alternative explanations, and evidence needed |

## Trust & local-first

- Local SQLite; projects are folders you own. Data lives in `~/.scholarseed` (override with `SCHOLARSEED_HOME`).
- Agents run in isolated homes with plugins, hooks and marketplaces disabled, MCP config projected explicitly, secrets passed by environment, binaries pinned by SHA-256.
- Native per-directory authorization (Windows job-object broker, macOS leases), notarized and Authenticode-signed builds.
- Every skill result that touches full text requires your explicit grant.

<p align="center">
  <img src="./assets/readme/demos/ScholarSeed-Trust-Local.gif" alt="Research in a local project workspace with control over agent actions" width="800">
</p>

---

## Bring your own model

| Provider | Models in catalog |
|---|---|
| Alibaba (Qwen) | 34 |
| OpenAI | 9 |
| Anthropic (Claude) | 6 |
| DeepSeek | 6 |
| Zhipu (GLM) | 6 |
| Moonshot (Kimi) | 5 |
| **Any OpenAI-compatible endpoint** | your `base_url` + API key (or a custom auth header) |

Switch models per conversation. Keys stay on your machine.

**Coming:** first-class presets for **Google Gemini** and for local models via **Ollama, vLLM and LM Studio**; and **Claude Code** as a second agent runtime next to Codex. See [Roadmap](#roadmap).

---

## Integrations

**Literature**

<p align="center">
  <a href="https://www.zotero.org" title="Zotero"><img src="./assets/readme/logos/zotero.svg" width="40" alt="Zotero"></a>&nbsp;&nbsp;&nbsp;
  <a href="https://arxiv.org" title="arXiv"><img src="./assets/readme/logos/arxiv.svg" width="40" alt="arXiv"></a>&nbsp;&nbsp;&nbsp;
  <a href="https://openalex.org" title="OpenAlex"><b>OpenAlex</b></a>&nbsp;&nbsp;&nbsp;
  <a href="https://elicit.com" title="Elicit"><b>Elicit</b></a>
</p>

**Code & docs**

<p align="center">
  <a href="https://github.com" title="GitHub"><img src="./assets/readme/logos/github.svg" width="40" alt="GitHub"></a>&nbsp;&nbsp;&nbsp;
  <a href="https://gitlab.com" title="GitLab"><img src="./assets/readme/logos/gitlab.svg" width="40" alt="GitLab"></a>&nbsp;&nbsp;&nbsp;
  <a href="https://huggingface.co" title="Hugging Face"><img src="./assets/readme/logos/huggingface.svg" width="40" alt="Hugging Face"></a>&nbsp;&nbsp;&nbsp;
  <a href="https://www.notion.so" title="Notion"><img src="./assets/readme/logos/notion.svg" width="40" alt="Notion"></a>
</p>

**Web**

<p align="center">
  <a href="https://www.firecrawl.dev" title="Firecrawl"><b>Firecrawl</b></a>&nbsp;&nbsp;&nbsp;
  <a href="https://brave.com/search/api/" title="Brave Search"><img src="./assets/readme/logos/brave.svg" width="40" alt="Brave Search"></a>
</p>

**Models — today**

<p align="center">
  <a href="https://www.alibabacloud.com/en/product/modelstudio" title="Alibaba Cloud Model Studio (Qwen)"><img src="./assets/readme/logos/alibabacloud.svg" width="40" alt="Alibaba Cloud"></a>&nbsp;&nbsp;&nbsp;
  <a href="https://platform.openai.com" title="OpenAI"><b>OpenAI</b></a>&nbsp;&nbsp;&nbsp;
  <a href="https://www.anthropic.com" title="Anthropic"><img src="./assets/readme/logos/anthropic.svg" width="40" alt="Anthropic"></a>&nbsp;&nbsp;&nbsp;
  <a href="https://www.deepseek.com" title="DeepSeek"><img src="./assets/readme/logos/deepseek.svg" width="40" alt="DeepSeek"></a>&nbsp;&nbsp;&nbsp;
  <a href="https://www.zhipuai.cn" title="Zhipu"><b>Zhipu</b></a>&nbsp;&nbsp;&nbsp;
  <a href="https://www.moonshot.cn" title="Moonshot (Kimi)"><img src="./assets/readme/logos/kimi.svg" width="40" alt="Kimi"></a>
</p>

**Models & agents — coming**

<p align="center">
  <a href="https://claude.com/claude-code" title="Claude Code (agent runtime)"><img src="./assets/readme/logos/claude.svg" width="40" alt="Claude Code"></a>&nbsp;&nbsp;&nbsp;
  <a href="https://ai.google.dev" title="Google Gemini"><img src="./assets/readme/logos/googlegemini.svg" width="40" alt="Google Gemini"></a>&nbsp;&nbsp;&nbsp;
  <a href="https://ollama.com" title="Ollama"><img src="./assets/readme/logos/ollama.svg" width="40" alt="Ollama"></a>&nbsp;&nbsp;&nbsp;
  <a href="https://docs.vllm.ai" title="vLLM"><img src="./assets/readme/logos/vllm.svg" width="40" alt="vLLM"></a>&nbsp;&nbsp;&nbsp;
  <a href="https://lmstudio.ai" title="LM Studio"><img src="./assets/readme/logos/lmstudio.svg" width="40" alt="LM Studio"></a>
</p>

---

## Research paper

**[ScholarStack: Layered Research Asset Orchestration and Cross-Task Reuse for Scientific Agents](https://arxiv.org/abs/2609.23735v3)**

ScholarSeed AI Team

### Let understanding from one task support the next

Research accumulates across tasks. Methods and terminology identified during search help organize a review. Disagreements and limitations motivate new ideas, while comparisons made during novelty assessment inform experimental baselines. When this understanding remains inside a single conversation or report, later tasks must reread the same papers and reconstruct earlier judgments.

**ScholarStack organizes source facts, domain structure, and cross-paper understanding into reusable research assets.** It preserves both what individual papers report and how studies relate, together with their sources, study conditions, scope, and versions. Scientific agents can draw on this shared foundation across retrieval, question answering, writing, and claim assessment.

![ScholarStack overview: offline construction of three asset layers and task-specific online reuse](assets/scholarstack-overview.png)

*Figure 1 shows how ScholarStack compiles a collection into research assets and assembles task-specific Knowledge Views. Tasks use the layers they need. After initial checks, teams can register selected outputs as candidate assets. Semantic verification is a separate step.*

### Three layers connecting source evidence and research understanding

| Layer | What it preserves | How it supports subsequent research |
| --- | --- | --- |
| **L1 · Source-grounded facts** | Reported findings, methods, hypotheses, and limitations, with study conditions, source locations, and checking states | Answer specific questions and verify values and claims while retaining the conditions under which findings apply |
| **L2 · Domain organization** | Canonical entities, domain categories, assignments, and relations linked to their evidence | Align terminology across papers, organize research directions, and establish dimensions for method comparison |
| **L3 · Scoped cross-paper syntheses** | Interpretations across studies, with explicit coverage, supporting, opposing, and limiting evidence | Trace methodological developments, disagreements, and open questions to inform reviews and research planning |

Agents retrieve, select, expand, compare, and synthesize assets into a task-specific **Knowledge View**. Single-paper questions may primarily use L1. Cross-paper comparisons can combine L2 with original study conditions, and reviews may also use L3. When a source or asset changes, dependent judgments require rechecking, while earlier versions retain the basis of previous outputs.

### From literature understanding to research outputs

Researchers can use the same assets to organize references and position contributions, trace themes and disagreements in reviews, recover experimental settings, baselines, and limitations, and identify open questions.

![ScholarStack evidence-grounded generation for related work, reviews, experimental design, and research ideas](assets/scholarstack-generation.png)

*Figure 4 shows how tasks combine the required layers to organize, compare, and synthesize evidence while linking claims to sources. Reported findings, synthesized interpretations, and proposed hypotheses remain distinct.*

### Selected experimental results

The paper evaluates **ten settings** covering literature retrieval, scientific question answering, evidence-grounded generation, and claim and consistency assessment. Selected results from the current manuscript are shown below.

| Task and evaluation scope | Comparator | ScholarStack |
| --- | --- | --- |
| **Multi-paper QA** · MDAQA, 797 questions (Table 9) | Full-text: total score **8.46 / 20**; mean **20.8k tokens / question** | Total score **18.41 / 20**; mean **5.5k tokens / question**, approximately **73% fewer** |
| **Literature review generation** · ReportBench-ML, 25 tasks (Table 13) | Claude Code DeepResearch: RACE overall score **7.54 / 10** | RACE overall score **9.18 / 10**; comprehensiveness **9.23** and insight **9.30** |
| **Experimental design** · 12 fields, 38 targets (Table 14) | Full-text: coverage F1 **0.398**; mean **20.7k tokens / task** | Comparable coverage F1 of **0.404**; mean **12.4k tokens / task**, approximately **40% fewer** |

The multi-paper QA total sums five dimensions (out of 20). The study uses model-based judging for both QA and review quality. The review results compare complete workflows. Token figures cover query or generation time and exclude initial asset construction. The small experimental-design F1 difference is not interpreted as a quality improvement. See the paper for task-specific settings, metrics, and evaluation scope.

## For developers

ScholarSeed is a working research application you can extend rather than a framework you must assemble. PDF handling, the library, projects, model routing, sandboxing, citations, and the UI are already there.

| Extension | Example you could build |
| --- | --- |
| Research Skill | A paper-comparison workflow using your lab's inclusion criteria |
| UI plugin | A conversation card for comparing methods and selecting papers |
| MCP connector | Access to a specialized scientific database |
| Agent runtime | An adapter for another research or coding agent |

These are extension ideas, not a list of shipped add-ons. To create a plugin with AI assistance, ask ScholarSeed to use `plugin-create` and describe the workflow.

### Start with a Skill

Create a folder containing `SKILL.md`. This minimal example defines a reading method without requiring a custom interface:

```markdown
---
name: lab-paper-comparison
description: Compare selected project papers using the lab's reading criteria.
---

# Lab paper comparison

1. Confirm the research question and the papers to compare.
2. Read the authorized materials. For each paper, record its question,
   method, study conditions, findings, and limitations.
3. Cite supporting passages where available. Mark missing evidence and
   distinguish reported findings from interpretations.
4. Present a comparison table and ask which papers need closer study.
5. Draft a summary for review; ask before changing library records.
```

This file supplies instructions. Installing a plugin or adding a dedicated card also requires the descriptor, packaging, validation, and installation steps in the [plugin creation guide](https://github.com/alibaba-damo-academy/ScholarSeed/blob/main/doc/plugins/create.md). A `SKILL.md` file alone does not create a custom UI.

### Add cards and application actions

The two frontend interfaces have different roles:

- **`window.scholarseedUI`** mounts React components and provides ScholarSeed's UI and conversation components.
- **`window.plugin`** handles card state and interactions through methods including `onState`, `save`, `submit`, and `request`.

Skills use **`scholarseed-bridge`** to read authorized materials, manage literature, present cards, and organize results within the current project and permissions. A card's buttons do not inherit every backend operation.

For example, a lab workflow could compare 30 papers, present a selection card, then produce a report and save reading notes or organize papers within the granted permissions. The method, card implementation, and application actions must each be connected and tested.

See the [plugin overview](https://github.com/alibaba-damo-academy/ScholarSeed/blob/main/doc/plugins.md), [API guide](https://github.com/alibaba-damo-academy/ScholarSeed/blob/main/doc/plugins/api.md), [public cards](https://github.com/alibaba-damo-academy/ScholarSeed/blob/main/doc/plugins/cards.md), and [testing guide](https://github.com/alibaba-damo-academy/ScholarSeed/blob/main/doc/plugins/testing.md). Interfaces are in developer preview and may introduce breaking changes. Inspect the contract for your matching backend with:

```bash
python -m service.cli.plugins describe
```

### Build from source

Requires Git, **Node.js 24.16.0**, **pnpm 12.14.0**, **uv ≥ 0.12.11**, and your platform's native build tools. On macOS:

```bash
xcode-select --install
```

On Windows x64, follow the [Windows setup](CONTRIBUTING.md#windows); the build scripts fetch the pinned native compiler themselves.

```bash
git clone https://github.com/alibaba-damo-academy/ScholarSeed.git
cd ScholarSeed
pnpm ops pre   # pinned JS + Python deps, Office assets, bundled Skill pack
pnpm ops dev   # starts Electron
```

On a fresh clone, run both commands. For subsequent launches, run `pnpm ops dev`. After dependency or Skill changes, stop the app and run `pnpm ops pre` again. The first run needs network access. The setup verifies downloaded runtimes against the manifests by size and SHA-256. Set `SCHOLARSEED_ARTIFACT_CACHE` to use a different cache directory. No separate Python installation or Git LFS is needed.

Use `pnpm ops pre doctor` to inspect the toolchain, `pnpm ops cd build local --stage app` to compile Desktop, and `pnpm ops ci test --scope desktop` to run its tests. See the [development and testing guide](CONTRIBUTING.md#development-and-testing) for the complete commands.

- Build the installer on the matching platform with `pnpm ops cd build local`. For an unsigned, unpacked release candidate, use `pnpm ops cd build release --stage dir --candidate`. See [Packaging](CONTRIBUTING.md#packaging) for release builds and signing requirements.
- Rebuild the Skill pack: `pnpm ops cd build local --target skills`; check it against source: `pnpm ops ci check skills product --mode source`.
- Windows gotchas: [Electron download stalls](CONTRIBUTING.md#windows-download-diagnostics), [stale ACL policy outputs](CONTRIBUTING.md#windows-checkout-line-endings), [private build directory rejection](CONTRIBUTING.md#windows-private-build-directory).
- Optional env vars: [`.env.example`](.env.example). Never commit keys, tokens, session data or certificates.

### Architecture

```text
Electron / React
      │ HTTP + SSE
      ▼
ScholarSeed Serve (FastAPI)
      │ commands + events
      ▼
Runtime Gateway ──► Codex Adapter ──► Codex App Server (sandboxed)
      │
      └────────────► DamoATrace evidence recording
```

The agent engine sits behind runtime contracts for sessions, events, permissions, MCP, and related execution concerns. Providers are discovered through `scholarseed_runtime.providers` and enabled in `product.json`; `packages/adapters/codex/` is the reference implementation. DamoATrace provides separate trace recording, storage, query, CLI, and diagnostic interfaces.

See the [project map](https://github.com/alibaba-damo-academy/ScholarSeed/blob/main/CONTRIBUTING.md#project-map), [runtime package](https://github.com/alibaba-damo-academy/ScholarSeed/tree/main/packages/runtime), [UI SDK](https://github.com/alibaba-damo-academy/ScholarSeed/tree/main/packages/ui), and [development and testing guide](https://github.com/alibaba-damo-academy/ScholarSeed/blob/main/CONTRIBUTING.md#development-and-testing) for implementation details.

## Model and Service Configuration

ScholarSeed requires a model connection that you are authorized to use. Configure the provider endpoint, model name, and credential in the application settings, or sign in to use the models available to your ScholarSeed account. Local HTTP authentication and model authorization are separate concerns: a healthy local service does not imply that a model account is authorized.

Optional development and service variables are documented in [`.env.example`](.env.example). Do not commit API keys, access tokens, user configuration, session data, certificates, or private keys.

## Local Data and Privacy

The default user data directory is `~/.scholarseed`. Set `SCHOLARSEED_HOME` to use a different location; this selects a separate user state and does not migrate existing data.

- User-level configuration, credentials, project registry, session catalog, and literature data are managed under `SCHOLARSEED_HOME`.
- Project-owned data is stored under `<project>/.scholarseed/` and travels with the project directory.
- Codex state is isolated under `<SCHOLARSEED_HOME>/codex/` by default; use `SCHOLARSEED_CODEX_HOME` only when a separate location is needed. ScholarSeed does not automatically copy your personal Codex credentials or model configuration.
- DamoATrace records product-visible diagnostic events for debugging; it does not imply access to undisclosed executor internals.
- Model calls, literature searches, and network tools communicate with the configured external services. Local storage does not mean all processing stays offline.
- Choose an appropriate permission mode for each task and confirm tool execution and file operations when requested.

Keep user data and credentials outside the repository. Review diagnostic bundles before sharing them.

## Roadmap

Planned work is separate from the current capabilities above. Scope and availability may change.

| Area | Status |
| --- | --- |
| ScholarStack-based reusable research assets | Coming soon; not fully integrated into ScholarSeed |
| Skill Hub for discovering and installing community Skills | Coming soon |
| Claude Code as an additional agent runtime | Planned |
| First-class Google Gemini provider preset | Planned |
| Local model presets for Ollama, vLLM, and LM Studio | Planned |
| In-workbench LaTeX editor with library citation support | Planned |
| Linux build | Exploring |

Plugins are currently in developer preview. See the [plugin guide](developer-docs/plugins.md) for development and installation.

The [research paper](#research-paper) describes ScholarStack's architecture and evaluation. Full integration into the workbench is planned.

---

The AI invokes these operations following the Skill; ScholarSeed checks the current project scope and permissions. Cards do not inherit all application permissions or automatically approve sensitive actions. See the [plugin API guide](developer-docs/plugins/api.md) for available operations.

## Community & contributing

Scan the QR code to join the ScholarSeed community and discuss your experience and research questions.

<img src="./assets/community-qr.png" alt="ScholarSeed community group QR code" width="280">

- Report bugs and request features through [Issues](https://github.com/alibaba-damo-academy/ScholarSeed/issues). Include your operating system, application version, steps to reproduce, and expected behavior.
- See [CONTRIBUTING.md](CONTRIBUTING.md) for development and contribution instructions.
- Built by Alibaba DAMO Academy, Decision Intelligence Lab.

### Built on

ScholarSeed stands on a lot of other people's work. Thank you to:

| Area | Projects |
|---|---|
| Agent runtime | [OpenAI Codex](https://github.com/openai/codex) App Server 0.165.0 · [MCP Python SDK](https://github.com/modelcontextprotocol/python-sdk) |
| Literature | [Zotero](https://www.zotero.org) · [zotero-mcp](https://github.com/54yyyu/zotero-mcp) · [OpenAlex](https://openalex.org) · [arXiv](https://arxiv.org) · [Brave Search](https://brave.com/search/api/) |
| PDF & documents | [PDFium](https://pdfium.googlesource.com/pdfium/) via [pypdfium2](https://github.com/pypdfium2-team/pypdfium2) · [pypdf](https://github.com/py-pdf/pypdf) · [pdfplumber](https://github.com/jsvine/pdfplumber) · [python-docx](https://github.com/python-openxml/python-docx) · [python-pptx](https://github.com/scanny/python-pptx) · [openpyxl](https://foss.heptapod.net/openpyxl/openpyxl) |
| Office preview | [docx-preview](https://github.com/VolodymyrBaydalka/docxjs) · [ExcelJS](https://github.com/exceljs/exceljs) · [pptx-renderer](https://github.com/aiden0z/pptx-renderer) · [emf-converter](https://github.com/ChristopherVR/emf-converter) · [ZetaOffice](apps/desktop/src/renderer/public/office/THIRD_PARTY_NOTICES.md) (wasm) with [Fontconfig](https://www.freedesktop.org/wiki/Software/fontconfig/) and [FreeType](https://freetype.org) |
| Writing | [TeX Live](https://tug.org/texlive/) 2026 · [Milkdown](https://milkdown.dev) · [CodeMirror](https://codemirror.net) |
| Desktop | [Electron](https://www.electronjs.org) 44 · [React](https://react.dev) · [Vite](https://vite.dev) / [electron-vite](https://electron-vite.org) · [electron-builder](https://www.electron.build) · [Velopack](https://velopack.io) (Windows updates) · [Tailwind CSS](https://tailwindcss.com) · [i18next](https://www.i18next.com) · [Playwright](https://playwright.dev) |
| Backend | [FastAPI](https://fastapi.tiangolo.com) · [python-build-standalone](https://github.com/astral-sh/python-build-standalone) CPython 3.14 · [uv](https://github.com/astral-sh/uv) · [DuckDB](https://duckdb.org) · [httpx](https://www.python-httpx.org) · [Pydantic](https://pydantic.dev) · [truststore](https://github.com/sethmlarson/truststore) |
| Tools shipped in the package | [ripgrep](https://github.com/BurntSushi/ripgrep) · [PowerShell](https://github.com/PowerShell/PowerShell) 7.6 (Windows) |
| Fonts | [IBM Plex Mono](https://github.com/IBM/plex) · [Newsreader](https://github.com/productiontype/Newsreader) · [Noto Serif SC](https://fonts.google.com/noto) |
| README logos | [Simple Icons](https://simpleicons.org) (CC0; marks remain their owners' trademarks) |

## License

ScholarSeed's original source code is licensed under the [Apache License 2.0](LICENSE).

Third-party software, assets, and bundled runtimes remain under their respective licenses. Their licenses are not replaced by Apache-2.0. Available notices include:

- [Desktop dependencies and corresponding source notices](apps/desktop/resources/notices/README.md)
- [Office viewer third-party notices](apps/desktop/src/renderer/public/office/THIRD_PARTY_NOTICES.md)
- [`paper-fulltext-dl` third-party notices](skills/community/precise-literature-search/vendor/THIRD_PARTY_NOTICES.md)
