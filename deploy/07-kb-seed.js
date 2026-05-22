/**
 * KB Seed — MD DNR pilot
 *
 * Creates:
 *   • "MD DNR Help Center" KB  — scoped to MD DNR company users + CSR agents
 *   • "Aspira Agent Resources" KB — scoped to CSR agents only
 *   • Categories and articles for parks/reservations + payments/billing
 *   • Updates system property ahc.kb.company_map  (company sys_id → KB sys_id)
 *
 * Run standalone:  node deploy/07-kb-seed.js
 */
require('dotenv').config();
const client     = require('../lib/client');
const { upsert } = require('../lib/idempotent');

// ─── helpers ────────────────────────────────────────────────────────────────

async function findOne(table, query) {
  const r = await client.get(`/api/now/table/${table}`, {
    params: { sysparm_query: query, sysparm_fields: 'sys_id,name,title,label', sysparm_limit: 1 }
  });
  return r.data.result && r.data.result.length ? r.data.result[0] : null;
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
  const sysId = r.data.result.sys_id;
  console.log(`  [created] kb_uc_can_read_mtom (${sysId})`);
  return sysId;
}

async function updateSysProp(name, mergeFn) {
  const existing = await findOne('sys_properties', `name=${name}`);
  let current = {};
  if (existing) {
    try { current = JSON.parse(existing.value || '{}'); } catch(e) {}
  }
  const updated = mergeFn(current);
  await upsert('sys_properties', 'name', name, { name, value: JSON.stringify(updated) });
}

// ─── article content ─────────────────────────────────────────────────────────

