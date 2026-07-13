'use strict';

const assert = require('node:assert/strict');
const { buildServiceApp } = require('./support/service-app');

describe('org leader membership', () => {
  let ctx;
  let tenantId;

  before(async () => {
    ctx = await buildServiceApp();
    const t = await ctx.ns.services.tenant.create({
      name: 'Leader Test',
      description: '',
      logo: '',
      themeColor: '#000',
      accountCount: 100,
      supportLanguage: ['zh-CN'],
      defaultLanguage: 'zh-CN',
      serviceStartTime: new Date().toISOString(),
      serviceEndTime: new Date().toISOString()
    });
    tenantId = t.id;
  });

  after(async () => {
    await ctx.fastify.close();
  });

  it('auto-enrolls leader into department on save when not already a member', async () => {
    const deptA = await ctx.ns.services.org.create({ tenantId, name: '部门A', parentId: null });
    const deptB = await ctx.ns.services.org.create({ tenantId, name: '部门B', parentId: null });
    const user = await ctx.ns.services.user.create({
      tenantId,
      name: '仅B部门用户',
      email: 'leader-b-only@test.com',
      phone: '',
      tenantOrgIds: [deptB.id],
      roles: []
    });

    await ctx.ns.services.org.save({
      tenantId,
      id: deptA.id,
      leaderUserId: user.id
    });
    const withLeader = await ctx.ns.services.org.detail({ id: deptA.id });
    assert.equal(String(withLeader.leaderUserId), String(user.id));
    const refreshed = await ctx.ns.services.user.detail({ tenantId, id: user.id });
    const orgIds = Array.isArray(refreshed.tenantOrgIds) ? refreshed.tenantOrgIds.map(String) : [];
    assert.ok(orgIds.includes(String(deptA.id)));
    assert.ok(orgIds.includes(String(deptB.id)));

    await ctx.ns.services.user.remove({ tenantId, id: user.id });
    await ctx.ns.services.org.remove({ tenantId, id: deptA.id });
    await ctx.ns.services.org.remove({ tenantId, id: deptB.id });
  });

  it('clears leader when leaderUserId is null on save', async () => {
    const dept = await ctx.ns.services.org.create({ tenantId, name: '待清空负责人部门', parentId: null });
    const user = await ctx.ns.services.user.create({
      tenantId,
      name: '负责人',
      email: 'leader-clear@test.com',
      phone: '',
      tenantOrgIds: [dept.id],
      roles: []
    });
    await ctx.ns.services.org.save({ tenantId, id: dept.id, leaderUserId: user.id });
    const withLeader = await ctx.ns.services.org.detail({ id: dept.id });
    assert.equal(String(withLeader.leaderUserId), String(user.id));

    await ctx.ns.services.org.save({ tenantId, id: dept.id, leaderUserId: null });
    const cleared = await ctx.ns.services.org.detail({ id: dept.id });
    assert.equal(cleared.leaderUserId, null);

    await ctx.ns.services.user.remove({ tenantId, id: user.id });
    await ctx.ns.services.org.remove({ tenantId, id: dept.id });
  });

  it('auto-enrolls leader into new department on create', async () => {
    const user = await ctx.ns.services.user.create({
      tenantId,
      name: '待任命负责人',
      email: 'leader-auto-enroll@test.com',
      phone: '',
      tenantOrgIds: [],
      roles: []
    });
    const dept = await ctx.ns.services.org.create({
      tenantId,
      name: '新部门',
      parentId: null,
      leaderUserId: user.id
    });
    assert.equal(String(dept.leaderUserId), String(user.id));
    const refreshed = await ctx.ns.services.user.detail({ tenantId, id: user.id });
    const orgIds = Array.isArray(refreshed.tenantOrgIds) ? refreshed.tenantOrgIds.map(String) : [];
    assert.ok(orgIds.includes(String(dept.id)));

    await ctx.ns.services.user.remove({ tenantId, id: user.id });
    await ctx.ns.services.org.remove({ tenantId, id: dept.id });
  });
});
