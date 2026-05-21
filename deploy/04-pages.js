const { findSysId } = require('../lib/idempotent');
const client = require('../lib/client');

// ServiceNow converts hyphens → underscores in sp_page.id on creation
const PAGES = [
  { id: 'ahc-index',         storedId: 'ahc_index',         title: 'Home',              key: 'pageHome'    },
  { id: 'ahc-submit-ticket', storedId: 'ahc_submit_ticket', title: 'Submit a Ticket',   key: 'pageTicket'  },
  { id: 'ahc-kb-search',     storedId: 'ahc_kb_search',     title: 'Knowledge Base',    key: 'pageKb'      },
  { id: 'ticket-list',       storedId: 'ticket_list',       title: 'My Tickets',        key: 'pageTickets'      },
  { id: 'ticket-detail',    storedId: 'ticket_detail',    title: 'Case Detail',        key: 'pageTicketDetail' }
];

module.exports = async function deployPages(ctx) {
  for (const page of PAGES) {
    // Check if page already exists — sp_page ACLs allow create but not update
    const existing = await findSysId('sp_page', 'id', page.storedId);
    if (existing) {
      ctx[page.key] = existing;
      console.log(`  Page "${page.title}" (${page.id}): ${existing} [exists]`);
    } else {
      const resp = await client.post('/api/now/table/sp_page', {
        title: page.title,
        id: page.id,
        sp_portal: ctx.portalSysId,
        public: 'true'
      });
      const sysId = resp.data.result.sys_id;
      ctx[page.key] = sysId;
      console.log(`  Page "${page.title}" (${page.id}): ${sysId} [created]`);
    }
  }

  // Set homepage on the portal
  await client.patch(`/api/now/table/sp_portal/${ctx.portalSysId}`, {
    homepage: ctx.pageHome
  });
  console.log(`  Homepage set to ahc-index (${ctx.pageHome})`);
};

if (require.main === module) {
  require('dotenv').config();
  module.exports({ portalSysId: process.argv[2] }).catch(e => {
    console.error(e.message);
    process.exit(1);
  });
}
