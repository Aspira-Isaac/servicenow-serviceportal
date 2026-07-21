# KB Article Template Guide — Aspira Help Portals

**Audience:** anyone authoring Knowledge Base articles with custom HTML/CSS design
(Next-Gen onboarding guides, styled how-tos, etc.).

**TL;DR:** wrap your whole article in one `<div class="nx-article">` and make sure
**every** CSS selector in your `<style>` block starts with `.nx-article`. That's it —
your design renders exactly as you built it, and it can't affect the portal around it.

---

## Why this matters

KB articles are rendered **inside** the help portal page — your HTML becomes part of
the same page as the portal's header, sidebar, and navigation. CSS is global by
default, so a style block like this:

```css
/* ❌ don't do this */
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: 'Segoe UI'; background: #f4f6f8; }
header { background: #0d6e78; padding: 20px 40px; }
table { width: 100%; }
```

doesn't just style *your* article — it restyles **the entire portal** while your
article is on screen. With the rules above, the portal's top navigation bar turns
teal and doubles in height (`header { }` matches the portal's own header), fonts
change across the whole page (`body { }`), and every table in every widget gets
your table styling.

The design itself is not the problem — **the selectors are**. The same design with
scoped selectors renders pixel-identical and leaves the portal untouched.

## The one rule

> Every CSS selector must start with your article's wrapper class.

```html
<!-- ✅ SAFE -->
<div class="nx-article">
  <style>
    .nx-article { font-family: 'Segoe UI', Arial, sans-serif; color: #1a2332; }
    .nx-article * { box-sizing: border-box; }
    .nx-article .nx-banner { background: #0d6e78; color: #fff; }
    .nx-article table { width: 100%; }
  </style>
  ... your content ...
</div>
```

```css
/* ❌ NEVER — these apply to the whole portal page */
* { ... }
body { ... }
html { ... }
table { ... }
header { ... }
p { ... }
h2 { ... }
```

The wrapper class (`nx-article`) plus the prefix means your rules can only match
elements inside your article. Styles you would have put on `body { ... }` go on
`.nx-article { ... }` itself.

## Do / Don't

| ✅ Do | ❌ Don't |
|---|---|
| One root `<div class="nx-article">` around everything | Multiple top-level elements with loose styles |
| Prefix **every** selector: `.nx-article .tip { }` | Bare selectors: `*`, `body`, `table`, `header`, `.tip` |
| Use **classes** for styling | Use `id="…"` for styling (ids risk collisions between articles) |
| Attach screenshots **to the article record**, reference `/sys_attachment.do?sys_id=…` | Relative paths (`uploads/home.png`) — they 404 on the portal |
| `max-width: 100%` on images | Fixed pixel widths wider than ~850px (the article column) |
| Keep styling in the article's own `<style>` block | `@import`, CDN `<link>`s, external fonts (blocked / unreliable) |
| Plain HTML + CSS | `<script>` tags or inline handlers (`onclick=`, `onerror=`) — ServiceNow strips them |

Also good to know:

- **HTML comments (`<!-- … -->`) are stripped when the article is saved** — don't
  use them to carry information.
- `position: fixed` / high `z-index` can float elements over the portal navigation
  even when scoped — avoid them.
- The article renders in a ~850–900px column; design for that width. Content
  exported from HubSpot often carries a `margin-right: 400px` wrapper that squeezes
  the layout — remove it.

## Copy-paste starter template

Visually identical to the original Next-Gen design — teal banner, section cards,
tip boxes, tables, screenshot frames — with every selector already scoped.

```html
<div class="nx-article">
<style>
  .nx-article { font-family: 'Segoe UI', Arial, sans-serif; color: #1a2332;
                font-size: 15px; line-height: 1.7; }
  .nx-article * { box-sizing: border-box; }

  .nx-article .nx-banner { background: #0d6e78; color: #fff; padding: 20px 28px;
    border-radius: 10px 10px 0 0; display: flex; align-items: center; gap: 14px; }
  .nx-article .nx-banner-logo { width: 38px; height: 38px; background: #fff;
    border-radius: 8px; flex-shrink: 0; }
  .nx-article .nx-banner-title { font-size: 20px; font-weight: 600; margin: 0; color: #fff; }
  .nx-article .nx-banner-subtitle { font-size: 12px; opacity: 0.75; margin: 2px 0 0; }

  .nx-article .nx-crumb { background: #e8f4f6; border-bottom: 1px solid #c9dfe3;
    padding: 10px 28px; font-size: 12px; color: #4a7a82; margin-bottom: 28px; }

  .nx-article .nx-section { background: #fff; border-radius: 10px;
    box-shadow: 0 1px 4px rgba(0,0,0,0.07); margin-bottom: 28px; overflow: hidden; }
  .nx-article .nx-section-header { background: #f0f8f9; border-bottom: 1px solid #d4eaed;
    padding: 16px 28px; }
  .nx-article .nx-section-header h2 { font-size: 17px; font-weight: 600;
    color: #0d6e78; margin: 0; }
  .nx-article .nx-section-body { padding: 24px 28px; }
  .nx-article .nx-section-body p { margin: 0 0 14px; }
  .nx-article .nx-section-body p:last-child { margin-bottom: 0; }

  .nx-article .nx-table { width: 100%; border-collapse: collapse; margin-top: 16px;
    font-size: 14px; }
  .nx-article .nx-table thead tr { background: #0d6e78; color: #fff; }
  .nx-article .nx-table thead th { padding: 11px 16px; text-align: left;
    font-weight: 500; font-size: 13px; border: none; }
  .nx-article .nx-table tbody tr:nth-child(even) { background: #f4f9fa; }
  .nx-article .nx-table tbody td { padding: 11px 16px; border: none;
    border-bottom: 1px solid #e4edf0; }
  .nx-article .nx-table tbody td:first-child { font-weight: 600; color: #0d6e78; }

  .nx-article .nx-tip { background: #e8f7f9; border-left: 4px solid #0d6e78;
    border-radius: 0 6px 6px 0; padding: 12px 16px; margin-top: 16px;
    font-size: 14px; color: #1a4a52; }
  .nx-article .nx-tip strong { color: #0d6e78; }

  .nx-article .nx-shot { border: 1px solid #d0dde0; border-radius: 8px;
    overflow: hidden; margin: 20px 0; background: #f9fbfc; }
  .nx-article .nx-shot img { max-width: 100%; display: block; }
  .nx-article .nx-shot-caption { background: #eef5f7; border-top: 1px solid #d0dde0;
    padding: 8px 14px; font-size: 12px; color: #5a7a82; font-style: italic; }
</style>

<div class="nx-banner">
  <div class="nx-banner-logo"></div>
  <div>
    <p class="nx-banner-title">Aspira Next-Gen Knowledgebase</p>
    <p class="nx-banner-subtitle">Client Onboarding Guide</p>
  </div>
</div>
<div class="nx-crumb">Knowledgebase &rsaquo; <strong>Your Article Title</strong></div>

<div class="nx-section">
  <div class="nx-section-header"><h2>Section title</h2></div>
  <div class="nx-section-body">
    <p>Section content…</p>
    <div class="nx-tip"><strong>Tip:</strong> callout text…</div>
    <div class="nx-shot">
      <img src="/sys_attachment.do?sys_id=ATTACHMENT_SYS_ID" alt="Describe the screenshot" />
      <div class="nx-shot-caption">Fig. 1 — caption…</div>
    </div>
  </div>
</div>
</div>
```

## Current articles — what needs to change (as of 2026-07-09)

The help portal renders articles exactly as you write them, so the changes below
are what stand between the current drafts and a working portal.

**To appear on the portal at all, an article must be:** Published (Draft articles
are hidden), Active, and assigned to a category — the six existing articles were
assigned to **Getting Started** on 2026-07-09; new articles need a category chosen
on the Knowledge form.

| Article | Status | What to change |
|---|---|---|
| KB0010728 — Next Gen - FAQs | Unscoped page template | Rebuild on the starter template above (scope all CSS under `.nx-article`) |
| KB0010729 — Next Gen - Glossary of Terms | Unscoped page template | Same |
| KB0010734 — How To - Creating a Resource | Unscoped template **+ dead image paths** | Starter template + attach screenshots to the article (current `uploads/…` paths 404) |
| KB0010736 — Navigating the Sandbox - Tips & Tricks | Unscoped template **+ dead image paths** | Same |
| KB0010741 — Next Gen - Resources vs Products | Unscoped page template | Starter template |
| KB0010735 — How To - Creating a Product | ✅ Clean | Nothing — publish when ready |

"Unscoped page template" means the article's `<style>` block uses global selectors
(`* { }`, `body { }`, `table { }`, `header { }` …), which restyle the whole portal
whenever the article is on screen. The visual design stays exactly the same after
the fix; only the selectors and the wrapper div change.

## Checklist before publishing

1. Search your `<style>` block for `* {`, `body`, `html`, and bare element names
   (`table {`, `header {`, `p {`) — there should be **none** without the
   `.nx-article` prefix.
2. Open the article on the portal. The portal header, sidebar, fonts, and
   background must look **exactly** the same as on any other page.
3. Navigate to a *different* article afterwards and confirm it also still looks normal.
4. Images: confirm each one loads (attached to the article, not a relative path).
