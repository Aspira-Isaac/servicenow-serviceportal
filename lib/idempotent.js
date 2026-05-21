const client = require('./client');

async function upsert(table, queryField, queryValue, payload) {
  const searchResp = await client.get(`/api/now/table/${table}`, {
    params: {
      sysparm_query: `${queryField}=${queryValue}`,
      sysparm_fields: 'sys_id',
      sysparm_limit: 1
    }
  });

  const existing = searchResp.data.result;

  if (existing && existing.length > 0) {
    const sysId = existing[0].sys_id;
    await client.patch(`/api/now/table/${table}/${sysId}`, payload);
    console.log(`  [updated] ${table} ${queryField}=${queryValue} (${sysId})`);
    return { sys_id: sysId, action: 'updated' };
  } else {
    const createResp = await client.post(`/api/now/table/${table}`, payload);
    const sysId = createResp.data.result.sys_id;
    console.log(`  [created] ${table} ${queryField}=${queryValue} (${sysId})`);
    return { sys_id: sysId, action: 'created' };
  }
}

async function findSysId(table, queryField, queryValue) {
  const resp = await client.get(`/api/now/table/${table}`, {
    params: {
      sysparm_query: `${queryField}=${queryValue}`,
      sysparm_fields: 'sys_id',
      sysparm_limit: 1
    }
  });
  const results = resp.data.result;
  return results && results.length > 0 ? results[0].sys_id : null;
}

module.exports = { upsert, findSysId };
