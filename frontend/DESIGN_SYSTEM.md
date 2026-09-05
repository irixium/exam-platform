# Test Taker — Design System & UI Specification

> **For:** UI / frontend designers and developers maintaining or extending the app.
> **Scope:** `frontend/index.html`, `frontend/src/App.tsx`, `frontend/src/styles.css`
> **Status:** As-built spec — every value below matches the shipped CSS. If you change the UI, update this file.

---

## 1. Design intent

The product is an **examination atelier**, not a SaaS dashboard.

Principles, in priority order:

1. **Premium, confident, intentional.** Editorial typography, hairline rules, and restraint do the heavy lifting — no gradients-as-decoration, no pill buttons, no card-shadow soup.
2. **Sharp, structured geometry.** Radius is `0px` everywhere. Depth comes from 1px borders and hard offset shadows (`4px 4px 0`), never blurs.
3. **Strong hierarchy, generous whitespace.** One big serif idea per screen. Mono eyebrows label everything. Body copy is capped at `46–52ch`.
4. **Minimal chrome.** One 68px topbar, one footer, hairline dividers. No sidebars, no avatars, no notification bells.
5. **Clean, not sterile.** Warm paper background + faint architectural grid + a single burnt-sienna accent keep it human.

Anti-goals: rounded “friendly SaaS” buttons/cards, purple/blue gradient themes, drop-shadow cards, icon-heavy toolbars, uppercase serif headings.

---

## 2. Tokens

All tokens live in `:root` in `styles.css`. Dark mode overrides under `:root[data-theme="dark"]`. Theme is set via `document.documentElement.dataset.theme` and persisted in `localStorage("theme")`.

### 2.1 Color — Light (default)

| Token | Value | Usage |
|---|---|---|
| `--paper` | `#f1ede3` | Page background |
| `--paper-2` | `#faf8f2` | Raised surface: login panel, exam-row hover, hero-stats, upload sheet, empty state |
| `--paper-3` | `#e9e3d3` | Sunken/tinted surface: status background, drop-zone hover, `btn-line` hover |
| `--ink` | `#171510` | Primary text, headings, primary button fill, 2px structural rules, focus-shadow color |
| `--ink-soft` | `#2b2921` | Status body text |
| `--muted` | `#6f6759` | Secondary text: hero copy, descriptions, labels, account name |
| `--faint` | `#a39a86` | Tertiary: placeholders, index numbers, table heads, footer, hints |
| `--line` | `#d5cdb8` | Default 1px hairline: dividers, stats borders, status border |
| `--line-strong` | `#b3a88f` | Emphasised border: inputs, buttons-line, drop-zone dash, sheet border |
| `--accent` | `#b2431a` | **Sparing use only:** wordmark square, eyebrow `<b>`, italic words in H1, focus outline, error left-rule, accent button, hero underline segment, begin-button hover shadow |
| `--accent-deep` | `#8c3312` | Accent-button hover |
| `--moss` | `#435c2b` | Success left-rule, series tag (`row-kind`), published state |
| `--field` | `#fbf9f4` | Input fill |
| `--grid-line` | `rgba(23,21,16,0.07)` | Background grid lines |
| `--shadow` | `rgba(23,21,16,0.12)` | Reserved (hard shadows use solid `var(--ink)` / `var(--accent)` instead) |
| `--radius` | `0px` | Global — do not introduce rounded corners |

### 2.2 Color — Dark (`data-theme="dark"`)

| Token | Value | Notes |
|---|---|---|
| `--paper` | `#10110e` | |
| `--paper-2` | `#171815` | |
| `--paper-3` | `#1e201b` | |
| `--ink` | `#ece7d9` | Text + rules invert to paper-light; buttons invert accordingly |
| `--ink-soft` | `#d4cec0` | |
| `--muted` | `#9c9482` | |
| `--faint` | `#6b6557` | |
| `--line` | `#2b2d27` | |
| `--line-strong` | `#4a4d42` | |
| `--accent` | `#e0683a` | Brightened for contrast on dark |
| `--accent-deep` | `#f08356` | |
| `--moss` | `#9dbb76` | Brightened for contrast on dark |
| `--field` | `#141510` | |
| `--grid-line` | `rgba(236,231,217,0.06)` | |
| `--shadow` | `rgba(0,0,0,0.5)` | |