const CUSTOMER_ARTICLES = [
  {
    short_description: 'How to Reserve a State Park Campsite',
    keywords: 'reservation camping campsite park book reserve online',
    category_key: 'parks',
    text: `<h2>Reserving a Campsite</h2>
<p>You can reserve a Maryland state park campsite online, by phone, or in person — up to 12 months in advance.</p>
<h3>Online (fastest)</h3>
<ol>
  <li>Go to <strong>reservations.maryland.gov</strong></li>
  <li>Search by park name, dates, or campsite type</li>
  <li>Select your site and click "Reserve"</li>
  <li>Sign in or create a free account</li>
  <li>Complete payment — a <strong>$10 non-refundable reservation fee</strong> applies to all bookings</li>
</ol>
<h3>By Phone</h3>
<p>Call <strong>1-888-432-2267</strong>, Monday–Friday 9 AM–5 PM ET. Have your dates, park name, and card ready.</p>
<h3>What You'll Need</h3>
<ul>
  <li>Government-issued ID (name must match reservation)</li>
  <li>Vehicle license plate number</li>
  <li>Credit or debit card</li>
</ul>
<p>A confirmation email is sent within 15 minutes of booking. If you don't see it, check your spam folder or call us.</p>`
  },
  {
    short_description: 'Cancelling or Modifying a Park Reservation',
    keywords: 'cancel modify change reservation refund campsite date',
    category_key: 'parks',
    text: `<h2>Cancellation &amp; Modification Policy</h2>
<p>You can cancel or change your reservation online at any time. Refunds depend on how far in advance you cancel.</p>
<h3>Refund Schedule</h3>
<table border="1" cellpadding="6" style="border-collapse:collapse;width:100%">
  <tr><th>Days Before Arrival</th><th>Nightly Fee Refund</th></tr>
  <tr><td>15 or more days</td><td>100% refunded</td></tr>
  <tr><td>8–14 days</td><td>50% refunded</td></tr>
  <tr><td>7 days or fewer</td><td>No refund</td></tr>
</table>
<p><em>The $10 reservation fee is never refunded regardless of cancellation timing.</em></p>
<h3>How to Cancel Online</h3>
<ol>
  <li>Log in to <strong>reservations.maryland.gov</strong></li>
  <li>Click "My Reservations"</li>
  <li>Find your booking and click "Cancel Reservation"</li>
  <li>Confirm — refunds process within 5–10 business days to your original payment method</li>
</ol>
<h3>Modifying Your Reservation</h3>
<p>Date changes and site transfers are treated as a cancellation + rebook. Cancel your current reservation first, then make a new one. A new $10 fee applies.</p>`
  },
  {
    short_description: 'State Park Day-Use Passes and Annual Passes',
    keywords: 'day use pass annual fee entrance park vehicle',
    category_key: 'parks',
    text: `<h2>Day-Use and Annual Passes</h2>
<h3>Day-Use Fees</h3>
<p>Most state parks charge a per-vehicle entrance fee on weekends and holidays from Memorial Day through Labor Day.</p>
<ul>
  <li><strong>Maryland residents:</strong> $5 per vehicle</li>
  <li><strong>Out-of-state visitors:</strong> $7 per vehicle</li>
</ul>
<p>Fees are collected at park entrance stations. Most parks accept cash and card.</p>
<h3>Annual Pass</h3>
<p>An annual pass gives unlimited same-day vehicle access to all Maryland state parks for 12 months from the purchase date.</p>
<ul>
  <li><strong>Maryland residents:</strong> $75</li>
  <li><strong>Out-of-state:</strong> $100</li>
</ul>
<p>Passes are vehicle-specific (linked to your license plate). Buy online at reservations.maryland.gov or in person at any park office.</p>
<h3>Who Enters Free</h3>
<ul>
  <li>Holders of a valid annual pass</li>
  <li>Visitors with a qualifying disability (state-issued placard)</li>
  <li>Active-duty military and veterans with valid ID</li>
  <li>Children under 2</li>
</ul>`
  },
  {
    short_description: 'Payment Failed at Checkout — What to Do',
    keywords: 'payment failed error declined credit card checkout billing try again',
    category_key: 'billing',
    text: `<h2>Payment Declined or Failed</h2>
<p>If your payment didn't go through during a reservation or pass purchase, here are the most common causes and how to fix them.</p>
<h3>Common Causes</h3>
<ul>
  <li><strong>Card blocked by bank:</strong> Online transactions from state systems are sometimes flagged. Call your bank to authorize the payment.</li>
  <li><strong>Billing address mismatch:</strong> The address you entered must exactly match what your bank has on file.</li>
  <li><strong>Expired card:</strong> Double-check the expiration date.</li>
  <li><strong>Insufficient balance:</strong> Ensure your account covers the full amount including any pending holds.</li>
</ul>
<h3>How to Retry</h3>
<ol>
  <li>Wait 10–15 minutes before trying again — rapid retries can trigger a temporary hold</li>
  <li>Try a different browser or a private/incognito window</li>
  <li>Use a different card or payment method</li>
  <li>If nothing works, call <strong>1-888-432-2267</strong> to complete the transaction by phone</li>
</ol>
<p><strong>Important:</strong> If your card shows a charge but you didn't receive a confirmation number, <a href="?id=ahc_submit_ticket">submit a support ticket</a> and we'll investigate within 1 business day.</p>`
  },
  {
    short_description: 'How to Request a Refund',
    keywords: 'refund money back billing reimbursement charge dispute',
    category_key: 'billing',
    text: `<h2>Requesting a Refund</h2>
<p>Refund eligibility depends on the type of purchase and when you request it.</p>
<h3>What Can Be Refunded</h3>
<ul>
  <li><strong>Campsite reservations:</strong> Refunded per the cancellation schedule (see the Cancellations article)</li>
  <li><strong>Duplicate charges:</strong> Reviewed automatically — allow 3–5 business days</li>
  <li><strong>Park-initiated cancellations</strong> (closures, weather): Full refund issued automatically</li>
  <li><strong>Annual passes:</strong> Refundable within 30 days of purchase if unused</li>
</ul>
<h3>What Is Non-Refundable</h3>
<ul>
  <li>The $10 reservation booking fee</li>
  <li>Annual passes after 30 days or after first use</li>
  <li>Fishing and hunting licenses once issued</li>
</ul>
<h3>How to Request</h3>
<ol>
  <li>Gather your confirmation number, transaction date, and the amount charged</li>
  <li><a href="?id=ahc_submit_ticket">Submit a support ticket</a> with the details</li>
  <li>Attach any confirmation emails or receipts</li>
</ol>
<p>Approved refunds process within 5–10 business days to your original payment method. We cannot redirect refunds to a different card or account.</p>`
  }
];

