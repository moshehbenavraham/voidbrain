# voidbrain - UX Requirements Document

**Companion to**: [PRD.md](PRD.md)
**Created**: 2026-05-12

---

## 1. Design Brief

### Emotional Targets

Calm control + earned trust + exploratory momentum.

The user often arrives with an overloaded vault, unfinished research, or concern that AI will damage private notes. The product should feel like a careful workstation: focused, inspectable, fast, and powerful without feeling reckless.

### Aesthetic Identity

- **Reference domain**: Scientific instruments and editorial research rooms.
- **Era / movement**: Swiss International information design with Obsidian-native restraint.
- **Material metaphor**: Matte slate panels, indexed paper tabs, and a glass inspection lens over a living graph.

The interface should not look like a generic chatbot wrapper. It should look like a privacy-aware knowledge cockpit embedded inside Obsidian.

### Signature Moment

The signature moment is the "graph-to-answer" inspection loop: the user lasso-selects a cluster in the smart graph, the selection compresses into source chips in chat, and the answer streams with visible citations, tool steps, and a pending-change review bar. The moment proves that AI output came from inspectable vault material.

### Micro-Narrative

Arrival -> Orientation -> Engagement -> Action -> Resolution

```
Open vault panel
  -> see provider trust, index state, and active space
  -> ask, ingest, or inspect graph
  -> review citations, tool steps, and staged edits
  -> accept changes, save context, or recover safely
```

---

## 2. User Flows

### Flow 1: First Run and Vault Connection

**Trigger**: User installs or enables the plugin in an existing Obsidian vault.
**Goal**: Reach a ready state without moving or modifying user notes unexpectedly.

```
Welcome check
  -> Choose new vault setup or connect existing vault
  -> Confirm privacy mode and provider path
  -> Configure local or cloud provider
  -> Start background index
  -> Ready dashboard
```

**Happy path**: The plugin detects the vault, explains local-first behavior, stores secrets outside markdown, starts indexing with progress, and opens the chat view when at least lexical search is ready.
**Error states**: No provider configured, provider auth fails, local model runtime unavailable, index folder not writable, vault too large for immediate semantic indexing. Each error must provide a non-destructive fallback.

### Flow 2: Chat With Vault

**Trigger**: User asks a question from the plugin chat view or a `.chat` file.
**Goal**: Receive a grounded answer with citations and recoverable thread state.

```
Ask question
  -> Select space, visible notes, graph notes, attachments, or current selection
  -> Estimate context usage
  -> Stream assistant answer
  -> Show tool steps and citations
  -> Save or branch thread
```

**Happy path**: The answer references vault paths, Obsidian links, note snippets, and source records. Tool calls can be expanded for inspection, but stay collapsed by default.
**Error states**: Retrieval returns weak matches, selected provider cannot handle attachment type, user exceeds context, cloud provider is not trusted for private notes, answer generation fails. The UI must preserve draft input and show clear retry paths.

### Flow 3: Ingest Source Into Wiki

**Trigger**: User drops a markdown, text, JSON, CSV, image, or PDF file; pastes a URL; or runs an agent-readable ingest command.
**Goal**: Convert source material into structured, linked, reviewable markdown.

```
Add source
  -> Preview source and privacy boundary
  -> Extract source, entities, concepts, and summary
  -> Stage generated notes
  -> Review diffs and citations
  -> Apply or reject
  -> Update index and hot cache
```

**Happy path**: The user sees what will be created before files are applied. Generated notes include frontmatter, wikilinks, source links, and index updates.
**Error states**: Unsupported file, extraction failure, duplicate source, conflicting note title, missing citation, provider timeout. Recovery must keep source files untouched and leave staged drafts inspectable.

### Flow 4: Review Staged Vault Changes

**Trigger**: The assistant proposes note creation, update, deletion, move, frontmatter edit, or generated wiki maintenance.
**Goal**: Accept or reject AI-created mutations with confidence.

```
Pending change appears
  -> Expand summary bar
  -> Inspect per-file diff
  -> Accept one, reject one, or batch decide
  -> Apply with notice and index refresh
  -> Keep audit trail
```