Rules for theme work:

- Never hard-code a hex in a component; always use a token.
- `--ink` ↔ `--paper` inversion is what makes `.btn-ink` and `.begin-btn:hover` work in both themes automatically.
- Accent text on accent fill is only used in `.btn-accent` (`#fff8f0` on light). In dark mode the fill is `#e0683a` with the same off-white text — verified contrast, do not change text color per-theme.
- `::selection` is always `background: var(--ink); color: var(--paper)`.

### 2.3 Typography

Loaded in `index.html`:

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400..700;1,9..144,400..700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
```

Stacks (in `styles.css`):

- `--display: "Fraunces", "Test Taker Display", Georgia, "Times New Roman", serif`
- `--sans: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
- `--mono: ui-monospace, "SF Mono", "Cascadia Mono", Menlo, Consolas, monospace`

Roles:

| Role | Font | When to use |
|---|---|---|
| Display | Fraunces | All `h1/h2/h3`-level ideas: manifesto H1, hero H1, login-index title, row titles, sheet H2, empty H3, stats numbers |
| Text | Inter | Body, inputs, buttons’ inherited text, descriptions, status |
| Label | Mono | Eyebrows, field labels, stats terms, buttons, badges, footer, loader, hints, table heads |

Type scale (shipped):

| Element | Size | Weight | Tracking | Leading | Class |
|---|---|---|---|---|---|
| Manifesto H1 | `clamp(3rem, 7vw, 6.4rem)` | 560 (roman) / 420 italic | `-0.045em` | `0.94` | `.login-manifesto h1` |
| Hero H1 | `clamp(2.9rem, 6.4vw, 5.6rem)` | 560 / 420 italic | `-0.05em` | `0.95` | `.hero h1` |
| Login title | `1.9rem` | 600 | `-0.03em` | 1.1 | `.login-index strong` |
| Row title | `clamp(1.35rem, 2.4vw, 1.9rem)` | 580 | `-0.03em` | `1.08` | `.row-title` |
| Sheet H2 | `1.7rem` | 600 | `-0.03em` | 1.15 | `.sheet-head h2` |
| Empty H3 | `1.8rem` | 560 | `-0.03em` | 1.15 | `.empty h3` |
| Stats number | `1.5rem` | 400 (display) | `-0.02em` | 1 | `.hero-stats dd` |
| Body | `15px` base, `1.02rem` ledes | 400/500 | normal | `1.6` / `1.65` | `body`, `.manifesto-sub`, `.hero-copy` |
| Mono eyebrow | `11px` | 600 | `0.2em`, uppercase | 1.5 | `.eyebrow` |
| Field label | `10.5px` | 700 | `0.18em`, uppercase | 1.4 | `.field > span` etc. |
| Buttons | `12px` (11.5px for link/begin) | 700 | `0.14–0.16em`, uppercase | 1 | `.btn-*`, `.begin-btn`, `.link-btn` |

Display details:

- Display headings use `text-wrap: balance` (manifesto, hero).
- Emphasis inside display headings is always `<em>` → italic, lighter weight (420), accent color. Example: `Write well. <em>Prevail.</em>`, `Assessments, <em>composed</em> with intent.`
- Never uppercase a display heading. Uppercase is reserved for mono labels.

### 2.4 Background & grid

Every top-level page uses the same architectural grid:

```css
background-image:
  linear-gradient(var(--grid-line) 1px, transparent 1px),
  linear-gradient(90deg, var(--grid-line) 1px, transparent 1px);
background-size: 72px 72px;
```

Applied to: `.login-page`, `.catalog-page`, `.app-loading`.

- Grid is structural texture, not content. Keep opacity as-token; do not darken.
- Surfaces sit flat on the grid (`--paper-2` panels, `--paper` rows). No backdrop blur on pages (blur is only for `.modal-backdrop`).

### 2.5 Spacing & layout

