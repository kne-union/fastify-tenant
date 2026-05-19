'use strict';

const assert = require('node:assert/strict');
const findDataScopeByPermissionCode = require('../libs/utils/findDataScopeByPermissionCode');
const mockPermissions = require('./fixtures/mockPermissionsForDataScope');

describe('findDataScopeByPermissionCode', () => {
  it('resolves module dataScope for permission code', () => {
    const found = findDataScopeByPermissionCode(
      mockPermissions,
      'setting:permission:shared-group:create'
    );
    assert.ok(found);
    assert.equal(found.moduleCode, 'setting:permission:shared-group');
    assert.equal(found.permissionCode, 'setting:permission:shared-group:create');
    assert.equal(found.dataScope.open, true);
    assert.equal(found.dataScope.type, 'org');
  });

  it('resolves owner type on biz-data order view', () => {
    const found = findDataScopeByPermissionCode(mockPermissions, 'setting:biz-data:order:view');
    assert.ok(found);
    assert.equal(found.moduleCode, 'setting:biz-data:order');
    assert.equal(found.dataScope.type, 'owner');
  });

  it('returns null for unknown permission code', () => {
    assert.equal(findDataScopeByPermissionCode(mockPermissions, 'setting:unknown:view'), null);
  });
});
