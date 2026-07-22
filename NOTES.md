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

## Customer feedback round — July 2026 (dev)

Five items from customer testing. All built **dev-only** (deploy 22/23/24) with
read-only tests (tests/22-24). Not yet in prod — awaits external-customer dev
sign-off + approval, then mirror with `-prod.js` scripts.

1. **Notification click did nothing** — bell items + "View all my cases" used a
   bare `href="?id=..."` (no `{{data.portalUrl}}` prefix) and `navToCase` never
   navigated. Fixed both: portal-prefixed hrefs in `deploy/02-header-footer.js`
   **and** `navToCase`/`navToTicketList` now drive `$location.search(...)` in
   `widgets/ahc-header-client.js`. Redeploy header to dev via
   `deploy/22-notif-nav-fix-dev.js` (re-runs 02 with the dev `showKbNav` ctx so
   the Knowledge nav link isn't clobbered).
2. **Case watchers** — Watchers section in `widgets-dev/ahc-case-detail`.
   Add/remove entries on `watch_list`; two ways to add: pick a colleague on the
   case's account (`data.watcherOptions`) **or type any email address**
   (`watch_list` is a glide_list that stores emails as well as user sys_ids).
   `add_watcher` accepts `watcherId` (32-char sys_id) or `watcherEmail`;
   `remove_watcher` matches the stored token case-insensitively. Deploy `24`.
   - **Gate = involvement, NOT a field ACL** (`canManageWatchers`): case
     `opened_by`/`contact`, or `customer_admin`/`admin`, or `canWrite()`.
     ⚠ Lesson: the first version gated on a field-level `watch_list/write` ACL
     check (`GlideSecurityManager.hasRightsTo`), which returned **false for the
     case opener** (Beth Grove in dev) and hid the whole section. SP widget
     **server scripts run in global scope where GlideRecord writes bypass ACLs
     anyway** (same reason as the old anon-case leak), so the ACL test was both
     wrong and pointless — do the gate in our own logic.
   - **Quick "Watch this" toggle**: meta-bar button on cases the current user
     did NOT open (`ng-if="data.canWatch && !data.isOpener"`), toggling on
     `data.isWatching`. Self-watch reuses `add_watcher`/`remove_watcher` with the
     user's own sys_id (`c.watchThis`/`c.unwatchThis` → `data.currentUserId`).
   - **Notifications work OOTB**: several ACTIVE `sysevent_email_action` on
     `sn_customerservice_case` already recipient `watch_list` ("Case commented
     for customer", "Case resolved/closed customer watchlist", etc.) — no
     instance change needed. Watchers are notified on the next comment/update.
3. **Session timeout** (instance `glide.ui.session_timeout`, not in repo):
   **prod = 30 min**, dev = 60 min. Guest = 5 min. Yes, the new portal has the
   same kind of inactivity logout as the old system (~30 min on prod).
4. **Multi-select filters** — `widgets-dev/ahc-case-list`: Status, **Location**
   and **Category** are all multi-select now (checkbox per option; each group's
   "All" clears that facet). Client sends `states`/`locations`/`categories`
   (comma-joined) → server `selectedStates`/`selectedLocations`/
   `selectedCategories`; empty = All. Applied as `<field> IN <selected>` inside
   `addConditions` so count/rows/export/facets all honor them. Facet lists keep
   still-selected values visible at count 0 (`keepSelectedMulti`). Replaced an
   earlier single "Hide closed" toggle and the old single-select
   location/category. "Opened by" stays a 3-way scope selector (All/Me/My Team)
   — not multi-select, since All already = Me + Team. Stats-card deep-links
   (`?filter=open|pending|resolved`) still work — server expands the named group
   into `selectedStates` on first load. Deploy `23`.
5. **"My Team" excluded Aspira staff** — was just `opened_by != me`. Now also
   `opened_by.company = accountId` in account scope, so vendor (Aspira) users
   who opened a case on the account drop out. "All" opener is unchanged. Deploy
   `23` (same widget as #4).

## Knowledge base moved to its own repo

The knowledge base (Rainger shared KB + Next Gen `/nextgen` KB portal) now lives
in **`servicenow-knowledgebase`** (private). That repo owns the KB deploy
scripts (old `deploy/07-17`), the `ahc-kb-*` KB widgets (home / categories /
article-list / article-view / deflect-banner), `lib/article-scoper.js`,
`lib/nextgen-portal.js`, and the Next Gen password-gate docs.

This portal repo keeps only the base `ahc-kb-search` widget (deployed by
`05-widgets` for the `/help` Knowledge page) and the header **Knowledge nav
link** (`showKbNav`). To layer the full KB onto dev `/help`, run the KB repo's
`deploy/help-kb-wire-dev.js` after `node deploy/index-dev.js`.

### ⚠ Anonymous case leak — fixed 2026-07-17, approach corrected 2026-07-21

The gate work didn't cause this, but surfaced it: the /help pages were created
`public=true` on 2026-05-21 (`deploy/04-pages.js`). Cases opened via inbound
email carry **opened_by=guest**, and the case-list widget's personal-scope
fallback (`opened_by=<current user>`) matched them for anonymous sessions —
~220k cases were readable at `/help?id=ticket_list` with no login.

**The fix is at the WIDGET layer, NOT page publicity:**
- `ahc-case-list/server.js` (and `ahc-stats`) bail to empty when
  `!gs.isLoggedIn()`. This is what actually closes the leak — verified:
  anonymous gets 0 cases even though the page is public.
- The /help header hides nav links + bell via `ng-if="data.isLoggedIn"`
  (nicety: anonymous visitors don't see ticket/catalog nav).
- Re-runnable: `lib/lock-help-pages.js` (scripts 19 dev / 20 prod).
- Next Gen is a separate portal/header/page — untouched.

**⚠ /help pages MUST stay `public=true`.** The first fix set them
`public=false`; that broke the portal for real customers. External CSM users
(`sn_customerservice.customer` / `snc_external`) do NOT have the `admin` role,
and the stock **sp_page read ACL** ("Allow read … for users with role admin")
means they cannot read a non-public `sp_page` — every /help page rendered
**"Not Found"** for them (found 2026-07-21 while impersonating an active
customer_admin, `AWO-elgrove`). Page publicity is the wrong lever; the widget
guards are publicity-independent. `deploy/04-pages.js` + `index-dev.js` create
pages `public=true`.

Note: internal admins don't hit this (they pass the ACL), so a non-public page
looks fine when you test as yourself — always verify portal changes as an
actual external customer.