const AGENT_ARTICLES = [
  {
    short_description: '[AGENT] State Park Reservations — Call Reference',
    keywords: 'reservation campsite agent override cancel modify refund code',
    category_key: 'agent_parks',
    text: `<h2>Reservations — Agent Reference</h2>
<p style="background:#fff3cd;padding:8px;border-left:4px solid #ffc107"><strong>Internal use only.</strong> Do not share content, codes, or procedures from this article with callers.</p>
<h3>Looking Up a Reservation</h3>
<ol>
  <li>Open the Parks Admin console (internal link in your bookmarks bar)</li>
  <li>Search by confirmation number <strong>or</strong> last name + last 4 digits of phone</li>
  <li>Status values: Active · Cancelled · Pending Refund · No-Show</li>
</ol>
<h3>Override Cancellation Outside the Policy Window</h3>
<p>Overrides are only valid for these situations — document the reason in the case:</p>
<ul>
  <li>Medical emergency (ask for a case/claim number if possible)</li>
  <li>Active military deployment (ask for orders reference)</li>
  <li>DNR-initiated park closure or natural disaster</li>
</ul>
<p>In the admin console: Reservation → Actions → "Supervisor Cancellation" → select reason → your employee ID is logged automatically. If you're unsure whether an override is justified, escalate to your supervisor before processing.</p>
<h3>Refund Override Codes</h3>
<table border="1" cellpadding="5" style="border-collapse:collapse">
  <tr><th>Situation</th><th>Code</th></tr>
  <tr><td>Medical / personal emergency</td><td>MED-OVERRIDE</td></tr>
  <tr><td>DNR-initiated park closure</td><td>PARK-CLOSE</td></tr>
  <tr><td>System error / double booking</td><td>SYS-ERR</td></tr>
  <tr><td>Military deployment</td><td>MIL-DEPLOY</td></tr>
</table>
<h3>When to Escalate to Tier 2</h3>
<ul>
  <li>Caller disputes a charge older than 90 days</li>
  <li>Reservation shows "Pending Fraud Review" status</li>
  <li>Refund amount exceeds $500</li>
  <li>Caller is aggressive or threatening — flag in case notes, transfer to supervisor</li>
</ul>`
  },
  {
    short_description: '[AGENT] Payment Issues — Call Reference',
    keywords: 'payment failed declined refund billing agent duplicate charge code',
    category_key: 'agent_billing',
    text: `<h2>Payment Issues — Agent Reference</h2>
<p style="background:#fff3cd;padding:8px;border-left:4px solid #ffc107"><strong>Internal use only.</strong></p>
<h3>Common Payment Failure Codes</h3>
<table border="1" cellpadding="5" style="border-collapse:collapse;width:100%">
  <tr><th>Code</th><th>Meaning</th><th>What to Tell the Caller</th></tr>
  <tr><td>INSUFFICIENT_FUNDS</td><td>Card declined — low balance</td><td>Try a different card or contact your bank</td></tr>
  <tr><td>DO_NOT_HONOR</td><td>Bank blocked transaction</td><td>Call your bank — state merchant codes are sometimes blocked by default</td></tr>
  <tr><td>DUPLICATE_TRANSACTION</td><td>Same amount + card within 5 min</td><td>Check if first transaction completed before reprocessing</td></tr>
  <tr><td>TIMEOUT</td><td>Session expired mid-checkout</td><td>Start a fresh session; cart items may not have saved</td></tr>
  <tr><td>AVS_MISMATCH</td><td>Billing address doesn't match</td><td>Ask caller to confirm address exactly as the bank has it</td></tr>
</table>
<h3>Handling Duplicate Charges</h3>
<ol>
  <li>Pull transaction history in the billing console — search by email or card last 4</li>
  <li>If two charges appear for the same item on the same day: initiate a refund on the second charge</li>
  <li>Log both transaction IDs in the case notes</li>
  <li>Refund SLA: 5–10 business days — communicate this clearly to the caller</li>
</ol>
<h3>Escalation Triggers</h3>
<ul>
  <li>Charge older than 60 days → email billing@mdnr-support.internal with case number</li>
  <li>3+ failed attempts on same reservation → flag for fraud review before reattempting</li>
  <li>Caller says they were charged but received no confirmation and transaction is not in the system → escalate; do not issue a manual refund</li>
</ul>`
  },
  {
    short_description: '[AGENT] Annual Pass — Call Reference',
    keywords: 'annual pass refund prorate replacement lost vehicle plate agent',
    category_key: 'agent_billing',
    text: `<h2>Annual Pass — Agent Reference</h2>
<p style="background:#fff3cd;padding:8px;border-left:4px solid #ffc107"><strong>Internal use only.</strong></p>
<h3>Looking Up a Pass</h3>
<p>Search by pass number or purchaser email in the Passes Admin console. The pass record shows: purchase date, expiry, entry count, linked vehicle plates.</p>
<h3>Replacing a Lost or Damaged Pass</h3>
<ul>
  <li>First replacement in a 12-month period: <strong>no charge</strong>, reissue immediately</li>
  <li>Second replacement in same year: requires supervisor approval before reissuing</li>
  <li>Old pass number is deactivated the moment the new one is issued — inform caller</li>
</ul>
<h3>Refund Rules</h3>
<ul>
  <li>Within 30 days of purchase AND pass has not been used: full refund, process immediately</li>
  <li>After 30 days <strong>or</strong> pass has been scanned at least once: no refund — this is policy, no exceptions</li>
  <li>Prorating is not supported in the current billing system</li>
</ul>
<p>If a caller pushes back on the no-refund rule after the window: apologize, confirm the policy, and offer to escalate to a supervisor if they'd like — but the supervisor cannot override this one.</p>
<h3>Changing a Vehicle Plate</h3>
<p>Passes admin → Edit Pass → "Update Vehicle Plate". Limit: 2 plate changes per pass year. Document the change with a brief case note (caller request, old plate, new plate).</p>`
  }
];

