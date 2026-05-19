const fp = require('fastify-plugin');
const { BusinessError } = require('../utils/errors');
const { escapeLike } = require('../utils/escapeLike');

module.exports = fp(async (fastify, options) => {
  const { models, services } = fastify[options.name];
  const { Op } = fastify.sequelize.Sequelize;

  const create = async ({ tenantId, ...data }) => {
    const tenant = await services.tenant.detail({ id: tenantId, withTenantSetting: false });
    return await models.role.create(Object.assign({}, data, { tenantId: tenant.id }));
  };

  const pickFilterString = value => {
    if (value == null || value === '') {
      return '';
    }
    if (typeof value === 'string' || typeof value === 'number') {
      return String(value).trim();
    }
    if (typeof value === 'object') {
      if (value.value != null && value.value !== '') {
        return String(value.value).trim();
      }
      if (value.id != null && value.id !== '') {
        return String(value.id).trim();
      }
    }
    return '';
  };

  const normalizeListFilter = raw => {
    if (raw == null || raw === '') {
      return {};
    }
    if (typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : {};
      } catch {
        return {};
      }
    }
    return typeof raw === 'object' ? raw : {};
  };

  const list = async ({ tenantId, perPage, currentPage, filter: rawFilter = {} }) => {
    const filter = normalizeListFilter(rawFilter);
    const and = [{ tenantId }];

    const status = pickFilterString(filter.status);
    if (status) {
      and.push({ status });
    }

    const roleType = pickFilterString(filter.type);
    if (roleType) {
      // 勿写 where: { type: roleType } 与 tenantId 平铺（部分版本/场景会失效），放在 Op.and 内用 Op.eq
      and.push({ type: { [Op.eq]: roleType } });
    }

    const keyword = pickFilterString(filter.keyword);
    if (keyword) {
      const escaped = escapeLike(keyword);
      and.push({
        [Op.or]: ['name', 'code', 'description'].map(name => {
          return {
            [name]: {
              [Op.like]: `%${escaped}%`
            }
          };
        })
      });
    }

    await services.tenant.detail({ id: tenantId, withTenantSetting: false });

    const { count, rows } = await models.role.findAndCountAll({
      where: { [Op.and]: and },
      limit: perPage,
      offset: (currentPage - 1) * perPage,
      order: [['createdAt', 'DESC']]
    });
    return { pageData: rows, totalCount: count };
  };

  const detail = async ({ tenantId, id }) => {
    await services.tenant.detail({ id: tenantId, withTenantSetting: false });
    const role = await models.role.findOne({
      where: {
        id,
        tenantId
      }
    });
    if (!role) {
      throw new BusinessError('ROLE_NOT_FOUND', '角色不存在', 404);
    }
    return role;
  };

  const save = async ({ tenantId, id, ...data }) => {
    const role = await detail({ id, tenantId });
    if (role.type === 'system') {
      throw new BusinessError('ROLE_SYSTEM_IMMUTABLE', '系统角色不能修改');
    }
    return await role.update(data);
  };

  const remove = async ({ tenantId, id }) => {
    const role = await detail({ id, tenantId });
    if (role.type === 'system') {
      throw new BusinessError('ROLE_SYSTEM_IMMUTABLE', '系统角色不能删除');
    }

    if (
      (await models.user.count({
        where: {
          tenantId,
          roles: {
            [Op.contains]: [role.code]
          }
        }
      })) > 0
    ) {
      throw new BusinessError('ROLE_IN_USE', '角色已被用户关联，不能删除');
    }
    return await role.destroy();
  };

  const setStatus = async ({ tenantId, id, status }) => {
    const role = await detail({ id, tenantId });
    if (role.type === 'system') {
      throw new BusinessError('ROLE_SYSTEM_IMMUTABLE', '系统角色不能修改');
    }
    return await role.update({ status });
  };

  const permissionList = async ({ tenantId, id }) => {
    const tenantPermissions = await services.permission.tenantLevelList({ tenantId });
    const role = await models.role.findOne({
      where: {
        id,
        tenantId
      }
    });
    if (!role) {
      throw new BusinessError('ROLE_NOT_FOUND', '角色不存在', 404);
    }
    const allowed = new Set(tenantPermissions.codes);
    return {
      codes: role.permissions.filter(code => allowed.has(code)),
      permissions: tenantPermissions.permissions
    };
  };

  const combinedPermissions = async ({ tenantId, roles = [] }) => {
    const tenantPermissions = await services.permission.tenantLevelList({ tenantId });
    const roleIds = [...new Set((roles || []).filter(Boolean))];
    const roleWhere =
      roleIds.length > 0
        ? {
            status: 'open',
            tenantId,
            [Op.or]: [{ id: { [Op.in]: roleIds } }, { type: 'system', code: 'default' }]
          }
        : {
            status: 'open',
            tenantId,
            type: 'system',
            code: 'default'
          };

    const roleList = await models.role.findAll({
      where: roleWhere
    });

    if (roleList.find(({ type, code }) => type === 'system' && code === 'admin')) {
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

    const allowed = new Set(tenantPermissions.codes);
    return {
      codes: codes.filter(code => allowed.has(code)),
      permissions: tenantPermissions.permissions
    };
  };

  const savePermission = async ({ tenantId, id, permissions }) => {
    const role = await detail({ tenantId, id });
    const tenantPermissions = await services.permission.tenantLevelList({ tenantId });
    const allowed = new Set(tenantPermissions.codes);
    await role.update({ permissions: permissions.filter(code => allowed.has(code)) });
    return role;
  };

  const rolesFilter = async ({ tenantId, roles }) => {
    const uniqueIds = [...new Set((roles || []).filter(id => id != null && id !== ''))];
    if (uniqueIds.length === 0) {
      return [];
    }
    const tenantExists = await models.tenant.findByPk(tenantId, { attributes: ['id'] });
    if (!tenantExists) {
      throw new Error('租户不存在');
    }
    return await models.role.findAll({
      where: {
        id: {
          [Op.in]: uniqueIds
        },
        tenantId,
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

  const enums = async (authenticatePayload, { ids, names, codes }) => {
    const { tenantId } = authenticatePayload;
    const whereQuery = {
      tenantId,
      [Op.or]: [{ id: { [Op.in]: ids || [] } }, { name: { [Op.in]: names || [] } }, { code: { [Op.in]: codes || [] } }]
    };
    const positions = await models.role.findAll({
      where: whereQuery
    });

    return positions.map(item => {
      return {
        value: item.id,
        description: item.name
      };
    });
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
      rolesToList,
      enums
    }
  });
});
