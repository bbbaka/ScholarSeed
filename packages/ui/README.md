# Official UI 1.0 resources

Resource release 1.1.3 combines typed interactive charts, data tables and conversation-aware
presentation with cached-image loading fixes and automatic card text registration.
Copy registration follows every published snapshot, supports in-place retry and reconnect
recovery, and includes the shared research cards alongside discoverable layout, form,
table, feedback, menu and dialog controls. It preserves the selection presentation and all earlier
exports. Compatibility remains 1.0; leases keep their pinned resource snapshot.
This extends composition, not permissions or the update entry points.

## Conversation presentation

The isolated document is a transparent canvas, using the host design font, body size,
line height and explicit theme. Surfaces belong to cards, not the entire frame.
The host propagates live theme changes without recreating the frame or its draft.
Sandbox, CSP, navigation, frame height limits and authorization remain unchanged.
Leases are scoped to the owning document: cross-document host navigation or renderer
loss discards that owner's leases; same-document navigation preserves them. Reloading
the gallery therefore does not consume the fixed instance limit indefinitely.
The isolated loader waits for document readiness, then loads the pinned runtime
before the plugin entry. Parser speculation must not request resources before the
opaque frame has an established identity; failed runtime loading stops the entry.

The host owns spacing between display cards; `Content` owns gaps between its blocks;
each component owns only its internal layout. Do not add outer padding/margins to
every component. Use Markdown blocks for narrative and result interpretation.
`Content` keeps its independent Canvas disclosure but lets responsive charts flow
without a second height-limited vertical scroller. `Canvas` exposes `scroll=false`
for this use; other previews retain their existing bounded scroll by default.
`Plot` exposes `framed=false` for an existing parent card, avoiding nested borders
and padding. Standalone plots keep their own chart surface, reading-width bound,
container-responsive height, original data toggle and keyboard/point selection.
Long chart labels truncate visually while the source table and accessible row
description retain full values. Dense series keep inside/slider zoom; sparse plots
keep inside zoom without an unnecessary slider. Theme changes preserve selections.
Markdown owns internal paragraph spacing but has no leading/trailing block margin.
DataTable owns its composition gaps and normalizes legacy child margins. Captionless
tables keep copying beside the header instead of reserving an empty toolbar row;
captioned tables retain their labelled toolbar and both keep the original copy port.
Result details use a bounded conversation preview with the existing result surface's
internal scrolling, not the plugin viewport height. Menus constrain themselves to
their actual viewport and scroll to keyboard-focused actions instead of clipping.

The sole development preview entry is the live source-based workbench below.
Desktop's UI materials reuse this workbench in an embedded mode: the same discovered
official exports, six categories, input contracts and bindings follow the existing
conversation examples. This is a source import, not an iframe or dependency on a
running preview server. The host owns selection and theme; embedded drafts use a
separate session-storage key and do not write the standalone preview's hash or drafts.
`example/laboratory.js` and its programmatic builder remain fixtures for the existing
in-app MOCK and isolation regressions, not a second live/offline development page.
Historical immutable cards keep their pinned resources and synthetic materials;
editing the developer preview never silently replaces those historical snapshots.

The official UI is an independently built browser resource package. Desktop ships
its copy as a system dependency on each release; research plugins reference its compatible
exports rather than bundling React or base controls again. The host owns trust,
isolation, dependency resolution, permissions and interaction responses.

## Build

Cards can call `window.plugin.setCopyContent({ text, markdown? })` to register their
text representation. This does not access the clipboard: Desktop's outer card and
reply copy buttons perform the actual write after a user click. Register again
from the updated `onState` snapshot after saving a draft; stale draft revisions
are rejected. The persisted representation remains available without a mounted frame.

`Conversation.Choices`, `Results`, `Details`, `References`, `Downloads`, `Delivery`
and `Review` register their text automatically when rendered through `mount`.
The same applies to `Markdown`, `Message`, `Code`, `Formula`, `Tabulation` (with
`copyText` or `invalidSource`) and `Artifact`. Code retains collapsed lines;
formula text retains its LaTeX source, caption and notes. Artifact text keeps the
displayed title, filename, path and status, not the linked file's contents.
Composing several cards combines their texts instead of overwriting each other.
The same registration covers Plot and its ten typed charts, DataTable, Content,
EvidenceSelection and ArtifactPreview. It includes complete original rows, units,
provided sources/scripts, unabridged excerpts, file versions, supplied preview blocks
and saved selection IDs; it never reads linked files. Layouts, icons and menus do
not synthesize business content. Copy uses the reply action, not a standalone card button.
Review text includes collapsed sections, citations, warnings, checks, issues and
artifact paths; it does not read linked files. Delivery text follows the loaded
batch and its save/cancel results. Saved state changes register the new revision.
A registration failure stays visible in the frame until a subsequent registration succeeds.