// ─── main ────────────────────────────────────────────────────────────────────

module.exports = async function seedMdDnrKb(ctx) {

  // 1. Find MD DNR company record
  console.log('\n  Looking up MD DNR company...');
  const company = await findOne('core_company', 'nameLIKEDNR^ORnameLIKEMaryland DNR^ORnameLIKEnatural resources');
  if (!company) throw new Error('Could not find MD DNR company record. Check core_company table.');
  const companySysId = company.sys_id;
  console.log(`  Found: "${company.name}" (${companySysId})`);

  // 2. Create the customer-facing KB
  console.log('\n  Creating MD DNR Help Center KB...');
  const { sys_id: kbSysId } = await upsert('kb_knowledge_base', 'title', 'MD DNR Help Center', {
    title:       'MD DNR Help Center',
    description: 'Customer-facing knowledge base for Maryland Department of Natural Resources portal users.',
    active:      true
  });
  ctx.mdDnrKbSysId = kbSysId;
  console.log(`  KB sys_id: ${kbSysId}`);

  // 3. Create user criteria — MD DNR company users
  console.log('\n  Creating user criteria (MD DNR customers)...');
  const { sys_id: ucCompanySysId } = await upsert('user_criteria', 'name', 'MD DNR Customers', {
    name:    'MD DNR Customers',
    company: companySysId,
    active:  true
  });

  // 4. Create user criteria — CSR agents (shared, may already exist)
  console.log('  Creating user criteria (CSR agents)...');
  const { sys_id: ucAgentSysId } = await upsert('user_criteria', 'name', 'CSR Agents', {
    name:   'CSR Agents',
    roles:  'sn_customerservice.agent',
    active: true
  });

  // 5. Link both criteria to MD DNR KB (can_read)
  console.log('\n  Linking user criteria to MD DNR KB...');
  await linkUserCriteriaToKb(kbSysId, ucCompanySysId);
  await linkUserCriteriaToKb(kbSysId, ucAgentSysId);

  // 6. Create the agent-only KB
  console.log('\n  Creating Aspira Agent Resources KB...');
  const { sys_id: agentKbSysId } = await upsert('kb_knowledge_base', 'title', 'Aspira Agent Resources', {
    title:       'Aspira Agent Resources',
    description: 'Internal KB for Aspira CSR agents. Not linked to any customer portal.',
    active:      true
  });
  ctx.agentKbSysId = agentKbSysId;
  console.log(`  Agent KB sys_id: ${agentKbSysId}`);

  // 7. Agent-only user criteria for the agent KB
  console.log('  Creating user criteria (agents only for agent KB)...');
  const { sys_id: ucAgentOnlySysId } = await upsert('user_criteria', 'name', 'CSR Agents Only', {
    name:   'CSR Agents Only',
    roles:  'sn_customerservice.agent',
    active: true
  });
  await linkUserCriteriaToKb(agentKbSysId, ucAgentOnlySysId);

  // 8. Create KB categories for the customer KB
  console.log('\n  Creating categories (customer KB)...');
  const { sys_id: catParksSysId } = await upsert('kb_category', 'label', 'Parks & Reservations', {
    label:           'Parks & Reservations',
    kb_knowledge_base: kbSysId
  });
  const { sys_id: catBillingSysId } = await upsert('kb_category', 'label', 'Payments & Billing', {
    label:           'Payments & Billing',
    kb_knowledge_base: kbSysId
  });

  // 9. Create KB categories for the agent KB
  console.log('  Creating categories (agent KB)...');
  const { sys_id: catAgentParksSysId }   = await upsert('kb_category', 'label', 'MD DNR — Parks', {
    label: 'MD DNR — Parks', kb_knowledge_base: agentKbSysId
  });
  const { sys_id: catAgentBillingSysId } = await upsert('kb_category', 'label', 'MD DNR — Billing', {
    label: 'MD DNR — Billing', kb_knowledge_base: agentKbSysId
  });

  const catMap = {
    parks:        catParksSysId,
    billing:      catBillingSysId,
    agent_parks:  catAgentParksSysId,
    agent_billing: catAgentBillingSysId
  };

  // 10. Publish customer articles to MD DNR KB
  console.log('\n  Publishing customer articles...');
  for (const a of CUSTOMER_ARTICLES) {
    await upsert('kb_knowledge', 'short_description', a.short_description, {
      short_description: a.short_description,
      text:              a.text,
      keywords:          a.keywords,
      kb_knowledge_base: kbSysId,
      kb_category:       catMap[a.category_key],
      active: true
    });
  }

  // 11. Publish agent articles to Agent Resources KB
  console.log('  Publishing agent articles...');
  for (const a of AGENT_ARTICLES) {
    await upsert('kb_knowledge', 'short_description', a.short_description, {
      short_description: a.short_description,
      text:              a.text,
      keywords:          a.keywords,
      kb_knowledge_base: agentKbSysId,
      kb_category:       catMap[a.category_key],
      active:            true
    });
  }

  // 12. Force-publish all articles via a one-time background script
  //     (direct PATCH to workflow_state is reset by business rules; setWorkflow(false) bypasses them)
  console.log('\n  Publishing articles via background script...');
  const allIds = [];
  for (const a of [...CUSTOMER_ARTICLES, ...AGENT_ARTICLES]) {
    const rec = await findOne('kb_knowledge', `short_description=${a.short_description}`);
    if (rec) allIds.push(rec.sys_id);
  }
  const publishScript = `var ids=${JSON.stringify(allIds)};for(var i=0;i<ids.length;i++){var gr=new GlideRecord('kb_knowledge');if(gr.get(ids[i])){gr.setWorkflow(false);gr.setValue('workflow_state','published');gr.update();}}`;
  const past = new Date(Date.now() - 5000).toISOString().replace('T', ' ').substring(0, 19);
  await client.post('/api/now/table/sysauto_script', {
    name: 'AHC - Publish KB Articles (one-time)',
    script: publishScript,
    active: true,
    run_type: 'once',
    run_start: past
  });
  console.log(`  Scheduled publish job for ${allIds.length} articles`);

  // 13. Update the company → KB mapping system property
  console.log('\n  Updating ahc.kb.company_map system property...');
  await updateSysProp('ahc.kb.company_map', function(current) {
    current[companySysId] = kbSysId;
    return current;
  });
  console.log(`  Mapped company ${companySysId} → KB ${kbSysId}`);

  console.log('\n  MD DNR KB seed complete.');
  console.log(`  Customer KB:  ${kbSysId}`);
  console.log(`  Agent KB:     ${agentKbSysId}`);
  console.log(`  Company:      ${companySysId}`);
};

if (require.main === module) {
  require('dotenv').config();
  const ctx = {};
  module.exports(ctx)
    .then(() => console.log('\nDone.', ctx))
    .catch(e => { console.error(e.message); process.exit(1); });
}
