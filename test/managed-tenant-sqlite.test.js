'use strict';

const assert = require('node:assert/strict');
const Fastify = require('fastify');

const ISSUER = 'https://host.example.com/oidc';

const buildApp = async () => {
  const fastify = Fastify({ logger: false });
  await fastify.register(require('@kne/fastify-sequelize'), { db: { dialect: 'sqlite', storage: ':memory:', logging: false }, sqlPath: './test/__no_sql__' });
  await fastify.register(require('@kne/fastify-account'), {});
  await fastify.register(require('../index'), { permissionsProfile: null });
  await fastify.ready();
  await fastify.sequelize.sync();
  return fastify;
};

const createAccountUser = async (fastify, id) => {
  const account = await fastify.account.models.userAccount.create({ password: 'x', salt: 'y' });
  return fastify.account.models.user.create({ id, nickname: `u-${id}`, status: 0, userAccountId: account.id }, { hooks: false });
};

const createLocalTenant = (fastify, name) =>
  fastify.tenant.services.tenant.create({
    name,
    description: '',
    accountCount: 20,
    supportLanguage: ['zh-CN'],
    defaultLanguage: 'zh-CN',
    serviceStartTime: new Date().toISOString(),
    serviceEndTime: new Date(Date.now() + 86400000).toISOString()
  });

const buildSnapshot = (overrides = {}) =>
  Object.assign(
    {
      tenant: { id: 'h-tenant-1', name: '共享租户', status: 'open', accountCount: 100 },
      enabled: true,
      permissions: ['setting', 'setting:org', 'setting:org:view'],
      roles: [
        { id: 'h-role-admin', code: 'admin', name: '租户管理员', type: 'system', status: 'open', permissions: [] },
        { id: 'h-role-default', code: 'default', name: '默认角色', type: 'system', status: 'open', permissions: [] },
        { id: 'h-role-sales', code: 'sales', name: '销售', type: 'custom', status: 'open', permissions: ['setting:org:view'] }
      ],
      orgs: [
        { id: 'h-org-child', parentId: 'h-org-root', name: '销售部', index: 1, status: 'open', leaderTenantUserId: 'h-tu-2' },
        { id: 'h-org-root', parentId: null, name: '总部', index: 0, status: 'open', leaderTenantUserId: null }
      ],
      members: [
        { id: 'h-tu-1', userId: 'acc-1', name: '张三', email: 'a@x.com', status: 'open', roleCodes: ['admin'], tenantOrgIds: ['h-org-root'] },
        { id: 'h-tu-2', userId: 'acc-2', name: '李四', phone: '13800138000', status: 'open', roleCodes: ['sales'], tenantOrgIds: ['h-org-root', 'h-org-child'] }
      ]
    },
    overrides
  );