**Happy path**: Staged edits are grouped by thread and change type. Destructive changes require stronger confirmation than additive writes.
**Error states**: File changed since staging, write permission denied, path collision, index refresh fails. The UI must keep rejected and failed changes recoverable until the user dismisses them.

### Flow 5: Smart Graph Exploration

**Trigger**: User opens the smart graph view.
**Goal**: Understand vault structure, find related notes, and send graph context into chat.

```
Open graph
  -> Build from lexical, semantic, and wikilink data
  -> Filter by folder, tag, extension, or saved space
  -> Cluster and label regions
  -> Lasso-select notes
  -> Open, immerse, save space, or send to chat
```

**Happy path**: The graph loads progressively, stays interactive, and makes clusters legible through color, labels, and inspector controls.
**Error states**: No embedding index, graph build canceled, too many nodes for readable canvas, worker error, missing note paths. The user can still use lexical and wikilink views.

### Flow 6: Vault Health Check

**Trigger**: User runs a health check from troubleshooting, command palette, or agent surface.
**Goal**: Find orphans, broken wikilinks, stale indexes, missing citations, and content gaps.

```
Run health check
  -> Scan vault and indexes
  -> Group findings by severity and type
  -> Preview suggested fixes
  -> Stage safe repairs
  -> Export report to markdown
```

**Happy path**: Findings are actionable and link directly to affected notes.
**Error states**: Scan canceled, plugin lacks read access, vault changes during scan, generated fix is unsafe. Unsafe findings stay report-only.

### Flow 7: Provider and Model Configuration

**Trigger**: User configures chat, embedding, graph, local model, cloud provider, or OpenAI-compatible endpoint.
**Goal**: Make model capability, trust, auth state, and privacy consequences visible.

```
Open settings
  -> Add provider
  -> Enter endpoint or secret through secure field
  -> Test auth
  -> Mark provider trust for private data
  -> Choose chat, embedding, and graph models
```

**Happy path**: Provider cards show auth status, capability badges, trust shield, model role, and retry controls.
**Error states**: Auth fails, model list unavailable, embedding model incompatible with existing index, cloud provider selected for private notes. Privacy warnings must block accidental disclosure.

---

## 3. Screen Inventory

| Screen | Route/Path | Purpose | Key Components |
|--------|------------|---------|----------------|
| Chat View | Obsidian sidebar item and `.chat` file view | Ask questions, inspect tool steps, manage thread branches, attach context | Space switcher, message timeline, input editor, model selector, agent selector, context meter, attachment chips, pending changes bar |
| Smart Graph View | Obsidian item view | Explore vault topology, clusters, saved spaces, and graph-selected context | Graph canvas, controls overlay, lasso mode, cluster labels, segment legend, selection bar |
| Search Modal | Obsidian modal | Find notes and scoped results with filters | Search input, inline filter chips, autocomplete, result cards, display settings |
| Provider Setup Modal | Obsidian modal | Configure local and cloud providers safely | Provider form, secret selector, endpoint fields, capability preview, auth test |
| Settings - General | Obsidian settings tab | Configure global behavior and privacy defaults | Toggle groups, managed entities, command preferences |
| Settings - Search | Obsidian settings tab | Configure lexical and semantic search behavior | Embedding index section, indexing progress, import/export, report modal |
| Settings - Agents | Obsidian settings tab | Configure agents, skills, tools, and system prompt | Agent list, skill categories, MCP tools, model warnings, editor modal |
| Settings - Graph | Obsidian settings tab | Configure graph layout and clustering | Physics sliders, color segmentation, projection controls, reset controls |
| Settings - Troubleshooting | Obsidian settings tab | Diagnose provider, index, vault, and privacy issues | Health check report, logs, reindex actions, repair suggestions |
| Ingestion Review | Modal or chat-attached panel | Preview generated notes and staged source-derived changes | Source preview, note list, citation status, diff viewer, accept/reject controls |
| Vault Health Report | Modal and markdown export | Review broken links, orphans, stale indexes, missing citations | Severity tabs, grouped findings, affected paths, staged repair actions |
| Hot Cache and Session Summary | Markdown note and chat action | Show recent context and saved conversation state | Summary sections, active threads, recent changes, related links |

