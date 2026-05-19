const fp = require('fastify-plugin');
const get = require('lodash/get');
const filterPermissionsByCodes = require('../utils/filterPermissionsByCodes');

module.exports = fp(async (fastify, options) => {
  const { models, services, permissions, utils } = fastify[options.name];
  const initTenantPermissions = async ({ tenantId }) => {
    const tenant = await services.tenant.detail({ id: tenantId, withTenantSetting: false });
    const permissionItems = utils.flattenPermissions(permissions);
    await services.setting.savePermissions({
      tenantId: tenant.id,
      permissions: permissionItems.map(item => item.code)
    });
  };

  const tenantLevelList = async ({ tenantId }) => {
    const tenant = await services.tenant.detail({ id: tenantId });
    const codes = get(tenant.getDataValue('tenantSetting'), 'permissions', []);
    const tenantPermissions = filterPermissionsByCodes(permissions, codes);
    return {
      codes,
      permissions: tenantPermissions
    };
  };

  const list = async ({ tenantId }) => {
    const tenant = await services.tenant.detail({ id: tenantId });
    const allPermissionSet = new Set(utils.flattenPermissions(permissions).map(item => item.code));
    return {
      codes: get(tenant.getDataValue('tenantSetting'), 'permissions', []).filter(code => allPermissionSet.has(code)),
      permissions
    };
  };

  const save = async ({ tenantId, permissions: codes }) => {
    const tenant = await services.tenant.detail({ id: tenantId, withTenantSetting: false });
    const allPermissionSet = new Set(utils.flattenPermissions(permissions).map(item => item.code));
    await services.setting.savePermissions({
      tenantId: tenant.id,
      permissions: codes.filter(code => allPermissionSet.has(code))
    });
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