- Page max width: `1180px` (`.catalog-inner`, `.topbar` in catalog, `.footer`). Centered with `margin: 0 auto`.
- Page gutters: `clamp(20px, 4vw, 48px)`.
- Login manifesto padding: `clamp(40px, 6vw, 96px)` vertical, gutter horizontal. Login panel: `clamp(40px, 5vw, 88px)` × `clamp(24px, 4vw, 72px)`.
- Hero padding: `clamp(48px, 7vw, 104px)` top, `clamp(32px, 4vw, 56px)` bottom.
- Section rhythm: toolbar `30px 0 22px`; exam rows `30px 8px`; sheet body `28px 34px 34px`.
- Stack gaps: manifesto column `40px`; hero-side `22px`; forms `20px`; question list `16px`; sheet actions use `14px` gap, right-aligned.
- Content measure: `.manifesto-sub` and `.hero-copy` capped at `46ch`/`52ch`; `.row-desc` at `52ch` with 2-line clamp.

### 2.6 Borders, shadows, motion

- Borders: `1px solid var(--line)` for structure; `1px solid var(--line-strong)` for interactive edges (inputs, line buttons, sheet). Structural emphasis: `2px solid var(--ink)` (login-index underline, hero bottom, sheet-head bottom).
- Radius: `0` everywhere, including inputs, buttons, badges, sheets, toggles, loader.
- Shadows: hard offsets only.
  - Input focus: `3px 3px 0 0 var(--ink)`.
  - `.btn-ink:hover`: `4px 4px 0 0 var(--accent)` + `translate(-1px,-1px)`.
  - `.btn-accent:hover`: `4px 4px 0 0 var(--ink)`.
  - `.begin-btn:hover`: `4px 4px 0 0 var(--accent)` with fill flip to ink.
  - `.upload-sheet`: static `10px 10px 0 0 rgba(0,0,0,0.28)`.
- Motion: `160–180ms ease` for color/border/transform/background/box-shadow. Loader spin `0.8s linear infinite`. Arrow nudge `translateX(4px)` on begin hover. `prefers-reduced-motion: reduce` kills all transitions/animations.

---

## 3. Global chrome

### 3.1 Topbar (`.topbar`)

- Height `68px`, `border-bottom: 1px solid var(--line)`, flex space-between.
- Login page: full-bleed with gutter padding. Catalog: constrained to 1180px, no side borders.
- Left: wordmark. Right: account cluster or theme toggle.

### 3.2 Wordmark (`.wordmark`)

- Mono, `12px`, weight 700, `0.24em` tracking, uppercase, text `Test Taker` (with `&nbsp;`).
- Mark: `14×14px` solid accent square (`<i>`) + hard offset `box-shadow: 7px 7px 0 0 var(--ink)`. Gap `12px`.
- Do not replace with an image logo without preserving the square+offset motif.

### 3.3 Eyebrow (`.eyebrow`)

- Mono `11px`, 600, `0.2em`, uppercase, muted. Leading number/accent wrapped in `<b>` → accent color, weight 700.
- Examples: `01 — Examination Hall`, `Catalogue — 2026 Session`, `02 — Review key`, `∅ — Nothing filed`.

### 3.4 Theme toggle (`.theme-toggle`)

- `36×36px` square, `1px var(--line)` border, transparent fill, muted icon. Hover: ink border + ink icon.
- Icon: `16px` stroke SVG (`stroke-width 1.6`, `linecap: square`, no fill). Sun for dark mode, moon for light. `aria-label` flips accordingly.

### 3.5 Footer (`.footer`)

- `1180px` max, `border-top: 1px hairline`, `26px  gutter  40px` padding, flex space-between wrap.
- Mono `10.5px`, `0.16em`, uppercase, faint. Left: `Test Taker — Examination Atelier`. Right: `Set in Fraunces & Inter · MMXXVI`.

### 3.6 Focus, selection, disabled

- `:focus-visible`: `1.5px solid var(--accent)` + `3px` offset. Inputs instead use border-to-ink + `3px` ink shadow (no outline) — see §5.
- `::selection`: ink background, paper text.
- `:disabled`: `opacity 0.45`, `cursor: wait`.

---

## 4. Screens

### 4.1 Loading (`.app-loading`)

