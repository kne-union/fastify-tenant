'use strict';

const assert = require('node:assert/strict');
const toPartialSchema = require('../libs/utils/toPartialSchema');
const roleSchema = require('../libs/schema/role');
const sharedGroupSchema = require('../libs/schema/shared-group');
const {
  Fastify,
  createControllerServices,
  registerTenantUserController,
  registerTenantAdminController,
  registerTenantPermissionController,
  registerTenantAdminPermissionController,
  registerTenantSharedGroupController,
  registerTenantAdminSharedGroupController
} = require('./support/controller-harness');

const prefix = '/api/tenant';

const capture = () => {
  const calls = [];
  const fn = async body => {
    calls.push(body);
    return body;
  };
  fn.calls = calls;
  return fn;
};

describe('toPartialSchema', () => {
  it('去掉顶层 default、整体替换 required、追加字段', () => {
    const result = toPartialSchema(roleSchema, { properties: { id: { type: 'string', description: 'id' } }, required: ['id'] });
    assert.deepEqual(result.required, ['id']);
    assert.equal(result.properties.id.type, 'string');
    ['description', 'status', 'type'].forEach(key => assert.equal('default' in result.properties[key], false, key));
  });

  it('不修改原 schema', () => {
    toPartialSchema(sharedGroupSchema, { required: ['id'] });
    assert.deepEqual(sharedGroupSchema.properties.memberTenantUserIds.default, []);
    assert.equal(sharedGroupSchema.required, undefined);
    assert.deepEqual(roleSchema.required, ['name', 'code']);
    assert.equal(roleSchema.properties.status.default, 'open');
  });
});

describe('编辑接口局部更新：未传字段不得被默认值填充', () => {
  it('admin/save 只传 id 通过校验，且不注入 description', async () => {
    const save = capture();
    const app = Fastify({ logger: false });
    await registerTenantAdminController(app, 'tSave', prefix, createControllerServices({ tenant: Object.assign(createControllerServices().tenant, { save }) }));
    const res = await app.inject({ method: 'POST', url: `${prefix}/admin/save`, payload: { id: 't1', name: '新名称' } });
    assert.equal(res.statusCode, 200, res.body);
    assert.deepEqual(save.calls[0], { id: 't1', name: '新名称' });
    await app.close();
  });

  it('role/save 只传 id + name 通过校验，不注入 status / type / description', async () => {
    const save = capture();
    const app = Fastify({ logger: false });
    await registerTenantPermissionController(app, 'tRoleSave', prefix, createControllerServices({ role: Object.assign(createControllerServices().role, { save }) }));
    const res = await app.inject({ method: 'POST', url: `${prefix}/role/save`, payload: { id: 'r1', name: '销售' } });
    assert.equal(res.statusCode, 200, res.body);
    assert.deepEqual(save.calls[0], { id: 'r1', name: '销售', tenantId: 'tid-1' });
    await app.close();
  });

  it('admin/role/save 只传 tenantId + id 通过校验，不注入默认值', async () => {
    const save = capture();
    const app = Fastify({ logger: false });
    await registerTenantAdminPermissionController(app, 'tAdminRoleSave', prefix, createControllerServices({ role: Object.assign(createControllerServices().role, { save }) }));
    const res = await app.inject({ method: 'POST', url: `${prefix}/admin/role/save`, payload: { tenantId: 't1', id: 'r1', description: 'd' } });
    assert.equal(res.statusCode, 200, res.body);
    assert.deepEqual(save.calls[0], { tenantId: 't1', id: 'r1', description: 'd' });
    await app.close();
  });

  it('shared-group/save 只传 id + name 时不注入空数组', async () => {
    const save = capture();
    const app = Fastify({ logger: false });
    await registerTenantSharedGroupController(app, 'tSgSave', prefix, createControllerServices({ sharedGroup: Object.assign(createControllerServices().sharedGroup, { save }) }));
    const res = await app.inject({ method: 'POST', url: `${prefix}/shared-group/save`, payload: { id: 'sg1', name: 'SG' } });
    assert.equal(res.statusCode, 200, res.body);
    assert.deepEqual(save.calls[0], { id: 'sg1', name: 'SG', tenantId: 'tid-1' });
    await app.close();
  });

  it('admin/shared-group/save 只传 tenantId + id + name 时不注入空数组', async () => {
    const save = capture();
    const app = Fastify({ logger: false });
    await registerTenantAdminSharedGroupController(app, 'tAdminSgSave', prefix, createControllerServices({ sharedGroup: Object.assign(createControllerServices().sharedGroup, { save }) }));
    const res = await app.inject({ method: 'POST', url: `${prefix}/admin/shared-group/save`, payload: { tenantId: 't1', id: 'sg1', name: 'SG' } });
    assert.equal(res.statusCode, 200, res.body);
    assert.deepEqual(save.calls[0], { tenantId: 't1', id: 'sg1', name: 'SG' });
    await app.close();
  });

  it('shared-group/create 仍按默认值补全', async () => {
    const create = capture();
    const app = Fastify({ logger: false });
    await registerTenantSharedGroupController(app, 'tSgCreate', prefix, createControllerServices({ sharedGroup: Object.assign(createControllerServices().sharedGroup, { create }) }));
    const res = await app.inject({ method: 'POST', url: `${prefix}/shared-group/create`, payload: { name: 'SG' } });
    assert.equal(res.statusCode, 200, res.body);
    assert.deepEqual(create.calls[0].memberTenantUserIds, []);
    assert.deepEqual(create.calls[0].dataSourceTenantUserIds, []);
    await app.close();
  });
});