describe('托管租户 applySnapshot（sqlite）', () => {
  let fastify;
  const events = [];

  before(async () => {
    fastify = await buildApp();
    await createAccountUser(fastify, 'acc-1');
    await createAccountUser(fastify, 'acc-2');
    fastify.tenant.onChange(event => events.push(event));
  });

  after(async () => {
    await fastify.close();
  });

  it('首次同步创建租户、角色、组织层级、成员多组织与负责人', async () => {
    const tenant = await fastify.tenant.services.managed.applySnapshot({ issuer: ISSUER, snapshot: buildSnapshot() });
    const { models } = fastify.tenant;
    assert.equal(tenant.name, '共享租户');
    assert.equal(tenant.options.managedBy.hostTenantId, 'h-tenant-1');
    assert.equal(fastify.tenant.services.managed.isManagedTenant(tenant), true);

    const orgs = await models.org.findAll({ where: { tenantId: tenant.id } });
    const root = orgs.find(org => org.name === '总部');
    const child = orgs.find(org => org.name === '销售部');
    assert.equal(child.parentId, root.id);

    const users = await models.user.findAll({ where: { tenantId: tenant.id } });
    const lisi = users.find(user => user.userId === 'acc-2');
    assert.deepEqual([...lisi.tenantOrgIds].sort(), [root.id, child.id].sort());
    assert.equal((await models.org.findByPk(child.id)).leaderUserId, lisi.id);

    const salesRole = await models.role.findOne({ where: { tenantId: tenant.id, code: 'sales' } });
    assert.deepEqual(lisi.roles, [salesRole.id]);

    const info = await fastify.tenant.services.user.getTenantUserInfo({ id: 'acc-2' });
    assert.equal(info.tenantId, tenant.id);
    assert.deepEqual(info.get('permissions'), ['setting:org:view']);
    assert.ok(events.some(event => event.type === 'snapshot' && event.tenantId === String(tenant.id)));
  });

  it('重复同步幂等，移除的组织与成员被关闭', async () => {
    const snapshot = buildSnapshot({
      orgs: [{ id: 'h-org-root', parentId: null, name: '总部', status: 'open' }],
      members: [{ id: 'h-tu-1', userId: 'acc-1', name: '张三', email: 'a@x.com', status: 'open', roleCodes: ['admin'], tenantOrgIds: ['h-org-root'] }]
    });
    const tenant = await fastify.tenant.services.managed.applySnapshot({ issuer: ISSUER, snapshot });
    const { models } = fastify.tenant;
    assert.equal(await models.tenant.count({ where: { name: '共享租户' } }), 1);
    const child = await models.org.findOne({ where: { tenantId: tenant.id, name: '销售部' } });
    assert.equal(child.status, 'closed');
    const lisi = await models.user.findOne({ where: { tenantId: tenant.id, userId: 'acc-2' } });
    assert.equal(lisi.status, 'closed');
    assert.equal(await models.user.count({ where: { tenantId: tenant.id } }), 2);
  });

  it('同步公司信息与 logo，文件映射记在 managedBy.files，未带映射时保留上次的', async () => {
    const { models, services } = fastify.tenant;
    const company = { name: '共享公司', fullName: '共享有限公司', logo: 'local-logo', banners: ['local-b1'], teamDescription: [{ name: '甲', avatar: 'local-a1' }] };
    const tenant = await services.managed.applySnapshot({
      issuer: ISSUER,
      snapshot: buildSnapshot({ tenant: { id: 'h-tenant-1', name: '共享租户', status: 'open', logo: 'local-t-logo', company }, files: { 'h-logo': 'local-t-logo' } })
    });
    assert.equal(tenant.logo, 'local-t-logo');
    assert.deepEqual(tenant.options.managedBy.files, { 'h-logo': 'local-t-logo' });
    const row = await models.company.findOne({ where: { tenantId: tenant.id } });
    assert.equal(row.fullName, '共享有限公司');
    assert.equal(row.logo, 'local-logo');
    assert.deepEqual(row.banners, ['local-b1']);
    assert.deepEqual(row.teamDescription, [{ name: '甲', avatar: 'local-a1' }]);

    const again = await services.managed.applySnapshot({ issuer: ISSUER, snapshot: buildSnapshot() });
    assert.deepEqual(again.options.managedBy.files, { 'h-logo': 'local-t-logo' });
    assert.equal((await models.company.findOne({ where: { tenantId: tenant.id } })).fullName, '共享有限公司');
  });

  it('托管租户的本地写操作被拒绝', async () => {
    const { services } = fastify.tenant;
    const tenant = await services.managed.findByHostTenantId({ issuer: ISSUER, hostTenantId: 'h-tenant-1' });
    const tenantId = tenant.id;
    const rejects = fn => assert.rejects(fn, err => err.messageId === 'tenantManaged');
    await rejects(() => services.tenant.save({ id: tenantId, name: 'x' }));
    await rejects(() => services.tenant.setStatus({ id: tenantId, status: 'closed' }));
    await rejects(() => services.permission.save({ tenantId, permissions: [] }));
    await rejects(() => services.role.create({ tenantId, name: 'r', code: 'r' }));
    await rejects(() => services.user.create({ tenantId, name: 'n', email: 'n@x.com' }));
    await rejects(() => services.org.create({ tenantId, name: '新部门' }));
    await rejects(() => services.orgSync.saveConfig({ tenantId, source: 'wecom' }));
    await rejects(() => services.orgSync.cancelConfig({ tenantId }));
    await rejects(() => services.company.save({ tenantId, name: 'x' }));
    await rejects(() => services.thirdLogin.saveConfig({ tenantId, source: 'wecom', targetId: 't1' }));
    await rejects(() => services.thirdLogin.cancelConfig({ tenantId, source: 'wecom', targetId: 't1' }));
    await rejects(() => services.thirdLogin.saveBindSetting({ tenantId, allowThirdLoginBind: true }));
    await rejects(() => services.user.thirdLoginBindToken({ tenantId, id: 'u1', platform: 'wecom' }));
    await rejects(() => services.user.thirdLoginUnbind({ tenantId, id: 'u1' }));
  });

  it('本地自建租户不受影响，重名时追加（宿主）后缀', async () => {
    const local = await createLocalTenant(fastify, '同名租户');
    await fastify.tenant.services.tenant.save({ id: local.id, description: 'local' });
    const managed = await fastify.tenant.services.managed.applySnapshot({
      issuer: ISSUER,
      snapshot: buildSnapshot({ tenant: { id: 'h-tenant-2', name: '同名租户', status: 'open' }, orgs: [], members: [] })
    });
    assert.equal(managed.name, '同名租户（宿主）');
    const another = await fastify.tenant.services.managed.applySnapshot({
      issuer: 'https://other.example.com/oidc',
      snapshot: buildSnapshot({ tenant: { id: 'h-tenant-2', name: '同名租户', status: 'open' }, orgs: [], members: [] })
    });
    assert.equal(another.name, '同名租户（宿主2）');
  });

  it('宿主关闭应用后租户置为关闭；从未同步过的未开通租户不创建', async () => {
    const tenant = await fastify.tenant.services.managed.applySnapshot({ issuer: ISSUER, snapshot: buildSnapshot({ enabled: false }) });
    assert.equal(tenant.status, 'closed');
    const missing = await fastify.tenant.services.managed.applySnapshot({
      issuer: ISSUER,
      snapshot: buildSnapshot({ tenant: { id: 'h-tenant-404', name: '未开通' }, enabled: false })
    });
    assert.equal(missing, null);
  });
});

