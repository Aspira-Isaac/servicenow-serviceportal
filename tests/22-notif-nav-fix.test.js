/**
 * Integration tests for deploy/22-notif-nav-fix-dev.js
 *
 * READ-ONLY — verifies the Aspira Help Center Header record on DEV carries the
 * notification-navigation fix: the bell items + footer link point at the
 * portal-prefixed page URLs, and the client controller drives the SPA
 * navigation itself (a bare href="?id=..." is dropped by Angular's HTML5-mode
 * anchor handler, which is why clicking a notification did nothing before).
 *
 * Also asserts the dev-only Knowledge nav link is preserved, so the fix redeploy
 * did not clobber the showKbNav customization.
 *
 * Run: node tests/22-notif-nav-fix.test.js
 */
require('dotenv').config({ path: '.env.dev' });
const assert = require('assert');
const client = require('../lib/client');

let passed = 0, failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    → ${err.message}`);
    failed++;
  }
}

async function run() {
  console.log('\n─── Header record ───');

  let header;

  await test('"Aspira Help Center Header" should exist in sp_header_footer', async () => {
    const r = await client.get('/api/now/table/sp_header_footer', {
      params: {
        sysparm_query: 'name=Aspira Help Center Header',
        sysparm_fields: 'sys_id,name,template,client_script',
        sysparm_limit: 1
      }
    });
    assert.strictEqual(r.data.result.length, 1, 'header not found');
    header = r.data.result[0];
  });

  console.log('\n─── Template hrefs (portal-prefixed) ───');

  await test('notification item href includes the {{data.portalUrl}} prefix', async () => {
    assert.ok(header, 'header must exist first');
    assert.ok(
      header.template.includes('href="{{data.portalUrl}}?id=ticket_detail&sys_id={{n.docSysId}}"'),
      'notification item href is missing the {{data.portalUrl}} prefix'
    );
  });

  await test('notification item does NOT use the bare relative href', async () => {
    assert.ok(header, 'header must exist first');
    assert.ok(
      !header.template.includes('href="?id=ticket_detail&sys_id={{n.docSysId}}"'),
      'notification item still uses the bare relative href (Angular drops it)'
    );
  });

  await test('"View all my cases" footer link includes the {{data.portalUrl}} prefix', async () => {
    assert.ok(header, 'header must exist first');
    assert.ok(
      header.template.includes('href="{{data.portalUrl}}?id=ticket_list" class="ahc-notif-panel__footer-link"'),
      'footer "View all my cases" link is missing the {{data.portalUrl}} prefix'
    );
  });

  console.log('\n─── Client controller (SPA navigation) ───');

  await test('navToCase drives $location to the case detail page', async () => {
    assert.ok(header, 'header must exist first');
    assert.ok(
      header.client_script.includes("$location.search({ id: 'ticket_detail', sys_id: sysId })"),
      'navToCase does not navigate via $location.search'
    );
  });

  await test('navToTicketList drives $location to the ticket list page', async () => {
    assert.ok(header, 'header must exist first');
    assert.ok(
      header.client_script.includes("$location.search({ id: 'ticket_list' })"),
      'navToTicketList does not navigate via $location.search'
    );
  });

  console.log('\n─── Dev customization preserved ───');

  await test('dev-only Knowledge nav link is still present (showKbNav not clobbered)', async () => {
    assert.ok(header, 'header must exist first');
    assert.ok(
      header.template.includes('?id=ahc_kb_search" class="ahc-nav__link">Knowledge'),
      'Knowledge nav link missing — the fix redeploy dropped the dev showKbNav customization'
    );
  });

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed ? 1 : 0);
}

run().catch(e => { console.error(e.message); process.exit(1); });
