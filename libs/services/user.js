const fp = require('fastify-plugin');
const { Forbidden } = require('http-errors');
const { BusinessError } = require('../utils/errors');
const { normalizePhone } = require('../utils/phone');
const { escapeLike } = require('../utils/escapeLike');
const { collectOrgSubtreeIds } = require('../utils/dataScopeOrgIds');
const { buildOrgNamePath } = require('../utils/orgPath');
const { normalizeTenantUserStatus } = require('../utils/normalizeTenantUserStatus');
const { pickOrgIdsFromInput, buildUserOrgMembershipWhere, attachUserOrgDisplay, getUserOrgIds } = require('../utils/tenantOrgIds');
const findDataScopeByPermissionCode = require('../utils/findDataScopeByPermissionCode');
const get = require('lodash/get');
const { mergeThirdLoginOptions, clearThirdLoginOptions, findUserByThirdLoginBinding, findUserBySyncSourceId, assertThirdLoginBindingConflict, getThirdLoginFromOptions } = require('../utils/thirdLoginBinding');

module.exports = fp(async (fastify, options) => {
  const { models, services } = fastify[options.name];
  const { Op } = fastify.sequelize.Sequelize;

  const assertTenantOrgIds = async ({ tenantId, tenantOrgIds, transaction }) => {
    for (const orgId of tenantOrgIds) {
      await services.org.detail({ id: orgId, transaction });
    }
  };

  const create = async ({ tenantId, avatar, name, email, phone: phoneRaw, description, tenantOrgIds: tenantOrgIdsInput, roles, options, transaction, synced, syncSource, sourceId }) => {
    const phone = phoneRaw ? normalizePhone(phoneRaw) : phoneRaw;
    if (email && !synced && (await models.user.count({ where: { email, tenantId }, transaction })) > 0) {
      throw new BusinessError('USER_EMAIL_DUPLICATE', '邮箱不能重复');
    }
    if (phone && !synced && (await models.user.count({ where: { phone, tenantId }, transaction })) > 0) {
      throw new BusinessError('USER_PHONE_DUPLICATE', '手机号不能重复');
    }
    if (!synced && !email && !phone) {
      throw new BusinessError('USER_CONTACT_REQUIRED', '手机号或邮箱不能同时为空');
    }

    let tenant;
    if (transaction) {
      tenant = await models.tenant.findByPk(tenantId, { transaction });
      if (!tenant) {
        throw new Error('租户不存在');
      }
    } else {
      tenant = await services.tenant.detail({ id: tenantId, withTenantSetting: false });
    }
    const currentCount = await models.user.count({
      where: { tenantId: tenantId },
      transaction
    });

    if (currentCount >= tenant.accountCount) {
      throw new Error('租户用户数量已达到上限');
    }

    const tenantOrgIds = pickOrgIdsFromInput({ tenantOrgIds: tenantOrgIdsInput });
    if (tenantOrgIds.length) {
      await assertTenantOrgIds({ tenantId, tenantOrgIds, transaction });
    }

    const checkedRoles = await services.role.checkRoles({ tenantId, roles });

    return await models.user.create(
      {
        avatar,
        name,
        email,
        phone,
        description,
        tenantId,
        roles: checkedRoles,
        tenantOrgIds,
        options,
        synced: synced || false,
        syncSource: syncSource || null,
        sourceId: sourceId || null
      },
      { transaction }
    );
  };

  const detail = async ({ tenantId, id }) => {
    await services.tenant.detail({ id: tenantId, withTenantSetting: false });
    const tenantUser = await models.user.findByPk(id, {
      include: [models.tenant]
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

    const orgRows = await models.org.findAll({
      where: { tenantId },
      attributes: ['id', 'name', 'parentId']
    });
    const orgById = new Map(orgRows.map(o => [String(o.id), o]));
    attachUserOrgDisplay(tenantUser, orgById, buildOrgNamePath);

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
    const token = fastify.jwt.sign({ payload: { id: tenantUser.id, tenantId: tenantUser.tenantId } }, { expiresIn: '7d' });
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
        }
      ],
      where: {
        userId: authenticatePayload.id
      }
    });

    const orgRows = await models.org.findAll({
      attributes: ['id', 'name', 'parentId']
    });
    const orgById = new Map(orgRows.map(o => [String(o.id), o]));
    for (const item of list) {
      attachUserOrgDisplay(item, orgById, buildOrgNamePath);
    }

    const defaultTenant = await models.userDefault.findOne({
      where: { userId: authenticatePayload.id }
    });

    return {
      list,
      defaultTenantId: defaultTenant?.tenantId
    };
  };

  const setDefaultTenant = async (authenticatePayload, { tenantId }) => {
    await services.tenant.detail({ id: tenantId, withTenantSetting: false });
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
      await tenantUserDefault.update({
        tenantId
      });
    }

    return tenantUserDefault;
  };

  const list = async ({ tenantId, filter = {}, perPage, currentPage }) => {
    const whereQuery = { tenantId };
    const keyword = filter.keyword != null ? String(filter.keyword).trim() : '';
    if (keyword) {
      const escaped = escapeLike(keyword);
      whereQuery[Op.or] = [{ name: { [Op.like]: `%${escaped}%` } }, { description: { [Op.like]: `%${escaped}%` } }];
    }
    const statusFilter = normalizeTenantUserStatus(filter.status);
    if (statusFilter) {
      whereQuery.status = statusFilter;
    }
    const tenantOrgId = filter.tenantOrgId != null ? String(filter.tenantOrgId).trim() : '';
    const orgRows = await models.org.findAll({
      where: { tenantId },
      attributes: ['id', 'name', 'parentId']
    });
    const orgById = new Map(orgRows.map(o => [String(o.id), o]));
    if (tenantOrgId) {
      const orgIds = [
        ...collectOrgSubtreeIds(
          orgRows.map(o => ({ id: o.id, parentId: o.parentId })),
          tenantOrgId
        )
      ];
      const orgMembershipWhere = buildUserOrgMembershipWhere(orgIds.length > 0 ? orgIds : [tenantOrgId], Op);
      if (orgMembershipWhere) {
        whereQuery[Op.and] = [...(whereQuery[Op.and] || []), orgMembershipWhere];
      }
    }
    const toFilterArray = value => {
      if (value == null || value === '') {
        return [];
      }
      return Array.isArray(value) ? value : [value];
    };
    const roleIds = toFilterArray(filter.roles)
      .concat(toFilterArray(filter.role))
      .map(role => String(role).trim())
      .filter(Boolean);
    if (roleIds.length === 1) {
      whereQuery.roles = { [Op.contains]: [roleIds[0]] };
    } else if (roleIds.length > 1) {
      const roleOr = roleIds.map(roleId => ({ roles: { [Op.contains]: [roleId] } }));
      const roleCondition = { [Op.or]: roleOr };
      if (whereQuery[Op.or]) {
        const keywordOr = whereQuery[Op.or];
        delete whereQuery[Op.or];
        whereQuery[Op.and] = [...(whereQuery[Op.and] || []), { [Op.or]: keywordOr }, roleCondition];
      } else {
        whereQuery[Op.and] = [...(whereQuery[Op.and] || []), roleCondition];
      }
    }

    const id = filter.id != null ? String(filter.id).trim() : '';
    const ids = toFilterArray(filter.ids)
      .map(item => String(item).trim())
      .filter(Boolean);
    if (id && ids.length) {
      whereQuery.id = { [Op.in]: [...new Set([id, ...ids])] };
    } else if (ids.length) {
      whereQuery.id = { [Op.in]: [...new Set(ids)] };
    } else if (id) {
      whereQuery.id = id;
    }

    if (filter.synced != null && filter.synced !== '') {
      const syncedValue = filter.synced === 'true' || filter.synced === true;
      if (syncedValue) {
        whereQuery.synced = true;
      } else {
        whereQuery[Op.and] = [...(whereQuery[Op.and] || []), { [Op.or]: [{ synced: false }, { synced: null }] }];
      }
    }

    const { count, rows } = await models.user.findAndCountAll({
      where: whereQuery,
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
        attachUserOrgDisplay(item, orgById, buildOrgNamePath);
        return item;
      }),
      totalCount: count
    };
  };

  const isTenantAdmin = ({ roleDetails } = {}) => {
    return (Array.isArray(roleDetails) ? roleDetails : []).some(role => role && role.type === 'system' && role.code === 'admin');
  };

  /**
   * 判定租户管理员：优先 roleDetails；否则用 roles（角色 id 或 code）对照系统 admin 角色。
   * roleDetails 为 setDataValue 附加字段，部分场景下直接读 instance.roleDetails 会拿不到。
   */
  const resolveIsTenantAdmin = async ({ tenantId, roleDetails, roles, currentTenantUserId } = {}) => {
    if (isTenantAdmin({ roleDetails })) {
      return true;
    }

    let refs = Array.isArray(roles) ? roles.map(item => String(item).trim()).filter(Boolean) : [];
    if (!refs.length && currentTenantUserId && tenantId) {
      const me = await models.user.findOne({
        where: { id: currentTenantUserId, tenantId },
        attributes: ['roles']
      });
      refs = Array.isArray(me?.roles) ? me.roles.map(item => String(item).trim()).filter(Boolean) : [];
    }
    if (!refs.length || !tenantId) {
      return false;
    }

    const adminRole = await models.role.findOne({
      where: {
        tenantId,
        type: 'system',
        code: 'admin'
      },
      attributes: ['id', 'code']
    });
    if (!adminRole) {
      return false;
    }
    const adminId = String(adminRole.id);
    return refs.includes(adminId) || refs.includes(String(adminRole.code));
  };

  /**
   * 带数据权限的租户用户列表：
   * - 租户管理员：同 list，可见全部
   * - 普通用户：默认本部门及以下（orgSubtree），可选 moduleCode / permissionCode 合并共享组数据来源
   */
  const listByDataPermission = async ({ tenantId, currentTenantUserId, roleDetails, roles, permissions: userPermissionCodes, filter = {}, perPage, currentPage, type, moduleCode, permissionCode }) => {
    if (await resolveIsTenantAdmin({ tenantId, roleDetails, roles, currentTenantUserId })) {
      return list({ tenantId, filter, perPage, currentPage });
    }

    let resolvedModuleCode = moduleCode != null && String(moduleCode).trim() ? String(moduleCode).trim() : null;
    const permissionCodeTrimmed = permissionCode != null && String(permissionCode).trim() ? String(permissionCode).trim() : null;

    if (permissionCodeTrimmed) {
      const codes = Array.isArray(userPermissionCodes) ? userPermissionCodes : [];
      if (!codes.includes(permissionCodeTrimmed)) {
        throw new Forbidden('无权访问');
      }
      if (!resolvedModuleCode) {
        const found = findDataScopeByPermissionCode(fastify[options.name].permissions, permissionCodeTrimmed);
        if (found?.moduleCode) {
          resolvedModuleCode = found.moduleCode;
        }
      }
    }

    const scopeType = type != null && String(type).trim() ? String(type).trim() : 'orgSubtree';
    const tenantUserIds = await services.dataScope.resolveVisibleTenantUserIds({
      tenantId,
      currentTenantUserId,
      type: scopeType,
      moduleCode: resolvedModuleCode
    });

    if (!tenantUserIds.length) {
      return { pageData: [], totalCount: 0 };
    }

    const visibleSet = new Set(tenantUserIds.map(String));
    const requestedId = filter.id != null ? String(filter.id).trim() : '';
    const requestedIds = (Array.isArray(filter.ids) ? filter.ids : filter.ids != null && filter.ids !== '' ? [filter.ids] : []).map(item => String(item).trim()).filter(Boolean);

    let scopedIds = tenantUserIds;
    if (requestedId || requestedIds.length) {
      const want = new Set([...(requestedId ? [requestedId] : []), ...requestedIds]);
      scopedIds = [...want].filter(id => visibleSet.has(id));
      if (!scopedIds.length) {
        return { pageData: [], totalCount: 0 };
      }
    }

    const scopedFilter = Object.assign({}, filter, { ids: scopedIds });
    delete scopedFilter.id;

    return list({
      tenantId,
      filter: scopedFilter,
      perPage,
      currentPage
    });
  };

  const setStatus = async ({ tenantId, id, status }) => {
    const normalized = normalizeTenantUserStatus(status);
    if (!normalized) {
      throw new Error('无效的用户状态');
    }
    const tenantUser = await detail({ tenantId, id });
    await tenantUser.update({ status: normalized });

    return tenantUser;
  };

  const save = async ({ id, tenantId, tenantOrgIds: tenantOrgIdsInput, avatar, name, email, phone, roles = [], description, options }) => {
    const tenantUser = await detail({ tenantId, id });

    if (phone) {
      phone = normalizePhone(phone);
    }
    if (email && !tenantUser.synced && (await models.user.count({ where: { email, id: { [Op.not]: tenantUser.id }, tenantId } })) > 0) {
      throw new BusinessError('USER_EMAIL_DUPLICATE', '邮箱不能重复');
    }
    if (phone && !tenantUser.synced && (await models.user.count({ where: { phone, id: { [Op.not]: tenantUser.id }, tenantId } })) > 0) {
      throw new BusinessError('USER_PHONE_DUPLICATE', '手机号不能重复');
    }
    if (!tenantUser.synced && !email && !phone) {
      throw new BusinessError('USER_CONTACT_REQUIRED', '手机号或邮箱不能同时为空');
    }

    const checkedRoles = await services.role.checkRoles({ tenantId, roles });
    const previousOrgIds = getUserOrgIds(tenantUser);
    const tenantOrgIds = pickOrgIdsFromInput({ tenantOrgIds: tenantOrgIdsInput });
    if (tenantOrgIds.length) {
      await assertTenantOrgIds({ tenantId, tenantOrgIds });
    }
    const removedOrgIds = previousOrgIds.filter(orgId => !tenantOrgIds.includes(orgId));
    if (removedOrgIds.length) {
      await models.org.update(
        { leaderUserId: null },
        {
          where: {
            tenantId,
            leaderUserId: tenantUser.id,
            id: { [Op.in]: removedOrgIds }
          }
        }
      );
    }

    const updateData = {
      tenantOrgIds,
      avatar,
      roles: checkedRoles,
      options
    };

    if (!tenantUser.synced) {
      Object.assign(updateData, { name, email, phone, description });
    }

    await tenantUser.update(updateData);

    return tenantUser;
  };

  const remove = async ({ id, tenantId }) => {
    const tenantUser = await detail({ tenantId, id });
    await models.org.update({ leaderUserId: null }, { where: { leaderUserId: id, tenantId } });
    await tenantUser.destroy();
  };

  const permissionList = async ({ tenantId, id }) => {
    const tenantUser = await detail({ tenantId, id });
    return await services.role.combinedPermissions({ tenantId, roles: tenantUser.roles });
  };

  const enrichTenantUserInfo = async tenantUser => {
    if (!tenantUser || tenantUser.status !== 'open') {
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
      (await services.role.rolesToList({ tenantId: tenantUser.tenantId, roles: tenantUser.roles })).map(item => {
        return { id: item.id, code: item.code, name: item.name, description: item.description, type: item.type };
      })
    );

    const orgRows = await models.org.findAll({
      where: { tenantId: tenantUser.tenantId },
      attributes: ['id', 'name', 'parentId']
    });
    const orgById = new Map(orgRows.map(o => [String(o.id), o]));
    attachUserOrgDisplay(tenantUser, orgById, buildOrgNamePath);

    return tenantUser;
  };

  const tenantUserInclude = {
    model: models.tenant,
    include: models.company
  };

  const getTenantUserInfo = async authenticatePayload => {
    const tenantUserDefault = await models.userDefault.findOne({
      where: { userId: authenticatePayload.id }
    });
    if (!tenantUserDefault) {
      throw new Forbidden('未设置默认租户');
    }
    const tenantUser = await models.user.findOne({
      include: tenantUserInclude,
      where: { tenantId: tenantUserDefault.tenantId, userId: authenticatePayload.id, status: 'open' }
    });
    return enrichTenantUserInfo(tenantUser);
  };

  const applyThirdLoginProfile = (user, thirdLoginResult) => {
    ['avatar', 'gender', 'description', 'name', 'email', 'phone'].forEach(name => {
      if (thirdLoginResult[name]) {
        user[name] = thirdLoginResult[name];
      }
    });
  };

  const buildThirdLoginResponse = (user, thirdLoginResult, props) => {
    return {
      token: fastify.jwt.sign({ payload: { id: user.id, tenantId: user.tenantId } }, { expiresIn: '7d' }),
      platform: thirdLoginResult.platform,
      redirectUrl: thirdLoginResult.redirect || props.redirect || '/tenant',
      name: user.name,
      avatar: user.avatar,
      email: user.email,
      phone: user.phone
    };
  };

  const resolveThirdLoginUser = async (props, thirdLoginResult) => {
    const { tenantId } = props;
    const platform = thirdLoginResult.platform;

    if (props.bindToken) {
      let payload;
      try {
        payload = fastify.jwt.verify(props.bindToken).payload;
      } catch (e) {
        throw new Error('绑定链接无效或已过期');
      }
      if (payload.purpose !== 'third-login-bind' || String(payload.tenantId) !== String(tenantId)) {
        throw new Error('绑定链接无效');
      }
      if (payload.platform && payload.platform !== platform) {
        throw new Error('绑定平台与登录平台不一致');
      }

      const thirdLoginConfig = await services.thirdLogin.getConfig({
        tenantId,
        type: platform,
        targetId: props.targetId || payload.targetId
      });
      if (!thirdLoginConfig.enabled) {
        throw new Error('未配置该渠道的第三方登录');
      }

      const targetUser = await models.user.findOne({
        where: { id: payload.id, tenantId, status: 'open' }
      });
      if (!targetUser) {
        throw new Error('用户不存在或已关闭');
      }

      await assertThirdLoginBindingConflict({
        models,
        tenantId,
        platform,
        sourceId: thirdLoginResult.oauthUserId || thirdLoginResult.id,
        excludeUserId: targetUser.id
      });

      targetUser.options = mergeThirdLoginOptions(targetUser.options, platform, thirdLoginResult.oauthUserId || thirdLoginResult.id);
      applyThirdLoginProfile(targetUser, thirdLoginResult);
      await targetUser.save();
      return targetUser;
    }

    const thirdLoginConfig = await services.thirdLogin.getConfig({
      tenantId,
      type: platform,
      targetId: props.targetId
    });
    if (!thirdLoginConfig.enabled) {
      throw new Error('未配置该渠道的第三方登录');
    }

    // 绑定用真实 OAuth userid；查找用 result.id（北森场景下已被改写为 user.sourceId）
    const bindSourceId = String(thirdLoginResult.oauthUserId || thirdLoginResult.id);
    const syncLookupId = String(thirdLoginResult.id);

    // 1) Already bound: options.thirdLogin.platform + OAuth userid
    let user = await findUserByThirdLoginBinding({
      models,
      tenantId,
      platform,
      sourceId: bindSourceId
    });

    // 2) org-synced：user.sourceId（企微/钉钉同步，或北森改写后的 sourceId）
    if (!user) {
      user = await findUserBySyncSourceId({
        models,
        tenantId,
        platform,
        sourceId: syncLookupId
      });
    }

    // 3) task 手机/邮箱回退时带上的 matchedUserId（兼容旧链路）
    if (!user && thirdLoginResult.matchedUserId) {
      user = await models.user.findOne({
        where: { id: thirdLoginResult.matchedUserId, tenantId, status: 'open' }
      });
    }

    if (!user) {
      throw new Error('用户不存在或未绑定');
    }

    const existingBinding = getThirdLoginFromOptions(user.options);
    if (!existingBinding) {
      await assertThirdLoginBindingConflict({
        models,
        tenantId,
        platform,
        sourceId: bindSourceId,
        excludeUserId: user.id
      });
      user.options = mergeThirdLoginOptions(user.options, platform, bindSourceId);
    } else if (existingBinding.platform !== platform || existingBinding.sourceId !== bindSourceId) {
      throw new Error('当前用户已绑定其他第三方账号');
    }

    applyThirdLoginProfile(user, thirdLoginResult);
    await user.save();
    return user;
  };

  const getThirdLoginUrl = async ({ tenantId, platform, redirect, bindToken, targetId }) => {
    const tenant = await services.tenant.detail({ id: tenantId });
    if (typeof options?.thirdLogin?.getThirdLoginUrl !== 'function') {
      throw new Error('租户不支持第三方登录');
    }

    const config = await services.thirdLogin.getConfig({ tenantId, type: platform, targetId });
    if (!config.enabled) {
      throw new Error('未找到有效的第三方登录配置');
    }

    const configProps = get(config, 'props');
    const resolvedTargetId = config.targetId;

    const redirectQuery = redirect ? encodeURIComponent(redirect) : '';
    const bindTokenQuery = bindToken ? `&bindToken=${encodeURIComponent(bindToken)}` : '';
    const targetIdQuery = resolvedTargetId ? `&targetId=${encodeURIComponent(resolvedTargetId)}` : '';

    const url =
      platform === 'dingtalk'
        ? (() => {
            if (!(configProps.corpId && (configProps.client_id || configProps.clientId))) {
              throw new Error('租户参数配置不完整');
            }
            return `/third-login-result?platform=dingtalk&code=200&message=success&redirect=${redirectQuery}&tenantId=${tenantId}&corpId=${configProps.corpId}&clientId=${configProps.client_id || configProps.clientId}${bindTokenQuery}${targetIdQuery}`;
          })()
        : await options.thirdLogin.getThirdLoginUrl({
            tenant,
            platform,
            redirect,
            bindToken,
            targetId: resolvedTargetId,
            configProps
          });

    return {
      companyName: tenant.company?.name,
      logo: tenant.company?.logo,
      configProps,
      targetId: resolvedTargetId,
      redirectUrl: url
    };
  };

  const getThirdLoginResult = async props => {
    if (!props.tenantId) {
      throw new Error('租户ID不能为空');
    }
    if (typeof options?.thirdLogin?.getThirdLoginResult !== 'function') {
      throw new Error('租户不支持第三方登录');
    }

    let resultProps = props;
    if (props.platform) {
      const config = await services.thirdLogin.getConfig({
        tenantId: props.tenantId,
        type: props.platform,
        targetId: props.targetId
      });
      if (!config.enabled) {
        throw new Error('未找到有效的第三方登录配置');
      }
      resultProps = Object.assign({}, props, {
        targetId: config.targetId,
        configProps: config.props
      });
    }

    const thirdLoginResult = await options.thirdLogin.getThirdLoginResult(resultProps);
    const user = await resolveThirdLoginUser(resultProps, thirdLoginResult);
    return buildThirdLoginResponse(user, thirdLoginResult, resultProps);
  };

  const thirdLoginBindToken = async ({ tenantId, id, platform, targetId, tenantUserId }) => {
    const targetUserId = id || tenantUserId;
    if (!targetUserId) {
      throw new Error('用户ID不能为空');
    }

    await detail({ tenantId, id: targetUserId });

    let resolvedPlatform = platform;
    let resolvedTargetId = targetId;
    if (!resolvedPlatform) {
      const { list: channels } = await services.thirdLogin.list({ tenantId });
      if (channels.length === 1) {
        resolvedPlatform = channels[0].source;
        resolvedTargetId = resolvedTargetId || channels[0].targetId;
      } else {
        throw new Error('请指定第三方登录平台');
      }
    }

    const config = await services.thirdLogin.getConfig({
      tenantId,
      type: resolvedPlatform,
      targetId: resolvedTargetId
    });
    if (!config.enabled) {
      throw new Error('未配置该渠道的第三方登录');
    }

    const token = fastify.jwt.sign(
      {
        payload: {
          purpose: 'third-login-bind',
          id: targetUserId,
          tenantId,
          platform: resolvedPlatform,
          targetId: config.targetId
        }
      },
      { expiresIn: '24h' }
    );

    const targetIdQuery = config.targetId ? `&targetId=${encodeURIComponent(config.targetId)}` : '';
    const url = `${fastify.config.ORIGIN}/third-login?platform=${resolvedPlatform}&tenantId=${tenantId}&bindToken=${encodeURIComponent(token)}${targetIdQuery}`;

    return {
      token,
      url,
      platform: resolvedPlatform,
      targetId: config.targetId
    };
  };

  const thirdLoginUnbind = async ({ tenantId, id, tenantUserId }) => {
    const targetUserId = id || tenantUserId;
    if (!targetUserId) {
      throw new Error('用户ID不能为空');
    }
    const tenantUser = await detail({ tenantId, id: targetUserId });
    await tenantUser.update({
      options: clearThirdLoginOptions(tenantUser.options)
    });
    return {};
  };

  const getThirdLoginTenantUserInfo = async authenticatePayload => {
    const tenantUser = await models.user.findByPk(authenticatePayload.id, {
      include: tenantUserInclude
    });
    return enrichTenantUserInfo(tenantUser);
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
      getThirdLoginTenantUserInfo,
      getThirdLoginUrl,
      getThirdLoginResult,
      thirdLoginBindToken,
      thirdLoginUnbind,
      list,
      listByDataPermission,
      isTenantAdmin,
      resolveIsTenantAdmin,
      setStatus,
      save,
      join,
      remove
    }
  });
});
