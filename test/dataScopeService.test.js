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
});
