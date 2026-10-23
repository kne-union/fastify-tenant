'use strict';

const assert = require('node:assert/strict');
const Fastify = require('fastify');

const P = '/api/tenant';

const buildApp = async () => {
  const fastify = Fastify({ logger: false });
  await fastify.register(require('@kne/fastify-sequelize'), { db: { dialect: 'sqlite', storage: ':memory:', logging: false }, sqlPath: './test/__no_sql__' });
  await fastify.register(require('@kne/fastify-account'), {});
  await fastify.register(require('../index'), {
    permissionsProfile: null,
    getUserAuthenticate: () => async () => {},
    getAdminUserAuthenticate: () => async () => {}
  });
  await fastify.ready();
  await fastify.sequelize.sync();
  return fastify;
};

describe('编辑接口局部更新（sqlite 端到端）', () => {
  let fastify;
  let tenant;
  let zhang;
  let li;

  const post = async (url, payload) => {
    const res = await fastify.inject({ method: 'POST', url: `${P}${url}`, payload });
    assert.equal(res.statusCode, 200, `${url} -> ${res.statusCode} ${res.body}`);
    return res.json();
  };

  const get = async (url, query) => {
    const res = await fastify.inject({ method: 'GET', url: `${P}${url}`, query });
    assert.equal(res.statusCode, 200, `${url} -> ${res.statusCode} ${res.body}`);
    return res.json();
  };

  before(async () => {
    fastify = await buildApp();
    tenant = await fastify.tenant.services.tenant.create({
      name: 'T1',
      description: '原描述',
      themeColor: '#fff',
      logo: '',
      accountCount: 10,
      supportLanguage: ['zh-CN'],
      defaultLanguage: 'zh-CN',
      serviceStartTime: new Date().toISOString(),
      serviceEndTime: new Date(Date.now() + 86400000).toISOString()
    });
    await post('/admin/user-create', { tenantId: tenant.id, name: '张三', email: 'a@x.com', roles: ['admin'] });
    await post('/admin/user-create', { tenantId: tenant.id, name: '李四', phone: '13800138000' });
    const { pageData } = await get('/admin/user-list', { tenantId: tenant.id });
    zhang = pageData.find(u => u.name === '张三');
    li = pageData.find(u => u.name === '李四');
  });

  after(() => fastify.close());

  it('admin/save 只改名称不清空描述与其它字段', async () => {
    await post('/admin/save', { id: tenant.id, name: 'T2' });
    const detail = await get('/admin/detail', { id: tenant.id });
    assert.equal(detail.name, 'T2');
    assert.equal(detail.description, '原描述');
    assert.equal(detail.themeColor, '#fff');
  });

  it('admin/role/save 只改名称不重开已关闭角色', async () => {
    const role = await post('/admin/role/create', { tenantId: tenant.id, name: '销售', code: 'sales', description: '销售角色' });
    await post('/admin/role/set-status', { tenantId: tenant.id, id: role.id, status: 'closed' });
    await post('/admin/role/save', { tenantId: tenant.id, id: role.id, name: '销售2' });
    const saved = await fastify.tenant.models.role.findByPk(role.id);
    assert.equal(saved.name, '销售2');
    assert.equal(saved.status, 'closed');
    assert.equal(saved.description, '销售角色');
    assert.equal(saved.code, 'sales');
  });

  it('admin/shared-group/save 只改名称不清空成员、数据来源与共享模块', async () => {
    const sg = await post('/admin/shared-group/create', {
      tenantId: tenant.id,
      name: 'SG',
      sharedModules: [{ moduleCode: 'setting', access: 'read' }],
      dataSourceTenantUserIds: [li.id],
      memberTenantUserIds: [zhang.id]
    });
    await post('/admin/shared-group/save', { tenantId: tenant.id, id: sg.id, name: 'SG2' });
    const { pageData } = await get('/admin/shared-group/list', { tenantId: tenant.id });
    const saved = pageData.find(item => item.id === sg.id);
    assert.equal(saved.name, 'SG2');
    assert.deepEqual(saved.sharedModules, [{ moduleCode: 'setting', access: 'read' }]);
    assert.deepEqual(
      saved.dataSources.map(item => item.tenantUserId),
      [li.id]
    );
    assert.deepEqual(
      saved.members.map(item => item.tenantUserId),
      [zhang.id]
    );
  });

  it('admin/role/remove 角色仍被用户按 ID 引用时拒绝删除', async () => {
    const role = await post('/admin/role/create', { tenantId: tenant.id, name: '在用角色', code: 'in-use' });
    await post('/admin/user-create', { tenantId: tenant.id, name: '王五', email: 'w@x.com', roles: [role.id] });
    const res = await fastify.inject({ method: 'POST', url: `${P}/admin/role/remove`, payload: { tenantId: tenant.id, id: role.id } });
    assert.equal(res.statusCode, 400, res.body);
    assert.ok(await fastify.tenant.models.role.findByPk(role.id));
  });

  it('admin/role/remove 历史数据按编码引用时同样拒绝删除', async () => {
    const role = await post('/admin/role/create', { tenantId: tenant.id, name: '旧角色', code: 'legacy-code' });
    await post('/admin/user-create', { tenantId: tenant.id, name: '赵六', email: 'z@x.com' });
    await fastify.tenant.models.tenantUser.update({ roles: ['legacy-code'] }, { where: { tenantId: tenant.id, email: 'z@x.com' } });
    const res = await fastify.inject({ method: 'POST', url: `${P}/admin/role/remove`, payload: { tenantId: tenant.id, id: role.id } });
    assert.equal(res.statusCode, 400, res.body);
    assert.ok(await fastify.tenant.models.role.findByPk(role.id));
  });

  it('admin/role/remove 无用户引用时可删除', async () => {
    const role = await post('/admin/role/create', { tenantId: tenant.id, name: '空角色', code: 'unused' });
    await post('/admin/role/remove', { tenantId: tenant.id, id: role.id });
    assert.equal(await fastify.tenant.models.role.findByPk(role.id), null);
  });

  it('admin/user-permission-list 返回用户角色合并后的权限码', async () => {
    const role = await post('/admin/role/create', { tenantId: tenant.id, name: '组织查看', code: 'org-viewer' });
    await post('/admin/role/save-permission', { tenantId: tenant.id, id: role.id, permissions: ['setting', 'setting:org', 'setting:org:view'] });
    await post('/admin/user-save', { tenantId: tenant.id, id: li.id, name: li.name, phone: li.phone, roles: [role.id] });
    const result = await get('/admin/user-permission-list', { tenantId: tenant.id, id: li.id });
    assert.ok(result.codes.includes('setting:org:view'), JSON.stringify(result.codes));
    assert.ok(Array.isArray(result.permissions.modules));
  });
});
