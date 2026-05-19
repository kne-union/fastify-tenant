'use strict';

const assert = require('node:assert/strict');
const {
  Fastify,
  createControllerServices,
  registerTenantUserController,
  registerTenantAdminController,
  registerTenantPermissionController,
  registerTenantAdminPermissionController,
  registerTenantSharedGroupController,
  registerTenantAdminSharedGroupController
} = require('./support/controller-harness');

const prefix = '/api/tenant';

/** @param {import('fastify').FastifyInstance} app */
async function injectOk(app, method, url, opts = {}) {
  const res = await app.inject({ method, url, ...opts });
  assert.ok(
    res.statusCode < 500,
    `${method} ${url} -> ${res.statusCode} body=${res.body.slice(0, 200)}`
  );
}

describe('controllers 全路由冒烟（期望 <500，覆盖 handler 注册）', () => {
  describe('tenant.js', () => {
    let app;
    before(async () => {
      app = Fastify({ logger: false });
      await registerTenantUserController(app, 'tFull', prefix, createControllerServices());
    });
    after(() => app.close());

    const routes = [
      ['POST', `${prefix}/parse-join-token`, { payload: { token: 't' } }],
      ['POST', `${prefix}/join`, { payload: { token: 't' } }],
      ['GET', `${prefix}/available-list`, {}],
      ['POST', `${prefix}/switch-default-tenant`, { payload: { tenantId: 'tid' } }],
      ['GET', `${prefix}/getUserInfo`, {}],
      ['GET', `${prefix}/company-detail`, {}],
      ['POST', `${prefix}/company-save`, { payload: { name: 'c' } }],
      ['POST', `${prefix}/org-create`, { payload: { name: 'o' } }],
      ['GET', `${prefix}/org-list`, {}],
      ['POST', `${prefix}/org-remove`, { payload: { id: '1' } }],
      ['POST', `${prefix}/org-save`, { payload: { id: '1', name: 'o2' } }],
      [
        'POST',
        `${prefix}/org-batch-import`,
        {
          payload: {
            rows: [{ orgName: 'B', parentOrgName: null, leaderName: null, email: null, phone: null, description: null }]
          }
        }
      ],
      ['POST', `${prefix}/user-create`, { payload: { name: 'u' } }],
      ['GET', `${prefix}/user-detail?id=1`, {}],
      ['POST', `${prefix}/user-save`, { payload: { id: '1', name: 'u2' } }],
      ['POST', `${prefix}/user-remove`, { payload: { id: '1' } }],
      ['GET', `${prefix}/user-list`, {}],
      ['POST', `${prefix}/user-set-status`, { payload: { id: '1', status: 'open' } }],
      ['GET', `${prefix}/user-invite-token?id=1`, {}],
      ['POST', `${prefix}/send-invite-message`, { payload: { id: '1' } }],
      ['GET', `${prefix}/custom-component-detail?key=k`, {}]
    ];

    for (const [method, url, extra] of routes) {
      it(`${method} ${url}`, async () => {
        await injectOk(app, method, url, extra);
      });
    }
  });

  describe('tenant-permission.js', () => {
    let app;
    before(async () => {
      app = Fastify({ logger: false });
      await registerTenantPermissionController(app, 'tpFull', prefix, createControllerServices());
    });
    after(() => app.close());

    const routes = [
      [
        'POST',
        `${prefix}/role/create`,
        {
          payload: {
            name: 'R',
            code: 'r1',
            description: '',
            status: 'open',
            type: 'custom',
            permissions: []
          }
        }
      ],
      ['GET', `${prefix}/role/list`, {}],
      ['POST', `${prefix}/role/remove`, { payload: { id: '1' } }],
      ['POST', `${prefix}/role/set-status`, { payload: { id: '1', status: 'open' } }],
      [
        'POST',
        `${prefix}/role/save`,
        { payload: { id: '1', name: 'R2', code: 'r1', description: '', status: 'open', type: 'custom', permissions: [] } }
      ],
      ['GET', `${prefix}/role/permission-list?id=1`, {}],
      ['POST', `${prefix}/role/save-permission`, { payload: { id: '1', permissions: ['a'] } }],
      ['GET', `${prefix}/permission/list`, {}]
    ];

    for (const [method, url, extra] of routes) {
      it(`${method} ${url}`, async () => {
        await injectOk(app, method, url, extra);
      });
    }
  });

  describe('tenant-shared-group.js', () => {
    let app;
    before(async () => {
      app = Fastify({ logger: false });
      await registerTenantSharedGroupController(app, 'tsgFull', prefix, createControllerServices());
    });
    after(() => app.close());

    const routes = [
      ['GET', `${prefix}/shared-group/list`, {}],
      [
        'POST',
        `${prefix}/shared-group/create`,
        {
          payload: {
            name: 'SG',
            description: '',
            sharedModules: [{ moduleCode: 'm1', access: 'read' }],
            dataSourceTenantUserIds: [],
            memberTenantUserIds: []
          }
        }
      ],
      [
        'POST',
        `${prefix}/shared-group/save`,
        {
          payload: {
            id: '1',
            name: 'SG2',
            sharedModules: [{ moduleCode: 'm1', access: 'read' }]
          }
        }
      ],
      ['POST', `${prefix}/shared-group/set-status`, { payload: { id: '1', status: 'open' } }],
      ['POST', `${prefix}/shared-group/remove`, { payload: { id: '1' } }]
    ];

    for (const [method, url, extra] of routes) {
      it(`${method} ${url}`, async () => {
        await injectOk(app, method, url, extra);
      });
    }
  });

  describe('tenant-admin-permission.js', () => {
    let app;
    before(async () => {
      app = Fastify({ logger: false });
      await registerTenantAdminPermissionController(app, 'tapFull', prefix, createControllerServices());
    });
    after(() => app.close());

    const routes = [
      [
        'POST',
        `${prefix}/admin/role/create`,
        {
          payload: {
            tenantId: 't1',
            name: 'R',
            code: 'r2',
            description: '',
            status: 'open',
            type: 'custom',
            permissions: []
          }
        }
      ],
      ['GET', `${prefix}/admin/role/list?tenantId=t1`, {}],
      ['POST', `${prefix}/admin/role/remove`, { payload: { tenantId: 't1', id: '1' } }],
      ['POST', `${prefix}/admin/role/set-status`, { payload: { tenantId: 't1', id: '1', status: 'open' } }],
      [
        'POST',
        `${prefix}/admin/role/save`,
        {
          payload: {
            tenantId: 't1',
            id: '1',
            name: 'R',
            code: 'r2',
            description: '',
            status: 'open',
            type: 'custom',
            permissions: []
          }
        }
      ],
      ['GET', `${prefix}/admin/role/permission-list?tenantId=t1&id=1`, {}],
      ['POST', `${prefix}/admin/role/save-permission`, { payload: { tenantId: 't1', id: '1', permissions: [] } }],
      ['GET', `${prefix}/admin/permission/list?tenantId=t1`, {}],
      ['POST', `${prefix}/admin/permission/save`, { payload: { tenantId: 't1', permissions: [] } }]
    ];

    for (const [method, url, extra] of routes) {
      it(`${method} ${url}`, async () => {
        await injectOk(app, method, url, extra);
      });
    }
  });

  describe('tenant-admin-shared-group.js', () => {
    let app;
    before(async () => {
      app = Fastify({ logger: false });
      await registerTenantAdminSharedGroupController(app, 'tasgFull', prefix, createControllerServices());
    });
    after(() => app.close());

    const routes = [
      ['GET', `${prefix}/admin/shared-group/list?tenantId=t1`, {}],
      [
        'POST',
        `${prefix}/admin/shared-group/create`,
        {
          payload: {
            tenantId: 't1',
            name: 'AdminSG',
            description: '',
            sharedModules: [{ moduleCode: 'm1', access: 'read' }],
            dataSourceTenantUserIds: [],
            memberTenantUserIds: []
          }
        }
      ],
      [
        'POST',
        `${prefix}/admin/shared-group/save`,
        {
          payload: {
            tenantId: 't1',
            id: '1',
            name: 'AdminSG2',
            sharedModules: [{ moduleCode: 'm1', access: 'write' }]
          }
        }
      ],
      ['POST', `${prefix}/admin/shared-group/set-status`, { payload: { tenantId: 't1', id: '1', status: 'open' } }],
      ['POST', `${prefix}/admin/shared-group/remove`, { payload: { tenantId: 't1', id: '1' } }]
    ];

    for (const [method, url, extra] of routes) {
      it(`${method} ${url}`, async () => {
        await injectOk(app, method, url, extra);
      });
    }
  });

  describe('tenant-admin.js', () => {
    let app;
    before(async () => {
      app = Fastify({ logger: false });
      await registerTenantAdminController(app, 'taFull', prefix, createControllerServices());
    });
    after(() => app.close());

    const iso = () => new Date().toISOString();
    const routes = [
      ['GET', `${prefix}/admin/list`, {}],
      ['GET', `${prefix}/admin/detail?id=1`, {}],
      [
        'POST',
        `${prefix}/admin/append-args`,
        { payload: { tenantId: 't1', args: [{ key: 'K', value: 'V', secret: false }] } }
      ],
      ['POST', `${prefix}/admin/remove-arg`, { payload: { tenantId: 't1', key: 'K' } }],
      [
        'POST',
        `${prefix}/admin/append-custom-component`,
        {
          payload: {
            tenantId: 't1',
            customComponent: { key: 'ck', name: 'n', type: 't', content: 'c' }
          }
        }
      ],
      ['GET', `${prefix}/admin/custom-component-detail?tenantId=t1&key=ck`, {}],
      ['POST', `${prefix}/admin/remove-custom-component`, { payload: { tenantId: 't1', key: 'ck' } }],
      [
        'POST',
        `${prefix}/admin/save-custom-component`,
        {
          payload: {
            tenantId: 't1',
            customComponent: { key: 'ck', name: 'n', type: 't', content: 'c2' }
          }
        }
      ],
      ['POST', `${prefix}/admin/copy-custom-component`, { payload: { tenantId: 't1', key: 'ck' } }],
      [
        'POST',
        `${prefix}/admin/create`,
        {
          payload: {
            name: 'Tnew',
            themeColor: '#fff',
            logo: 'l',
            serviceStartTime: iso(),
            serviceEndTime: iso()
          }
        }
      ],
      [
        'POST',
        `${prefix}/admin/save`,
        {
          payload: {
            id: '1',
            name: 'T',
            themeColor: '#fff',
            logo: 'l',
            serviceStartTime: iso(),
            serviceEndTime: iso()
          }
        }
      ],
      ['POST', `${prefix}/admin/set-status`, { payload: { id: '1', status: 'open' } }],
      ['POST', `${prefix}/admin/remove`, { payload: { id: '1' } }],
      ['GET', `${prefix}/admin/company-detail?tenantId=t1`, {}],
      ['POST', `${prefix}/admin/company-save`, { payload: { tenantId: 't1', name: 'Co' } }],
      ['POST', `${prefix}/admin/org-create`, { payload: { tenantId: 't1', name: 'O' } }],
      ['GET', `${prefix}/admin/org-list?tenantId=t1`, {}],
      ['POST', `${prefix}/admin/org-remove`, { payload: { tenantId: 't1', id: '1' } }],
      ['POST', `${prefix}/admin/org-save`, { payload: { tenantId: 't1', id: '1', name: 'O2' } }],
      [
        'POST',
        `${prefix}/admin/org-batch-import`,
        {
          payload: {
            tenantId: 't1',
            rows: [{ orgName: 'O', parentOrgName: null, leaderName: null, email: null, phone: null, description: null }]
          }
        }
      ],
      [
        'POST',
        `${prefix}/admin/user-create`,
        {
          payload: {
            tenantId: 't1',
            name: 'U',
            tenantOrgId: null,
            roles: [],
            avatar: '',
            email: null,
            phone: '',
            description: ''
          }
        }
      ],
      [
        'POST',
        `${prefix}/admin/user-save`,
        {
          payload: {
            id: '1',
            tenantId: 't1',
            name: 'U2',
            tenantOrgId: null,
            roles: [],
            avatar: '',
            email: null,
            phone: '',
            description: ''
          }
        }
      ],
      ['POST', `${prefix}/admin/user-remove`, { payload: { tenantId: 't1', id: '1' } }],
      ['GET', `${prefix}/admin/user-list?tenantId=t1`, {}],
      ['GET', `${prefix}/admin/user-detail?tenantId=t1&id=1`, {}],
      ['POST', `${prefix}/admin/user-set-status`, { payload: { tenantId: 't1', id: '1', status: 'open' } }],
      ['GET', `${prefix}/admin/user-permission-list?tenantId=t1&id=1`, {}],
      ['GET', `${prefix}/admin/user-invite-token?tenantId=t1&id=1`, {}],
      ['POST', `${prefix}/admin/send-invite-message`, { payload: { tenantId: 't1', id: '1' } }]
    ];

    for (const [method, url, extra] of routes) {
      it(`${method} ${url}`, async () => {
        await injectOk(app, method, url, extra);
      });
    }
  });
});
