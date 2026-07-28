'use strict';

const assert = require('node:assert/strict');
const Fastify = require('fastify');
const { Sequelize } = require('sequelize');
const mockPermissions = require('./fixtures/mockPermissionsForDataScope');
const { getUserOrgIds } = require('../libs/utils/tenantOrgIds');

const NS = 'dataScopeTest';

describe('dataScope service', () => {
  let fastify;
  const tenantId = 'tenant_1';
  const orgRoot = 'org_root';
  const orgSales = 'org_sales';
  const leaderId = 'user_leader';
  const memberId = 'user_member';

  before(async () => {
    fastify = Fastify({ logger: false });
    const Op = Sequelize.Op;
    fastify.decorate('sequelize', { Sequelize });

    const orgs = [
      { id: orgRoot, tenantId, parentId: null, leaderUserId: leaderId },
      { id: orgSales, tenantId, parentId: orgRoot, leaderUserId: null }
    ];
    const users = [
      { id: leaderId, tenantId, tenantOrgId: orgRoot, tenantOrgIds: [orgRoot] },
      { id: memberId, tenantId, tenantOrgId: orgSales, tenantOrgIds: [orgSales] }
    ];

    const models = {
      org: {
        findAll: async ({ where, attributes }) =>
          orgs
            .filter(o => o.tenantId === where.tenantId)
            .map(o => {
              if (!attributes) {
                return { ...o };
              }
              return attributes.reduce((acc, key) => {
                acc[key] = o[key];
                return acc;
              }, {});
            })
      },
      user: {
        findOne: async ({ where }) => users.find(u => u.id === where.id && u.tenantId === where.tenantId) || null,
        findAll: async ({ where, attributes }) => {
          const matchOrgCond = (user, cond) => {
            if (!cond || typeof cond !== 'object') {
              return false;
            }
            if (cond[Op.or]) {
              return cond[Op.or].some(sub => matchOrgCond(user, sub));
            }
            if (cond.tenantOrgId != null && cond.tenantOrgId !== '') {
              return getUserOrgIds(user).includes(String(cond.tenantOrgId));
            }
            const contains = cond.tenantOrgIds?.[Op.contains];
            if (Array.isArray(contains) && contains.length) {
              const ids = getUserOrgIds(user);
              return contains.some(id => ids.includes(String(id)));
            }
            return false;
          };
          let list = users.filter(u => {
            if (u.tenantId !== where.tenantId) {
              return false;
            }
            if (where[Op.or]) {
              return matchOrgCond(u, { [Op.or]: where[Op.or] });
            }
            if (where.tenantOrgIds?.[Op.contains]) {
              return matchOrgCond(u, { tenantOrgIds: where.tenantOrgIds });
            }
            return true;
          });
          if (!attributes || !attributes.length) {
            return list.map(u => ({ ...u }));
          }
          return list.map(u =>
            attributes.reduce((acc, key) => {
              acc[key] = u[key];
              return acc;
            }, {})
          );
        }
      },
      sharedGroupMember: { findAll: async () => [] },
      sharedGroup: { findAll: async () => [] },
      sharedGroupDataSource: { findAll: async () => [] }
    };

    fastify.decorate(NS, {
      models,
      services: {
        tenant: {
          detail: async () => ({ id: tenantId })
        },
        user: {
          isTenantAdmin: ({ roleDetails } = {}) =>
            (Array.isArray(roleDetails) ? roleDetails : []).some(role => role && role.type === 'system' && role.code === 'admin')
        }
      },
      permissions: mockPermissions
    });

    await fastify.register(require('../libs/services/data-scope.js'), { name: NS });
    await fastify.ready();
  });

  after(async () => {
    await fastify.close();
  });

  it('owner includes leader subtree users and self', async () => {
    const ids = await fastify[NS].services.dataScope.resolveOrgRuleTenantUserIds({
      tenantId,
      currentTenantUserId: leaderId,
      type: 'owner'
    });
    assert.deepEqual(new Set(ids), new Set([leaderId, memberId]));
  });

  it('org includes same-department users only', async () => {
    const ids = await fastify[NS].services.dataScope.resolveOrgRuleTenantUserIds({
      tenantId,
      currentTenantUserId: memberId,
      type: 'org'
    });
    assert.deepEqual(ids, [memberId]);
  });

  it('resolveTenantUserIdsByPermissionCode uses module dataScope.type', async () => {
    const result = await fastify[NS].services.dataScope.resolveTenantUserIdsByPermissionCode({
      tenantId,
      currentTenantUserId: leaderId,
      permissionCode: 'setting:biz-data:order:view'
    });
    assert.equal(result.type, 'owner');
    assert.equal(result.dataScopeOpen, true);
    assert.equal(result.moduleCode, 'setting:biz-data:order');
    assert.deepEqual(new Set(result.tenantUserIds), new Set([leaderId, memberId]));
  });

  it('resolveTenantUserIdsByPermissionCode falls back to self when dataScope closed', async () => {
    const result = await fastify[NS].services.dataScope.resolveTenantUserIdsByPermissionCode({
      tenantId,
      currentTenantUserId: leaderId,
      permissionCode: 'setting:org:view'
    });
    assert.equal(result.type, 'self');
    assert.equal(result.dataScopeOpen, false);
    assert.deepEqual(result.tenantUserIds, [leaderId]);
  });

  it('buildRowScopeWhere admin returns allVisible and empty where', async () => {
    const result = await fastify[NS].services.dataScope.buildRowScopeWhere({
      tenantId,
      currentTenantUserId: leaderId,
      roleDetails: [{ type: 'system', code: 'admin' }],
      type: 'owner'
    });
    assert.equal(result.allVisible, true);
    assert.deepEqual(result.tenantUserIds, []);
    assert.deepEqual(result.where, {});
  });

  it('buildRowScopeWhere normal user returns allVisible false and IN where', async () => {
    const result = await fastify[NS].services.dataScope.buildRowScopeWhere({
      tenantId,
      currentTenantUserId: memberId,
      roleDetails: [{ type: 'custom', code: 'member' }],
      type: 'org'
    });
    assert.equal(result.allVisible, false);
    assert.deepEqual(result.tenantUserIds, [memberId]);
    assert.ok(result.where.createdUserId);
  });

  it('resolveDataPermission admin skips ids', async () => {
    const result = await fastify[NS].services.dataScope.resolveDataPermission({
      tenantId,
      currentTenantUserId: leaderId,
      roleDetails: [{ type: 'system', code: 'admin' }],
      type: 'owner',
      moduleCode: null
    });
    assert.equal(result.allVisible, true);
    assert.deepEqual(result.tenantUserIds, []);
    assert.equal(result.type, 'owner');
  });

  it('resolveDataPermission normal defaults allVisible false', async () => {
    const result = await fastify[NS].services.dataScope.resolveDataPermission({
      tenantId,
      currentTenantUserId: memberId,
      roleDetails: [{ type: 'custom', code: 'member' }],
      type: 'org'
    });
    assert.equal(result.allVisible, false);
    assert.deepEqual(result.tenantUserIds, [memberId]);
  });

  it('resolveDataPermissionByCode admin skips ids', async () => {
    const result = await fastify[NS].services.dataScope.resolveDataPermissionByCode({
      tenantId,
      currentTenantUserId: leaderId,
      roleDetails: [{ type: 'system', code: 'admin' }],
      permissionCode: 'setting:biz-data:order:view'
    });
    assert.equal(result.allVisible, true);
    assert.deepEqual(result.tenantUserIds, []);
    assert.equal(result.type, 'owner');
    assert.equal(result.dataScopeOpen, true);
  });

  describe('allVisible / 租户管理员不过滤', () => {
    it('角色列表中含 system+admin 即 allVisible（可混有其他角色）', async () => {
      const result = await fastify[NS].services.dataScope.resolveDataPermission({
        tenantId,
        currentTenantUserId: memberId,
        roleDetails: [
          { type: 'custom', code: 'member' },
          { type: 'system', code: 'admin' }
        ],
        type: 'self'
      });
      assert.equal(result.allVisible, true);
      assert.deepEqual(result.tenantUserIds, []);
      assert.equal(result.type, 'self');
    });

    it('system 但非 admin、或 custom 且 code=admin，均不过滤跳过', async () => {
      for (const roleDetails of [[{ type: 'system', code: 'default' }], [{ type: 'custom', code: 'admin' }]]) {
        const result = await fastify[NS].services.dataScope.resolveDataPermission({
          tenantId,
          currentTenantUserId: memberId,
          roleDetails,
          type: 'org'
        });
        assert.equal(result.allVisible, false, JSON.stringify(roleDetails));
        assert.deepEqual(result.tenantUserIds, [memberId]);
      }
    });

    it('缺省 / 空 roleDetails 时 allVisible 默认为 false', async () => {
      const a = await fastify[NS].services.dataScope.resolveDataPermission({
        tenantId,
        currentTenantUserId: memberId,
        type: 'org'
      });
      const b = await fastify[NS].services.dataScope.resolveDataPermission({
        tenantId,
        currentTenantUserId: memberId,
        roleDetails: [],
        type: 'org'
      });
      assert.equal(a.allVisible, false);
      assert.equal(b.allVisible, false);
      assert.deepEqual(a.tenantUserIds, [memberId]);
    });

    it('管理员短路不查询组织用户（不触发 tenant.detail）', async () => {
      let detailCalls = 0;
      const originalDetail = fastify[NS].services.tenant.detail;
      fastify[NS].services.tenant.detail = async (...args) => {
        detailCalls += 1;
        return originalDetail(...args);
      };
      try {
        await fastify[NS].services.dataScope.resolveDataPermission({
          tenantId,
          currentTenantUserId: leaderId,
          roleDetails: [{ type: 'system', code: 'admin' }],
          type: 'owner'
        });
        await fastify[NS].services.dataScope.buildRowScopeWhere({
          tenantId,
          currentTenantUserId: leaderId,
          roleDetails: [{ type: 'system', code: 'admin' }],
          type: 'owner'
        });
        assert.equal(detailCalls, 0);
      } finally {
        fastify[NS].services.tenant.detail = originalDetail;
      }
    });

    it('resolveDataPermissionByCode 普通用户 allVisible=false 且带可见 ids', async () => {
      const result = await fastify[NS].services.dataScope.resolveDataPermissionByCode({
        tenantId,
        currentTenantUserId: leaderId,
        roleDetails: [{ type: 'custom', code: 'member' }],
        permissionCode: 'setting:biz-data:order:view'
      });
      assert.equal(result.allVisible, false);
      assert.equal(result.dataScopeOpen, true);
      assert.equal(result.type, 'owner');
      assert.deepEqual(new Set(result.tenantUserIds), new Set([leaderId, memberId]));
    });

    it('resolveDataPermissionByCode 管理员在 dataScope 关闭时仍 allVisible，且不计算 ids', async () => {
      const result = await fastify[NS].services.dataScope.resolveDataPermissionByCode({
        tenantId,
        currentTenantUserId: leaderId,
        roleDetails: [{ type: 'system', code: 'admin' }],
        permissionCode: 'setting:org:view'
      });
      assert.equal(result.allVisible, true);
      assert.deepEqual(result.tenantUserIds, []);
      assert.equal(result.type, 'self');
      assert.equal(result.dataScopeOpen, false);
    });

    it('buildRowScopeWhere 无 roleDetails 时默认 allVisible=false', async () => {
      const result = await fastify[NS].services.dataScope.buildRowScopeWhere({
        tenantId,
        currentTenantUserId: memberId,
        type: 'org'
      });
      assert.equal(result.allVisible, false);
      assert.ok(Object.keys(result.where).length > 0);
    });
  });
});
