# Aspira Help Center — Developer Notes

Portal URL: `https://aspiraconnect.service-now.com/help`  
Deploy: `node deploy/index.js` from repo root (fully idempotent).

---

## Hidden Features (re-enable when ready)

### Knowledge Base

Search for `KB hidden until ready` across the repo to find all commented-out blocks.

| File | What to do |
|------|-----------|
| `deploy/02-header-footer.js` | Uncomment the nav "Knowledge" `<li>` |
| `deploy/02-header-footer.js` | Uncomment the footer "Knowledge Base" `<a>` |
| `widgets/ahc-hero/template.html` | Uncomment the "Browse Knowledge Base" `<a>` pill |
| `widgets/ahc-hero/server.js` | Uncomment the KB entry in `quickCards` |

### Quick Links widget

In `widgets/ahc-quick-links/template.html`, change:
```html
<div class="ahc-ql" ng-if="false">
```
back to:
```html
<div class="ahc-ql" ng-if="data.links.length">
```

---

## Key sys_ids

| Record | sys_id |
|--------|--------|
| Portal (`/help`) | `fabeccf82b4d0b14a0ebfe37b891bfb5` |
| Theme | `26bec878fbc187dccbf9fefd6eefdceb` |
| Header | `72bec878fbc187dccbf9fefd6eefdcf4` |
| Footer | `22be40b82b4d0b14a0ebfe37b891bfe3` |
| Page: Home (`ahc_index`) | `47be4c3447c18f584c01be7d416d4378` |
| Page: Submit Ticket (`ahc_submit_ticket`) | `5fbe847c2b050fd0694af7dddd91bf25` |
| Page: KB Search (`ahc_kb_search`) | `dbbe803c2b4d0b14a0ebfe37b891bf11` |
| Page: My Tickets (`ticket_list`) | `7fc3247847c9cf584c01be7d416d4360` |
| Page: Case Detail (`ticket_detail`) | `6397e03847cdcf584c01be7d416d43e5` |
| Widget: Hero | `6fbecc3c2b050fd0694af7dddd91bf19` |
| Widget: Ticket Wizard | `a7bec87c2b050fd0694af7dddd91bf85` |
| Widget: KB Search | `e3be8cb82b4d0b14a0ebfe37b891bf8e` |
| Widget: Quick Links | `8d22e8f84749cf584c01be7d416d4357` |
| Widget: Case List | `b39760b82b098b14a0ebfe37b891bf2b` |
| Widget: Case Detail | `44a7643847cdcf584c01be7d416d43a4` |
| Widget: Stats | `11ec70fcfb854bdccbf9fefd6eefdc20` |

---

## ServiceNow SP Gotchas

### Widget layout hierarchy
`sp_page` → `sp_container` → `sp_row` → `sp_column` → `sp_instance`

`sp_row` does **not** link directly to `sp_page`. Always create an `sp_container` first (fields: `sp_page`, `order`, `width: "container-fluid"`, `background_style`, `name`).

### Page ID format
ServiceNow converts hyphens to underscores in `sp_page.id` on save. Always query with the underscore form (`ahc_index`, not `ahc-index`). In `04-pages.js` we store both `id` and `storedId` for this reason.

### sp_page ACL
The `easyBI` deploy user can **create** `sp_page` records but cannot **PATCH** them (HTTP 403). Deploy scripts use read-then-skip logic for pages — never attempt a PATCH.

### CSS priority order (highest to lowest)
1. **Footer template `<style>`** — injected last in `<body>`, beats everything
2. **Widget compiled CSS** — in `<head>`
3. **Header template `<style>`** — injected early in `<body>`
4. **`sp_theme.css` / `sp_header_footer.css` fields**

Use the footer `<style>` block for any override that needs to beat widget-compiled CSS (e.g. required-field tag colors, form button colors).

### Loading overlay pattern
Two separate flags on `$rootScope`:
- `$root.ahcBarLoading` — thin top bar, set by every `$locationChangeStart`, cleared by `$locationChangeSuccess`
- `$root.ahcOverlay` — full-page overlay, **only** set by explicit `ng-click` on nav links that need it (currently just "My Tickets"), cleared by the destination widget's controller when its data is ready

The case list widget (`ahc-case-list/client.js`) clears `$rootScope.ahcOverlay` on init because `$locationChangeSuccess` timing is unreliable against widget initialization.

---

## Future Polish

- Replace the spinner on case detail back-navigation (`c.navigating = true`) with a skeleton that mirrors the case list layout for a seamless transition.
