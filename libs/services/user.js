const fp = require('fastify-plugin');
const { Forbidden } = require('http-errors');

module.exports = fp(async (fastify, options) => {
  const { models, services } = fastify[options.name];
  const { Op } = fastify.sequelize.Sequelize;

  const create = async ({ tenantId, avatar, name, email, phone, description, tenantOrgId, roles }) => {
    if (email && (await models.user.count({ where: { email, tenantId } })) > 0) {
      throw new Error('邮箱不能重复');
    }
    if (phone && (await models.user.count({ where: { phone, tenantId } })) > 0) {
      throw new Error('手机号不能重复');
    }
    if (!email && !phone) {
      throw new Error('手机号或邮箱不能同时为空');
    }

    const tenant = await services.tenant.detail({ id: tenantId });
    const currentCount = await models.user.count({
      where: { tenantId: tenantId }
    });

    if (currentCount >= tenant.accountCount) {
      throw new Error('租户用户数量已达到上限');
    }

    if (tenantOrgId) {
      await services.org.detail({ id: tenantOrgId });
    }

    const checkedRoles = await services.role.checkRoles({ tenantId, roles });

    return await models.user.create({
      avatar,
      name,
      email,
      phone,
      description,
      tenantId,
      roles: checkedRoles,
      tenantOrgId
    });
  };

  const detail = async ({ tenantId, id }) => {
    await services.tenant.detail({ id: tenantId });
    const tenantUser = await models.user.findByPk(id, {
      include: [models.org, models.tenant]
    });
    if (!tenantUser) {
      throw new Error('租户用户不存在');
    }
    if (tenantUser.tenantId !== tenantId) {
      throw new Error('租户用户不存在');
    }

    tenantUser.setDataValue(
      'roleDetails',
      (await services.role.rolesToList({ tenantId, roles: tenantUser.roles })).map(item => {
        return { id: item.code, code: item.code, name: item.name, description: item.description, type: item.type };
      })
    );

    return tenantUser;
  };

  const associate = async (authenticatePayload, { token }) => {
    const { payload } = fastify.jwt.decode(token);
    const { tenantId, id } = payload;
    const tenantUser = await detail({ tenantId, id });
    if (tenantUser.userId) {
      throw new Error('租户用户已经被关联');
    }
    await tenantUser.update({
      userId: authenticatePayload.id
    });
  };

  const inviteToken = async ({ tenantId, id }) => {
    const tenantUser = await detail({ tenantId, id });
    const token = fastify.jwt.sign({ payload: { id: tenantUser.id, tenantId: tenantUser.tenantId } });
    return { token };
  };

  const sendInviteMessage = async ({ tenantId, id }) => {
    const tenantUser = await detail({ tenantId, id });
    const { token } = await inviteToken({ tenantId, id });
    const name = tenantUser.email || tenantUser.phone;
    if (!name) {
      throw new Error('邮箱或手机号不能为空');
    }

    await fastify.message.services.sendMessage({
      name,
      type: tenantUser.email ? 0 : 1,
      code: 'INVITETENANT',
      props: {
        inviteUrl: `${fastify.config.ORIGIN}/join-tenant?token=${token}`,
        username: tenantUser.name,
        tenantName: tenantUser.tenant.name,
        companyName: tenantUser.tenant.company?.name,
        themeColor: tenantUser.tenant.themeColor
      },
      options: {
        title: '加入租户邀请'
      }
    });
  };

  const parseToken = async ({ token }) => {
    const { payload } = fastify.jwt.decode(token);
    const { id, tenantId } = payload;
    const tenant = await services.tenant.detail({ id: tenantId });
    const company = await services.company.detail({ tenantId });
    const tenantUser = await detail({ tenantId, id });
    return { tenant, company, tenantUser };
  };

  const join = async (authenticatePayload, { token }) => {
    const { payload } = fastify.jwt.decode(token);
    const { id, tenantId } = payload;
    const tenantUser = await detail({ tenantId, id });
    if (tenantUser.userId) {
      throw new Error('当前认证链接已经被使用，请直接登录或者联系管理员');
    }

    if ((await models.user.count({ where: { tenantId, userId: authenticatePayload.id } })) > 0) {
      throw new Error('当前用户已经绑定过此租户不能重复绑定');
    }

    await tenantUser.update({
      userId: authenticatePayload.id
    });

    await setDefaultTenant(authenticatePayload, { tenantId });
  };

  const tenantList = async authenticatePayload => {
    const list = await models.user.findAll({
      include: [
        {
          model: models.tenant,
          include: models.company
        },
        {
          model: models.org
        }
      ],
      where: {
        userId: authenticatePayload.id
      }
    });

    const defaultTenant = await models.userDefault.findOne({
      where: { userId: authenticatePayload.id }
    });

    return {
      list,
      defaultTenantId: defaultTenant?.tenantId
    };
  };

  const setDefaultTenant = async (authenticatePayload, { tenantId }) => {
    await services.tenant.detail({ id: tenantId });
    const tenantUser = await models.user.findOne({
      where: { tenantId: tenantId, userId: authenticatePayload.id }
    });
    if (!tenantUser) {
      throw new Error('不能进行此操作');
    }
    let tenantUserDefault = await models.userDefault.findOne({
      where: { userId: authenticatePayload.id }
    });
    if (!tenantUserDefault) {
      tenantUserDefault = await models.userDefault.create({
        tenantId,
        userId: authenticatePayload.id
      });
    } else {
      tenantUserDefault.update({
        tenantId
      });
    }

    return tenantUserDefault;
  };

  const list = async ({ tenantId, filter = {}, perPage, currentPage }) => {
    const whereQuery = {};
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

    const { count, rows } = await models.user.findAndCountAll({
      include: models.org,
      where: Object.assign({}, whereQuery, {
        tenantId
      }),
      offset: perPage * (currentPage - 1),
      limit: perPage,
      order: [['createdAt', 'DESC']]
    });

    const roles = await services.role.rolesToList({
      tenantId,
      roles: rows.reduce((acc, item) => {
        return [...acc, ...item.roles];
      }, [])
    });

    const rolesMap = new Map(roles.map(item => [item.id, { id: item.id, code: item.code, name: item.name, type: item.type, description: item.description }]));
    return {
      pageData: rows.map(item => {
        item.setDataValue(
          'roles',
          item.roles.map(role => rolesMap.get(role)).filter(item => !!item)
        );
        return item;
      }),
      totalCount: count
    };
  };

  const setStatus = async ({ tenantId, id, status }) => {
    const tenantUser = await detail({ tenantId, id });
    await tenantUser.update({ status });

    return tenantUser;
  };

  const save = async ({ id, tenantId, tenantOrgId, avatar, name, email, phone, roles = [], description }) => {
    const tenantUser = await detail({ tenantId, id });

    if (email && (await models.user.count({ where: { email, id: { [Op.not]: tenantUser.id }, tenantId } })) > 0) {
      throw new Error('邮箱不能重复');
    }
    if (phone && (await models.user.count({ where: { phone, id: { [Op.not]: tenantUser.id }, tenantId } })) > 0) {
      throw new Error('手机号不能重复');
    }
    if (!email && !phone) {
      throw new Error('手机号或邮箱不能同时为空');
    }

    const checkedRoles = await services.role.checkRoles({ tenantId, roles });

    await tenantUser.update({ tenantOrgId, avatar, name, email, phone, description, roles: checkedRoles });

    return tenantUser;
  };

  const remove = async ({ id, tenantId }) => {
    const tenantUser = await detail({ tenantId, id });
    await tenantUser.destroy();
  };

  const permissionList = async ({ tenantId, id }) => {
    const tenantUser = await detail({ tenantId, id });
    return await services.role.combinedPermissions({ tenantId, roles: tenantUser.roles });
  };

  const getTenantUserInfo = async authenticatePayload => {
    const tenantUserDefault = await models.userDefault.findOne({
      where: { userId: authenticatePayload.id }
    });
    if (!tenantUserDefault) {
      throw new Forbidden('未设置默认租户');
    }
    const tenantUser = await models.user.findOne({
      include: {
        model: models.tenant,
        include: models.company
      },
      where: { tenantId: tenantUserDefault.tenantId, userId: authenticatePayload.id, status: 'open' }
    });
    if (!tenantUser) {
      throw new Forbidden('当前租户用户不存在或账号被关闭');
    }
    if (tenantUser.tenant?.status !== 'open') {
      throw new Forbidden('租户不能使用');
    }

    const tenantSetting = await services.setting.detail({ tenantId: tenantUser.tenantId });
    tenantUser.tenant.setDataValue('tenantSetting', tenantSetting);
    tenantUser.setDataValue('tenantSetting', tenantSetting);
    tenantUser.setDataValue('permissions', (await permissionList({ tenantId: tenantUser.tenantId, id: tenantUser.id })).codes);
    tenantUser.setDataValue(
      'roleDetails',
      (await services.role.rolesToList({ tenantId: tenantUserDefault.tenantId, roles: tenantUser.roles })).map(item => {
        return { id: item.id, code: item.code, name: item.name, description: item.description, type: item.type };
      })
    );
    return tenantUser;
  };

  Object.assign(fastify[options.name].services, {
    user: {
      create,
      associate,
      detail,
      inviteToken,
      parseToken,
      sendInviteMessage,
      tenantList,
      setDefaultTenant,
      getTenantUserInfo,
      list,
      setStatus,
      save,
      join,
      remove
    }
  });
});
