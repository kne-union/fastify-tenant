const fp = require('fastify-plugin');
const { Forbidden } = require('http-errors');
const { createError, createBusinessError } = require('../utils/intl');
const { normalizePhone, resolvePhoneFilterPattern } = require('../utils/phone');
const { escapeLike } = require('../utils/escapeLike');
const { collectOrgSubtreeIds } = require('../utils/dataScopeOrgIds');
const { buildOrgNamePath } = require('../utils/orgPath');
const { normalizeTenantUserStatus } = require('../utils/normalizeTenantUserStatus');
const { pickOrgIdsFromInput, buildUserOrgMembershipWhere, attachUserOrgDisplay, getUserOrgIds } = require('../utils/tenantOrgIds');
const findDataScopeByPermissionCode = require('../utils/findDataScopeByPermissionCode');
const get = require('lodash/get');
const {
  mergeThirdLoginOptions,
  clearThirdLoginOptions,
  findUserByThirdLoginBinding,
  findUserBySyncSourceId,
  assertThirdLoginBindingConflict,
  getThirdLoginFromOptions,
  listThirdLoginBindings,
  assertCanUnbindThirdLogin
} = require('../utils/thirdLoginBinding');

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
      throw createBusinessError('USER_EMAIL_DUPLICATE', 'emailDuplicate');
    }
    if (phone && !synced && (await models.user.count({ where: { phone, tenantId }, transaction })) > 0) {
      throw createBusinessError('USER_PHONE_DUPLICATE', 'phoneDuplicate');
    }
    if (!synced && !email && !phone) {
      throw createBusinessError('USER_CONTACT_REQUIRED', 'contactRequired');
    }

    let tenant;
    if (transaction) {
      tenant = await models.tenant.findByPk(tenantId, { transaction });
      if (!tenant) {
        throw createError(null, 'tenantNotFound');
      }
    } else {
      tenant = await services.tenant.detail({ id: tenantId, withTenantSetting: false });
    }
    const currentCount = await models.user.count({
      where: { tenantId: tenantId },
      transaction
    });

    if (currentCount >= tenant.accountCount) {
      throw createError(null, 'tenantUserLimitReached');
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
      throw createError(null, 'tenantUserNotFound');
    }
    if (tenantUser.tenantId !== tenantId) {
      throw createError(null, 'tenantUserNotFound');
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
      throw createError(null, 'tenantUserAlreadyLinked');
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
      throw createError(null, 'emailOrPhoneRequired');
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
      throw createError(null, 'inviteLinkUsed');
    }

    if ((await models.user.count({ where: { tenantId, userId: authenticatePayload.id } })) > 0) {
      throw createError(null, 'tenantAlreadyJoined');
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
      throw createError(null, 'operationNotAllowed');
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

  const coerceFilterString = raw => {
    if (raw == null || raw === '') {
      return '';
    }
    if (typeof raw === 'object') {
      const v = raw.value ?? raw.email ?? '';
      return v == null ? '' : String(v).trim();
    }
    return String(raw).trim();
  };

  const list = async ({ tenantId, filter = {}, perPage, currentPage }) => {
    const whereQuery = { tenantId };
    const keyword = coerceFilterString(filter.keyword);
    if (keyword) {
      const escaped = escapeLike(keyword);
      const like = { [Op.like]: `%${escaped}%` };
      const orConditions = [{ name: like }, { email: like }, { phone: like }, { description: like }];
      const phoneFromKeyword = resolvePhoneFilterPattern(keyword);
      if (phoneFromKeyword && phoneFromKeyword !== keyword) {
        orConditions.push({ phone: { [Op.like]: `%${escapeLike(phoneFromKeyword)}%` } });
      }
      whereQuery[Op.or] = orConditions;
    }
    const email = coerceFilterString(filter.email);
    if (email) {
      whereQuery.email = { [Op.like]: `%${escapeLike(email)}%` };
    }
    const phone = resolvePhoneFilterPattern(filter.phone);
    if (phone) {
      whereQuery.phone = { [Op.like]: `%${escapeLike(phone)}%` };
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
        throw createError(Forbidden, 'accessDenied');
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
      throw createError(null, 'tenantUserStatusInvalid');
    }
    const tenantUser = await detail({ tenantId, id });
    await tenantUser.update({ status: normalized });
    await services.permissionChange?.notify({ tenantId, userIds: [tenantUser.userId], reason: 'tenant-user-status' });

    return tenantUser;
  };

  const save = async ({ id, tenantId, tenantOrgIds: tenantOrgIdsInput, avatar, name, email, phone, roles = [], description, options }) => {
    const tenantUser = await detail({ tenantId, id });

    if (phone) {
      phone = normalizePhone(phone);
    }
    if (email && !tenantUser.synced && (await models.user.count({ where: { email, id: { [Op.not]: tenantUser.id }, tenantId } })) > 0) {
      throw createBusinessError('USER_EMAIL_DUPLICATE', 'emailDuplicate');
    }
    if (phone && !tenantUser.synced && (await models.user.count({ where: { phone, id: { [Op.not]: tenantUser.id }, tenantId } })) > 0) {
      throw createBusinessError('USER_PHONE_DUPLICATE', 'phoneDuplicate');
    }
    if (!tenantUser.synced && !email && !phone) {
      throw createBusinessError('USER_CONTACT_REQUIRED', 'contactRequired');
    }

    const checkedRoles = await services.role.checkRoles({ tenantId, roles });
    const rolesChanged = JSON.stringify(tenantUser.roles || []) !== JSON.stringify(checkedRoles || []);
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
    if (rolesChanged) {
      await services.permissionChange?.notify({ tenantId, userIds: [tenantUser.userId], reason: 'tenant-user-roles' });
    }

    return tenantUser;
  };

  const remove = async ({ id, tenantId }) => {
    const tenantUser = await detail({ tenantId, id });
    await models.org.update({ leaderUserId: null }, { where: { leaderUserId: id, tenantId } });
    await tenantUser.destroy();
    await services.permissionChange?.notify({ tenantId, userIds: [tenantUser.userId], reason: 'tenant-user-remove' });
  };

  const permissionList = async ({ tenantId, id }) => {
    const tenantUser = await detail({ tenantId, id });
    return await services.role.combinedPermissions({ tenantId, roles: tenantUser.roles });
  };

  const enrichTenantUserInfo = async tenantUser => {
    if (!tenantUser || tenantUser.status !== 'open') {
      throw createError(Forbidden, 'tenantUserUnavailable');
    }
    if (tenantUser.tenant?.status !== 'open') {
      throw createError(Forbidden, 'tenantUnavailable');
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
    let tenantId = authenticatePayload.tenantId;
    if (!tenantId) {
      const tenantUserDefault = await models.userDefault.findOne({
        where: { userId: authenticatePayload.id }
      });
      if (!tenantUserDefault) {
        throw createError(Forbidden, 'defaultTenantNotSet');
      }
      tenantId = tenantUserDefault.tenantId;
    }
    const tenantUser = await models.user.findOne({
      include: tenantUserInclude,
      where: { tenantId, userId: authenticatePayload.id, status: 'open' }
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
        throw createError(null, 'bindLinkInvalidOrExpired');
      }
      if (payload.purpose !== 'third-login-bind' || String(payload.tenantId) !== String(tenantId)) {
        throw createError(null, 'bindLinkInvalid');
      }
      if (payload.platform && payload.platform !== platform) {
        throw createError(null, 'bindPlatformMismatch');
      }

      const thirdLoginConfig = await services.thirdLogin.getConfig({
        tenantId,
        type: platform,
        targetId: props.targetId || payload.targetId
      });
      if (!thirdLoginConfig.enabled) {
        throw createError(null, 'thirdLoginChannelNotConfigured');
      }

      const targetUser = await models.user.findOne({
        where: { id: payload.id, tenantId, status: 'open' }
      });
      if (!targetUser) {
        throw createError(null, 'userNotFoundOrClosed');
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
      throw createError(null, 'thirdLoginChannelNotConfigured');
    }

    // 绑定用真实 OAuth userid；查找用 result.id（北森场景下已被改写为 user.sourceId）
    const bindSourceId = String(thirdLoginResult.oauthUserId || thirdLoginResult.id);
    const syncLookupId = String(thirdLoginResult.id);

    // 1) Already bound: options.thirdLogin[platform].sourceId
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
      throw createError(null, 'userNotFoundOrUnbound');
    }

    const existingBinding = getThirdLoginFromOptions(user.options, platform);
    if (!existingBinding) {
      await assertThirdLoginBindingConflict({
        models,
        tenantId,
        platform,
        sourceId: bindSourceId,
        excludeUserId: user.id
      });
      user.options = mergeThirdLoginOptions(user.options, platform, bindSourceId);
    } else if (existingBinding.sourceId !== bindSourceId) {
      throw createError(null, 'userBoundOtherThirdAccount');
    }

    applyThirdLoginProfile(user, thirdLoginResult);
    await user.save();
    return user;
  };

  const getThirdLoginUrl = async ({ tenantId, platform, redirect, bindToken, targetId }) => {
    const tenant = await services.tenant.detail({ id: tenantId });
    if (typeof options?.thirdLogin?.getThirdLoginUrl !== 'function') {
      throw createError(null, 'tenantThirdLoginUnsupported');
    }

    const config = await services.thirdLogin.getConfig({ tenantId, type: platform, targetId });
    if (!config.enabled) {
      throw createError(null, 'thirdLoginConfigInvalid');
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
              throw createError(null, 'tenantParamsIncomplete');
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
      throw createError(null, 'tenantIdRequired');
    }
    if (typeof options?.thirdLogin?.getThirdLoginResult !== 'function') {
      throw createError(null, 'tenantThirdLoginUnsupported');
    }

    let resultProps = props;
    if (props.platform) {
      const config = await services.thirdLogin.getConfig({
        tenantId: props.tenantId,
        type: props.platform,
        targetId: props.targetId
      });
      if (!config.enabled) {
        throw createError(null, 'thirdLoginConfigInvalid');
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
      throw createError(null, 'userIdRequired');
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
        throw createError(null, 'thirdLoginPlatformRequired');
      }
    }

    const config = await services.thirdLogin.getConfig({
      tenantId,
      type: resolvedPlatform,
      targetId: resolvedTargetId
    });
    if (!config.enabled) {
      throw createError(null, 'thirdLoginChannelNotConfigured');
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

  const thirdLoginUnbind = async ({ tenantId, id, tenantUserId, platform }) => {
    const targetUserId = id || tenantUserId;
    if (!targetUserId) {
      throw createError(null, 'userIdRequired');
    }
    const tenantUser = await detail({ tenantId, id: targetUserId });

    if (platform) {
      assertCanUnbindThirdLogin({ user: tenantUser, platform });
      await tenantUser.update({
        options: clearThirdLoginOptions(tenantUser.options, platform)
      });
      return {};
    }

    const bindings = listThirdLoginBindings(tenantUser.options);
    const locked = tenantUser.syncSource ? String(tenantUser.syncSource) : null;
    const removable = bindings.filter(item => !locked || item.platform !== locked);
    if (removable.length === 0) {
      if (locked && bindings.some(item => item.platform === locked)) {
        throw createError(null, 'sourceChannelNotUnbindable');
      }
      return {};
    }

    let nextOptions = tenantUser.options;
    removable.forEach(item => {
      nextOptions = clearThirdLoginOptions(nextOptions, item.platform);
    });
    await tenantUser.update({ options: nextOptions });
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
