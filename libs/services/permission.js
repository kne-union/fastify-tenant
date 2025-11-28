const fp = require('fastify-plugin');

module.exports = fp(async (fastify, options) => {
  const { models, services, permissions } = fastify[options.name];
  const { Op } = fastify.sequelize.Sequelize;

  const flattenPermissions = data => {
    const result = [];
    const processModule = (module, parentCode = '') => {
      const currentCode = parentCode ? `${parentCode}:${module.code}` : module.code;

      // 添加当前模块
      result.push({
        name: module.name,
        code: currentCode,
        type: 'module'
      });

      // 处理子模块
      if (module.modules) {
        module.modules.forEach(subModule => {
          processModule(subModule, currentCode);
        });
      }

      // 处理权限
      if (module.permissions) {
        module.permissions.forEach(permission => {
          result.push({
            name: permission.name,
            code: `${currentCode}:${permission.code}`,
            type: 'permission'
          });
        });
      }
    };

    // 处理所有顶级模块
    data.modules.forEach(module => {
      processModule(module);
    });

    return result;
  };

  const initTenantPermissions = async ({ tenantId }) => {
    const tenant = await services.tenant.detail({ id: tenantId });
    const permissionItems = flattenPermissions(permissions);
    await models.tenantPermission.bulkCreate(
      permissionItems.map((item, index) => {
        return Object.assign({}, item, { tenantId: tenant.id });
      })
    );
  };

  const list = async ({ tenantId }) => {
    const tenantPermissions = await models.tenantPermission.findAll({
      where: {
        tenantId
      }
    });
    return {
      tenantPermissions: tenantPermissions.map(item => item.code),
      permissions
    };
  };

  Object.assign(fastify[options.name].services, {
    permission: {
      list,
      initTenantPermissions
    }
  });
});
