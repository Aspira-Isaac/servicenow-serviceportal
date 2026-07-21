/**
 * Rainger KB — dev seed
 *
 * Creates in the dev instance (aspiraconnecttest.service-now.com):
 *   • "Rainger" customer KB + 5 categories + 9 published articles
 *   • "Rainger (Internal)" agent KB + 3 categories + 7 published [AGENT] articles
 *   • User criteria links (Customer Knowledge & Training + CSR Agents Only)
 *
 * Purely additive — never modifies existing records.
 * Fully idempotent — safe to re-run.
 *
 * Run: node deploy/10-rainger-seed-dev.js
 */
require('dotenv').config({ path: '.env.dev' }); // MUST load before lib/client
const client     = require('../lib/client');
const { upsert } = require('../lib/idempotent');

const CKT_GROUP_SYS_ID      = 'd913510087fa0510122d8446cebb35cc'; // Customer Knowledge & Training
const DEV_CSM_PORTAL_SYS_ID = '89275a53cb13020000f8d856634c9c51'; // CSM portal on aspiraconnecttest.service-now.com

// ─── helpers ────────────────────────────────────────────────────────────────

async function findOne(table, query) {
  const r = await client.get(`/api/now/table/${table}`, {
    params: { sysparm_query: query, sysparm_fields: 'sys_id', sysparm_limit: 1 }
  });
  return r.data.result && r.data.result.length ? r.data.result[0] : null;
}

async function linkKbToPortal(portalSysId, kbSysId) {
  const existing = await findOne(
    'm2m_sp_portal_knowledge_base',
    `sp_portal=${portalSysId}^kb_knowledge_base=${kbSysId}`
  );
  if (existing) {
    console.log(`  [skip]    portal KB link already exists`);
    return existing.sys_id;
  }
  const r = await client.post('/api/now/table/m2m_sp_portal_knowledge_base', {
    sp_portal:        portalSysId,
    kb_knowledge_base: kbSysId
  });
  console.log(`  [created] portal KB link (${r.data.result.sys_id})`);
  return r.data.result.sys_id;
}

async function linkUserCriteriaToKb(kbSysId, ucSysId) {
  const existing = await findOne(
    'kb_uc_can_read_mtom',
    `kb_knowledge_base=${kbSysId}^user_criteria=${ucSysId}`
  );
  if (existing) {
    console.log(`  [skip]    criteria link already exists`);
    return existing.sys_id;
  }
  const r = await client.post('/api/now/table/kb_uc_can_read_mtom', {
    kb_knowledge_base: kbSysId,
    user_criteria:     ucSysId
  });
  console.log(`  [created] kb_uc_can_read_mtom (${r.data.result.sys_id})`);
  return r.data.result.sys_id;
}

// A kb_category belongs to a KB via parent_id + parent_table — the native
// category picker on the Knowledge form builds its tree from these, so a
// category created without a parent is invisible there (portal widgets still
// find it by bridging through articles, which masked this for a while).
// Lookup is scoped to the KB so same-label categories in other KBs are not reused.
async function upsertCategory(label, kbSysId) {
  const existing = await findOne('kb_category', `label=${label}^parent_id=${kbSysId}`);
  if (existing) {
    console.log(`  [skip]    category "${label}" (${existing.sys_id})`);
    return existing.sys_id;
  }
  const r = await client.post('/api/now/table/kb_category', {
    label,
    parent_id:    kbSysId,
    parent_table: 'kb_knowledge_base',
    active:       true
  });
  console.log(`  [created] category "${label}" (${r.data.result.sys_id})`);
  return r.data.result.sys_id;
}

// ─── article content ─────────────────────────────────────────────────────────