describe('必填参数校验', () => {
  let tenantApp;
  let adminApp;
  let adminRoleApp;

  before(async () => {
    tenantApp = Fastify({ logger: false });
    await registerTenantUserController(tenantApp, 'tRequired', prefix, createControllerServices());
    adminApp = Fastify({ logger: false });
    await registerTenantAdminController(adminApp, 'tAdminRequired', prefix, createControllerServices());
    adminRoleApp = Fastify({ logger: false });
    await registerTenantAdminPermissionController(adminRoleApp, 'tAdminRoleRequired', prefix, createControllerServices());
  });

  after(async () => {
    await tenantApp.close();
    await adminApp.close();
    await adminRoleApp.close();
  });

  const expect400 = async (app, method, url, payload) => {
    const res = await app.inject(method === 'GET' ? { method, url } : { method, url, payload });
    assert.equal(res.statusCode, 400, `${method} ${url} -> ${res.statusCode} ${res.body}`);
  };

  it('parse-join-token / join 缺 token 返回 400', async () => {
    await expect400(tenantApp, 'POST', `${prefix}/parse-join-token`, {});
    await expect400(tenantApp, 'POST', `${prefix}/join`, {});
  });

  it('switch-default-tenant 缺 tenantId 返回 400', async () => {
    await expect400(tenantApp, 'POST', `${prefix}/switch-default-tenant`, {});
  });

  it('org-list 非法 status 返回 400', async () => {
    await expect400(tenantApp, 'GET', `${prefix}/org-list?status=bad`);
  });

  it('admin/user-list 缺 tenantId 返回 400', async () => {
    await expect400(adminApp, 'GET', `${prefix}/admin/user-list`);
  });

  it('admin/set-status 非法 status 返回 400', async () => {
    await expect400(adminApp, 'POST', `${prefix}/admin/set-status`, { id: 't1', status: 'bad' });
  });

  it('admin/save 缺 id 返回 400', async () => {
    await expect400(adminApp, 'POST', `${prefix}/admin/save`, { name: 'T' });
  });

  it('admin/role/create 缺 name 或 code 返回 400', async () => {
    await expect400(adminRoleApp, 'POST', `${prefix}/admin/role/create`, { tenantId: 't1', code: 'c' });
    await expect400(adminRoleApp, 'POST', `${prefix}/admin/role/create`, { tenantId: 't1', name: 'n' });
  });
});
