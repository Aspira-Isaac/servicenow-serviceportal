# Next-Gen Platform — Requirements

---

## Online Knowledge Bases

3 Online Knowledge Bases:

- **Customer-facing online** — general across all users (no login required)
- **Client-facing online** — per client account (login protected)
- **Internal Teams KB for Next-Gen** (login protected)

> **Research findings:**
> - Client-facing (login) KB = the Rainger pattern already built. ✓
> - Internal Teams KB = Rainger (Internal) already built. ✓
> - Public no-login KB = net new. SNOW Service Portal can serve a public KB page, but a standalone static site or public-facing web page may be simpler and better for SEO.

---

## Tools Needed for KB

Reporting on KB article health and metrics:
- AVG Time Per Page View (article)
- Most Viewed Articles
- Total # of Searches
- Most Searched Terms
- Search Terms with No Results

User feedback:
- Helpful / Unhelpful ratings on articles (thumbs up / thumbs down)

> **Research findings:**
> | Feature | Status |
> |---|---|
> | Most Viewed Articles | ✅ Native — `kb_use` table, OOTB reports |
> | Total # of Searches | ✅ Native — `ts_query_log` table |
> | Most Searched Terms | ✅ Native — `ts_query_log`, basic report (~1hr to build) |
> | Search Terms with No Results | ✅ Native — `ts_query_log` where `result_count = 0` |
> | Thumbs Up / Down ratings | ✅ Native — `kb_feedback` table, OOTB SP widget |
> | **AVG Time Per Page View** | ❌ NOT native — SNOW does not track session dwell time. Requires custom JS widget instrumentation (timer on page load/unload posting to a custom table). ~1–2 days custom work. |
> | Trending over time (all metrics) | ⚠️ Needs Performance Analytics add-on for true time-series dashboards |

---

## AI Features

### Help Desk Ticket Responses with AI
- AI-generated reply recommendations in each ticket
- Recommendations include links to relevant KB articles

> **Research findings:**
> - ✅ Native with **Now Assist for CSM** add-on — "Chat response suggestions" + "Suggested KB articles" during case work.
> - ⚠️ Requires Now Assist add-on (~20–40% on top of base CSM contract). Not included in base license.

---

### AI Customer Agent
- In-app chat agent deployed inside Next-Gen Platform
- Minimize / close agent window
- Handoff: create ticket from conversation
- Handoff: transfer to human agent *(not initial need, but architect for it)*
  - Agent recognizes when human touch is needed and transfers automatically
- Set working hours to control when agent is active

**AI Agent Conversation Stats:**
- Resolved / Not Resolved — tracked over time
- Positive / Negative sentiment — tracked over time

**Training Sources (selectable):**
- The KB
- Website and landing pages
- YouTube training videos
- External files

