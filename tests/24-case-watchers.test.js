/**
 * Integration tests for deploy/24-case-watchers-dev.js
 *
 * READ-ONLY — verifies the ahc-case-detail widget on DEV carries the Watchers
 * feature: server add/remove actions gated on watch_list field-write, a
 * same-account candidate list, and the template/client wiring for the picker.
 *
 * NOTE: these assert the widget CODE is deployed. Two instance dependencies
 * (external write ACL on watch_list; an OOTB watch-list notification) are NOT
 * checked here — they must be verified manually in dev (see the deploy script).
 *
 * Run: node tests/24-case-watchers.test.js
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

const WIDGET_ID = 'ahc-case-detail';

async function run() {
  console.log('\n─── Widget record ───');

  let widget;

  await test('widget "ahc-case-detail" should exist in sp_widget', async () => {
    const r = await client.get('/api/now/table/sp_widget', {
      params: { sysparm_query: 'id=' + WIDGET_ID, sysparm_fields: 'sys_id,id,script,template,client_script', sysparm_limit: 1 }
    });
    assert.strictEqual(r.data.result.length, 1, 'widget not found');
    widget = r.data.result[0];
  });

  console.log('\n─── Server: watch_list actions & access ───');

  await test('server gates watch management on case involvement (not a field ACL)', async () => {
    assert.ok(widget, 'widget must exist first');
    assert.ok(widget.script.includes('canManageWatchers'), 'no canManageWatchers gate');
    // Gate is ownership/role based: opener OR contact OR customer_admin/admin OR canWrite
    const gateIdx = widget.script.indexOf('function canManageWatchers');
    assert.ok(gateIdx !== -1, 'canManageWatchers not defined');
    const gateBody = widget.script.substring(gateIdx, gateIdx + 400);
    assert.ok(gateBody.includes("getValue('opened_by')") && gateBody.includes("getValue('contact')"),
      'gate does not allow the case opener/contact');
    // The field-level ACL check (which wrongly hid the UI) must be gone
    assert.ok(!widget.script.includes('.watch_list/write'), 'server still does the field-level ACL check that hid the UI');
  });

  await test('server handles add_watcher and remove_watcher', async () => {
    assert.ok(widget, 'widget must exist first');
    assert.ok(widget.script.includes("input.action === 'add_watcher'"), 'no add_watcher action');
    assert.ok(widget.script.includes("input.action === 'remove_watcher'"), 'no remove_watcher action');
    assert.ok(widget.script.includes('watch_list'), 'server never touches watch_list');
  });

  await test('add_watcher accepts EITHER a user sys_id OR an email address', async () => {
    assert.ok(widget, 'widget must exist first');
    const addIdx = widget.script.indexOf("input.action === 'add_watcher'");
    const addBody = widget.script.substring(addIdx, addIdx + 700);
    assert.ok(/\[0-9a-f\]\{32\}/.test(addBody), 'add_watcher does not accept a user sys_id');
    assert.ok(addBody.includes('watcherEmail') && /EMAIL_RE|@/.test(addBody), 'add_watcher does not accept an email address');
  });

  await test('server exposes watchers, canWatch and a same-account picker list', async () => {
    assert.ok(widget, 'widget must exist first');
    assert.ok(widget.script.includes('data.watchers'), 'no data.watchers');
    assert.ok(widget.script.includes('data.canWatch'), 'no data.canWatch');
    assert.ok(widget.script.includes('data.watcherOptions'), 'no data.watcherOptions');
    assert.ok(widget.script.includes("addQuery('company', accountSysId)"), 'picker list is not scoped to the account company');
  });

  console.log('\n─── Quick "Watch this" toggle ───');

  await test('server exposes currentUserId, isOpener and isWatching', async () => {
    assert.ok(widget, 'widget must exist first');
    assert.ok(widget.script.includes('data.currentUserId'), 'no data.currentUserId');
    assert.ok(widget.script.includes('data.isOpener'), 'no data.isOpener');
    assert.ok(widget.script.includes('data.isWatching'), 'no data.isWatching');
  });

  await test('client exposes watchThis / unwatchThis reusing add/remove', async () => {
    assert.ok(widget, 'widget must exist first');
    assert.ok(widget.client_script.includes('c.watchThis'), 'no watchThis handler');
    assert.ok(widget.client_script.includes('c.unwatchThis'), 'no unwatchThis handler');
    assert.ok(widget.client_script.includes('c.data.currentUserId'), 'self-watch does not use the current user id');
  });

  await test('template shows the Watch toggle only on cases you did not open', async () => {
    assert.ok(widget, 'widget must exist first');
    assert.ok(widget.template.includes('ahc-cd__watch-btn'), 'no watch button');
    assert.ok(widget.template.includes('!data.isOpener'), 'watch button not hidden for the opener');
    assert.ok(widget.template.includes('c.watchThis()') && widget.template.includes('c.unwatchThis()'),
      'watch button not wired to watchThis/unwatchThis');
  });

  console.log('\n─── Client wiring ───');

  await test('client exposes addWatcher / addWatcherEmail / removeWatcher', async () => {
    assert.ok(widget, 'widget must exist first');
    assert.ok(widget.client_script.includes('c.addWatcher'), 'no addWatcher handler');
    assert.ok(widget.client_script.includes('c.addWatcherEmail'), 'no addWatcherEmail handler');
    assert.ok(widget.client_script.includes('c.removeWatcher'), 'no removeWatcher handler');
    assert.ok(widget.client_script.includes("action: 'add_watcher'"), 'add does not post add_watcher');
    assert.ok(widget.client_script.includes('watcherEmail'), 'add-email path does not send watcherEmail');
    assert.ok(widget.client_script.includes("action: 'remove_watcher'"), 'removeWatcher does not post remove_watcher');
  });

  console.log('\n─── Template ───');

  await test('template renders the Watchers section with colleague + email inputs', async () => {
    assert.ok(widget, 'widget must exist first');
    assert.ok(/Watchers/.test(widget.template), 'no Watchers label');
    assert.ok(widget.template.includes('data.canWatch'), 'watchers UI not gated on data.canWatch');
    assert.ok(widget.template.includes('c.addWatcher()'), 'no colleague Add control');
    assert.ok(widget.template.includes('c.addWatcherEmail()'), 'no email Add control');
    assert.ok(widget.template.includes('ng-model="c.watcherEmail"'), 'no email input field');
    assert.ok(widget.template.includes('c.removeWatcher(w.sys_id)'), 'no remove-watcher control');
  });

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed ? 1 : 0);
}

run().catch(e => { console.error(e.message); process.exit(1); });
