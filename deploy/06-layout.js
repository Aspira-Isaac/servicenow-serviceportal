const client = require('../lib/client');

// Built-in SP catalog widgets (already exist in the instance)
const SC_CATEGORIES_WIDGET = '4c03cba0cb11020000f8d856634c9ce1'; // SC Categories (sidebar)
const SC_CATEGORY_WIDGET   = 'f2ff0622d7000200a9ad1e173e24d4f3'; // SC Category Page (item grid)

// Full hierarchy: sp_page → sp_container → sp_row → sp_column → sp_instance

async function findOrCreate(table, query, payload) {
  const resp = await client.get(`/api/now/table/${table}`, {
    params: {
      sysparm_query: query,
      sysparm_fields: 'sys_id',
      sysparm_limit: 1
    }
  });
  const existing = resp.data.result;
  if (existing && existing.length > 0) {
    console.log(`    [exists] ${table}`);
    return existing[0].sys_id;
  }
  const created = await client.post(`/api/now/table/${table}`, payload);
  console.log(`    [created] ${table}`);
  return created.data.result.sys_id;
}

async function wireWidgetToPage(label, pageSysId, widgetSysId, containerOrder) {
  console.log(`  Wiring ${label}...`);

  // 1. sp_container — links directly to sp_page
  const containerSysId = await findOrCreate(
    'sp_container',
    `sp_page=${pageSysId}^order=${containerOrder}`,
    {
      sp_page: pageSysId,
      order: containerOrder,
      width: 'container-fluid',
      background_style: 'default',
      name: `${label} Container`
    }
  );

  // 2. sp_row — links to sp_container
  const rowSysId = await findOrCreate(
    'sp_row',
    `sp_container=${containerSysId}^order=10`,
    { sp_container: containerSysId, order: 10 }
  );

  // 3. sp_column — links to sp_row
  const colSysId = await findOrCreate(
    'sp_column',
    `sp_row=${rowSysId}^order=10`,
    { sp_row: rowSysId, size: 12, order: 10 }
  );

  // 4. sp_instance — link widget to column; update in place if a different widget is already there
  const existingResp = await client.get(`/api/now/table/sp_instance`, {
    params: { sysparm_query: `sp_column=${colSysId}`, sysparm_fields: 'sys_id,sp_widget', sysparm_limit: 1 }
  });
  const existingInstances = existingResp.data.result;
  let instanceSysId;
  if (existingInstances && existingInstances.length > 0) {
    instanceSysId = existingInstances[0].sys_id;
    const currentWidget = existingInstances[0].sp_widget && existingInstances[0].sp_widget.value;
    if (currentWidget !== widgetSysId) {
      await client.patch(`/api/now/table/sp_instance/${instanceSysId}`, { sp_widget: widgetSysId });
      console.log(`    [updated] sp_instance widget`);
    } else {
      console.log(`    [exists] sp_instance`);
    }
  } else {
    const created = await client.post(`/api/now/table/sp_instance`, { sp_column: colSysId, sp_widget: widgetSysId, order: 10 });
    instanceSysId = created.data.result.sys_id;
    console.log(`    [created] sp_instance`);
  }

  return { containerSysId, rowSysId, colSysId, instanceSysId };
}

// Two-column catalog page: SC Categories sidebar (col 3) + sc-category item grid (col 9)
async function wireCatalogPage(pageSysId) {
  console.log('  Wiring Catalog Browse...');

  const containerSysId = await findOrCreate(
    'sp_container',
    `sp_page=${pageSysId}^order=100`,
    { sp_page: pageSysId, order: 100, width: 'container-fluid', background_style: 'default', name: 'Catalog Container' }
  );

  const rowSysId = await findOrCreate(
    'sp_row',
    `sp_container=${containerSysId}^order=10`,
    { sp_container: containerSysId, order: 10 }
  );

  // Helper: get or create a column with a specific order; update size if wrong
  async function ensureColumn(order, size) {
    const resp = await client.get('/api/now/table/sp_column', {
      params: { sysparm_query: `sp_row=${rowSysId}^order=${order}`, sysparm_fields: 'sys_id,size', sysparm_limit: 1 }
    });
    const existing = resp.data.result;
    if (existing && existing.length > 0) {
      const colId = existing[0].sys_id;
      if (existing[0].size !== String(size)) {
        await client.patch(`/api/now/table/sp_column/${colId}`, { size });
        console.log(`    [updated] sp_column order=${order} size→${size}`);
      } else {
        console.log(`    [exists] sp_column order=${order}`);
      }
      return colId;
    }
    const created = await client.post('/api/now/table/sp_column', { sp_row: rowSysId, size, order });
    console.log(`    [created] sp_column order=${order} size=${size}`);
    return created.data.result.sys_id;
  }

  // Helper: wire a widget to a column, updating if a different widget is already there
  async function ensureInstance(colSysId, widgetSysId, params) {
    const resp = await client.get('/api/now/table/sp_instance', {
      params: { sysparm_query: `sp_column=${colSysId}`, sysparm_fields: 'sys_id,sp_widget', sysparm_limit: 1 }
    });
    const existing = resp.data.result;
    const payload = { sp_widget: widgetSysId, order: 10 };
    if (params) payload.widget_parameters = JSON.stringify(params);
    if (existing && existing.length > 0) {
      const inst = existing[0];
      const needsUpdate = inst.sp_widget.value !== widgetSysId;
      if (needsUpdate || params) {
        await client.patch(`/api/now/table/sp_instance/${inst.sys_id}`, payload);
        console.log(`    [updated] sp_instance`);
      } else {
        console.log(`    [exists] sp_instance`);
      }
      return inst.sys_id;
    }
    const created = await client.post('/api/now/table/sp_instance', { sp_column: colSysId, ...payload });
    console.log(`    [created] sp_instance`);
    return created.data.result.sys_id;
  }

  const leftColId  = await ensureColumn(10, 3);   // sidebar
  const rightColId = await ensureColumn(20, 9);   // item grid

  await ensureInstance(leftColId,  SC_CATEGORIES_WIDGET, null);
  // Pass page sys_id so sc-category links back to our catalog page
  await ensureInstance(rightColId, SC_CATEGORY_WIDGET, { page: pageSysId });
}

module.exports = async function deployLayout(ctx) {
  await wireWidgetToPage('Homepage Hero',        ctx.pageHome,          ctx.widgetHero,       100);
  await wireWidgetToPage('Homepage Stats',       ctx.pageHome,          ctx.widgetStats,      150);
  await wireWidgetToPage('Homepage Quick Links', ctx.pageHome,          ctx.widgetQuickLinks, 200);
  await wireCatalogPage(ctx.pageTicket);
  await wireWidgetToPage('KB Search',            ctx.pageKb,            ctx.widgetKb,         100);
  await wireWidgetToPage('Case List',            ctx.pageTickets,       ctx.widgetCaseList,   100);
  await wireWidgetToPage('Case Detail',          ctx.pageTicketDetail,  ctx.widgetCaseDetail, 100);
};

if (require.main === module) {
  require('dotenv').config();
  console.log('Run via: node deploy/index.js (layout step requires full ctx)');
}
