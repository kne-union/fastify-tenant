const fp = require('fastify-plugin');
const omit = require('lodash/omit');

module.exports = fp(async (fastify, options) => {
  const { models, services } = fastify[options.name];
  const detail = async ({ id, tenantId }) => {
    if (id) {
      return models.tenantCompany.findByPk(id);
    }
    if (!tenantId) {
      throw new Error('查询参数有误');
    }

    const tenant = await services.tenant.detail({ id: tenantId });

    const company = await models.company.findOne({
      where: {
        tenantId: tenantId
      }
    });

    if (company) {
      return company;
    }

    return await models.company.create({
      name: tenant.name,
      tenantId: tenant.id
    });
  };

  const save = async ({ tenantId, ...data }) => {
    const company = await detail({ tenantId });
    await company.update(omit(data, ['id']));

    return company;
  };

  const remove = async ({ tenantId }) => {
    const company = await models.company.findOne({
      where: {
        tenantId: tenantId
      }
    });
    company && (await company.destroy());
  };

  Object.assign(fastify[options.name].services, {
    company: { detail, save, remove }
  });
});
