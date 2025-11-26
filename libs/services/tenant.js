const fp = require('fastify-plugin');
const pick = require('lodash/pick');

module.exports = fp(async (fastify, options) => {
  const { models, services } = fastify[options.name];
  const { Op } = fastify.sequelize.Sequelize;
  const create = async ({ name, description, logo, themeColor, accountCount, supportLanguage, defaultLanguage, serviceStartTime, serviceEndTime }) => {
    return await models.tenant.create({
      name,
      description,
      logo,
      themeColor,
      accountCount,
      supportLanguage,
      defaultLanguage,
      serviceStartTime,
      serviceEndTime
    });
  };

  const save = async ({ id, ...data }) => {
    const tenant = await detail({ id });
    await tenant.update(pick(data, ['name', 'description', 'logo', 'accountCount', 'themeColor', 'supportLanguage', 'defaultLanguage', 'serviceStartTime', 'serviceEndTime']));
    return tenant;
  };

  const list = async ({ perPage, currentPage, filter = {} }) => {
    const whereQuery = {};
    ['status'].forEach(name => {
      if (filter[name]) {
        whereQuery[name] = filter[name];
      }
    });
    if (filter['keyword']) {
      whereQuery[Op.or] = [
        {
          name: {
            [Op.like]: `%${filter['keyword']}%`
          }
        },
        {
          description: {
            [Op.like]: `%${filter['keyword']}%`
          }
        }
      ];
    }

    const { count, rows } = await models.tenant.findAndCountAll({
      where: Object.assign({}, whereQuery),
      limit: perPage,
      offset: (currentPage - 1) * perPage,
      order: [['createdAt', 'DESC']]
    });

    return { pageData: rows, totalCount: count };
  };

  const detail = async ({ id }) => {
    const tenant = await models.tenant.findByPk(id, {
      include: [models.company]
    });
    if (!tenant) {
      throw new Error('租户不存在');
    }
    const tenantSetting = await services.setting.detail({ tenantId: tenant.id });
    tenant.setDataValue('tenantSetting', tenantSetting);
    return tenant;
  };

  const setStatus = async ({ id, status }) => {
    const tenant = await detail({ id });
    await tenant.update({ status });
    return tenant;
  };

  const remove = async ({ id }) => {
    const tenant = await detail({ id });
    await services.company.remove({ tenantId: id });
    await tenant.destroy(id);
  };

  const getToken = async ({ id }) => {
    const tenant = await detail({ id });
    const token = fastify.jwt.sign({ payload: { id: tenant.id } });
    return { token };
  };

  const parseToken = async ({ token }) => {
    const { payload } = fastify.jwt.decode(token);
    const tenant = await detail({ id: payload.id });

    return { tenant };
  };

  Object.assign(fastify[options.name].services, {
    tenant: { create, save, list, detail, setStatus, remove, getToken, parseToken }
  });
});
