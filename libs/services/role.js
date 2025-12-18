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

    if (
      (await models.user.count({
        where: {
          tenantId: tenant.id,
          roles: {
            [Op.contains]: [role.code]
          }
        }
      })) > 0
    ) {
      throw new Error('角色已被用户关联，不能删除');
    }
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

  const permissionList = async ({ tenantId, id }) => {
    const tenant = await services.tenant.detail({ id: tenantId });
    const role = await detail({ id, tenantId: tenant.id });
    const tenantPermissions = await services.permission.tenantLevelList({ tenantId: tenant.id });
    return {
      codes: role.permissions,
      permissions: tenantPermissions.permissions
    };
  };

  const combinedPermissions = async ({ tenantId, roles = [] }) => {
    const tenant = await services.tenant.detail({ id: tenantId });
    const tenantPermissions = await services.permission.tenantLevelList({ tenantId: tenant.id });
    const roleList = await models.role.findAll({
      where: {
        [Op.or]: [
          {
            id: {
              [Op.in]: roles
            }
          },
          {
            type: 'system',
            code: 'default'
          }
        ],
        status: 'open',
        tenantId: tenant.id
      }
    });
    if (roles.indexOf('admin') > 1) {
      return tenantPermissions;
    }

    const codes = roleList.reduce((acc, curr) => {
      if (curr.permissions) {
        curr.permissions.forEach(permission => {
          if (!acc.includes(permission)) {
            acc.push(permission);
          }
        });
      }
      return acc;
    }, []);

    return {
      codes,
      permissions: tenantPermissions.permissions
    };
  };

  const savePermission = async ({ tenantId, id, permissions }) => {
    const role = await detail({ tenantId, id });
    const tenantPermissions = await services.permission.tenantLevelList({ tenantId });
    await role.update({ permissions: permissions.filter(code => tenantPermissions.codes.indexOf(code) !== -1) });
    return role;
  };

  const rolesFilter = async ({ tenantId, roles }) => {
    const tenant = await services.tenant.detail({ id: tenantId });
    return await models.role.findAll({
      where: {
        id: {
          [Op.in]: roles
        },
        tenantId: tenant.id,
        [Op.not]: {
          type: 'system',
          code: 'default'
        }
      }
    });
  };

  //验证role是否存在
  const checkRoles = async ({ tenantId, roles }) => {
    return (await rolesFilter({ tenantId, roles })).map(({ id }) => id);
  };

  const rolesToList = async ({ tenantId, roles }) => {
    return await rolesFilter({ tenantId, roles });
  };

  Object.assign(fastify[options.name].services, {
    role: {
      create,
      list,
      detail,
      save,
      remove,
      setStatus,
      permissionList,
      combinedPermissions,
      savePermission,
      checkRoles,
      rolesToList
    }
  });
});