---

## 4. Navigation Structure

```
Obsidian Workspace
|-- Ribbon actions
|   |-- Open Chat
|   |-- Open Smart Graph
|   |-- Run Vault Health Check
|   \-- Ingest Source
|-- Chat View
|   |-- Thread timeline
|   |-- Branches
|   |-- Pending changes
|   \-- Context input
|-- Smart Graph View
|   |-- Filters
|   |-- Spaces
|   |-- Selection actions
|   \-- Send to Chat
|-- Settings
|   |-- General
|   |-- Search
|   |-- Agents
|   |-- Graph
|   \-- Troubleshooting
\-- Vault Markdown Surfaces
    |-- AGENTS.md
    |-- CLAUDE.md
    |-- GEMINI.md
    |-- skills/
    |-- wiki/
    \-- logs/
```

**Navigation pattern**: Obsidian-native command palette, ribbon icons, sidebar views, settings tabs, and markdown command surfaces.
**Deep linking**: Vault paths, note headings, `.chat` threads, `.canvas` files, and report markdown must be linkable through Obsidian links. Plugin-specific state such as selected graph spaces may use persisted IDs.

---

## 5. Interaction Patterns

### Forms

- Validation: Use inline validation for provider setup, model selection, source ingestion, and paths; confirm on submit for destructive settings.
- Error display: Keep errors near the field, with technical detail available in an expandable disclosure.
- Success feedback: Use Obsidian notices for completed actions and persistent status badges for provider/index state.

### Modals and Dialogs

- Use modals for focused, bounded tasks: provider setup, model selection, privacy warning, search display settings, skill editing, and health report detail.
- Avoid modals for ongoing workflows such as chat, graph exploration, streaming, and staged change review.
- Confirmation dialogs are mandatory for delete, overwrite, cloud-private disclosure, batch apply, and index deletion.

### Loading States

- Chat uses streaming text, tool-step progress, and a small processing indicator.
- Indexing uses progress bars with indexed, total, skipped, current file, cancel, and report actions.
- Graph build uses staged messages: initializing index, loading vectors, reducing vectors, clustering notes, applying layout.
- Search uses immediate lexical results while semantic results or previews catch up.

### Notifications

- Toast notices: applied change, rejected change, copied content, provider auth retry result.
- Inline banners: privacy risk, missing provider, stale index, weak retrieval confidence.
- Report panels: health check findings and indexing reports.

### Context Selection

- Use chips for selected notes, visible notes, graph-selected notes, attachments, active space, and current editor selection.
- Chips must be removable, keyboard reachable, and visually distinct by context source.
- Context usage meter should warn before exceeding model limits.

### Staged Change Review

- Group pending changes by chat thread and operation type.
- Show a compact summary bar by default.
- Expand to per-file rows with badges for Create, Update, Delete, and Move.
- Diff viewer must show before and after for edits and a full preview for new notes.
- Accept and reject controls must exist at both batch and per-file levels.

---

## 6. Motion and Animation Strategy

### Philosophy

Motion should clarify state changes and make long-running local work feel alive. It must never obscure privacy, citations, or staged changes.

### Entrance Choreography

- Page load: Chat and settings views should appear immediately with skeleton or empty states, not blocked by indexing.
- Graph load: Show staged build labels, then fade the graph canvas in once the first stable layout is available.
- Modals: Use short opacity and 4px vertical movement only.

### Interaction Feedback

- Hover states: Use subtle background change, border accent, or icon color shift. Avoid large scale transforms except for the chat focus logo treatment.
- Click/tap responses: Use pressed-state background and brief icon feedback.
- Focus rings: Use a 2px accent ring with sufficient contrast against Obsidian light and dark themes.
- Drag-and-drop: Show a full-view translucent overlay with dashed accent border and upload or warning icon.

### Scroll-Driven Moments

- Chat scroll-to-latest uses smooth movement only after send or branch navigation.
- Health and index reports keep sticky section headers rather than animated reveal.
- No marketing-style scroll animations inside the plugin UI.