For other custom layouts, declare `useCopyContent` in `ui.exports` and call
`window.scholarseedUI.useCopyContent(text)` inside the component passed to `mount`.
Each mounted component contributes its own text. Supply business content, not button
labels or private configuration. Use this hook for composition; do not also call
`setCopyContent` in the same frame, since the latter replaces the entire card's text.

### Live conversation preview

Run the single repository-local preview entry after installing the repository's
Desktop frontend dependencies:

```sh
node packages/ui/preview.cjs
```

Open the printed loopback URL (default port 5191). There is no offline HTML build,
export step, Serve, account or model dependency. An occupied port fails explicitly.
Vite imports the actual official Conversation/controls/theme sources, not generated
`ui.js`. Editing those sources updates the browser automatically; a dependency that
cannot use React Fast Refresh may reload the page automatically instead.

The directory is discovered from PascalCase renderable values in the actual
`Conversation` namespace. It is not populated from the sample registry. New exports
appear immediately, including an explicit missing-contract entry when needed;
removed exports disappear. The browser regression compares real exports with the
directory and requires a usable data contract for every current card.

The directory uses six ordered categories: body/rich content, charts,
conversation/confirmation/execution, research results, citations/evidence/context,
and attachments/artifacts/workbench. Identical renderer references share one entry;
the 56 current exports produce 55 entries because ArtifactMenuItems aliases
FileMenuItems. The ten chart types and generic Plot remain separate entries.
Aliases remain searchable and old hash links resolve to the canonical entry.
Existing canonical JSON drafts take precedence; an alias-only draft is reused
without deleting historical records. Narrow-width selection uses the same groups.

`preview/catalog.mjs` owns serializable preview contracts, labels, grouping and
structural adapter selection. `schema.mjs` implements the declared JSON Schema
subset (types, objects, required/additional fields, arrays, enum/const/default,
oneOf and limits). `rules.mjs` supplies seeded generation and dataset/chart
relationships; unsupported generation rules fail, never silently return a fixture.
These are preview input/composition contracts, not exhaustive React prop schemas
or permission grants. Editing protocol constants or exceeding a declared preview
constraint is rejected explicitly, rather than passed unchecked to a component.
Contracts reuse public content schemas where applicable, rather than inferring
types from hardcoded example records. Normal, empty-collection, long-text and dense
profiles affect appropriate fields. Seeded output is repeatable; changing JSON
does not change official component code. New components need their data contract
and, only for a new interaction/composition shape, a safe binding; the page does
not need another case or hand-maintained component list.

Valid JSON edits apply immediately. Invalid drafts show field paths and stay in
the editor while the last valid preview remains visible. Drafts, generation seeds,
the selected card and theme survive navigation, HMR and page reload through tab-local
session storage; no JSON is posted to a backend. A contract-breaking source edit
retains the draft and explicitly marks regenerated fallback data as unapplied.
Regeneration is an explicit user action. The Schema disclosure shows the actual
contract used for generation and validation.

Callback functions and React subtrees are injected through fixed local bindings,
never parsed as executable JSON. File, literature and workflow actions only report
simulated feedback; there is no Desktop bridge or API proxy. Development CSP permits
the exact loopback HMR socket and nonce-bearing Vite scripts, not remote services.
The product/plugin CSP and pinned resource lifecycle remain unchanged.

The existing persistent in-app MOCK and its historical resources remain separate;
they are not silently rebound by editing this live preview. This developer tool is
not Agent/Skill or host authorization acceptance. Run the rule and real-browser
regressions with:

```sh
node --experimental-transform-types --test packages/ui/preview/schema.test.mjs packages/ui/preview/browser.test.cjs
```

Use the existing `PLAYWRIGHT_CHANNEL=chrome` setting when testing with installed
Chrome rather than a Playwright-managed browser. Browser HMR tests use a private
source copy; they never rewrite the developer's official source files.