const CUSTOMER_ARTICLES = [
  {
    short_description: 'How to Create a Rainger Account',
    keywords: 'create account sign up register new user rainger',
    category_key: 'getting_started',
    text: `<h2>Creating Your Rainger Account</h2>
<p>Setting up a Rainger account gives you access to park reservations, billing history, and support — all in one place.</p>
<h3>Steps to Register</h3>
<ol>
  <li>Go to the Rainger platform and click <strong>Sign Up</strong> in the top right corner.</li>
  <li>Enter your first name, last name, and a valid email address.</li>
  <li>Create a password (minimum 8 characters, at least one number and one special character).</li>
  <li>Check your email for a verification link and click it to activate your account.</li>
  <li>Complete your profile by adding your phone number and mailing address.</li>
</ol>
<h3>Troubleshooting Registration</h3>
<ul>
  <li><strong>Didn't receive the verification email?</strong> Check your spam folder. If it's not there, click "Resend verification email" on the login page.</li>
  <li><strong>Email already in use?</strong> You may already have an account. Try the "Forgot Password" option to regain access.</li>
</ul>
<p>Once your account is active, you can log in at any time from the Rainger homepage.</p>`
  },
  {
    short_description: 'Navigating the Rainger Dashboard',
    keywords: 'dashboard overview navigation home screen rainger portal',
    category_key: 'getting_started',
    text: `<h2>Your Rainger Dashboard</h2>
<p>The dashboard is your home base in Rainger. Here's what you'll find and how to get around.</p>
<h3>Dashboard Sections</h3>
<ul>
  <li><strong>My Reservations</strong> — View upcoming and past park reservations. Click any reservation to see details or make changes.</li>
  <li><strong>Billing Summary</strong> — See your most recent payment and any outstanding balance.</li>
  <li><strong>Support Cases</strong> — Track open support requests you've submitted.</li>
  <li><strong>Quick Actions</strong> — Shortcuts to make a new reservation, update your profile, or contact support.</li>
</ul>
<h3>Navigation Tips</h3>
<ul>
  <li>Use the left sidebar to move between sections.</li>
  <li>The bell icon in the top right shows notifications for reservation confirmations and case updates.</li>
  <li>Click your name in the top right to access account settings or log out.</li>
</ul>`
  },
  {
    short_description: 'How to Update Your Profile and Contact Info',
    keywords: 'update profile contact info email phone address name change',
    category_key: 'account_settings',
    text: `<h2>Updating Your Profile</h2>
<p>Keeping your contact information current ensures you receive reservation confirmations and support updates without delay.</p>
<h3>How to Update</h3>
<ol>
  <li>Log in to your Rainger account.</li>
  <li>Click your name in the top right corner and select <strong>Account Settings</strong>.</li>
  <li>Edit any field — name, phone number, mailing address, or email.</li>
  <li>Click <strong>Save Changes</strong>. You'll see a confirmation message when the update is successful.</li>
</ol>
<h3>Changing Your Email Address</h3>
<p>Changing your email requires re-verification. After saving your new email, a verification link will be sent to the new address. Your account will continue to use the old email until you verify the new one.</p>
<h3>Changing Your Password</h3>
<p>Go to <strong>Account Settings → Security → Change Password</strong>. You'll need to enter your current password first. If you've forgotten it, use the "Forgot Password" link on the login page instead.</p>`
  },
  {
    short_description: 'Managing Notification Preferences',
    keywords: 'notifications email alerts preferences settings opt out',
    category_key: 'account_settings',
    text: `<h2>Notification Preferences</h2>
<p>Control which emails and alerts Rainger sends you.</p>
<h3>Available Notification Types</h3>
<ul>
  <li><strong>Reservation confirmations</strong> — Sent immediately when a reservation is made or changed.</li>
  <li><strong>Upcoming reservation reminders</strong> — Sent 48 hours before your reservation date.</li>
  <li><strong>Support case updates</strong> — Sent when an agent responds to or closes your case.</li>
  <li><strong>Billing receipts</strong> — Sent when a payment is processed.</li>
  <li><strong>Platform announcements</strong> — Occasional updates about new features or park closures.</li>
</ul>
<h3>How to Adjust</h3>
<ol>
  <li>Go to <strong>Account Settings → Notifications</strong>.</li>
  <li>Toggle each notification type on or off.</li>
  <li>Click <strong>Save Preferences</strong>.</li>
</ol>
<p><strong>Note:</strong> Reservation confirmations and billing receipts cannot be turned off — these are transactional emails required for your account activity.</p>`
  },
  {
    short_description: 'Understanding Your Billing Statement',
    keywords: 'billing statement charges invoice payment history receipt',
    category_key: 'billing',
    text: `<h2>Your Billing Statement</h2>
<p>The Billing section shows all charges, payments, and receipts associated with your Rainger account.</p>
<h3>What's on Your Statement</h3>
<ul>
  <li><strong>Reservation fees</strong> — The nightly or per-site rate for each park reservation.</li>
  <li><strong>Booking fee</strong> — A non-refundable $10 fee applied to each new reservation.</li>
  <li><strong>Cancellation refunds</strong> — Any refunds issued appear as credits on your statement.</li>
  <li><strong>Annual pass charges</strong> — If you purchased an annual pass, it appears as a single line item.</li>
</ul>
<h3>How to Access Your Statements</h3>
<ol>
  <li>Log in and go to <strong>Billing</strong> from the sidebar.</li>
  <li>Select a date range to filter transactions.</li>
  <li>Click any transaction to see the full receipt — you can also download it as a PDF.</li>
</ol>
<p>If you see a charge you don't recognize, <a href="?id=sc_category&catalog_id=-1">submit a support case</a> and include the transaction date and amount.</p>`
  },
  {
    short_description: 'What to Do If Your Payment Is Declined',
    keywords: 'payment declined failed error card checkout billing retry',
    category_key: 'billing',
    text: `<h2>Payment Declined — What to Do</h2>
<p>If your payment didn't go through during a reservation or pass purchase, here are the most common causes and how to fix them.</p>
<h3>Common Reasons</h3>
<ul>
  <li><strong>Card blocked by your bank</strong> — Some banks flag transactions from government or recreation platforms. Call your bank to authorize the payment.</li>
  <li><strong>Billing address mismatch</strong> — The address you entered must exactly match what your bank has on file.</li>
  <li><strong>Expired or incorrect card details</strong> — Double-check the card number, expiry date, and CVV.</li>
  <li><strong>Insufficient funds</strong> — Ensure your account covers the full amount including any pending holds.</li>
</ul>
<h3>How to Retry</h3>
<ol>
  <li>Wait 10–15 minutes before retrying — rapid attempts can trigger a temporary hold.</li>
  <li>Try a different browser or an incognito/private window to clear any cached form state.</li>
  <li>Use a different card or payment method if available.</li>
  <li>If nothing works, <a href="?id=sc_category&catalog_id=-1">open a support case</a> and we can assist by phone.</li>
</ol>
<p><strong>Important:</strong> If your card shows a charge but you never received a confirmation number, submit a support case immediately — do not retry the payment until we've confirmed no duplicate charge exists.</p>`
  },
  {
    short_description: 'How to Make and Manage a Park Reservation',
    keywords: 'reservation book campsite park reserve site make new',
    category_key: 'reservations',
    text: `<h2>Making a Park Reservation</h2>
<p>You can reserve a park site online through your Rainger account up to 6 months in advance.</p>
<h3>How to Book</h3>
<ol>
  <li>Log in and click <strong>New Reservation</strong> from your dashboard.</li>
  <li>Search by park name, region, or dates.</li>
  <li>Select a site from the available results — click a site to see photos and amenities.</li>
  <li>Choose your arrival and departure dates, then click <strong>Reserve</strong>.</li>
  <li>Enter your payment details and confirm. A <strong>$10 non-refundable booking fee</strong> applies to all reservations.</li>
  <li>Check your email for a confirmation with your reservation number.</li>
</ol>
<h3>Managing Existing Reservations</h3>
<ul>
  <li>Go to <strong>My Reservations</strong> on your dashboard to see all upcoming bookings.</li>
  <li>Click any reservation to view details, print a confirmation, or make changes.</li>
  <li>To modify dates or site, cancel the existing reservation and rebook — a new booking fee applies.</li>
</ul>`
  },
  {
    short_description: 'Cancelling or Changing a Reservation',
    keywords: 'cancel modify change reservation refund date site',
    category_key: 'reservations',
    text: `<h2>Cancellation and Change Policy</h2>
<p>You can cancel or change your reservation at any time. Refunds depend on how far in advance you cancel.</p>
<h3>Refund Schedule</h3>
<table border="1" cellpadding="6" style="border-collapse:collapse;width:100%">
  <tr><th>Days Before Arrival</th><th>Nightly Fee Refund</th></tr>
  <tr><td>15 or more days</td><td>100% refunded</td></tr>
  <tr><td>8–14 days</td><td>50% refunded</td></tr>
  <tr><td>7 days or fewer</td><td>No refund</td></tr>
</table>
<p><em>The $10 booking fee is non-refundable in all cases.</em></p>
<h3>How to Cancel</h3>
<ol>
  <li>Go to <strong>My Reservations</strong> and find the booking you want to cancel.</li>
  <li>Click <strong>Cancel Reservation</strong> and confirm.</li>
  <li>Eligible refunds are processed within 5–10 business days to your original payment method.</li>
</ol>
<h3>Changing Your Reservation</h3>
<p>Date changes and site transfers are handled as a cancel-and-rebook. Cancel your current reservation first, then make a new one. A new $10 booking fee applies to the new reservation.</p>`
  },
  {
    short_description: 'Troubleshooting Login Issues',
    keywords: 'login problem password reset locked out access sign in cannot',
    category_key: 'troubleshooting',
    text: `<h2>Can't Log In? Here's What to Try</h2>
<h3>Forgot Your Password</h3>
<ol>
  <li>Click <strong>Forgot Password</strong> on the login page.</li>
  <li>Enter the email address you registered with.</li>
  <li>Check your inbox for a password reset link (also check spam).</li>
  <li>Click the link and create a new password. The link expires after 24 hours.</li>
</ol>
<h3>Account Locked Out</h3>
<p>After 5 failed login attempts your account is temporarily locked for 30 minutes. Wait and try again, or use the "Forgot Password" flow to reset your credentials immediately.</p>
<h3>Correct Credentials but Still Can't Log In</h3>
<ul>
  <li>Make sure you're using the same email you registered with — check for typos.</li>
  <li>Clear your browser cache and cookies, or try a private/incognito window.</li>
  <li>Try a different browser (Chrome, Firefox, Edge).</li>
  <li>If your account was created through a state agency or employer, you may need to log in through your organization's SSO link — contact your administrator.</li>
</ul>
<p>If none of the above resolve the issue, <a href="?id=sc_category&catalog_id=-1">submit a support case</a> with your registered email address and we'll investigate.</p>`
  }
];

