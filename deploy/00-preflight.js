require('dotenv').config();
const client = require('../lib/client');

module.exports = async function preflight() {
  console.log(`  Connecting to ${process.env.SNOW_INSTANCE} as ${process.env.SNOW_USER}...`);
  const resp = await client.get('/api/now/table/sys_user', {
    params: { sysparm_limit: 1, sysparm_fields: 'user_name' }
  });
  if (!resp.data.result) throw new Error('Unexpected response from instance');
  console.log('  Connection OK');

  // Confirm we are not touching any existing portal
  const portals = await client.get('/api/now/table/sp_portal', {
    params: { sysparm_query: 'url_suffix=help', sysparm_fields: 'title,url_suffix', sysparm_limit: 1 }
  });
  if (portals.data.result.length > 0) {
    console.log('  /help portal already exists — deploy will update (upsert mode)');
  } else {
    console.log('  /help portal does not exist — will create fresh');
  }
};

if (require.main === module) {
  module.exports({}).then(() => console.log('Preflight passed')).catch(e => {
    console.error(e.message);
    process.exit(1);
  });
}
