'use strict';

const assert = require('node:assert/strict');
const {
  Fastify,
  createControllerServices,
  registerTenantUserController,
  registerTenantAdminController,
  registerTenantPermissionController,
  registerTenantAdminPermissionController
} = require('./support/controller-harness');

describe('controllers /tenant 路由', () => {
  const prefix = '/api/tenant';
  let fastify;
  let hit;

  before(async () => {
    hit = {};
    const services = createControllerServices({
      user: {
        parseToken: async body => {
          hit.parseToken = body;
          return { ok: 1 };
        },
        join: async (u, b) => {
          hit.join = [u, b];
        },
        tenantList: async () => ({ list: [], defaultTenantId: null }),
        setDefaultTenant: async (u, b) => {
          hit.setDefaultTenant = [u, b];
        },
        create: async b => {
          hit.userCreate = b;
        },
        detail: async () => ({ id: 'u1' }),
        save: async b => {
          hit.userSave = b;
        },
        remove: async b => {
          hit.userRemove = b;
        },
        list: async () => ({ pageData: [], totalCount: 0 }),
        setStatus: async b => {
          hit.userSetStatus = b;
        },
        inviteToken: async () => ({ token: 'x' }),
        sendInviteMessage: async b => {
          hit.sendInvite = b;
        }
      },
      company: {
        detail: async q => {
          hit.companyDetail = q;
          return {};
        },
        save: async b => {
          hit.companySave = b;
          return {};
        }
      },
      org: {
        create: async b => {
          hit.orgCreate = b;
          return {};
        },
        list: async q => {
          hit.orgList = q;
          return [];
        },
        remove: async b => {
          hit.orgRemove = b;
        },
        save: async b => {
          hit.orgSave = b;
        }
      },
      setting: {
        customComponentDetail: async q => {
          hit.ccDetail = q;
          return {};
        }
      }
    });
    fastify = Fastify({ logger: false });
    await registerTenantUserController(fastify, 'ctenant', prefix, services);
  });

  after(() => fastify.close());

  it('POST parse-join-token 调用 user.parseToken', async () => {
    const res = await fastify.inject({
      method: 'POST',
      url: `${prefix}/parse-join-token`,
      payload: { token: 'abc' }
    });
    assert.equal(res.statusCode, 200);
    assert.deepEqual(hit.parseToken, { token: 'abc' });
  });

  it('GET getUserInfo 返回 userInfo 与 tenantUserInfo', async () => {
    const res = await fastify.inject({ method: 'GET', url: `${prefix}/getUserInfo` });
    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.ok(body.tenantUserInfo);
    assert.ok(body.company);
  });

  it('POST org-create 附带 tenantId', async () => {
    await fastify.inject({
      method: 'POST',
      url: `${prefix}/org-create`,
      payload: { name: '部门' }
    });
    assert.equal(hit.orgCreate.tenantId, 'tid-1');
    assert.equal(hit.orgCreate.name, '部门');
  });
});

describe('controllers /tenant/admin org-batch-import', () => {
  const prefix = '/api/tenant';
  let fastify;
  let batchArgs;

  before(async () => {
    batchArgs = null;
    const services = createControllerServices({
      org: {
        importFromRows: async args => {
          batchArgs = args;
          return { ok: true };
        }
      }
    });
    fastify = Fastify({ logger: false });
    await registerTenantAdminController(fastify, 'cadmin', prefix, services);
  });

  after(() => fastify.close());

  it('JSON 提交 rows', async () => {
    const res = await fastify.inject({
      method: 'POST',
      url: `${prefix}/admin/org-batch-import`,
      payload: {
        tenantId: 't1',
        parentOrgId: 'p1',
        rows: [
          {
            rowType: 'org',
            orgName: 'A',
            parentOrgName: null,
            userName: null,
            email: null,
            phone: null,
            description: null,
            isLeader: false
          }
        ]
      }
    });
    assert.equal(res.statusCode, 200);
    assert.equal(batchArgs.tenantId, 't1');
    assert.equal(batchArgs.parentOrgId, 'p1');
    assert.equal(batchArgs.rows.length, 1);
  });

  it('缺少 rows 时校验失败', async () => {
    const res = await fastify.inject({
      method: 'POST',
      url: `${prefix}/admin/org-batch-import`,
      payload: { tenantId: 't1' }
    });
    assert.equal(res.statusCode, 400);
  });
});

describe('controllers tenant-permission & tenant-admin-permission', () => {
  const prefix = '/api/tenant';

  it('role/list 合并 tenantId', async () => {
    let q;
    const fastify = Fastify({ logger: false });
    const services = createControllerServices({
      role: {
        list: async query => {
          q = query;
          return { pageData: [], totalCount: 0 };
        }
      }
    });
    await registerTenantPermissionController(fastify, 'cperm', prefix, services);
    const res = await fastify.inject({ method: 'GET', url: `${prefix}/role/list?currentPage=1&perPage=10` });
    assert.equal(res.statusCode, 200);
    assert.equal(q.tenantId, 'tid-1');
    await fastify.close();
  });

  it('role/list query 透传 filter.type', async () => {
    let q;
    const qs = require('qs');
    const fastify = Fastify({
      logger: false,
      querystringParser: str => qs.parse(str)
    });
    const services = createControllerServices({
      role: {
        list: async query => {
          q = query;
          return { pageData: [], totalCount: 0 };
        }
      }
    });
    await registerTenantPermissionController(fastify, 'cperm', prefix, services);
    const res = await fastify.inject({
      method: 'GET',
      url: `${prefix}/role/list?currentPage=1&perPage=10&filter[type]=system`
    });
    assert.equal(res.statusCode, 200);
    assert.equal(q.filter.type, 'system');
    await fastify.close();
  });

  it('admin permission save 调用 services.permission.save', async () => {
    let body;
    const fastify = Fastify({ logger: false });
    const services = createControllerServices({
      permission: {
        save: async b => {
          body = b;
        }
      }
    });
    await registerTenantAdminPermissionController(fastify, 'cadmperm', prefix, services);
    const res = await fastify.inject({
      method: 'POST',
      url: `${prefix}/admin/permission/save`,
      payload: { tenantId: 't1', permissions: ['a'] }
    });
    assert.equal(res.statusCode, 200);
    assert.deepEqual(body, { tenantId: 't1', permissions: ['a'] });
    await fastify.close();
  });
});

describe('controllers shared-group', () => {
  const prefix = '/api/tenant';

  it('admin/shared-group/list 传递 tenantId', async () => {
    let query;
    const fastify = Fastify({ logger: false });
    const services = createControllerServices({
      sharedGroup: {
        list: async q => {
          query = q;
          return { pageData: [], totalCount: 0 };
        }
      }
    });
    const { registerTenantAdminSharedGroupController } = require('./support/controller-harness');
    await registerTenantAdminSharedGroupController(fastify, 'cadmSg', prefix, services);
    const res = await fastify.inject({
      method: 'GET',
      url: `${prefix}/admin/shared-group/list?tenantId=t1&currentPage=1&perPage=10`
    });
    assert.equal(res.statusCode, 200);
    assert.equal(query.tenantId, 't1');
    await fastify.close();
  });
});
