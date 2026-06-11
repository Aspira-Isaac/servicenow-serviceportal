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
| `widgets/ahc-hero/template.html` | Uncomment the KB search bar (`ahc-hero__search-wrap` block) |
| `widgets/ahc-hero/server.js` | Uncomment the KB entry in `quickCards` |
| `widgets/ahc-hero/server.js` | Restore the KB mention in the default `welcomeSubtitle` if desired |

### Hero quick-access cards (hidden for stats-first iteration)

The gray quick-access card strip under the hero (`ahc-cards-section` in
`widgets/ahc-hero/template.html`) is commented out — it duplicated the hero CTA
pills once the home page switched to leading with ticket stats. Uncomment the
block to bring it back.

### Loading overlay contract

Any `ng-click` that sets `$root.ahcOverlay = true` must navigate to a page whose
widget clears it on init (`ahc-case-list` and `ahc-case-detail` both do). It is
intentionally NOT cleared on `$locationChangeSuccess` — that fires before the
destination widgets load. Nav helpers (`navToTicketList`, `navToCase`) live in
`widgets/ahc-header-client.js`; they must stay in the client script because
Angular expressions (`ng-init`) cannot define functions.

### Stock `ticket` page edits (June 2026 — shared across portals!)

The post-submission view (`?id=ticket`, also `?id=sc_request`) is the OOTB
global page, shared by every portal on the instance. Three changes were made:

| What | Where | Rollback |
|------|-------|----------|
| Removed "Tickets are picked up within 4 hours (M-F 9-5)" | `sp_instance` `44af3d50d7000200a9ad1e173e24d4ea` (Ticket Fields, page `ticket`) — `widget_parameters` blanked | Restore `{"pickup_msg": {"value": "Tickets are picked up within <br/> 4 hours (M-F 9-5)"}}` |
| Removed "Requests are picked up within…" | `sp_instance` `cc316d33d7230200a9addd173e24d4f5` (page `sc_request`) — `widget_parameters` blanked | Restore `{"pickup_msg": "${Requests are picked up within <br/> 4 hours (M-F 9-5)}"}` |
| Deleted "Set up Google Maps API" box (shown to any case writer; `google.maps.key` unset instance-wide) | `sp_instance` `29af3d50d7000200a9ad1e173e24d4d7` deleted (Ticket Location widget `2795e5e2ff123100ba13ffffffffff84`, column `a77f3d50d7000200a9ad1e173e24d488`, order 2, title "Location") | Re-create the instance with those values |

Also: the red "Your request has been submitted" banner was the portal record's
`css_variables` ($brand-primary/#link-color were #cf1d25) — fixed in
`deploy/03-portal.js`; portal vars beat theme `!default` values.

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
