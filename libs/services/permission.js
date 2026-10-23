const fp = require('fastify-plugin');
const get = require('lodash/get');
const filterPermissionsByCodes = require('../utils/filterPermissionsByCodes');

module.exports = fp(async (fastify, options) => {
  const { models, services, utils } = fastify[options.name];
  // 权限树可能被 appendPermissions / setPermissionSource 替换，每次读取最新值
  const getPermissions = () => fastify[options.name].permissions;

  const initTenantPermissions = async ({ tenantId }) => {
    const tenant = await services.tenant.detail({ id: tenantId, withTenantSetting: false });
    const permissionItems = utils.flattenPermissions(getPermissions());
    const defaultDisabled = fastify[options.name].getDefaultDisabledPermissionCodes?.() || new Set();
    await services.setting.savePermissions({
      tenantId: tenant.id,
      permissions: permissionItems.map(item => item.code).filter(code => !defaultDisabled.has(code))
    });
  };

  const tenantLevelList = async ({ tenantId }) => {
    const tenant = await services.tenant.detail({ id: tenantId });
    const codes = get(tenant.getDataValue('tenantSetting'), 'permissions', []);
    const tenantPermissions = filterPermissionsByCodes(getPermissions(), codes);
    return {
      codes,
      permissions: tenantPermissions
    };
  };

  const list = async ({ tenantId }) => {
    const tenant = await services.tenant.detail({ id: tenantId });
    const permissions = getPermissions();
    const allPermissionSet = new Set(utils.flattenPermissions(permissions).map(item => item.code));
    return {
      codes: get(tenant.getDataValue('tenantSetting'), 'permissions', []).filter(code => allPermissionSet.has(code)),
      permissions
    };
  };

  const save = async ({ tenantId, permissions: codes }) => {
    const tenant = await services.tenant.detail({ id: tenantId, withTenantSetting: false });
    await services.managed?.assertNotManaged(tenant);
    const allPermissionSet = new Set(utils.flattenPermissions(getPermissions()).map(item => item.code));
    await services.setting.savePermissions({
      tenantId: tenant.id,
      permissions: codes.filter(code => allPermissionSet.has(code))
    });
    await services.permissionChange?.notify({ tenantId: tenant.id, reason: 'tenant-permissions' });
    fastify[options.name].emitChange?.({ tenantId: tenant.id, type: 'tenant-permission' });
  };

  Object.assign(fastify[options.name].services, {
    permission: {
      list,
      save,
      tenantLevelList,
      initTenantPermissions
    }
  });
});
