'use strict';

const assert = require('node:assert/strict');
const { buildServiceApp, NS } = require('./support/service-app');

describe('OIDC 适配：tenantId 优先与 onPermissionChange', () => {
  let ctx;
  let tenantA;
  let tenantB;
  const calls = [];

  before(async () => {
    ctx = await buildServiceApp();
    await ctx.fastify.register(require('../libs/services/permission-change.js'), {
      name: NS,
      onPermissionChange: async payload => {
        calls.push(payload);
      }
    });
    const createTenant = name =>
      ctx.ns.services.tenant.create({
        name,
        description: '',
        logo: 'l',
        themeColor: '#000',
        accountCount: 20,
        supportLanguage: ['zh-CN'],
        defaultLanguage: 'zh-CN',
        serviceStartTime: new Date().toISOString(),
        serviceEndTime: new Date().toISOString()
      });
    tenantA = (await createTenant('A')).id;
    tenantB = (await createTenant('B')).id;
    await ctx.stores.users.clear();
    for (const [id, tenantId] of [
      ['tu-a', tenantA],
      ['tu-b', tenantB]
    ]) {
      ctx.stores.users.set(id, {
        id,
        tenantId,
        userId: 'account-1',
        status: 'open',
        roles: ['role-x'],
        update: async function (patch) {
          return Object.assign(this, patch);
        },
        destroy: async () => ctx.stores.users.delete(id),
        setDataValue(k, v) {
          this[`_${k}`] = v;
        },
        getDataValue(k) {
          return this[`_${k}`];
        }
      });
    }
    await ctx.ns.services.user.setDefaultTenant({ id: 'account-1' }, { tenantId: tenantA });
  });

  beforeEach(() => {
    calls.length = 0;
  });

  after(async () => {
    await ctx.fastify.close();
  });

  it('should prefer tenantId from authenticatePayload over default tenant', async () => {
    const fromDefault = await ctx.ns.services.user.getTenantUserInfo({ id: 'account-1' });
    assert.equal(fromDefault.tenantId, tenantA);
    const fromToken = await ctx.ns.services.user.getTenantUserInfo({ id: 'account-1', tenantId: tenantB });
    assert.equal(fromToken.tenantId, tenantB);
  });

  it('should notify when tenant user status changes', async () => {
    await ctx.ns.services.user.setStatus({ tenantId: tenantA, id: 'tu-a', status: 'closed' });
    assert.deepEqual(calls, [{ tenantId: tenantA, userIds: ['account-1'], reason: 'tenant-user-status' }]);
    await ctx.ns.services.user.setStatus({ tenantId: tenantA, id: 'tu-a', status: 'open' });
  });

  it('should notify users holding the role when role permissions change', async () => {
    const notify = ctx.ns.services.permissionChange.notify;
    await notify({ tenantId: tenantB, roleKeys: ['role-x'], reason: 'role-permissions' });
    assert.deepEqual(calls, [{ tenantId: tenantB, userIds: ['account-1'], reason: 'role-permissions' }]);
    calls.length = 0;
    await notify({ tenantId: tenantB, roleKeys: ['role-other'], reason: 'role-permissions' });
    assert.deepEqual(calls, []);
  });

  it('should notify all tenant users when tenant status changes', async () => {
    await ctx.ns.services.tenant.setStatus({ id: tenantB, status: 'closed' });
    assert.deepEqual(calls, [{ tenantId: tenantB, userIds: ['account-1'], reason: 'tenant-status' }]);
  });

  it('should not throw when callback fails', async () => {
    const app = await buildServiceApp();
    await app.fastify.register(require('../libs/services/permission-change.js'), {
      name: NS,
      onPermissionChange: async () => {
        throw new Error('boom');
      }
    });
    await app.ns.services.permissionChange.notify({ tenantId: 't', userIds: ['u'], reason: 'x' });
    await app.fastify.close();
  });
});
