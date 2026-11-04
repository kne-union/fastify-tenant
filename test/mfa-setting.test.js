'use strict';

const assert = require('node:assert/strict');
const Fastify = require('fastify');

const P = '/api/tenant';

describe('mfa-setting（sqlite 端到端）', () => {
  let fastify;
  let tenant;

  before(async () => {
    fastify = Fastify({ logger: false });
    await fastify.register(require('@kne/fastify-sequelize'), { db: { dialect: 'sqlite', storage: ':memory:', logging: false }, sqlPath: './test/__no_sql__' });
    await fastify.register(require('@kne/fastify-account'), {});
    await fastify.register(require('../index'), {
      permissionsProfile: null,
      getUserAuthenticate: () => async () => {},
      getAdminUserAuthenticate: () => async () => {}
    });
    await fastify.ready();
    await fastify.sequelize.sync();
    tenant = await fastify.tenant.services.tenant.create({
      name: 'T1',
      accountCount: 10,
      supportLanguage: ['zh-CN'],
      defaultLanguage: 'zh-CN',
      serviceStartTime: new Date().toISOString(),
      serviceEndTime: new Date(Date.now() + 86400000).toISOString()
    });
  });

  after(() => fastify.close());

  it('未保存时返回默认值；保存只合并传入字段，且不覆盖 options 里的其他键', async () => {
    const detail = await fastify.inject({ method: 'GET', url: `${P}/admin/mfa-setting/detail`, query: { tenantId: String(tenant.id) } });
    assert.equal(detail.statusCode, 200);
    assert.deepEqual(detail.json(), { enabled: false, methods: ['sms'], maxAge: 86400 });

    const setting = await fastify.tenant.models.setting.findOne({ where: { tenantId: tenant.id } });
    setting.options = { other: 1 };
    await setting.save();

    const saved = await fastify.inject({ method: 'POST', url: `${P}/admin/mfa-setting/save`, payload: { tenantId: String(tenant.id), enabled: true } });
    assert.equal(saved.statusCode, 200);
    assert.deepEqual(saved.json(), { enabled: true, methods: ['sms'], maxAge: 86400 });

    await fastify.tenant.services.setting.saveMfa({ tenantId: tenant.id, mfa: { maxAge: 0, unknown: 'x' } });
    assert.deepEqual(await fastify.tenant.services.setting.getMfa({ tenantId: tenant.id }), { enabled: true, methods: ['sms'], maxAge: 0 });
    const row = await fastify.tenant.models.setting.findOne({ where: { tenantId: tenant.id } });
    assert.equal(row.options.other, 1);
  });

  it('管理端校验：必须传 tenantId，maxAge 不能为负，methods 只支持 sms', async () => {
    const tenantId = String(tenant.id);
    assert.equal((await fastify.inject({ method: 'GET', url: `${P}/admin/mfa-setting/detail` })).statusCode, 400);
    assert.equal((await fastify.inject({ method: 'POST', url: `${P}/admin/mfa-setting/save`, payload: { tenantId, maxAge: -1 } })).statusCode, 400);
    assert.equal((await fastify.inject({ method: 'POST', url: `${P}/admin/mfa-setting/save`, payload: { tenantId, methods: ['totp'] } })).statusCode, 400);
  });

  it('权限树包含 setting:mfa-setting', async () => {
    const codes = fastify.tenant.utils.flattenPermissions(require('../libs/permissions')).map(item => item.code);
    assert.ok(codes.includes('setting:mfa-setting:view'));
    assert.ok(codes.includes('setting:mfa-setting:edit'));
  });
});

describe('mfa-setting 租户端权限', () => {
  const NS = 'tenantMfa';

  async function buildControllerApp({ permissions = [], isAdmin = false } = {}) {
    const fastify = Fastify({ logger: false });
    const calls = [];
    fastify.decorate(NS, {
      services: {
        user: { resolveIsTenantAdmin: async () => isAdmin },
        setting: {
          getMfa: async payload => {
            calls.push(['getMfa', payload]);
            return { enabled: false, methods: ['sms'], maxAge: 86400 };
          },
          saveMfa: async payload => {
            calls.push(['saveMfa', payload]);
            return Object.assign({ enabled: false, methods: ['sms'], maxAge: 86400 }, payload.mfa);
          }
        }
      },
      authenticate: {
        user: async () => {},
        tenantUser: async request => {
          request.tenantUserInfo = { id: 'tu-1', tenantId: 'tid-1', permissions };
        }
      }
    });
    await fastify.register(require('../libs/controllers/mfa-setting.js'), {
      name: NS,
      prefix: P,
      getUserAuthenticate: () => async () => {},
      getAdminUserAuthenticate: () => async () => {}
    });
    await fastify.ready();
    return { fastify, calls };
  }

  it('无权限 403；view 可查看不可修改；edit 可修改，tenantId 取自登录态', async () => {
    let { fastify } = await buildControllerApp();
    try {
      const res = await fastify.inject({ method: 'GET', url: `${P}/mfa-setting/detail` });
      assert.equal(res.statusCode, 403);
    } finally {
      await fastify.close();
    }

    ({ fastify } = await buildControllerApp({ permissions: ['setting:mfa-setting:view'] }));
    try {
      assert.equal((await fastify.inject({ method: 'GET', url: `${P}/mfa-setting/detail` })).statusCode, 200);
      assert.equal((await fastify.inject({ method: 'POST', url: `${P}/mfa-setting/save`, payload: { enabled: true } })).statusCode, 403);
    } finally {
      await fastify.close();
    }

    let calls;
    ({ fastify, calls } = await buildControllerApp({ permissions: ['setting:mfa-setting:edit'] }));
    try {
      assert.equal((await fastify.inject({ method: 'GET', url: `${P}/mfa-setting/detail` })).statusCode, 200);
      const res = await fastify.inject({ method: 'POST', url: `${P}/mfa-setting/save`, payload: { tenantId: 'other', enabled: true } });
      assert.equal(res.statusCode, 200);
      assert.deepEqual(calls[1], ['saveMfa', { tenantId: 'tid-1', mfa: { enabled: true } }]);
    } finally {
      await fastify.close();
    }
  });

  it('租户管理员可修改', async () => {
    const { fastify } = await buildControllerApp({ isAdmin: true });
    try {
      const res = await fastify.inject({ method: 'POST', url: `${P}/mfa-setting/save`, payload: { maxAge: 3600 } });
      assert.equal(res.statusCode, 200);
      assert.equal(res.json().maxAge, 3600);
    } finally {
      await fastify.close();
    }
  });
});