- Full viewport grid-centered on paper+grid background.
- Mark: `26px` square outline (`1.5px var(--line-strong)`, `border-top-color: accent`), spinning. Caption below: mono `11px`, `0.22em`, uppercase, muted — `Preparing catalogue`.
- Keep copy in mono; do not add a card or progress bar.

### 4.2 Login (`.login-page`)

Grid: `.login-grid` → `1.25fr 1fr`, `min-height: calc(100vh - 68px)`.

**Left — manifesto (`.login-manifesto`):**

- Right hairline (`border-right: 1px var(--line)`), bottom-anchored (`justify-content: flex-end`), `40px` stack gap, `position: relative`.
- Accent tick: `::before`, `120×4px` accent bar pinned top-left.
- Eyebrow: `01 — Examination Hall`.
- H1: `Sit down.<br />Write well. <em>Prevail.</em>` — display, balanced.
- Sub (`.manifesto-sub`): `A composed space for serious assessment. Timed papers, clean typography, and nothing between you and the questions.` Muted, `1.02rem/1.65`, `46ch`.
- Meta (`.manifesto-meta`): 3-col definition grid, `border-top` hairline, `20px` top padding. Terms mono `10.5px/0.18em` faint uppercase (`Format / Authority / Session`); values `0.9rem` 600 (`MCQ · Timed / Server-side clock / Private & sealed`).

**Right — panel (`.login-panel`):**

- Fill `--paper-2`, centered, inner max `400px`.
- Index header (`.login-index`): baseline flex, `2px` ink underline, `16px` bottom padding, `32px` bottom margin. Left display `Sign in` (1.9rem); right mono `02 / Access`.
- Fields: `.field` stacks (`9px` gap, `20px` bottom margin). See §5 for inputs.
- Submit: `.btn-ink.btn-full` — `Enter the hall →` / `Verifying…` while `isSigningIn`.
- Status `.status` when message present (error for bad credentials / unreachable backend).
- Hint (`.login-hint`): mono `11px`, faint, hairline top, `28px` top margin: `No self-registration. Accounts are issued by your administrator. Sessions expire on sign out.`

### 4.3 Catalog (`.catalog-page`)

**Hero (`.hero`):**

- Grid `1.6fr 1fr`, gap `clamp(24px, 5vw, 80px)`, bottom `2px` ink rule + `160×2px` accent segment overlapping at bottom-left (`::after`).
- Left: eyebrow (`Catalogue — {year} Session`), H1 (`Assessments, <em>composed</em> with intent.`), copy (`Each paper is timed by the server and sealed until you begin. Choose a paper below — the clock starts only when you confirm.`).
- Right (`.hero-side`, bottom-anchored): stats + admin CTA.
- Stats (`.hero-stats`): 3-col grid, `1px var(--line)` border, `--paper-2` fill; cells `16px` padding with hairline dividers (`div + div { border-left }`). Terms mono `10px/0.18em` faint (`Papers / Live / Minutes`); numbers display `1.5rem` (`pad(total)`, `pad(published)`, raw minutes). Numbers use `pad()` → zero-padded to 2 digits for counts.
- Admin CTA: `.btn-accent` full-side-width `+ Compose examination` (rendered only when `user.is_admin`).

**Toolbar (`.toolbar`):**

- Flex, bottom-aligned, space-between, wrap, `30px 0 22px`.
- Left cluster (`.toolbar-left`): search + series filter, `28px` gap.
- Search (`.search-field`, min `min(320px, 70vw)`): mono label `Search papers`; input is **underline style** — transparent, no box, `border-bottom: 1px var(--line-strong)`, `40px` min-height, `8px 2px` padding, placeholder `Type to filter…`. Focus: accent underline, no shadow.
- Filter (`.filter-field`): mono label `Series`; underline select, min `170px`, pointer cursor. Options: `All series / JEE Main / JEE Advanced / Other`.
- Right: `.link-btn` refresh — `Refresh ⟳` / `Refreshing…` while loading.

**Exam index (`.exam-index`):**

