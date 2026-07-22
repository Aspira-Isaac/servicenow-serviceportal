/**
 * Integration tests for deploy/23-case-list-filters-dev.js
 *
 * READ-ONLY — verifies the ahc-case-list widget on DEV carries:
 *   • a MULTI-SELECT status filter (check any combination of states; empty =
 *     All) that funnels through addConditions() as state IN <selected>, so it
 *     applies to the count, rows, export and facets, and
 *   • a "My Team" scope that excludes internal Aspira staff by matching on the
 *     opener's company (opened_by.company = the account).
 *
 * Run: node tests/23-case-list-filters.test.js
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

const WIDGET_ID = 'ahc-case-list';

async function run() {
  console.log('\n─── Widget record ───');

  let widget;

  await test('widget "ahc-case-list" should exist in sp_widget', async () => {
    const r = await client.get('/api/now/table/sp_widget', {
      params: { sysparm_query: 'id=' + WIDGET_ID, sysparm_fields: 'sys_id,id,script,template,client_script', sysparm_limit: 1 }
    });
    assert.strictEqual(r.data.result.length, 1, 'widget not found');
    widget = r.data.result[0];
  });

  console.log('\n─── Multi-select status filter (server) ───');

  await test('server reads the multi-select states input', async () => {
    assert.ok(widget, 'widget must exist first');
    assert.ok(widget.script.includes('input.states'), 'server does not read input.states');
    assert.ok(widget.script.includes('selectedStates'), 'server has no selectedStates list');
  });

  await test('selected states are applied as state IN <list> inside addConditions', async () => {
    assert.ok(widget, 'widget must exist first');
    // Must be inside addConditions so it applies to count, rows, export and facets
    const acIdx = widget.script.indexOf('function addConditions');
    assert.ok(acIdx !== -1, 'addConditions() not found');
    const acBody = widget.script.substring(acIdx, acIdx + 1400);
    assert.ok(
      /selectedStates\.length[\s\S]*?addQuery\('state', 'IN', selectedStates\.join/.test(acBody),
      'addConditions does not query state IN selectedStates'
    );
  });

  await test('server no longer carries the old hideClosed toggle', async () => {
    assert.ok(widget, 'widget must exist first');
    assert.ok(!widget.script.includes('hideClosed'), 'server still references the removed hideClosed toggle');
  });

  await test('server echoes data.selectedStates back to the client', async () => {
    assert.ok(widget, 'widget must exist first');
    assert.ok(widget.script.includes('data.selectedStates'), 'server does not set data.selectedStates');
  });

  console.log('\n─── Multi-select Location & Category (server) ───');

  await test('server reads multi-select locations & categories', async () => {
    assert.ok(widget, 'widget must exist first');
    assert.ok(widget.script.includes('input.locations'), 'server does not read input.locations');
    assert.ok(widget.script.includes('input.categories'), 'server does not read input.categories');
    assert.ok(widget.script.includes('selectedLocations') && widget.script.includes('selectedCategories'),
      'server has no selectedLocations/selectedCategories lists');
  });

  await test('location & category applied as IN <list> inside addConditions', async () => {
    assert.ok(widget, 'widget must exist first');
    assert.ok(widget.script.includes("addQuery('location', 'IN', selectedLocations.join"), 'location not queried as IN list');
    assert.ok(widget.script.includes("addQuery('category', 'IN', selectedCategories.join"), 'category not queried as IN list');
  });

  await test('server echoes selectedLocations & selectedCategories', async () => {
    assert.ok(widget, 'widget must exist first');
    assert.ok(widget.script.includes('data.selectedLocations') && widget.script.includes('data.selectedCategories'),
      'server does not echo the location/category selections');
  });

  console.log('\n─── My Team excludes Aspira staff (server) ───');

  await test('My Team matches opener company to the account (opened_by.company)', async () => {
    assert.ok(widget, 'widget must exist first');
    const teamIdx = widget.script.indexOf("opener === 'team'");
    assert.ok(teamIdx !== -1, "\"opener === 'team'\" branch not found");
    const teamBody = widget.script.substring(teamIdx, teamIdx + 600);
    assert.ok(teamBody.includes("'opened_by', '!='"), 'My Team no longer excludes the current user');
    assert.ok(teamBody.includes('opened_by.company'), 'My Team does not restrict to the account company (staff not excluded)');
  });

  console.log('\n─── Client wiring ───');

  await test('client sends the selected states on every reload', async () => {
    assert.ok(widget, 'widget must exist first');
    assert.ok(widget.client_script.includes('states:     c.states.join'), 'reload payload does not include the states list');
  });

  await test('client exposes multi-select handlers for all three facets', async () => {
    assert.ok(widget, 'widget must exist first');
    ['toggleState', 'toggleLocation', 'toggleCategory',
     'setAllStates', 'setAllLocations', 'setAllCategories',
     'isStateSelected', 'isLocationSelected', 'isCategorySelected'].forEach(function(fn) {
      assert.ok(widget.client_script.includes('c.' + fn), 'missing handler c.' + fn);
    });
  });

  await test('client sends location & category lists on reload', async () => {
    assert.ok(widget, 'widget must exist first');
    assert.ok(widget.client_script.includes('locations:  c.locations.join'), 'reload does not send locations list');
    assert.ok(widget.client_script.includes('categories: c.categories.join'), 'reload does not send categories list');
  });

  await test('client no longer carries old single-select filter / hideClosed / setLocation', async () => {
    assert.ok(widget, 'widget must exist first');
    assert.ok(!widget.client_script.includes('hideClosed'), 'client still references removed hideClosed');
    assert.ok(!widget.client_script.includes('c.setFilter'), 'client still references removed single-select setFilter');
    assert.ok(!widget.client_script.includes('c.setLocation'), 'client still references removed single-select setLocation');
    assert.ok(!widget.client_script.includes('c.setCategory'), 'client still references removed single-select setCategory');
  });

  await test('client persists the states array across case navigation', async () => {
    assert.ok(widget, 'widget must exist first');
    assert.ok(widget.client_script.includes('states:     c.states') &&
      widget.client_script.includes('savedState.states'), 'states are not persisted/restored');
  });

  console.log('\n─── Template ───');

  await test('template renders multi-select checkboxes for status, location & category', async () => {
    assert.ok(widget, 'widget must exist first');
    assert.ok(widget.template.includes('c.toggleState(s.value)'), 'state toggle not wired');
    assert.ok(widget.template.includes('c.toggleLocation(l.value)'), 'location toggle not wired');
    assert.ok(widget.template.includes('c.toggleCategory(cat.value)'), 'category toggle not wired');
    assert.ok(widget.template.includes('c.setAllStates()') &&
      widget.template.includes('c.setAllLocations()') &&
      widget.template.includes('c.setAllCategories()'), 'not all facets have an All (clear) button');
    assert.ok(!/Hide closed cases/i.test(widget.template), 'old Hide closed cases toggle still present');
    assert.ok(!widget.template.includes('c.setLocation(') && !widget.template.includes('c.setCategory('),
      'template still uses old single-select location/category handlers');
  });

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed ? 1 : 0);
}

run().catch(e => { console.error(e.message); process.exit(1); });
