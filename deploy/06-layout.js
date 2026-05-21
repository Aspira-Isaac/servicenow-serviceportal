const client = require('../lib/client');

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

  // 4. sp_instance — links widget to column
  const instanceSysId = await findOrCreate(
    'sp_instance',
    `sp_column=${colSysId}^widget=${widgetSysId}`,
    { sp_column: colSysId, sp_widget: widgetSysId, order: 10 }
  );

  return { containerSysId, rowSysId, colSysId, instanceSysId };
}

module.exports = async function deployLayout(ctx) {
  await wireWidgetToPage('Homepage Hero',        ctx.pageHome,          ctx.widgetHero,       100);
  await wireWidgetToPage('Homepage Stats',       ctx.pageHome,          ctx.widgetStats,      150);
  await wireWidgetToPage('Homepage Quick Links', ctx.pageHome,          ctx.widgetQuickLinks, 200);
  await wireWidgetToPage('Submit Ticket',        ctx.pageTicket,        ctx.widgetWizard,     100);
  await wireWidgetToPage('KB Search',            ctx.pageKb,            ctx.widgetKb,         100);
  await wireWidgetToPage('Case List',            ctx.pageTickets,       ctx.widgetCaseList,   100);
  await wireWidgetToPage('Case Detail',          ctx.pageTicketDetail,  ctx.widgetCaseDetail, 100);
};

if (require.main === module) {
  require('dotenv').config();
  console.log('Run via: node deploy/index.js (layout step requires full ctx)');
}