const AGENT_ARTICLES = [
  {
    short_description: '[AGENT] Onboarding Reference — Rainger Case Handling',
    keywords: 'agent onboarding rainger case handling reference guide',
    category_key: 'agent_reference',
    text: `<h2>Rainger — Agent Case Handling Reference</h2>
<p style="background:#fff3cd;padding:8px;border-left:4px solid #ffc107"><strong>Internal use only.</strong> Do not share content or procedures from this article with customers.</p>
<h3>Case Intake</h3>
<ul>
  <li>Confirm the customer's identity by verifying their registered email and reservation/account number.</li>
  <li>Summarize the issue in the Case Description before taking action — this is required for Tier 2 handoffs.</li>
  <li>Set the appropriate <strong>Category</strong> and <strong>Priority</strong> before saving the case.</li>
</ul>
<h3>Priority Guidelines</h3>
<table border="1" cellpadding="5" style="border-collapse:collapse;width:100%">
  <tr><th>Priority</th><th>Criteria</th><th>Target Response</th></tr>
  <tr><td>P1 — Critical</td><td>Active reservation today, payment dispute over $200, account locked for 3+ days</td><td>4 hours</td></tr>
  <tr><td>P2 — High</td><td>Upcoming reservation within 7 days, payment failure, access issue</td><td>8 hours</td></tr>
  <tr><td>P3 — Medium</td><td>General questions, profile updates, non-urgent billing</td><td>2 business days</td></tr>
  <tr><td>P4 — Low</td><td>Feature requests, documentation feedback</td><td>5 business days</td></tr>
</table>
<h3>Escalation Path</h3>
<p>Tier 2: Unresolved after one interaction + case is P1 or P2. Use the <strong>Escalate</strong> button on the case form. Do not escalate P3/P4 without supervisor approval.</p>`
  },
  {
    short_description: '[AGENT] Account Lookup and Reset Procedures',
    keywords: 'account lookup reset password unlock agent procedure',
    category_key: 'agent_reference',
    text: `<h2>Account Lookup and Reset — Agent Procedures</h2>
<p style="background:#fff3cd;padding:8px;border-left:4px solid #ffc107"><strong>Internal use only.</strong></p>
<h3>Looking Up an Account</h3>
<ol>
  <li>Go to Customer Accounts in the Agent Workspace sidebar.</li>
  <li>Search by registered email, account number, or full name.</li>
  <li>Open the account record — it shows reservation history, billing, and open cases.</li>
</ol>
<h3>Password Reset on Behalf of Customer</h3>
<p>Only perform this if the customer has exhausted the self-service flow and can verify their identity verbally.</p>
<ol>
  <li>Open the customer's user record.</li>
  <li>Use the <strong>Reset Password</strong> action — this sends a reset link to their registered email.</li>
  <li>Document in the case notes: "Password reset initiated at customer request, identity verified via [method]."</li>
</ol>
<h3>Unlocking a Locked Account</h3>
<p>Accounts lock after 5 failed login attempts. To unlock:</p>
<ol>
  <li>Open the user record in the admin panel.</li>
  <li>Set <strong>Locked Out</strong> to false.</li>
  <li>Add a case note documenting the unlock.</li>
</ol>`
  },
  {
    short_description: '[AGENT] Reservation Override and Cancellation Codes',
    keywords: 'reservation override cancellation refund code agent exception',
    category_key: 'agent_reference',
    text: `<h2>Reservation Overrides and Cancellation Codes</h2>
<p style="background:#fff3cd;padding:8px;border-left:4px solid #ffc107"><strong>Internal use only.</strong> Override codes must be documented in the case notes.</p>
<h3>When Overrides Are Permitted</h3>
<p>Policy overrides for cancellations outside the standard window require one of the following justifications. Document the justification in the case before processing.</p>
<ul>
  <li>Medical emergency (request a case/claim number if possible)</li>
  <li>Active military deployment (request orders reference)</li>
  <li>Platform-initiated cancellation (system outage or park closure)</li>
</ul>
<h3>Override Codes</h3>
<table border="1" cellpadding="5" style="border-collapse:collapse">
  <tr><th>Situation</th><th>Code</th></tr>
  <tr><td>Medical / personal emergency</td><td>MED-OVERRIDE</td></tr>
  <tr><td>Platform or park closure</td><td>PARK-CLOSE</td></tr>
  <tr><td>System error / double booking</td><td>SYS-ERR</td></tr>
  <tr><td>Military deployment</td><td>MIL-DEPLOY</td></tr>
</table>
<h3>Processing an Override</h3>
<ol>
  <li>Confirm eligibility against the criteria above.</li>
  <li>Open the reservation in the admin console.</li>
  <li>Click <strong>Actions → Supervisor Cancellation</strong> and select the override code.</li>
  <li>Your employee ID is logged automatically. Add a brief note to the case.</li>
  <li>If in doubt, escalate to your supervisor before processing.</li>
</ol>`
  },
  {
    short_description: '[AGENT] Payment Failure Escalation Paths',
    keywords: 'payment failed escalation path billing agent procedure code',
    category_key: 'agent_reference',
    text: `<h2>Payment Failure Escalation Paths</h2>
<p style="background:#fff3cd;padding:8px;border-left:4px solid #ffc107"><strong>Internal use only.</strong></p>
<h3>Common Payment Failure Codes</h3>
<table border="1" cellpadding="5" style="border-collapse:collapse;width:100%">
  <tr><th>Code</th><th>Meaning</th><th>Response to Customer</th></tr>
  <tr><td>INSUFFICIENT_FUNDS</td><td>Card declined — low balance</td><td>Try a different card or contact your bank</td></tr>
  <tr><td>DO_NOT_HONOR</td><td>Bank blocked the transaction</td><td>Call your bank — recreation platform transactions are sometimes blocked by default</td></tr>
  <tr><td>DUPLICATE_TRANSACTION</td><td>Same amount + card within 5 min</td><td>Check if first transaction completed before retrying</td></tr>
  <tr><td>AVS_MISMATCH</td><td>Billing address doesn't match</td><td>Confirm the billing address matches exactly what the bank has on file</td></tr>
  <tr><td>TIMEOUT</td><td>Session expired mid-checkout</td><td>Start a fresh session; cart items may not have saved</td></tr>
</table>
<h3>Escalation Triggers</h3>
<ul>
  <li>Charge older than 60 days → email billing@rainger-support.internal with case number</li>
  <li>3+ failed attempts on the same reservation → flag for fraud review before reattempting</li>
  <li>Customer was charged but received no confirmation → escalate immediately; do not issue a manual refund</li>
</ul>`
  },
  {
    short_description: '[AGENT] Known Issue: Reservation Confirmation Emails Delayed',
    keywords: 'known issue confirmation email delayed reservation not received',
    category_key: 'known_issues',
    text: `<h2>Known Issue: Reservation Confirmation Emails Delayed</h2>
<p style="background:#fff3cd;padding:8px;border-left:4px solid #ffc107"><strong>Internal use only.</strong></p>
<h3>Issue Summary</h3>
<p>Some customers report not receiving a reservation confirmation email immediately after booking. This is a known intermittent issue with the email delivery queue under high traffic periods (typically Friday afternoons and holiday weekends).</p>
<h3>Customer Impact</h3>
<p>The reservation is created correctly in the system — the delay is email-only. The customer's reservation will appear in their <strong>My Reservations</strong> dashboard even if the email hasn't arrived.</p>
<h3>Agent Response Steps</h3>
<ol>
  <li>Confirm the reservation exists in the system by looking up the customer's account.</li>
  <li>Tell the customer: "Your reservation is confirmed in our system. The confirmation email may take up to 2 hours to arrive during peak periods — please also check your spam folder."</li>
  <li>If the email has not arrived after 2 hours, use the <strong>Resend Confirmation</strong> action on the reservation record.</li>
  <li>Log a case note if the resend was required.</li>
</ol>
<h3>Status</h3>
<p>Engineering is aware. No ETA for resolution. Do not promise a timeline to customers.</p>`
  },
  {
    short_description: '[AGENT] Known Issue: Billing Portal Timeout on Safari',
    keywords: 'known issue safari billing timeout payment portal browser',
    category_key: 'known_issues',
    text: `<h2>Known Issue: Billing Portal Timeout on Safari</h2>
<p style="background:#fff3cd;padding:8px;border-left:4px solid #ffc107"><strong>Internal use only.</strong></p>
<h3>Issue Summary</h3>
<p>Customers using Safari (macOS and iOS) may experience a session timeout on the Billing page after approximately 3 minutes of inactivity, even if they are actively interacting with the page. This is caused by Safari's aggressive ITP (Intelligent Tracking Prevention) policy interfering with the session keep-alive mechanism.</p>
<h3>Symptoms</h3>
<ul>
  <li>The billing page goes blank or shows a "Session Expired" message.</li>
  <li>Payment attempts return a generic error after the page reloads.</li>
  <li>The issue does not occur in Chrome, Firefox, or Edge.</li>
</ul>
<h3>Workaround</h3>
<p>Advise the customer to:</p>
<ol>
  <li>Switch to Chrome or Firefox to complete the payment.</li>
  <li>Alternatively, use a private/incognito window in Safari — this reduces (but doesn't eliminate) the issue.</li>
</ol>
<h3>Status</h3>
<p>Engineering is investigating. Expected fix in the next platform release. Do not promise a timeline to customers.</p>`
  },
  {
    short_description: '[AGENT] Escalation Guide — Tier 2 Criteria',
    keywords: 'escalation tier 2 criteria guide when to escalate agent',
    category_key: 'escalation_guides',
    text: `<h2>Tier 2 Escalation Guide</h2>
<p style="background:#fff3cd;padding:8px;border-left:4px solid #ffc107"><strong>Internal use only.</strong></p>
<h3>When to Escalate to Tier 2</h3>
<p>Escalate a case to Tier 2 when ANY of the following are true:</p>
<ul>
  <li>The issue is unresolved after one full interaction with the customer</li>
  <li>The case is P1 or P2 priority</li>
  <li>A billing dispute involves a charge older than 60 days or over $200</li>
  <li>The customer reports a data or privacy concern</li>
  <li>A reservation shows a system error that you cannot clear (e.g., stuck in "Pending" state)</li>
  <li>The customer is threatening legal action or regulatory escalation</li>
</ul>
<h3>How to Escalate</h3>
<ol>
  <li>Ensure the Case Description and Work Notes are fully filled in before escalating.</li>
  <li>Click the <strong>Escalate</strong> button on the case form.</li>
  <li>Select the appropriate Tier 2 queue (Billing Escalations / Technical Escalations / Customer Relations).</li>
  <li>Notify the customer: "I'm escalating this to our specialist team. You'll receive an update within [SLA for their priority level]."</li>
</ol>
<h3>When NOT to Escalate</h3>
<ul>
  <li>P3/P4 cases that just need more time — use the "Pending" state and follow up.</li>
  <li>Cases where the answer is documented in this KB — resolve them directly.</li>
  <li>Escalating to avoid a difficult conversation — always attempt one full resolution before escalating.</li>
</ul>`
  }
];