### Resource package

Use the repository-reviewed Node and installed Desktop dependencies:

```sh
node packages/ui/build.cjs tmp/official-ui
node packages/ui/build.cjs --archive tmp/official-ui.zip
node packages/ui/build.cjs --example tmp/method-comparison.zip
node --test packages/ui/build.test.cjs
```

The official output contains `.scholarseed-ui.json`, the exact resource inventory,
`ui.js`, `ui.css`, `selection.js`, `catalog.json` and font resources. The build borrows the existing
design-system source as input; neither the shared card nor its runtime is compiled
into the research plugin. Runtime resources are loaded from the host-controlled
lease, not the network. Host application controls remain owned by Desktop.

The example is a separate local research plugin with its own `SKILL.md`, component,
declaration and sample-only preview. Its component consumes `window.scholarseedUI`.
Checkbox changes save a draft; confirmation submits the declared action. The host
decides whether that action is permitted and how it resumes the waiting workflow.

## Discover and compose

Read `catalog.json` from the built resource package before generating a custom
component. It describes only exported families, their intended use and pitfalls,
public slots, and the bridge completion contract. The same catalog is available
as `window.scholarseedUI.catalog` inside a bound frame. Family metadata comes from
the existing design-system registry; it is not a separately maintained list.
The catalog is not a complete props schema or an authorization grant. Agent-side
host discovery is available through `component/catalog` with `include_ui: true`.
The reply identifies the active resource fingerprint and is not an authorization.
Older resource packages without a catalog report it as unavailable.

`Conversation` exposes `Choices`, `Results`, `Details`, `References`, `Downloads`,
`Delivery`, `Review` and `Markdown`. These reuse the original components, not simplified copies.
Business cards consume `content` and `ports`; the typed operations are owned by
`apps/desktop/src/renderer/src/features/literature/ports.ts`. Plugins must bind
each operation to a declared `plugin.request` action, not call host APIs directly.
`createLiteraturePorts(request, scope)` supplies that typed adapter from this
resource package; consumers do not import ScholarSeed source or copy its operation map.
Pass `(action, values) => plugin.request(action, values)` and the card's display scope.
Creating the adapter does not call the host or grant permissions. Declaring the
component's required actions and capabilities remains mandatory; the host independently
checks the pinned card, session, project and item identity before executing them.
`Results` title buttons send only the bound paper ID, never a guest-provided URL.
Missing/unsafe source addresses disable source navigation. Both source and current-result
navigation retain the card on failure and retry from the original control.
`Choices` consumes `data`, `status`, `slot` and `submit`. Its selection action is
not approval: the host still owns confirmation and workflow completion.

`Conversation.Suggestions` shares the host's existing next-step presentation.
It receives `payload`, controlled `available`, `busy`, `failed`, `draft`, `onDraft`
and `onSend`. The host adapter retains session identity and duplicate-submission
checks; this component does not grant permission to send messages. Its current
layout retains the existing free-text input; compact capsules and per-turn dismissal
are also available. Suggestions do not offer regeneration.

`Markdown` consumes the original answer renderer's props, including `text`, `math`,
citation mapping and evidence annotations. Its required `onOpenExternal` callback
and optional `onOpenSessionFile` callback must use declared host operations.
Without a navigation callback, ordinary external links render as text. The shared implementation never opens windows or calls the Desktop bridge itself;
the host's existing `Markdown` adapter retains its original navigation behavior.
Math, GFM tables, code and annotation rendering share the same source, but this is
not yet the demo's complete formula/code toolbar or image and chart experience.

Declare every consumed export in the research plugin's `ui.exports`, with
`compatibility: "1.0"`. Import values from `window.scholarseedUI`, not a new React
bundle, the parent document, or Desktop internals. `Card`, form controls, tables,
menus and dialogs can be composed in arbitrary layouts; they are not public slot
registrations and do not claim a new business capability.

`DropdownMenuSubTrigger` opens on click or ArrowRight; set `openOnHover` explicitly
when hover expansion is required. Dialogs and menus remain within the isolated
frame, including their portals. Closing a local dialog is not an AI response.
Use `save` for drafts, `submit` for the declared answer, and `request` for a declared
host operation. Submission completion comes through `onState`, not the return
value of `submit`. Only the host can authorize or execute a business operation.

