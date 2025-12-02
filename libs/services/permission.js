const fp = require('fastify-plugin');

module.exports = fp(async (fastify, options) => {
  const { models, services, permissions, utils } = fastify[options.name];
  const { Op } = fastify.sequelize.Sequelize;
  const initTenantPermissions = async ({ tenantId }) => {
    const tenant = await services.tenant.detail({ id: tenantId });
    const permissionItems = utils.flattenPermissions(permissions);
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