// ─── main ────────────────────────────────────────────────────────────────────

module.exports = async function seedRaingerDev(ctx) {

  // SUPERSEDED for customer content (2026-07-09): the dev customer KB was renamed
  // "Next Gen" and reseeded from prod by deploy/14-nexgen-import-dev.js. Re-running
  // this script would fail to find it by title and create a duplicate "Rainger" KB.
  const nexGen = await findOne('kb_knowledge_base', 'title=Next Gen');
  if (nexGen) {
    console.log('\n  [abort] "Next Gen" KB exists — this seed is superseded by 14-nexgen-import-dev.js.');
    return;
  }

  // 1. Create both KBs
  console.log('\n  Creating Rainger customer KB...');
  const { sys_id: kbSysId } = await upsert('kb_knowledge_base', 'title', 'Rainger', {
    title:       'Rainger',
    description: 'Shared customer-facing KB for Rainger migration. Companies added incrementally via 09-rainger-link-company.js.',
    active:      true,
    application: 'global' // required for CSM portal visibility
  });
  ctx.raingerKbSysId = kbSysId;
  console.log(`  Customer KB sys_id: ${kbSysId}`);

  console.log('\n  Creating Rainger (Internal) KB...');
  const { sys_id: agentKbSysId } = await upsert('kb_knowledge_base', 'title', 'Rainger (Internal)', {
    title:       'Rainger (Internal)',
    description: 'Internal KB for Rainger — CSR agents only. Not linked to any customer portal.',
    active:      true,
    application: 'global'
  });
  ctx.raingerAgentKbSysId = agentKbSysId;
  console.log(`  Agent KB sys_id: ${agentKbSysId}`);

  // 2. Link customer KB to CSM portal (application=global alone is not enough — explicit M2M allowlist required)
  console.log('\n  Linking Rainger KB to CSM portal...');
  await linkKbToPortal(DEV_CSM_PORTAL_SYS_ID, kbSysId);
  // Rainger (Internal) is intentionally NOT linked to the customer portal

  // 3. Wire user criteria
  console.log('\n  Creating user criteria (Customer Knowledge & Training)...');
  const { sys_id: ucGroupSysId } = await upsert('user_criteria', 'name', 'Customer Knowledge & Training', {
    name:   'Customer Knowledge & Training',
    groups: CKT_GROUP_SYS_ID,
    active: true
  });
  console.log('  Linking Customer Knowledge & Training to Rainger KB...');
  await linkUserCriteriaToKb(kbSysId, ucGroupSysId);

  console.log('\n  Creating user criteria (CSR Agents Only)...');
  const { sys_id: ucAgentOnlySysId } = await upsert('user_criteria', 'name', 'CSR Agents Only', {
    name:   'CSR Agents Only',
    roles:  'sn_customerservice.agent',
    active: true
  });
  console.log('  Linking CSR Agents Only to Rainger (Internal) KB...');
  await linkUserCriteriaToKb(agentKbSysId, ucAgentOnlySysId);

  // 4. Create customer KB categories
  console.log('\n  Creating customer KB categories...');
  const customerCats = {
    getting_started:  await upsertCategory('Getting Started', kbSysId),
    account_settings: await upsertCategory('Account & Settings', kbSysId),
    billing:          await upsertCategory('Payments & Billing', kbSysId),
    reservations:     await upsertCategory('Reservations', kbSysId),
    troubleshooting:  await upsertCategory('Troubleshooting', kbSysId)
  };

  // 5. Create internal KB categories
  console.log('\n  Creating internal KB categories...');
  const internalCats = {
    agent_reference:   await upsertCategory('Agent Reference', agentKbSysId),
    known_issues:      await upsertCategory('Known Issues', agentKbSysId),
    escalation_guides: await upsertCategory('Escalation Guides', agentKbSysId)
  };

  // 6. Upsert customer articles
  console.log('\n  Creating customer KB articles...');
  for (const a of CUSTOMER_ARTICLES) {
    await upsert('kb_knowledge', 'short_description', a.short_description, {
      short_description: a.short_description,
      text:              a.text,
      keywords:          a.keywords,
      kb_knowledge_base: kbSysId,
      kb_category:       customerCats[a.category_key],
      active:            true
    });
  }

  // 7. Upsert internal articles
  console.log('\n  Creating internal KB articles...');
  for (const a of AGENT_ARTICLES) {
    await upsert('kb_knowledge', 'short_description', a.short_description, {
      short_description: a.short_description,
      text:              a.text,
      keywords:          a.keywords,
      kb_knowledge_base: agentKbSysId,
      kb_category:       internalCats[a.category_key],
      active:            true
    });
  }

  // 8. Bulk publish via sysauto_script (direct PATCH to workflow_state is blocked by business rules)
  console.log('\n  Publishing articles via background script...');
  const PUBLISH_JOB_NAME = 'Rainger Dev - Publish KB Articles (one-time)';
  const existingJob = await findOne('sysauto_script', `name=${PUBLISH_JOB_NAME}`);
  if (existingJob) {
    console.log(`  [skip]    publish job already exists`);
  } else {
    const allArticles = [...CUSTOMER_ARTICLES, ...AGENT_ARTICLES];
    const ids = [];
    for (const a of allArticles) {
      const rec = await findOne('kb_knowledge', `short_description=${a.short_description}`);
      if (rec) ids.push(rec.sys_id);
    }
    const script = `var ids=${JSON.stringify(ids)};for(var i=0;i<ids.length;i++){var gr=new GlideRecord('kb_knowledge');if(gr.get(ids[i])){gr.setWorkflow(false);gr.setValue('workflow_state','published');gr.update();}}`;
    const past = new Date(Date.now() - 5000).toISOString().replace('T', ' ').substring(0, 19);
    await client.post('/api/now/table/sysauto_script', {
      name:      PUBLISH_JOB_NAME,
      script,
      active:    true,
      run_type:  'once',
      run_start: past
    });
    console.log(`  [created] publish job for ${ids.length} articles`);
  }

  console.log('\n  Rainger dev seed complete.');
  console.log(`  Customer KB:  ${kbSysId}  (9 articles, 5 categories)`);
  console.log(`  Agent KB:     ${agentKbSysId}  (7 articles, 3 categories)`);
};

if (require.main === module) {
  const ctx = {};
  module.exports(ctx)
    .then(() => console.log('\nDone.', ctx))
    .catch(e => { console.error(e.message); process.exit(1); });
}