- `border-top` hairline. Header (`.index-head`): 4-col grid `64px 1.5fr 1fr auto`, `24px` gap, `14px 8px` padding, mono `10.5px/0.18em` faint uppercase (`No. / Paper / Specification / Action`), hairline bottom. Hidden below 920px.
- Row (`.exam-row`): same grid, `30px 8px` padding, hairline bottom, transparent fill, `180ms` background transition. Hover: `--paper-2` fill + title underline (`1.5px`, `5px` offset).
  - `01` — `.row-num`: mono `12px` faint, zero-padded index.
  - Paper — `.row-kind` badge + `.row-title` + `.row-desc`:
    - Badge: inline-block, mono `10.5px` 700 `0.16em` uppercase, moss text, `1px var(--line-strong)` border, `5px 9px` padding, `10px` bottom margin, transparent fill. Content: `{exam_type}` for candidates; `{exam_type} · {state}` for admins.
    - Title: display, balanced. Description: muted `0.9rem`, `52ch`, 2-line clamp.
  - Specification — `.row-meta`: flex `26px` gap. Each: mono `10px/0.16em` faint term (`Time / Marks`) + `0.92rem` 650 value (`{duration} min / {total_marks}`).
  - Action — `.row-action` → `.begin-btn` (`Begin →`). See §5.
- Numbering restarts per filter (`pad(i+1)` on the filtered list).

**Empty (`.empty`):**

- `72px 24px` padding, `1px dashed var(--line-strong)` border, `--paper-2` fill, left-aligned, `8px` top margin.
- Eyebrow (`∅ — Nothing filed`), display H3 (`No papers on the desk.` when catalog empty / `No papers match that filter.` when filtered to zero), muted body (`New examinations appear here…` / `Clear the search…`).

### 4.4 Upload sheet (dialog)

- Backdrop (`.modal-backdrop`): fixed inset, `z-index 20`, grid-centered, `20px` padding, `rgba(10,10,8,0.62)` + `blur(8px)`. Clicking backdrop closes (unless uploading); `Escape` also closes.
- Sheet (`.upload-sheet`): `min(100%, 920px)` wide, `min(880px, 100vh-40px)` tall, scrollable, `--paper-2` fill, `1px var(--line-strong)` border, hard `10px 10px` black shadow. `role="dialog"`, `aria-modal`, labelled by `#upload-title`.
- Head (`.sheet-head`): flex space-between, `30px 34px 24px` padding, `2px` ink bottom rule, sticky. Left: eyebrow (`01 — New examination` / `02 — Review key`), H2 (`Compose examination` / `Review questions`), steps (`.sheet-steps`). Right: `.link-btn` `Close ✕` (disabled while uploading).
- Steps: flex `10px` gap, `12px` top margin. Each: mono `10.5px/0.14em` uppercase, `1px` border, `5px 10px` padding, muted. Active: ink fill + ink border + paper text (`01 Metadata` active pre-parse; `02 Key` active in review).
- Body (`.sheet-body`): `28px 34px 34px`.
- Step 1 form: `.upload-fields` 2-col grid (`20px 18px` gap). Labels mono `10.5px` 700 (see §5). Title + brief span full width (`.wide-field`). Placeholders: `e.g. JEE Main — Mock 07`; `One or two lines on syllabus, scope, and intent.`
- Dropzone (`.drop-zone`): full-width button, grid-centered, `150px` min-height, `28px 20px` padding, `22px` top margin, `1px dashed var(--line-strong)`, `--paper` fill, centered. Label `0.95rem` 650 (`Drop the answer key here` / filename); sub mono `11px/0.1em` muted (`CSV only · or click to browse` / `Click to replace · CSV only`). Hover/dragging: accent border + `--paper-3` fill. Hidden file input (`accept=".csv,text/csv"`).
- Actions (`.sheet-actions`): right-aligned flex, `14px` gap, `26px` top margin. Step 1: `Cancel` (line) + `Parse & review →` (ink, `Parsing…` while busy). Review: `← Back` (line) + `Seal examination` (accent).
- Step 2 review: `.review-summary` (display `1.3rem`, hairline bottom, `16px` bottom padding, `20px` bottom margin: `{name}` + mono count `{n} questions`); `.question-list` (`16px` gap); `.question-editor` cards (see §5).

---

## 5. Components

### 5.1 Buttons