`catalog.test.cjs` checks the packaged directory and its integrity inventory.
`sdk.test.cjs` exercises composition in an opaque-origin iframe with scripts only:
nested menu, dialog, draft persistence and answer submission. This is deterministic
component regression with fixture responses, not real Desktop or model acceptance.

## Compatibility and security

`Conversation.Images` composes ordered thumbnails and the shared image viewer.
Items carry an immutable `id`, `title`, authorized `url` and optional failure state.
`renderActions(item)` receives the exact displayed source, including after group
navigation; it must use normal host capabilities for original-file actions.
Missing URLs mean loading, not authorization. Supply a failure state when loading
fails. The component performs no file reads and grants no host permissions.
For separate cards, compose `ImageThumbnail` with `Images` using
`selection={{id, onChange}}` and `thumbnails={false}`. All cards then share the
same viewer and selected-source action context, without duplicating thumbnails.
The native artifact batch uses this composition and retains each full artifact
card; host actions remain outside the resource package. Full visual and real
product acceptance remain pending, not implied by this composition export.

### Frozen source selections

`Conversation.SelectionReference` displays host-grouped, literal frozen excerpts.
Supply `label`, `items: [{id, text, complete, canOpen}]` and optional `onOpen(id)`.
The host groups by stable source/document identity, not display titles, and retains
every excerpt's snapshot, revision and locator. Missing identity is not guessed.
Hovering only reveals the existing text; opening a source is an explicit action.
The interactive popover stays available for long text and failed-operation retry.
Incomplete historical previews are labeled as such, never described as restored
originals. Rejected callbacks retain the text and the same source id for retry;
pending operations disable duplicate submissions. Without an authorized callback,
text can still be read but source opening is disabled.

The native sent-message projection preserves the backend's existing page-safe
`anchor.snapshot_text` in both durable history and optimistic messages. It does
not recover excerpts from model-only materials or reread changed source files.
Source opening is not a claim of exact-coordinate recovery; the host must provide
and validate that capability separately. Quote/annotation groups precede images,
files and message text, without changing the underlying source authority.

### Tool execution records

`Conversation.ExecutionBatch` is the native controlled batch disclosure. Supply
`label`, optional state/accessible title, `expanded`, `onExpandedChange` and
children. Nest it to compose process → batch → step without sharing expansion
state; hiding a parent preserves the children's state and evidence. Optional
`locked` disables only this disclosure's trigger, not nested actions; `animated`
controls its transition (default true). The host
remains responsible for live/terminal outcomes and timing, including unknown or
interrupted states. The native batch uses this view; the whole-turn process
projection is a separate host concern, not inferred from the supplied children.

`Conversation.ExecutionProcess` consumes authoritative `outcome`, optional
`turnId`, `reveal` and children. Running content stays open, terminal content
starts collapsed, and unknown/interrupted outcomes are never labeled completed.
Revealing a source opens the process and preserves child expansion; it neither
executes children nor supplies a synthetic duration. The native projection groups
only contiguous, same-turn explicit commentary and batches. Interaction cards,
answers, errors and deliveries remain outside and in original order. Records
without turn identity are not guessed into a process.

`Conversation.ToolExecution` renders a host-projected tool step. Its `data` keeps
the technical `name`, friendly `label`, `status`/`statusLabel`, optional
`failure: {summary?, help}`, `summary: {text, badge?}`, `preview`, `duration`,
literal `input`/`output` and `exitCode`. Technical disclosure and outer disclosure
are independent. The host supplies authorized `actions`; the view never executes
or retries a tool automatically and does not infer success from an exit code.
`ExecutionIO` and `ExecutionStatus` are the same implementations used by native
steps. Hidden details are inert, while the evidence remains available on reopen.

### Web execution records

`Conversation.WebSearchRecord` presents a complete execution-history record,
not an answer-source list: the actual submitted `queries`, optional `page` and
`pattern`, ordered `results` and status remain in one disclosure. Result titles
invoke `onOpenResult` with the original selected item; the host validates its
destination. A failed open stays next to that result and the same title retries.
The visible-result limit is configurable (`initialVisibleResults`, default 3);
more/collapse uses the actual hidden count and never discards results. No callback
means no opening capability. Native web-search activity uses the same component.

### Conversation context