### Animation Constraints

- Maximum 3 elements animating simultaneously per viewport region.
- Minimum 0.6s duration for graph or report reveals that explain structural change.
- No linear easing. Use ease-out or custom cubic-bezier curves for UI transitions.
- Respect `prefers-reduced-motion` with opacity-only or immediate state changes.
- Target locked 60fps and test graph, chat streaming, and drag overlay with 6x CPU throttling.
- Graph pan, zoom, drag, lasso, and clustering must use GPU-friendly transforms and worker-backed computation where possible.

---

## 7. Layout Philosophy

### Composition Approach

The product is an embedded work surface, not a landing page. Layouts should be dense, scannable, and operational, with the graph as the only full-bleed expressive canvas.

### Visual Hierarchy

- Scale contrast: Keep UI text compact. Reserve larger type for empty states, graph labels, and report section titles.
- Negative space: Use tight spacing for settings and reports; use more breathing room around chat input and graph overlays.
- Section rhythm: Prefer vertical task groups with clear separators, not nested card stacks.

### Section Transitions

Use Obsidian-native separators, tabs, and sticky overlays. Avoid floating section cards inside other cards.

### Fixed-Format Surfaces

- Chat input, graph controls, selection bars, icon buttons, badges, and progress meters must have stable dimensions.
- Long file paths must truncate with full path available in tooltip or hover preview.
- Buttons must not resize when state changes from idle to loading.

---

## 8. Responsive Strategy

| Breakpoint | Target | Layout Approach |
|------------|--------|-----------------|
| < 640px | Mobile Obsidian pane | Single-column chat, compact chips, hidden secondary metadata, bottom-safe primary actions, 44x44px touch targets |
| 640-1024px | Tablet or split pane | Two-layer controls with collapsible settings, graph overlays stacked vertically, staged changes in accordions |
| > 1024px | Desktop workspace | Chat, graph, and settings support side-by-side Obsidian panes; graph controls can remain overlayed without covering node inspection |

**Approach**: Adaptive within Obsidian pane constraints. The same view may be narrow even on desktop when placed in a sidebar.
**Touch targets**: Minimum 44x44px for primary mobile interactions. Dense desktop controls may be smaller only when keyboard and pointer affordances are clear.

---

## 9. Accessibility

**Target**: WCAG 2.1 AA.

- Keyboard navigation: All commands, tabs, popovers, graph controls, staged changes, provider actions, and modals must be keyboard reachable.
- Screen reader: Use semantic buttons, labeled icon buttons, live regions for indexing and streaming status, and readable provider/auth status text.
- Color contrast: Meet WCAG AA in both Obsidian light and dark themes. Accent color cannot be the only status indicator.
- Focus management: Modals trap focus, return focus to opener on close, and move focus to first actionable error after failed submit.
- Reduced motion: Honor `prefers-reduced-motion` for graph transitions, chat scroll, modal entrance, and drag overlay.
- Graph accessibility: Provide non-canvas fallbacks for selected nodes, cluster legends, top notes, and keyboard action lists.
- Diff accessibility: Use text labels and signs in addition to red/green color for additions and removals.

---

## 10. Design System

### Color Architecture

- **Dominant surface (60%)**: Obsidian `--background-primary` and `--background-secondary` so the plugin feels native.
- **Secondary surfaces (25%)**: Subtle bordered panels, table rows, report groups, popovers, and modals using Obsidian modifier variables.
- **Accent (10%)**: One active accent per viewport region for selected provider, active tab, focused graph segment, or primary action.
- **Signal colors (5%)**: Success, warning, error, and privacy trust colors. Always pair with icons or text labels.

Palette character: Cool-neutral and quiet by default, with precise accent signals. Avoid dominant purple-blue gradients, beige editorial themes, and one-note dark slate palettes.

### Typography