Base (`.btn-ink, .btn-accent, .btn-line`): inline-flex centered, `10px` gap, `52px` min-height, `14px 22px` padding, `1px` border, radius 0, mono `12px` 700 `0.16em` uppercase, `160ms` transform/background/color/shadow.

| Variant | Fill / border / text | Hover (not disabled) |
|---|---|---|
| `.btn-ink` | ink fill, ink border, paper text | `translate(-1px,-1px)` + `4px 4px 0 accent` |
| `.btn-accent` | accent fill/border, `#fff8f0` text | fill → `accent-deep`, `translate(-1px,-1px)` + `4px 4px 0 ink` |
| `.btn-line` | transparent, `line-strong` border, ink text | ink border + `paper-3` fill |
| `.btn-full` | modifier: `width: 100%` | — |

`.begin-btn` (catalog rows): like ink-outline — transparent fill, ink border/text, `46px` min-height, `12px 20px` padding, mono `11.5px/0.14em`, `12px` gap, `nowrap`. Hover: ink fill + paper text + `translate(-1px,-1px)` + `4px 4px 0 accent`; inner `.arrow` slides `translateX(4px)`.

`.link-btn` (text actions): borderless, `4px 0` padding, mono `11.5px` 700 `0.14em` uppercase, muted text + `1px line-strong` underline. Hover: accent text + accent underline.

Rules: primary action per surface is ink (login submit, parse); accent is reserved for the single admin/terminal action (compose trigger, seal). Never use accent for every button.

### 5.2 Fields

Labels (`.field`, `.upload-fields label`, `.question-editor label`): grid, `8–9px` gap. Label text: mono `10.5px` 700 `0.16–0.18em` uppercase muted.

Inputs/selects/textareas: `100%` width, `1px line-strong` border, radius 0, `--field` fill, ink text, `52px` min-height (`44px` inside question editors), `13px 14px` padding, `0.95rem`. Textareas: auto height, `12px 14px`, `1.55` leading, vertical resize. Placeholder: faint. Focus: no outline — `border-color: ink` + `box-shadow: 3px 3px 0 ink`. Transition `160ms` border/shadow.

Toolbar inputs are the exception: underline style (transparent, bottom-border only, `40px` min-height, `8px 2px` padding, accent underline on focus, no shadow).

### 5.3 Status (`.status`)

`22px` top margin, `13px 15px 13px 17px` padding, `1px var(--line)` border + `3px` left rule (faint default / accent for `.error` / moss for `.success`), `--paper-3` fill, `0.87rem/1.55` ink-soft text. Always `role="status"`. Copy must state what happened + what to do next (e.g. `CSV parsed. Review the imported questions before submitting.`).

### 5.4 Badges

- `.row-kind`: series tag — mono `10.5px` 700 uppercase moss, boxed (`1px line-strong`, `5px 9px`), transparent. Admin variant appends state inline.
- `.row-state`: mono `10.5px/0.16em` uppercase faint; `.published` → moss; `.draft` → accent.

### 5.5 Hero stats (`.hero-stats`)

3-col grid, `1px line` border, `paper-2` fill. Cells `16px 16px 14px`, `2px` gap, vertical dividers. Term mono `10px/0.18em` faint; value display `1.5rem/-0.02em`.

### 5.6 Drop-zone (`.drop-zone`)

See §4.4. States: default / `:hover` / `.dragging` (accent border + paper-3 fill). Sub-copy always mono uppercase.

### 5.7 Sheet steps (`.sheet-steps`)

Two mono chips; active = ink fill. They reflect `review === null ? 01 : 02`, not a separate stepper state.

### 5.8 Question editor (`.question-editor`)

Grid `16px` gap, `1px line` border, `--paper` fill, `22px` padding. Header: baseline flex — display `Q{n}` (`1.15rem/-0.02em`) + `120px` number field. Then stacked labeled fields: Subject / Question (`rows=3`) / Options · JSON (`rows=3`) / Correct answer.

### 5.9 Loader (`.loader-mark`)

`26px` spinning square + mono caption. See §4.1.

---

## 6. Copy & voice