`Conversation.ConversationReference` is the same popover used by native session
references. Supply `label`, `title`, literal `messages`, `loaded`, `loading`,
`changed`, `error`, `canPreview`, `onOpen` and optional `onMore`. The host owns the
authorized request, sent-reference snapshot identity and pagination cursor. A
changed-source notice distinguishes current content from the originally cited
conversation; the component does not itself fetch, authorize or send anything.
Existing messages remain visible when loading a later page fails. Closing the
popover does not discard the host's loaded state. `ComposerRefChip` reuses the
existing input context tag and keeps removal separate from opening or sending.

`Conversation.ImageView` is the same read-only viewer used by the workbench.
Supply an authorized `url`, `title`, load-failure flag, `viewState` and
`onViewChange`. It retains dimensions, fit, actual-size, zoom and pointer panning,
with explicit invalid-image feedback. Wheel zoom and double-click fit/double-size
use the same state callback as toolbar zoom and panning. Resource authorization, Blob URL ownership,
file operations and persisted tab state remain in the host. This is the viewer
primitive, not yet the full demo image gallery or its file-action workflow.

`Conversation.CitationLink`, `WebCitationLink` and `CitationSources` share the
host's complete evidence preview, mixed-source directory, verification dialog and
retry UI. Receipt resolution, answer hashing/range binding, authenticated preview
URLs and workspace navigation remain in the host adapter. Inject those operations
through the documented callbacks; never treat a source marked `exact` by frontend
data as permission to read it. Web opening receives the original URL, while its
display may decode readable text. `sourceKey` binds a directory to its answer;
refresh failures preserve known sources with explicit stale-state feedback.
Raster icons are included in the resource bundle, not resolved in the consuming
plugin's directory. No host API/store implementation is bundled by these exports.

`Conversation.Artifact` and `Conversation.ArtifactMenuItems` share Desktop's
artifact card, exact version selection and full nested menus. Menu expansion and
closing belong to the view; opening, saving, importing, application discovery and
integrity checks stay in caller-supplied host callbacks. The host supplies operation
feedback through `children`. Displaying a card grants no file or application access.

`Conversation.ArtifactDestination` is the same resource/literature destination
dialog used by Desktop. `location` and `onLocationChange` keep filename/folder
selection controlled; draft-folder creation is only a selection until the host
validates and executes `onSubmit`. `saving`, `error` and `onOpenChange` preserve
pending, failure/retry and cancel behavior. Preview callbacks must return sample
responses, never call real import/save operations. This shared view does not add
new plugin permissions or imply that every artifact viewer is migrated.

`Conversation.FileMenuItems` is the same menu implementation as
`ArtifactMenuItems`, usable under `DropdownMenu`, `ContextMenu` or `Menubar`.
It provides complete open-with submenus and optional `onOpen`, `onImport` and
`onSaveAs` ports; `showSaveAs={false}` omits an operation the host does not offer.
`directory` restricts the menu to reveal/copy only. `canUsePath`, `canImport`,
`canSaveAs` and `downloading` are host-projected availability, never authorization.
`emptyApps` preserves the host's full empty-state content. File/application
discovery and business feedback remain host-owned. The native workspace menu
uses this view without changing its file operations. Sent attachments still
require their own source-authorized operations; they do not gain path authority
by using this view.

The public controls include these context/menubar families as well as dropdowns.
Selecting a terminal submenu item closes its menu chain; Escape dismisses only
the focused submenu and leaves its parent available. Independent nested roots
are not implicitly members of that chain. Preview ports must record sample
responses instead of calling native file operations.

`Conversation.ArtifactGroup` arranges separate artifact-card children side by
side and wraps them within the available width. It adds no batch title, import
or open action. Supply one direct child per artifact; retain each child's own
identity and operation state. Images and auxiliary path links keep their own
presentations rather than becoming duplicate file cards. Empty groups render
nothing. Single cards retain the demo's bounded reading width.

`Conversation.Message` preserves literal user text instead of interpreting Markdown.
Long messages expand/collapse without changing the copied source; HTTP(S) links
keep their original destination and use an explicit `onOpenExternal` callback.
No callback means plain text, not a dead or privileged link. `onCopy` is similarly
host-controlled. Optional `header`/`children` compose context and attachments;
the host retains their object identity, permissions and existing rewind flow.
Only supplied durable `timestamp` values are shown; the component invents no time.