> **Research findings — two paths:**
>
> #### Option A: ServiceNow Virtual Agent + Now Assist
> | Requirement | Status |
> |---|---|
> | In-app chat deployable inside Next-Gen Platform | ✅ Yes — JS embed snippet (iframe). Works but limited theming. |
> | Minimize / close window | ✅ Yes — native widget UI |
> | Create ticket handoff | ✅ Native — OOTB Flow Designer action |
> | Transfer to human agent | ✅ Native — via AWA/Connect Chat. **Separate license needed for live chat.** |
> | Working hours control | ✅ Configurable via SNOW schedule + queue config |
> | Resolved/Unresolved stats | ✅ VA Analytics dashboard (containment rate) |
> | Sentiment tracking | ⚠️ Requires separate Sentiment plugin install |
> | KB as training source | ✅ Native grounding on `kb_knowledge` records |
> | Website / landing pages | ❌ Not native — no web crawling. Custom pipeline needed. |
> | YouTube training videos | ❌ Not supported at all |
> | External uploaded files | ✅ Washington/Xanadu: uploaded docs supported |
>
> **Now Assist add-on required** for GenAI answers (without it, Virtual Agent is purely scripted NLU flows — no generative responses).
>
> #### Option B: Custom Claude API Chat Widget
> | Dimension | Assessment |
> |---|---|
> | Conversation quality | Significantly better than Now Assist |
> | External sources (web, YouTube, files) | Fully flexible — you control the RAG pipeline |
> | SNOW integration (case creation, handoff) | Custom — every SNOW action needs API calls |
> | Time to deploy | Faster to build (~days), but you own the full stack |
> | Cost | Anthropic API (usage-based) vs. Now Assist flat add-on |
> | Data residency | Data leaves SNOW and goes to Anthropic — check compliance requirements |
>
> #### Recommendation
> **Hybrid approach worth considering:** Use SNOW Virtual Agent for structured flows (create ticket, check status) and Now Assist for KB-grounded answers. For richer AI conversation and external source grounding (website, YouTube), a Claude-powered layer on top delivers substantially better quality. The two are not mutually exclusive — a custom Claude widget can hand off to SNOW via REST API for case creation/routing.
>
> **The YouTube/website training source requirement cannot be met by Now Assist alone** — this is the biggest gap.

---

### Separate Piece — AI Tool for KB Article Standardization
- Shared Claude Project + Claude Skill for writing Next-Gen KB articles
  - Loren will create and share to explore this option
  - Likely lands in the Product Enablement Specialist role *(meeting with Vince and Doug to discuss)*
- **ServiceNow Now Assist for Knowledge Management:**
  - Generate articles from resolved cases/incidents
  - AI-assisted editing and formatting
  - Duplicate detection and knowledge gap identification
  - Summarize content, surface answers through AI Search and portals

