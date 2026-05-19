'use strict';

const assert = require('node:assert/strict');
const { buildServiceApp } = require('./support/service-app');

describe('services（内存假模型集成）', () => {
  let ctx;
  let tenantId;
  let userId;

  before(async () => {
    ctx = await buildServiceApp();
    const t = await ctx.ns.services.tenant.create({
      name: 'CoA',
      description: '',
      logo: 'l',
      themeColor: '#000',
      accountCount: 20,
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

  it('tenant.detail 附带 tenantSetting', async () => {
    const t = await ctx.ns.services.tenant.detail({ id: tenantId });
    assert.equal(t.id, tenantId);
    assert.ok(t.getDataValue('tenantSetting'));
  });

  it('permission.list / tenantLevelList / save', async () => {
    const list = await ctx.ns.services.permission.list({ tenantId });
    assert.ok(Array.isArray(list.codes));
    const tl = await ctx.ns.services.permission.tenantLevelList({ tenantId });
    assert.ok(Array.isArray(tl.codes));
    await ctx.ns.services.permission.save({
      tenantId,
      permissions: list.codes.slice(0, 3)
    });
  });

  it('role 系统角色不可 save', async () => {
    const admin = [...ctx.stores.roles.values()].find(r => r.code === 'admin');
    assert.ok(admin);
    await assert.rejects(() => ctx.ns.services.role.save({ tenantId, id: admin.id, name: 'x' }), /系统角色不能修改/);
  });

  it('role.combinedPermissions 在 admin 角色时返回全量租户权限', async () => {
    const admin = [...ctx.stores.roles.values()].find(r => r.code === 'admin');
    const out = await ctx.ns.services.role.combinedPermissions({ tenantId, roles: [admin.id] });
    assert.ok(out.codes.length > 0);
  });

  it('org.create / list / save / remove', async () => {
    const o = await ctx.ns.services.org.create({ tenantId, name: '根部门' });
    const list = await ctx.ns.services.org.list({ tenantId });
    assert.ok(list.some(x => x.id === o.id));
    await ctx.ns.services.org.save({ tenantId, id: o.id, name: '根部门改名' });
    await ctx.ns.services.org.remove({ tenantId, id: o.id });
  });

  it('setting.appendArgs 与 removeArg', async () => {
    await ctx.ns.services.setting.appendArgs({
      tenantId,
      args: [{ key: 'K1', value: 'V1', secret: false }]
    });
    await ctx.ns.services.setting.removeArg({ tenantId, key: 'K1' });
  });

  it('user.create / detail / parseToken / join 主流程', async () => {
    const u = await ctx.ns.services.user.create({
      tenantId,
      name: '张三',
      email: 'a@b.c',
      phone: '',
      tenantOrgId: null,
      roles: []
    });
    userId = u.id;
    const d = await ctx.ns.services.user.detail({ tenantId, id: userId });
    assert.equal(d.email, 'a@b.c');

    const token = ctx.fastify.jwt.sign({ payload: { id: userId, tenantId } });
    const parsed = await ctx.ns.services.user.parseToken({ token });
    assert.equal(parsed.tenantUser.id, userId);

    await ctx.ns.services.user.join({ id: 'account-1' }, { token });
    const again = await ctx.ns.services.user.detail({ tenantId, id: userId });
    assert.equal(again.userId, 'account-1');
  });

  it('user.tenantList / setDefaultTenant / getTenantUserInfo', async () => {
    await ctx.ns.services.user.setDefaultTenant({ id: 'account-1' }, { tenantId });
    const tl = await ctx.ns.services.user.tenantList({ id: 'account-1' });
    assert.equal(tl.defaultTenantId, tenantId);

    const info = await ctx.ns.services.user.getTenantUserInfo({ id: 'account-1' });
    assert.equal(info.tenantId, tenantId);
    assert.ok(Array.isArray(info.getDataValue('permissions')));
  });

  it('org.importFromRows 批量导入组织与用户', async () => {
    const r = await ctx.ns.services.org.importFromRows({
      tenantId,
      parentOrgId: null,
      rows: [
        { rowType: 'org', orgName: '导入部门', parentOrgName: null, userName: null, email: null, phone: null, description: null, isLeader: false },
        {
          rowType: 'user',
          orgName: '导入部门',
          parentOrgName: null,
          userName: '导入用户',
          email: 'import-user@test.local',
          phone: null,
          description: null,
          isLeader: true
        }
      ]
    });
    assert.ok(r.createdOrgs >= 1);
    assert.ok(r.createdUsers >= 1);
    assert.equal(r.rowCount, 2);
  });
});