`Conversation.Tabulation` supplies the shared table frame, horizontal scrolling,
sticky first-column context, caption/notes and controlled copying. Markdown tables
use the same frame: TSV retains displayed values, quotes embedded separators and
newlines, and keeps citation text; numeric columns align right without inventing
missing values or stripping source interactions. Detectable unparsed table syntax
retains its original source with a warning. `invalidSource` uses raw-source copying,
not a fabricated TSV. The caller supplies `onCopy`; no clipboard privilege is added.

`Conversation.Formula` renders untrusted LaTeX with KaTeX trust disabled. Optional
`caption` and `notes` retain the producer's symbol, unit and assumption notes;
rendering itself does not validate mathematics. Block math in `Conversation.Markdown`
uses this same component. Parse errors retain the original source and copy action;
inline math, currency and code stay on their existing parsing path. The `onCopy`
port receives `(source, html?)`: the formula view provides editable MathML/HTML
alongside plain text, while the LaTeX view provides source only. Desktop supplies
its existing rich clipboard writer; isolated consumers still need an authorized
host port. No native clipboard permission is added by importing the component.

`Conversation.Code` displays source, language and a collapsible full-line view.
`mode: command | output` removes code line numbers; neither mode executes code or
claims an execution result. `onCopy` must be provided by the caller and receives
the complete original source, including trailing newlines, without line numbers.
`Conversation.Markdown` uses the same component for fenced blocks and accepts the
same `onCopy` port. Desktop's Markdown wrapper supplies its existing clipboard
writer; the isolated SDK does not acquire Desktop clipboard access or add a new
host capability. Without a copy port, no nonfunctional copy button is shown.

`Conversation.Failure` reuses the host error/interruption presentation with the
original error item, localized `failureText`, controlled recovery availability,
pending/unknown/error state, and `onContinue`/`onRepair` callbacks. Authentication,
current-turn checks and model configuration remain in the host. No callback
grants permission; an unavailable host recovery must stay unavailable in the card.

`Conversation.Plan` accepts projected `items` (including nested children and
elapsed milliseconds), `summary`, optional estimates, and an explicit continuation
callback. It shares the Desktop plan presentation without accessing the session
store or executing a plan. The host projects current-turn eligibility and timing,
and still authorizes continuation; plugins must bind callbacks to declared host
operations. Passing display state does not authorize resuming any session.

`Conversation.Attachments` uses the original file/directory chip implementation.
Pass `refs`, controlled `openPaths`, `onOpen`, `onRemove` and optional
`renderActions`; remove callbacks retain indexes in the original reference list,
including entries that are not file chips. It does not read the document workspace
or open files itself. The Desktop adapter supplies its existing workspace state.
`Conversation.FileFormatIcon` shares the existing format mapping and visual assets.
`IconButton` is exported for compact attachment/menu actions; neither export grants
file access. Mixed image grids, file menus and preview routing still need complete
topic-level runtime acceptance.

Compatibility `1.0` describes the exported API and interaction semantics. Resource
`version` identifies a release; the host also fixes its byte fingerprint for each
interaction. Updating the active system dependency must not replace the runtime of
an existing frame or reinterpret its action. This package does not grant direct
HTTP, filesystem, Electron or parent-DOM access.

Eight existing public slots now have independent entries: question, authorization,
selection, search summary, search details, references, downloads and delivery.
`Review` is available for composition; the literature-review outline and result
entry now consumes `Conversation.Review` and `Conversation.Choices` from this
runtime instead of bundling React, styles, translations or fonts again. Its
existing plugin slot ownership, declared actions and host authorization remain
unchanged. User input, execution,
complete answer-body and artifact topics have shared building blocks, but complete
topic migration and final runtime acceptance remain pending. Source-authorized
file menus, exact position recovery, chart export and the full Canvas workbench
lifecycle are not proven by the available exports.
Contract tests are not real product
acceptance; isolated loading, updates and retained selection still need Desktop
verification through its public UI paths.

## Content composition

`Conversation.Diagram` is the same Mermaid renderer used by Markdown fences. It
keeps strict rendering and locks site configuration against source directives.
The resulting SVG is an image resource, not executable markup inserted into the
answer DOM. Source switching, complete copying and the shared image zoom remain
available; render errors preserve the source in that diagram only.
The isolated package build replaces the renderer library's direct `window.open`
primitive with an explicit denied operation. Strict configuration and inert SVG
are still required; actual navigation only uses declared host ports.

