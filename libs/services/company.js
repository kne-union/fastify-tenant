const fp = require('fastify-plugin');

const COMPANY_SAVE_KEYS = ['name', 'fullName', 'logo', 'industry', 'scale', 'address', 'phone', 'email', 'foundedDate', 'companyTags', 'website', 'description', 'banners', 'teamDescription', 'developmentHistory', 'contact', 'options'];

const normalizeFoundedDate = value => {
  if (value == null || value === '') {
    return null;
  }
  if (typeof value === 'string') {
    const s = value.trim();
    return s ? s.slice(0, 10) : null;
  }
  if (typeof value === 'object' && typeof value.format === 'function') {
    return value.format('YYYY-MM-DD');
  }
  return value;
};

const normalizeCompanyTags = tags => {
  if (!Array.isArray(tags)) {
    return [];
  }
  return tags
    .map(item => {
      if (typeof item === 'string') {
        const label = item.trim();
        return label ? { label } : null;
      }
      const label = item?.label != null ? String(item.label).trim() : '';
      return label ? { label } : null;
    })
    .filter(Boolean);
};

module.exports = fp(async (fastify, options) => {
  const { models, services } = fastify[options.name];
  const detail = async ({ id, tenantId }) => {
    if (id) {
      return models.company.findByPk(id);
    }
    if (!tenantId) {
      throw new Error('查询参数有误');
    }

    const tenant = await services.tenant.detail({ id: tenantId, withTenantSetting: false });

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
    const patch = {};
    for (const key of COMPANY_SAVE_KEYS) {
      if (!Object.prototype.hasOwnProperty.call(data, key)) {
        continue;
      }
      if (key === 'foundedDate') {
        patch.foundedDate = normalizeFoundedDate(data.foundedDate);
        continue;
      }
      if (key === 'companyTags') {
        patch.companyTags = normalizeCompanyTags(data.companyTags);
        continue;
      }
      patch[key] = data[key];
    }
    await company.update(patch);

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