describe('外部权限来源', () => {
  let fastify;

  before(async () => {
    fastify = await buildApp();
  });

  after(async () => {
    await fastify.close();
  });

  const appTree = permissions => ({ modules: [{ code: 'apps', name: '应用中心', modules: [{ code: 'crm', name: 'CRM', permissions }] }] });
  const codes = () => fastify.tenant.utils.flattenPermissions(fastify.tenant.permissions).map(item => item.code);

  it('同一 key 重复设置为替换，移除后消失', async () => {
    fastify.tenant.setPermissionSource('oidc-app:crm', appTree([{ code: 'view', name: '查看' }]), { defaultDisabled: true });
    fastify.tenant.setPermissionSource('oidc-app:crm', appTree([{ code: 'edit', name: '编辑' }]), { defaultDisabled: true });
    assert.ok(codes().includes('apps:crm:edit'));
    assert.ok(!codes().includes('apps:crm:view'));
    assert.equal(codes().filter(code => code === 'apps:crm:edit').length, 1);

    const tenant = await createLocalTenant(fastify, '新租户');
    const { codes: tenantCodes } = await fastify.tenant.services.permission.list({ tenantId: tenant.id });
    assert.ok(tenantCodes.includes('setting:org:view'));
    assert.ok(!tenantCodes.some(code => code.startsWith('apps')));

    await fastify.tenant.services.permission.save({ tenantId: tenant.id, permissions: [...tenantCodes, 'apps', 'apps:crm', 'apps:crm:edit'] });
    assert.ok((await fastify.tenant.services.permission.list({ tenantId: tenant.id })).codes.includes('apps:crm:edit'));

    fastify.tenant.removePermissionSource('oidc-app:crm');
    assert.ok(!codes().some(code => code.startsWith('apps')));
  });

  it('租户变更触发 onChange', async () => {
    const events = [];
    const tenant = await createLocalTenant(fastify, '事件租户');
    const off = fastify.tenant.onChange(event => events.push(event));
    await fastify.tenant.services.tenant.save({ id: tenant.id, description: 'changed' });
    await fastify.tenant.services.org.create({ tenantId: tenant.id, name: '部门' });
    await fastify.tenant.services.permission.save({ tenantId: tenant.id, permissions: [] });
    off();
    await fastify.tenant.services.tenant.save({ id: tenant.id, description: 'after-off' });
    assert.deepEqual(
      events.map(event => event.type),
      ['tenant', 'org', 'tenant-permission']
    );
    assert.ok(events.every(event => event.tenantId === String(tenant.id)));
  });
});
