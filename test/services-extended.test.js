'use strict';

const assert = require('node:assert/strict');
const { buildServiceApp } = require('./support/service-app');

describe('services 扩展（tenant / role / user / company / setting）', () => {
  let ctx;
  let tenantId;

  before(async () => {
    ctx = await buildServiceApp();
    const t = await ctx.ns.services.tenant.create({
      name: 'BetaSearch',
      description: 'desc-here',
      logo: 'l',
      themeColor: '#000',
      accountCount: 50,
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

  it('tenant.list 支持 keyword 与 status 过滤', async () => {
    const r1 = await ctx.ns.services.tenant.list({ perPage: 10, currentPage: 1, filter: { keyword: 'Beta' } });
    assert.ok(r1.totalCount >= 1);
    const r2 = await ctx.ns.services.tenant.list({ perPage: 10, currentPage: 1, filter: { status: 'open' } });
    assert.ok(r2.totalCount >= 1);
  });

  it('tenant.save / setStatus / getToken / parseToken', async () => {
    await ctx.ns.services.tenant.save({
      id: tenantId,
      name: 'BetaSearch2',
      themeColor: '#111',
      logo: 'l2',
      serviceStartTime: new Date().toISOString(),
      serviceEndTime: new Date().toISOString()
    });
    await ctx.ns.services.tenant.setStatus({ id: tenantId, status: 'open' });
    const { token } = await ctx.ns.services.tenant.getToken({ id: tenantId });
    const parsed = await ctx.ns.services.tenant.parseToken({ token });
    assert.equal(parsed.tenant.id, tenantId);
  });

  it('role.list 支持 filter.type 与 filter.keyword', async () => {
    await ctx.ns.services.role.create({
      tenantId,
      name: '系统审计',
      code: 'audit_system',
      type: 'system',
      permissions: [],
      description: ''
    });
    const customRole = await ctx.ns.services.role.create({
      tenantId,
      name: '业务自定义',
      code: 'biz_custom',
      type: 'custom',
      permissions: [],
      description: '含关键字业务角色'
    });

    const systemOnly = await ctx.ns.services.role.list({
      tenantId,
      perPage: 50,
      currentPage: 1,
      filter: { type: 'system' }
    });
    assert.ok(systemOnly.pageData.length >= 1);
    assert.ok(systemOnly.pageData.every(row => row.type === 'system'));

    const customOnly = await ctx.ns.services.role.list({
      tenantId,
      perPage: 50,
      currentPage: 1,
      filter: { type: 'custom' }
    });
    assert.ok(customOnly.pageData.some(row => row.id === customRole.id));
    assert.ok(customOnly.pageData.every(row => row.type === 'custom'));

    const byKeyword = await ctx.ns.services.role.list({
      tenantId,
      perPage: 50,
      currentPage: 1,
      filter: { keyword: '业务' }
    });
    assert.ok(byKeyword.pageData.some(row => row.id === customRole.id));

    await ctx.ns.services.role.remove({ tenantId, id: customRole.id });
  });

  it('role 自定义角色 save / permissionList / savePermission / combinedPermissions（非 admin）', async () => {
    const r = await ctx.ns.services.role.create({
      tenantId,
      name: '编辑者',
      code: 'editor',
      type: 'custom',
      permissions: [],
      description: ''
    });
    await ctx.ns.services.role.save({ tenantId, id: r.id, name: '编辑者2', code: 'editor', type: 'custom', description: '' });
    const pl = await ctx.ns.services.role.permissionList({ tenantId, id: r.id });
    assert.ok(Array.isArray(pl.codes));
    await ctx.ns.services.role.savePermission({ tenantId, id: r.id, permissions: pl.codes.slice(0, 2) });
    const comb = await ctx.ns.services.role.combinedPermissions({ tenantId, roles: [r.id] });
    assert.ok(Array.isArray(comb.codes));
    const ids = await ctx.ns.services.role.checkRoles({ tenantId, roles: [r.id] });
    assert.ok(Array.isArray(ids));
    const enums = await ctx.ns.services.role.enums({ tenantId: 'ignored' }, { ids: [r.id], names: [], codes: [] });
    assert.ok(Array.isArray(enums));
    await ctx.ns.services.role.setStatus({ tenantId, id: r.id, status: 'closed' });
    await ctx.ns.services.role.setStatus({ tenantId, id: r.id, status: 'open' });
    await ctx.ns.services.role.remove({ tenantId, id: r.id });
  });

  it('user.list 带 keyword / remove / setStatus / sendInviteMessage', async () => {
    const u = await ctx.ns.services.user.create({
      tenantId,
      name: '李四',
      email: 'li@si.com',
      phone: '',
      tenantOrgId: null,
      roles: [],
      description: '含关键字描述-keyword-x'
    });
    const list = await ctx.ns.services.user.list({
      tenantId,
      filter: { keyword: 'keyword' },
      perPage: 10,
      currentPage: 1
    });
    assert.ok(list.totalCount >= 1);

    await ctx.ns.services.user.setStatus({ tenantId, id: u.id, status: 'closed' });
    const openOnly = await ctx.ns.services.user.list({
      tenantId,
      filter: { status: 'open' },
      perPage: 10,
      currentPage: 1
    });
    assert.ok(openOnly.pageData.every(row => row.status === 'open'));

    const byId = await ctx.ns.services.user.list({
      tenantId,
      filter: { id: u.id },
      perPage: 10,
      currentPage: 1
    });
    assert.equal(byId.totalCount, 1);
    assert.equal(byId.pageData[0].id, u.id);
    await ctx.ns.services.user.setStatus({ tenantId, id: u.id, status: 'open' });
    await ctx.ns.services.user.sendInviteMessage({ tenantId, id: u.id });
    await ctx.ns.services.user.remove({ tenantId, id: u.id });
  });

  it('user.list 按 roles 筛选应匹配 JSONB 角色 id', async () => {
    const r = await ctx.ns.services.role.create({
      tenantId,
      name: '筛选角色A',
      code: 'filter_role_a',
      type: 'custom',
      permissions: [],
      description: ''
    });
    const otherRole = await ctx.ns.services.role.create({
      tenantId,
      name: '筛选角色B',
      code: 'filter_role_b',
      type: 'custom',
      permissions: [],
      description: ''
    });
    const withRole = await ctx.ns.services.user.create({
      tenantId,
      name: '带角色A用户',
      email: 'with-role-a@test.com',
      phone: '',
      tenantOrgId: null,
      roles: [r.id]
    });
    const withoutRole = await ctx.ns.services.user.create({
      tenantId,
      name: '带角色B用户',
      email: 'with-role-b@test.com',
      phone: '',
      tenantOrgId: null,
      roles: [otherRole.id]
    });

    const withRoleStored = await ctx.ns.services.user.detail({ tenantId, id: withRole.id });
    assert.deepEqual(withRoleStored.roles, [r.id]);

    const list = await ctx.ns.services.user.list({
      tenantId,
      filter: { roles: [r.id] },
      perPage: 100,
      currentPage: 1
    });
    const ids = new Set(list.pageData.map(row => row.id));
    assert.ok(ids.has(withRole.id), '应包含角色 A 的用户');
    assert.ok(!ids.has(withoutRole.id), '不应包含仅角色 B 的用户');

    await ctx.ns.services.user.remove({ tenantId, id: withRole.id });
    await ctx.ns.services.user.remove({ tenantId, id: withoutRole.id });
    await ctx.ns.services.role.remove({ tenantId, id: r.id });
    await ctx.ns.services.role.remove({ tenantId, id: otherRole.id });
  });

  it('user.list 按父级 tenantOrgId 应包含子级组织下的用户', async () => {
    const parent = await ctx.ns.services.org.create({ tenantId, name: '父级筛选部门', parentId: null });
    const child = await ctx.ns.services.org.create({ tenantId, name: '子级筛选部门', parentId: parent.id });
    const userInChild = await ctx.ns.services.user.create({
      tenantId,
      name: '子级组织用户',
      email: 'child-subtree-filter@test.com',
      phone: '',
      tenantOrgId: child.id,
      roles: []
    });
    const userInParent = await ctx.ns.services.user.create({
      tenantId,
      name: '父级组织用户',
      email: 'parent-subtree-filter@test.com',
      phone: '',
      tenantOrgId: parent.id,
      roles: []
    });
    const otherOrg = await ctx.ns.services.org.create({ tenantId, name: '其他部门', parentId: null });
    const userInOther = await ctx.ns.services.user.create({
      tenantId,
      name: '其他组织用户',
      email: 'other-subtree-filter@test.com',
      phone: '',
      tenantOrgId: otherOrg.id,
      roles: []
    });

    const list = await ctx.ns.services.user.list({
      tenantId,
      filter: { tenantOrgId: parent.id },
      perPage: 100,
      currentPage: 1
    });
    const ids = new Set(list.pageData.map(row => row.id));
    assert.ok(ids.has(userInChild.id));
    assert.ok(ids.has(userInParent.id));
    assert.ok(!ids.has(userInOther.id));

    await ctx.ns.services.user.remove({ tenantId, id: userInChild.id });
    await ctx.ns.services.user.remove({ tenantId, id: userInParent.id });
    await ctx.ns.services.user.remove({ tenantId, id: userInOther.id });
    await ctx.ns.services.org.remove({ tenantId, id: child.id });
    await ctx.ns.services.org.remove({ tenantId, id: parent.id });
    await ctx.ns.services.org.remove({ tenantId, id: otherOrg.id });
  });

  it('company.save 持久化基本信息扩展字段', async () => {
    const saved = await ctx.ns.services.company.save({
      tenantId,
      name: '展示名',
      fullName: '法定全称',
      logo: 'logo-file-id',
      industry: '信息技术',
      scale: '100-500人',
      address: '北京市海淀区',
      phone: '010-12345678',
      email: 'contact@example.com',
      foundedDate: '2018-06-15',
      companyTags: [{ label: '高新技术' }, { label: '  ' }, '双软'],
      website: 'https://example.com',
      description: '公司简介',
      banners: ['banner-1', 'banner-2']
    });
    assert.equal(saved.name, '展示名');
    assert.equal(saved.fullName, '法定全称');
    assert.equal(saved.logo, 'logo-file-id');
    assert.equal(saved.industry, '信息技术');
    assert.equal(saved.companyTags.length, 2);
    assert.equal(saved.companyTags[0].label, '高新技术');
    assert.equal(saved.companyTags[1].label, '双软');
    assert.equal(saved.banners.length, 2);

    const again = await ctx.ns.services.company.detail({ tenantId });
    assert.equal(again.email, 'contact@example.com');
    assert.equal(again.foundedDate, '2018-06-15');
  });

  it('company.remove', async () => {
    await ctx.ns.services.company.remove({ tenantId });
    assert.equal(ctx.stores.companies.has(tenantId), false);
  });

  it('setting 密钥与自定义组件链路', async () => {
    await ctx.ns.services.setting.appendArgs({
      tenantId,
      args: [{ key: 'SEC', value: 'x', secret: true }]
    });
    const secretVal = await ctx.ns.services.setting.getSecrets({ tenantId, key: 'SEC' });
    assert.equal(secretVal, 'x');
    await ctx.ns.services.setting.appendCustomComponent({
      tenantId,
      customComponent: { key: 'ui1', name: 'UI', type: 'html', content: '<p/>' }
    });
    const det = await ctx.ns.services.setting.customComponentDetail({ tenantId, key: 'ui1' });
    assert.ok(det);
    await ctx.ns.services.setting.saveCustomComponents({
      tenantId,
      customComponent: { key: 'ui1', name: 'UI', type: 'html', content: '<p>2</p>' }
    });
    await ctx.ns.services.setting.copyCustomComponent({ tenantId, key: 'ui1' });
    await ctx.ns.services.setting.removeCustomComponent({ tenantId, key: 'ui1_COPY' });
    await ctx.ns.services.setting.removeCustomComponent({ tenantId, key: 'ui1' });
  });

  it('org.enums', async () => {
    const o = await ctx.ns.services.org.create({ tenantId, name: '枚举部门' });
    const en = await ctx.ns.services.org.enums({ tenantId }, { ids: [o.id], names: [o.name] });
    assert.ok(en.length >= 1);
    await ctx.ns.services.org.remove({ tenantId, id: o.id });
  });
});
