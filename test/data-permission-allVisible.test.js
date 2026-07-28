'use strict';

const assert = require('node:assert/strict');
const Fastify = require('fastify');

const prefix = '/api/tenant';

/**
 * 验证 data-permission 接口把 roleDetails 传入 dataScope，并原样返回 allVisible。
 */
describe('GET data-permission allVisible', () => {
  async function buildApp({ roleDetails, dataScopeImpl }) {
    const app = Fastify({ logger: false });
    const name = 'dpAllVisible';
    app.decorate(name, {
      services: {
        user: {},
        company: {},
        org: {},
        setting: {},
        thirdLogin: {
          getConfig: async () => ({ enabled: false }),
          list: async () => ({ sourceOptions: [], list: [] })
        },
        dataScope: dataScopeImpl
      },
      authenticate: {
        user: async request => {
          request.userInfo = { id: 'user-1' };
        },
        tenantUser: async request => {
          request.tenantUserInfo = {
            id: 'tu-1',
            tenantId: 'tid-1',
            roleDetails,
            tenant: { id: 'tid-1', name: 'Tn', tenantCompany: { name: 'Co' } }
          };
        }
      }
    });
    await app.register(require('../libs/controllers/tenant.js'), {
      name,
      prefix,
      getUserAuthenticate: () => async request => {
        request.userInfo = { id: 'user-1' };
      }
    });
    await app.ready();
    return app;
  }

  it('管理员：传入 roleDetails，响应 allVisible=true 且 tenantUserIds 为空', async () => {
    let captured;
    const app = await buildApp({
      roleDetails: [{ type: 'system', code: 'admin' }],
      dataScopeImpl: {
        resolveDataPermission: async args => {
          captured = args;
          return { allVisible: true, tenantUserIds: [], type: args.type, moduleCode: args.moduleCode };
        },
        resolveDataPermissionByCode: async () => ({})
      }
    });
    try {
      const res = await app.inject({ method: 'GET', url: `${prefix}/data-permission?type=owner` });
      assert.equal(res.statusCode, 200);
      const body = res.json();
      assert.equal(body.allVisible, true);
      assert.deepEqual(body.tenantUserIds, []);
      assert.deepEqual(captured.roleDetails, [{ type: 'system', code: 'admin' }]);
      assert.equal(captured.tenantId, 'tid-1');
      assert.equal(captured.currentTenantUserId, 'tu-1');
      assert.equal(captured.type, 'owner');
    } finally {
      await app.close();
    }
  });

  it('普通用户：默认 allVisible=false，并带回可见 ids', async () => {
    let captured;
    const app = await buildApp({
      roleDetails: [{ type: 'custom', code: 'member' }],
      dataScopeImpl: {
        resolveDataPermission: async args => {
          captured = args;
          return { allVisible: false, tenantUserIds: ['tu-1', 'tu-2'], type: args.type, moduleCode: null };
        },
        resolveDataPermissionByCode: async () => ({})
      }
    });
    try {
      const res = await app.inject({ method: 'GET', url: `${prefix}/data-permission` });
      assert.equal(res.statusCode, 200);
      const body = res.json();
      assert.equal(body.allVisible, false);
      assert.deepEqual(body.tenantUserIds, ['tu-1', 'tu-2']);
      assert.deepEqual(captured.roleDetails, [{ type: 'custom', code: 'member' }]);
    } finally {
      await app.close();
    }
  });

  it('data-permission-by-code 管理员：allVisible=true', async () => {
    let captured;
    const app = await buildApp({
      roleDetails: [{ type: 'system', code: 'admin' }],
      dataScopeImpl: {
        resolveDataPermission: async () => ({}),
        resolveDataPermissionByCode: async args => {
          captured = args;
          return {
            allVisible: true,
            tenantUserIds: [],
            moduleCode: 'setting:permission:shared-group',
            type: 'org',
            dataScopeOpen: true
          };
        }
      }
    });
    try {
      const res = await app.inject({
        method: 'GET',
        url: `${prefix}/data-permission-by-code?permissionCode=setting:permission:shared-group:view`
      });
      assert.equal(res.statusCode, 200);
      const body = res.json();
      assert.equal(body.allVisible, true);
      assert.deepEqual(body.tenantUserIds, []);
      assert.equal(captured.permissionCode, 'setting:permission:shared-group:view');
      assert.deepEqual(captured.roleDetails, [{ type: 'system', code: 'admin' }]);
    } finally {
      await app.close();
    }
  });

  it('data-permission-by-code 普通用户：allVisible=false', async () => {
    const app = await buildApp({
      roleDetails: [{ type: 'custom', code: 'member' }],
      dataScopeImpl: {
        resolveDataPermission: async () => ({}),
        resolveDataPermissionByCode: async () => ({
          allVisible: false,
          tenantUserIds: ['tu-1'],
          moduleCode: 'setting:permission:shared-group',
          type: 'org',
          dataScopeOpen: true
        })
      }
    });
    try {
      const res = await app.inject({
        method: 'GET',
        url: `${prefix}/data-permission-by-code?permissionCode=setting:permission:shared-group:view`
      });
      assert.equal(res.statusCode, 200);
      const body = res.json();
      assert.equal(body.allVisible, false);
      assert.deepEqual(body.tenantUserIds, ['tu-1']);
    } finally {
      await app.close();
    }
  });
});
