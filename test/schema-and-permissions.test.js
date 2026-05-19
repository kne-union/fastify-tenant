'use strict';

const assert = require('node:assert/strict');
const tenantSchema = require('../libs/schema/tenant');
const tenantUserSchema = require('../libs/schema/tenant-user');
const roleSchema = require('../libs/schema/role');
const permissions = require('../libs/permissions');

describe('JSON Schema 导出', () => {
  it('tenant / tenant-user / role 均为 object schema', () => {
    assert.equal(tenantSchema.type, 'object');
    assert.ok(Array.isArray(tenantSchema.required));
    assert.equal(tenantUserSchema.type, 'object');
    assert.equal(roleSchema.type, 'object');
  });
});

describe('libs/permissions', () => {
  it('应包含 setting 模块及子模块', () => {
    assert.ok(Array.isArray(permissions.modules));
    const setting = permissions.modules.find(m => m.code === 'setting');
    assert.ok(setting);
    assert.ok(setting.modules.some(m => m.code === 'user-manager'));
  });
});
