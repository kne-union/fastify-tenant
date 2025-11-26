const fp = require('fastify-plugin');

module.exports = fp(async (fastify, options) => {
  const { models, services } = fastify[options.name];

  const list = async ({ tenantId }) => {
    return await models.org.findAll({
      where: {
        tenantId
      },
      order: [['createdAt', 'ASC']]
    });
  };

  const detail = async ({ id }) => {
    const org = await models.org.findByPk(id);
    if (!org) {
      throw new Error('组织不存在');
    }
    return org;
  };

  const create = async ({ tenantId, parentId, name, description }) => {
    await services.tenant.detail({ id: tenantId });
    if (parentId) {
      await detail({ id: parentId });
    }
    return await models.org.create({ tenantId, parentId, name, description });
  };

  const remove = async ({ tenantId, id }) => {
    await services.tenant.detail({ id: tenantId });
    const org = await detail({ id });
    if (org.tenantId !== tenantId) {
      throw new Error('操作失败');
    }
    if ((await models.org.count({ where: { tenantId, parentId: id } })) > 0) {
      throw new Error('请先删除所有子节点再进行操作');
    }
    if ((await models.user.count({ where: { tenantId, orgId: id } })) > 0) {
      throw new Error('请先移除当前组织下所有用户再进行操作');
    }
    await org.destroy();
  };

  const save = async ({ tenantId, id, ...data }) => {
    await services.tenant.detail({ id: tenantId });
    const org = await detail({ id });
    if (org.tenantId !== tenantId) {
      throw new Error('操作失败');
    }
    return await org.update(data);
  };

  Object.assign(fastify[options.name].services, {
    org: { list, detail, create, remove, save }
  });
});