`Conversation.Code` highlights recognized languages, preserves literal text and
multiline syntax, and falls back to plain text for unknown languages. Highlighting
never changes the source sent to the caller's copy port.

`Conversation.Canvas` composes arbitrary official controls and conversation
components inside a bounded, keyboard-scrollable preview. Each instance retains
its own disclosure. Optional `onOpen` must be bound to the same authorized content
in the host workbench; the frame itself has no navigation, saving or export
authority. The review verification sections consume the same frame. A frame
export alone does not prove the complete artifact-to-workbench Canvas lifecycle.

`Conversation.Lean` composes a real source editor/view with independent source and
InfoView disclosure. Supply `source`, controlled `mode`, `onModeChange`, editing
eligibility and the current source `revision`. Diagnostics and goals are visible
only when the service result matches that revision. Desktop supplies its existing
Monaco editor, save/undo/selection integration and an explicit unavailable state;
this change does not install a Lean server or simulate proof checking. Plugins
must not replace that unavailable state with sample successful diagnostics.

`Conversation.Suggestions` retains its form variant and offers `variant="compact"`
for the answer-tail capsules. The Desktop consumer hides suggestions during input,
competing execution/confirmation/failure and remembers per-turn dismissal. Sends
use the existing composer and preserve session context; no regeneration action is
provided. Plugins remain responsible for declaring and binding their own host
operations; display state never grants submission authority.

The whole resource library is catalogued by bounded families, including Runtime
exports. The host checks exact export coverage, family/export uniqueness and
per-family limits under the existing 64KiB descriptor/catalog byte limits.
Individual plugin declarations keep their original limit; increasing the library
does not increase a plugin's capabilities or action allowance.

Official resources are distributed only with Desktop. The ordinary plugin upload
and confirmation routes reject UI archives; there is no user-facing update entry.
Startup validates the bundled archive and reconciles it with the active dependency.
Existing interaction snapshots retain their resource bytes and choices. This does
not compile the resource package back into the host renderer or allow arbitrary
local packages to claim official status.

The host retains its original selector solely for existing `host-v1` bindings,
whose historical records have no resource snapshot. This compatibility copy is
registered as `legacyOnly`; it cannot service new bindings or resource-less
previews. New selection cards use the independent official package. Retaining an
old bound interaction does not authorize falling back to host code when a new
resource dependency is missing.

## Product operations and typed data

`node packages/ui/plugins.cjs HOST_VERSION` builds the conversation components in
`scholarseed-product-operations` from the official schemas and tiny runtime consumers.
The three composition slots share this single Skill; detailed instructions, request
schemas and examples are progressively loaded from its references. Complete official
card discovery comes from `component/catalog` with `include_ui:true`, not a duplicated
Skill inventory. Custom card authoring uses the existing `plugin-create` workflow.
Compiled entries include neither React nor component implementations. Descriptors,
sample-only previews and request schemas derive from `schemas.ts`; normal pack/source
inventory tooling still freezes the unified distributable. The category exports are named
top-level dependencies, so older UI resources fail closed instead of accepting a
generic Conversation export that lacks the required members.
Discover HOST_VERSION from the actual plugin author contract, not Desktop's version.
The generated descriptor is restricted to that exact verified host version.

`component/catalog` with `include_ui:true` discovers the schemas under local `$defs`
and the individual chart composition entries. Dataset rows have stable IDs and an
array of literal values matching the declared columns. Chart mappings use zero-based
column indices. ECharts imports only registered two-dimensional chart modules and
the SVG renderer; raw ECharts options, executable formatters, remote resources and
automatic downloads are not accepted. The resource includes the newly bundled
libraries' license texts in its integrity inventory.

`Plot` and ten named chart components share one dataset with `DataTable`. Sorting,
filtering, pagination and row selection use TanStack Table and official controls.
Histogram bins retain their original member IDs; box plots require explicit ordered
five-number summaries. No frontend calculation establishes statistical significance.
Local interactions save JSON drafts; only a declared explicit continuation submits
the selection. Display publication is not evidence that a user submitted a choice.

Evidence selection preserves literal supplied excerpts with an unverified-source
notice. Public research cards still use authoritative literature tools. Artifact
previews compose Canvas and rich content, but real file publication and workbench
navigation retain their original host contracts. These previews do not by themselves
complete the pending source-authorized file actions, exact locator recovery, general
Canvas workbench lifecycle, configurable chart export or Lean-service integration.
