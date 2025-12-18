const fp = require('fastify-plugin');
const get = require('lodash/get');

const filterPermissionsByCodes = (permissions, codes) => {
  // 将权限代码转换为集合，方便快速查找
  const codeSet = new Set(codes);

  // 递归过滤节点
  function filterNode(node, parentCode = '') {
    const fullCode = parentCode ? `${parentCode}:${node.code}` : node.code;

    // 如果当前节点不在代码集合中，返回null（被过滤掉）
    if (!codeSet.has(fullCode)) {
      return null;
    }

    // 创建过滤后的节点副本
    const filteredNode = { ...node };

    // 如果有子模块，递归过滤
    if (node.modules) {
      filteredNode.modules = node.modules.map(child => filterNode(child, fullCode)).filter(child => child !== null);
    }

    // 权限列表不需要过滤，因为权限代码已经在父节点中被验证过了
    return filteredNode;
  }

  // 过滤根模块
  const filteredModules = permissions.modules.map(module => filterNode(module)).filter(module => module !== null);

  return {
    ...permissions,
    modules: filteredModules
  };
};

module.exports = fp(async (fastify, options) => {
  const { models, services, permissions, utils } = fastify[options.name];
  const initTenantPermissions = async ({ tenantId }) => {
    const tenant = await services.tenant.detail({ id: tenantId });
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
    const allPermissions = utils.flattenPermissions(permissions).map(item => item.code);
    return {
      codes: get(tenant.getDataValue('tenantSetting'), 'permissions', []).filter(code => allPermissions.indexOf(code) > -1),
      permissions
    };
  };

  const save = async ({ tenantId, permissions: codes }) => {
    const tenant = await services.tenant.detail({ id: tenantId });
    const allPermissions = utils.flattenPermissions(permissions).map(item => item.code);
    await services.setting.savePermissions({
      tenantId: tenant.id,
      permissions: codes.filter(code => allPermissions.indexOf(code) > -1)
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
