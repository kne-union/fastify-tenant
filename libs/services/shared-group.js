const fp = require('fastify-plugin');
const { getSequelize } = require('../utils/sequelize');
const { escapeLike } = require('../utils/escapeLike');

const USER_LIST_ATTRS = ['id', 'name', 'email', 'phone', 'avatar', 'status'];

module.exports = fp(async (fastify, options) => {
  const { models, services } = fastify[options.name];
  const { Op } = fastify.sequelize.Sequelize;

  const assertTenantUsers = async (tenantId, userIds, transaction) => {
    const ids = [...new Set((userIds || []).filter(Boolean))];
    if (!ids.length) {
      return;
    }
    const n = await models.user.count({
      where: { tenantId, id: { [Op.in]: ids } },
      transaction
    });
    if (n !== ids.length) {
      throw new Error('租户用户不存在或不属于当前租户');
    }
  };

  const assertSharedModulesShape = sharedModules => {
    if (!Array.isArray(sharedModules)) {
      throw new Error('sharedModules 须为数组');
    }
    for (const item of sharedModules) {
      if (!item || typeof item.moduleCode !== 'string' || !item.moduleCode.trim()) {
        throw new Error('sharedModules 每项须包含非空 moduleCode');
      }
      if (!['read', 'write'].includes(item.access)) {
        throw new Error('sharedModules 每项 access 须为 read 或 write');
      }
    }
  };

  const detailInclude = () => [
    {
      model: models.sharedGroupDataSource,
      as: 'dataSources',
      required: false,
      include: [{ model: models.user, required: false, attributes: USER_LIST_ATTRS }]
    },
    {
      model: models.sharedGroupMember,
      as: 'members',
      required: false,
      include: [{ model: models.user, required: false, attributes: USER_LIST_ATTRS }]
    }
  ];

  const detail = async ({ tenantId, id, withRelations = true, transaction }) => {
    await services.tenant.detail({ id: tenantId, withTenantSetting: false });
    const row = await models.sharedGroup.findOne({
      where: { id, tenantId },
      include: withRelations ? detailInclude() : undefined,
      transaction
    });
    if (!row) {
      throw new Error('共享组不存在');
    }
    return row;
  };

  const create = async ({ tenantId, name, description, sharedModules = [], dataSourceTenantUserIds = [], memberTenantUserIds = [], createdTenantUserId, options: extraOptions, transaction: outerTransaction }) => {
    if (!name || !String(name).trim()) {
      throw new Error('共享组名称不能为空');
    }
    assertSharedModulesShape(sharedModules);
    await services.tenant.detail({ id: tenantId, withTenantSetting: false });
    await assertTenantUsers(tenantId, [...dataSourceTenantUserIds, ...memberTenantUserIds, createdTenantUserId].filter(Boolean), outerTransaction);

    const run = async t => {
      const sg = await models.sharedGroup.create(
        {
          tenantId,
          name: String(name).trim(),
          description: description != null ? description : null,
          sharedModules,
          createdTenantUserId: createdTenantUserId || null,
          status: 'open',
          options: extraOptions != null ? extraOptions : {}
        },
        { transaction: t }
      );
      const gid = sg.id;
      const dsIds = [...new Set((dataSourceTenantUserIds || []).filter(Boolean))];
      const memIds = [...new Set((memberTenantUserIds || []).filter(Boolean))];
      if (dsIds.length) {
        await models.sharedGroupDataSource.bulkCreate(
          dsIds.map(tenantUserId => ({ sharedGroupId: gid, tenantUserId })),
          { transaction: t }
        );
      }
      if (memIds.length) {
        await models.sharedGroupMember.bulkCreate(
          memIds.map(tenantUserId => ({ sharedGroupId: gid, tenantUserId })),
          { transaction: t }
        );
      }
      return detail({ tenantId, id: gid, transaction: t });
    };

    if (outerTransaction) {
      return run(outerTransaction);
    }
    return getSequelize(fastify).transaction(run);
  };

  const list = async ({ tenantId, perPage, currentPage, filter = {} }) => {
    await services.tenant.detail({ id: tenantId, withTenantSetting: false });
    const whereQuery = { tenantId };
    if (filter.status) {
      whereQuery.status = filter.status;
    }
    if (filter.keyword) {
      const kw = `%${escapeLike(filter.keyword)}%`;
      whereQuery[Op.or] = [{ name: { [Op.like]: kw } }, { description: { [Op.like]: kw } }];
    }

    const { count, rows } = await models.sharedGroup.findAndCountAll({
      where: whereQuery,
      include: detailInclude(),
      distinct: true,
      limit: perPage,
      offset: (currentPage - 1) * perPage,
      order: [['createdAt', 'DESC']]
    });
    return { pageData: rows, totalCount: count };
  };

  const save = async ({ tenantId, id, name, description, sharedModules, options: extraOptions, status, dataSourceTenantUserIds, memberTenantUserIds, transaction: outerTransaction }) => {
    await assertTenantUsers(tenantId, [...(dataSourceTenantUserIds || []), ...(memberTenantUserIds || [])].filter(Boolean), outerTransaction);
    if (sharedModules !== undefined) {
      assertSharedModulesShape(sharedModules);
    }

    const run = async t => {
      const row = await detail({ tenantId, id, withRelations: false, transaction: t });
      const patch = {};
      if (name !== undefined) {
        patch.name = String(name).trim();
        if (!patch.name) {
          throw new Error('共享组名称不能为空');
        }
      }
      if (description !== undefined) {
        patch.description = description;
      }
      if (sharedModules !== undefined) {
        patch.sharedModules = sharedModules;
      }
      if (status !== undefined) {
        patch.status = status;
      }
      if (extraOptions !== undefined) {
        patch.options = extraOptions;
      }
      if (Object.keys(patch).length) {
        await row.update(patch, { transaction: t });
      }

      if (dataSourceTenantUserIds !== undefined) {
        const dsIds = [...new Set((dataSourceTenantUserIds || []).filter(Boolean))];
        await assertTenantUsers(tenantId, dsIds, t);
        await models.sharedGroupDataSource.destroy({ where: { sharedGroupId: id }, transaction: t });
        if (dsIds.length) {
          await models.sharedGroupDataSource.bulkCreate(
            dsIds.map(tenantUserId => ({ sharedGroupId: id, tenantUserId })),
            { transaction: t }
          );
        }
      }

      if (memberTenantUserIds !== undefined) {
        const memIds = [...new Set((memberTenantUserIds || []).filter(Boolean))];
        await assertTenantUsers(tenantId, memIds, t);
        await models.sharedGroupMember.destroy({ where: { sharedGroupId: id }, transaction: t });
        if (memIds.length) {
          await models.sharedGroupMember.bulkCreate(
            memIds.map(tenantUserId => ({ sharedGroupId: id, tenantUserId })),
            { transaction: t }
          );
        }
      }

      return detail({ tenantId, id, transaction: t });
    };

    if (outerTransaction) {
      return run(outerTransaction);
    }
    return getSequelize(fastify).transaction(run);
  };

  const remove = async ({ tenantId, id }) => {
    const row = await detail({ tenantId, id, withRelations: false });
    await row.destroy();
    return {};
  };

  const setStatus = async ({ tenantId, id, status }) => {
    const row = await detail({ tenantId, id, withRelations: false });
    await row.update({ status });
    return row;
  };

  Object.assign(fastify[options.name].services, {
    sharedGroup: {
      create,
      list,
      detail,
      save,
      remove,
      setStatus
    }
  });
});