- **Display font**: Use Obsidian theme UI font; the product should inherit the vault environment instead of importing a branded web font.
- **Body font**: Obsidian theme text font, minimum 14px for dense plugin UI and 16px for markdown previews.
- **Monospace**: Obsidian monospace font for paths, tool names, provider endpoints, JSON previews, and logs.
- **Scale ratio**: Compact 1.125 UI scale; report headings may use 1.25.
- **Minimum body size**: 16px in markdown preview and modal body copy; compact controls may use Obsidian small UI tokens.

### Spacing Scale

Use an 4px base: 4, 8, 12, 16, 24, 32, 48, 64. Dense controls use 4 and 8. View-level groups use 16 and 24.

### Elevation and Depth

Commit to a flat instrument-panel model:

- Borders carry structure.
- Background shifts show hierarchy.
- Shadows are reserved for popovers, modals, drag overlays, and graph floating controls.
- Blur is allowed only on drag overlays and modal scrims.

### Texture and Atmosphere

No decorative orbs, bokeh, or generic gradient backgrounds. The only atmospheric effect is a subtle accent wash during drag-and-drop or focused chat state, and it must be tied to interaction state.

---

## 11. Component Patterns

| Component | Used In | Behavior |
|-----------|---------|----------|
| Space Switcher | Chat, Smart Graph | Switch active vault scope globally or per chat; color marks selected space |
| Chat Input Editor | Chat | Markdown-capable editor with attachments, context chips, model and agent controls |
| Context Chips | Chat, Search, Graph | Removable chips for notes, files, spaces, filters, and graph selections |
| Tool Calls Section | Chat | Collapsible steps with preambles, tool input previews, outputs, and status |
| Citation Links | Chat answers, reports | Obsidian links with hover preview and path-aware references |
| Pending Changes Bar | Chat, ingestion review | Compact summary that expands into diff rows and batch actions |
| Diff Viewer | Staged changes | Shows create, update, delete, and move previews with accessible signs |
| Provider Status Badge | Settings, model popover | Auth state, trust state, capability, retry, and warning icon |
| Embedding Index Control | Settings - Search, Settings - Graph | Select, build, cancel, import, export, delete, and inspect indexes |
| Progress Bar | Indexing, health checks | Shows percentage, counts, current file, skipped files, and cancel action |
| Graph Canvas | Smart Graph | Pan, zoom, drag, lasso, cluster focus, hover preview, and selection export |
| Graph Controls Overlay | Smart Graph | Physics sliders, segmentation, lasso, refresh, fit, label clusters, reset |
| Report Tabs | Health, indexing report | Group findings by type or severity with counts |
| Privacy Warning Modal | Provider switch, cloud use | Blocks risky action until cancel or explicit continue |
| Search Result Row | Search modal | Title, path, badges, snippet, filter match, and keyboard open action |

---

## 12. Anti-Patterns to Avoid

- Do not present AI answers without citations when the user asked a vault-grounded question.
- Do not hide provider privacy implications behind settings-only copy.
- Do not auto-apply note rewrites as the default interaction.
- Do not use marketing hero layouts, oversized chatbot empty states, or decorative gradients inside Obsidian.
- Do not make graph visuals beautiful but unusable. Every visual selection needs a list, link, or chat action.
- Do not rely on color alone for trust, health, graph segment, or diff status.
- Do not block the whole UI while indexing or graph computation runs.

---

## 13. Open UX Questions

1. What is the final product name and should the plugin carry a distinct visual mark or stay fully Obsidian-native?
2. Should MVP prioritize the plugin onboarding flow first, the markdown agent command surface first, or ship both as one guided setup?
3. Which provider set is mandatory for first-release UX testing: Ollama, OpenAI-compatible, OpenAI, Anthropic, OpenRouter, Gemini, or a smaller subset?
4. Should URL ingestion be a first-class UI flow in MVP, or only available through markdown/agent commands until Phase 02?
5. What default vault folder schema should the onboarding flow create for sources, concepts, entities, conversations, hot cache, logs, and staged changes?
6. Should Smart Graph be enabled in MVP by default, or hidden until indexing and graph performance are proven on the target vault size?
7. Which Obsidian community plugins can the user experience assume, if any: Bases, Dataview, Templater, Obsidian Git, Local REST API, or none?