> **Research findings:**
> - Now Assist for KM = add-on, not base license. Same Now Assist SKU covers both CSM agent assist and KM article generation.
> - Claude Skill approach (Loren's idea) is complementary — better writing quality, but lives outside SNOW. Now Assist generates from within SNOW case workflows.
> - These can coexist: Now Assist for quick article drafts from resolved cases; Claude Skill for higher-quality article creation and standardization.

---

## Snippet Template Responses

- Short, reusable pre-written responses to common requests
- Team-wide or individual-team specific

> **Research findings:**
> - ✅ **Fully native** — SNOW calls these **Quick Messages** (`csm_quick_message` table).
> - Supports group-scoped (team-wide) and personal messages.
> - Supports variable substitution (e.g., `${caller_name}`).
> - Available in Agent Workspace reply toolbar. Zero custom work needed.

---

## Ticket CSAT Survey

- CSAT survey sent automatically when each support ticket / case is closed

> **Research findings:**
> - ✅ **Fully native** — uses Surveys & Assessments module (ships with CSM).
> - Triggered via Flow Designer flow on case close/resolve.
> - May be **inactive by default** on new instances — needs to be turned on and a survey template selected.
> - Basic CSAT reporting is OOTB. Trending over time needs Performance Analytics.

---

## Dashboards and Reports

SLA Tracking + All Support Metrics:
- AVG Time to Respond
- AVG Time to Close
- Ticket Totals
- Highest Ticket Volume by Park
- Developer Help Tickets
- Ticket Totals by Category

> **Research findings:**
> | Metric | Status |
> |---|---|
> | SLA tracking (breach/compliance per case) | ✅ Fully native — `task_sla` table, OOTB visual indicators |
> | Ticket Totals | ✅ Native OOTB report |
> | Ticket Volume by Category | ✅ Native OOTB report |
> | Volume by Park / Developer tickets | ✅ Native — filter/group by assignment group or custom field |
> | AVG Time to Respond | ⚠️ Partial — build from `task_sla.business_duration` (~2–4 hrs) |
> | AVG Time to Close | ⚠️ Partial — `closed_at - opened_at` calculated field (~2–4 hrs) |
> | SLA compliance trends over time | ❌ Needs Performance Analytics add-on |
> | Client-facing portal dashboards | ❌ Not native — custom SP widget required (~1–3 days dev) |

---

## Ticket Categories / Tags / Properties

- Defined as Next-Gen product is built
- Examples: General Settings, Payments, Integrations, Reports, Reservation Cancellations, etc.

> **Research findings:**
> - ✅ **Fully native** — Case Category + Subcategory fields OOTB. Configured via choice lists.
> - ✅ Platform Labels (freeform tags) also native.
> - ⚠️ AI auto-categorization (suggest category from description) requires Predictive Intelligence add-on.

---

## Client Portal for Next-Gen

- Clients view SN tickets (conversations with AM) — integrated with HubSpot
- Client Portal Page — link to HubSpot Next-Gen Platform landing pages

> **Research findings:**
> - Clients viewing their own SN tickets on the portal = ✅ native CSM portal capability (account-scoped case list).
> - HubSpot integration on this page = see HubSpot section below.

---

## HubSpot ↔ ServiceNow Integration

- HubSpot Contact Records display associated SN tickets
- AMs in HubSpot see SN ticket associations with Contacts

> **Research findings:**
> - ❌ **No native certified connector exists** — neither ServiceNow Store nor HubSpot Marketplace has a first-party integration.
>
> | Scenario | Approach | Effort |
> |---|---|---|
> | SN tickets visible on HubSpot Contact record | HubSpot CRM Card (UI Extension) calling SN REST API | 2–4 days |
> | One-way push (new SN case → HubSpot activity) | Make / Zapier | 0.5–1 day |
> | HubSpot company data synced into SN account | Make / Integration Hub spoke | 1–2 days |
> | Full bidirectional real-time sync | Custom middleware | 4–8 weeks |
>
> **Recommended path:** Make/Zapier for event-driven pushes + HubSpot CRM Card for displaying SN cases inline on the Contact record. ~3–5 days total.
>
> **Key gotcha:** Account matching (HubSpot company ↔ SN account) by domain/name normalization is the hardest part. HubSpot Operations Hub Professional (~$800/mo) may be needed for Custom Objects if you want to avoid mapping SN cases to HubSpot's native Tickets object.

---

## Summary: Native vs. Custom/Add-on

### ✅ Native — Works OOTB (base CSM license)
- KB article ratings (thumbs up/down)
- KB metrics: views, search terms, zero-result searches
- CSAT survey on case close *(needs activation)*
- Quick Messages (canned responses/snippets)
- Case categories & subcategories
- SLA tracking per case
- Basic reports: ticket totals, volume by category, SLA breach counts
- Virtual Agent: scripted NLU flows, case creation, working hours, human handoff
- Client portal: account-scoped case list

### ⚠️ Add-on Required
| Feature | Add-on |
|---|---|
| Now Assist: GenAI chat answers, KB article generation, case summarization, reply suggestions | Now Assist for CSM/KM (~20–40% on base contract) |
| Sentiment analysis | Sentiment plugin (separate install) |
| SLA/KB/CSAT trending over time | Performance Analytics |
| AI auto-categorization | Predictive Intelligence |
| Live agent chat (Connect Chat) in CSM | Digital Customer Service / AWA license |

### ❌ Custom Work Required
| Feature | Effort |
|---|---|
| AVG time on KB page view | ~1–2 days (JS timer widget) |
| AI training on website / YouTube sources | Custom RAG pipeline (significant) |
| Client-facing reporting dashboard on portal | ~1–3 days (custom SP widget) |
| AVG time to respond / close reports | ~2–4 hrs (calculated fields) |
| HubSpot CRM Card showing SN tickets | ~2–4 days |
| HubSpot ↔ SN event sync | ~1–2 days (Make/Zapier) |
| Public no-login KB | Evaluate: SNOW public SP page vs. standalone site |