- Terse, formal, composed. Never playful SaaS (“Awesome!”, “Supercharge”).
- Shipped strings to preserve: `Sit down. Write well. Prevail.` · `Assessments, composed with intent.` · `Enter the hall →` · `Begin →` · `Parse & review →` · `Seal examination` · `Drop the answer key here` · `No papers on the desk.` · `Set in Fraunces & Inter · MMXXVI`.
- Errors guide action: `Choose a CSV file before uploading.` / `Duration and total marks must be positive numbers.` / `Complete every question field before submitting.`
- Units: `Time — {n} min`, `Marks — {n}`. Counts zero-padded (`01`, `07`).

---

## 7. Responsive

Breakpoints: `920px` and `600px`. No other breakpoints without updating this file.

At `≤920px`:

- `.login-grid` → single column; manifesto loses right border, gains bottom border; gap `28px`.
- `.hero` → single column.
- `.index-head` hidden; `.exam-row` → single column (`16px` gap, `26px 4px` padding); actions left-aligned.

At `≤600px`:

- `.upload-fields` → single column.
- `.sheet-head/.sheet-body` gutters `20px`.
- `.hero-stats` stays 3-col (compressed); `.account-name` hidden (keep sign-out + toggle); `.manifesto-meta` → 2-col.

Fluid type via `clamp()` handles the rest — do not add fixed `px` heading sizes at breakpoints.

---

## 8. Accessibility

- Semantic landmarks: `main`, `header`, `section` with `aria-labelledby`, `footer`, `role="dialog"` + `aria-modal` for the sheet, `role="status"` for messages, `aria-live="polite"` on the catalog section.
- Dialog: backdrop click + `Escape` to close (disabled while `isUploading`); sticky head keeps `Close ✕` visible; focus outline preserved (accent `1.5px` + `3px` offset) except inputs which use the ink hard-shadow focus.
- Form labels wrap inputs (no orphan `id/for` needed); file input is visually hidden but triggered by the drop-zone button; drag events `preventDefault` to avoid navigation.
- `prefers-reduced-motion: reduce` zeroes durations.
- Theme toggle and refresh expose text states (`Switch to dark mode`, `Refreshing…`, `Parsing…`, `Verifying…`).
- Do not remove underline affordances on hover (row titles, link buttons) — they are the primary hover signal for keyboard users alongside focus rings.

---

## 9. Do / Don’t

| Do | Don’t |
|---|---|
| Use hairlines + hard shadows for depth | Add `border-radius`, soft blurred shadows, gradients |
| Use mono uppercase for labels, display serif for ideas | Uppercase a serif heading; use Inter for a hero |
| Keep one accent moment per screen | Paint every CTA accent; add second accent color |
| Cap prose at `46–52ch`, clamp display type | Full-width paragraphs, fixed px heroes |
| Reuse `.btn-ink/.btn-line/.link-btn/.status/.eyebrow` | Invent a new button or alert style inline |
| Add new theme values as tokens in both themes | Hard-code hexes in component CSS |

---

## 10. File map & extension guide

- `frontend/index.html` — title `Test Taker — Examination Atelier`, meta description, `theme-color #f1ede3`, Google Fonts (Fraunces + Inter). Add new font weights here, not in CSS `@import`.
- `frontend/src/styles.css` — the entire system. Order: tokens → base → loading → shared chrome → login → catalog → upload sheet → responsive → reduced motion. New components go in the matching section with the same comment banners.
- `frontend/src/App.tsx` — screens + state. Key pieces: `normalizeExam()` (tolerates backend shape drift), `readPayload/responseMessage`, `ThemeToggle`, `screen` (`checking/login/catalog`), `query/typeFilter` + `filtered` memo, `stats` memo, `isUploadOpen/review` sheet flow, `updateQuestion`, `submitReview`.
- Backend note (do not “fix” from the frontend): `POST /signin` returns `200 + {error}` on failure (handled via `readPayload` check); `GET /exam-list` column mapping drifts (handled via `normalizeExam`).

To add a screen (e.g. exam-taking): create a new top-level page class with the same paper+grid background, reuse `.topbar`/`.eyebrow`/`.btn-*`/`.status`, keep max-width `1180px`, and document the new section here.
