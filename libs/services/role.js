const fp = require('fastify-plugin');

module.exports = fp(async (fastify, options) => {
  const { models, services } = fastify[options.name];
  const { Op } = fastify.sequelize.Sequelize;

  const create = async ({ tenantId, ...data }) => {
    const tenant = await services.tenant.detail({ id: tenantId });
    return await models.role.create(Object.assign({}, data, { tenantId: tenant.id }));
  };

  const list = async ({ tenantId, perPage, currentPage, filter = {} }) => {
    const whereQuery = {};
    ['status'].forEach(name => {
      if (filter[name]) {
        whereQuery[name] = filter[name];
      }
    });
    if (filter['keyword']) {
      whereQuery[Op.or] = ['name', 'code', 'description'].map(name => {
        return {
          [name]: {
            [Op.like]: `%${filter['keyword']}%`
          }
        };
      });
    }

    const { count, rows } = await models.role.findAndCountAll({
      where: Object.assign({}, whereQuery, { tenantId }),
      limit: perPage,
      offset: (currentPage - 1) * perPage,
      order: [['createdAt', 'DESC']]
    });
    return { pageData: rows, totalCount: count };
  };

  const detail = async ({ tenantId, id }) => {
    const tenant = await services.tenant.detail({ id: tenantId });
    const role = await models.role.findByPk(id, {
      where: {
        tenantId: tenant.id
      }
    });
    if (!role) {
      throw new Error('角色不存在');
    }
    return role;
  };

  const save = async ({ tenantId, id, data }) => {
    const tenant = await services.tenant.detail({ id: tenantId });
    const role = await detail({ id, tenantId: tenant.id });
    if (role.type === 'system') {
      throw new Error('系统角色不能修改');
    }
    return await role.update(data);
  };

  const remove = async ({ tenantId, id }) => {
    const tenant = await services.tenant.detail({ id: tenantId });
    const role = await detail({ id, tenantId: tenant.id });
    if (role.type === 'system') {
      throw new Error('系统角色不能删除');
    }
    // todo 检查是否有用户关联
    return await role.destroy();
  };

  const setStatus = async ({ tenantId, id, status }) => {
    const tenant = await services.tenant.detail({ id: tenantId });
    const role = await detail({ id, tenantId: tenant.id });
    if (role.type === 'system') {
      throw new Error('系统角色不能修改');
    }
    return await role.update({ status });
  };

  Object.assign(fastify[options.name].services, {
    role: {
      create,
      list,
      detail,
      save,
      remove,
      setStatus
    }
  });
});
