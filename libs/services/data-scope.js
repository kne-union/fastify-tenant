const fp = require('fastify-plugin');
const { collectOrgSubtreeIds } = require('../utils/dataScopeOrgIds');
const findDataScopeByPermissionCode = require('../utils/findDataScopeByPermissionCode');
const { normalizeDataScopeType } = require('../utils/normalizeDataScopeType');
const { getUserOrgIds, buildUserOrgMembershipWhere } = require('../utils/tenantOrgIds');

/** @typedef {'self' | 'owner' | 'org' | 'orgSubtree'} DataScopeType */

module.exports = fp(async (fastify, options) => {
  const { models, services, permissions } = fastify[options.name];
  const { Op } = fastify.sequelize.Sequelize;

  const pickScopeMode = ({ scope, type }) => normalizeDataScopeType(type || scope, 'self');

  /**
   * 本人 + 作为部门负责人（leaderUserId）所辖部门及其子部门内的全部租户用户。
   */
  const resolveOwnerScopeTenantUserIds = async ({ tenantId, currentTenantUserId, transaction }) => {
    const ids = new Set([String(currentTenantUserId)]);

    const orgRows = await models.org.findAll({
      where: { tenantId },
      attributes: ['id', 'parentId', 'leaderUserId'],
      transaction
    });
    const ledRootIds = orgRows.filter(o => o.leaderUserId != null && String(o.leaderUserId) === String(currentTenantUserId)).map(o => String(o.id));

    if (!ledRootIds.length) {
      return [...ids];
    }

    const orgNodes = orgRows.map(o => ({ id: o.id, parentId: o.parentId }));
    const orgIdSet = new Set();
    for (const rootId of ledRootIds) {
      for (const id of collectOrgSubtreeIds(orgNodes, rootId)) {
        orgIdSet.add(String(id));
      }
    }

    if (!orgIdSet.size) {
      return [...ids];
    }

    const orgMembershipWhere = buildUserOrgMembershipWhere([...orgIdSet], Op);
    if (orgMembershipWhere) {
      const users = await models.user.findAll({
        where: { tenantId, ...orgMembershipWhere },
        attributes: ['id'],
        transaction
      });
      users.forEach(u => ids.add(String(u.id)));
    }
    return [...ids];
  };

  /**
   * 按组织范围解析可见的租户用户 id（不含共享组扩展）。
   * @param {{ tenantId: string, currentTenantUserId: string, scope?: DataScopeType, type?: DataScopeType, transaction?: import('sequelize').Transaction }} p
   * @returns {Promise<string[]>}
   */
  const resolveOrgRuleTenantUserIds = async ({ tenantId, currentTenantUserId, scope, type, transaction }) => {
    await services.tenant.detail({ id: tenantId, withTenantSetting: false });

    const mode = pickScopeMode({ scope, type });

    if (mode === 'self') {
      return [String(currentTenantUserId)];
    }

    const me = await models.user.findOne({
      where: { id: currentTenantUserId, tenantId },
      attributes: ['id', 'tenantOrgIds'],
      transaction
    });
    if (!me) {
      throw new Error('当前租户用户不存在');
    }

    if (mode === 'owner') {
      return resolveOwnerScopeTenantUserIds({ tenantId, currentTenantUserId, transaction });
    }

    if (mode === 'org') {
      const myOrgIds = getUserOrgIds(me);
      if (!myOrgIds.length) {
        return [String(currentTenantUserId)];
      }
      const orgMembershipWhere = buildUserOrgMembershipWhere(myOrgIds, Op);
      const rows = await models.user.findAll({
        where: { tenantId, ...orgMembershipWhere },
        attributes: ['id'],
        transaction
      });
      const ids = [...new Set(rows.map(r => String(r.id)))];
      return ids.length ? ids : [String(currentTenantUserId)];
    }

    if (mode === 'orgSubtree') {
      const myOrgIds = getUserOrgIds(me);
      if (!myOrgIds.length) {
        return [String(currentTenantUserId)];
      }
      const orgRows = await models.org.findAll({
        where: { tenantId },
        attributes: ['id', 'parentId'],
        transaction
      });
      const orgNodes = orgRows.map(o => ({ id: o.id, parentId: o.parentId }));
      const scopeOrgIds = new Set();
      for (const rootId of myOrgIds) {
        for (const id of collectOrgSubtreeIds(orgNodes, rootId)) {
          scopeOrgIds.add(String(id));
        }
      }
      const orgIds = [...scopeOrgIds];
      if (!orgIds.length) {
        return [String(currentTenantUserId)];
      }
      const orgMembershipWhere = buildUserOrgMembershipWhere(orgIds, Op);
      const users = await models.user.findAll({
        where: { tenantId, ...orgMembershipWhere },
        attributes: ['id'],
        transaction
      });
      const ids = [...new Set(users.map(u => String(u.id)))];
      return ids.length ? ids : [String(currentTenantUserId)];
    }

    throw new Error(`未知的数据范围 type/scope: ${mode}`);
  };

  /**
   * 当前用户作为成员、且 sharedModules 含指定模块的共享组，合并其「数据来源」用户 id。
   * @param {{ tenantId: string, currentTenantUserId: string, moduleCode: string, transaction?: import('sequelize').Transaction }} p
   * @returns {Promise<string[]>}
   */
  const resolveSharedGroupDataSourceUserIds = async ({ tenantId, currentTenantUserId, moduleCode, transaction }) => {
    if (!moduleCode || !String(moduleCode).trim()) {
      return [];
    }
    const code = String(moduleCode).trim();

    const memberRows = await models.sharedGroupMember.findAll({
      where: { tenantUserId: currentTenantUserId },
      attributes: ['sharedGroupId'],
      transaction
    });
    const groupIds = [...new Set(memberRows.map(r => String(r.sharedGroupId)).filter(Boolean))];
    if (!groupIds.length) {
      return [];
    }

    const groups = await models.sharedGroup.findAll({
      where: {
        tenantId,
        status: 'open',
        id: { [Op.in]: groupIds }
      },
      attributes: ['id', 'sharedModules'],
      transaction
    });

    const matchedGroupIds = [];
    for (const g of groups) {
      const mods = g.sharedModules;
      if (!Array.isArray(mods)) {
        continue;
      }
      if (mods.some(m => m && String(m.moduleCode || '').trim() === code)) {
        matchedGroupIds.push(String(g.id));
      }
    }
    if (!matchedGroupIds.length) {
      return [];
    }

    const ds = await models.sharedGroupDataSource.findAll({
      where: { sharedGroupId: { [Op.in]: matchedGroupIds } },
      attributes: ['tenantUserId'],
      transaction
    });
    return [...new Set(ds.map(r => String(r.tenantUserId)).filter(Boolean))];
  };

  /**
   * 合并组织规则与共享组数据来源，返回去重后的租户用户 id 列表。
   */
  const resolveVisibleTenantUserIds = async ({ tenantId, currentTenantUserId, scope, type, moduleCode, transaction }) => {
    const base = await resolveOrgRuleTenantUserIds({ tenantId, currentTenantUserId, scope, type, transaction });
    const extra = moduleCode ? await resolveSharedGroupDataSourceUserIds({ tenantId, currentTenantUserId, moduleCode, transaction }) : [];
    return [...new Set([...base, ...extra])];
  };

  /**
   * 生成 Sequelize where 片段：`{ [fieldKey]: { [Op.in]: ids } }`。
   * ids 为空时使用不可能匹配的占位，避免部分数据库对 `IN ()` 的兼容问题。
   */
  const buildInWhere = (fieldKey, ids) => {
    const key = fieldKey && String(fieldKey).trim() ? String(fieldKey).trim() : 'createdUserId';
    const list = [...new Set((ids || []).map(String).filter(Boolean))];
    const values = list.length ? list : ['__data_scope_empty__'];
    return { [key]: { [Op.in]: values } };
  };

  /**
   * 数据权限：组织范围 + 可选共享组数据来源，返回可直接并入查询条件的对象。
   * 租户管理员（system + admin）：allVisible=true，where 为空，不计算 tenantUserIds。
   *
   * @param {{
   *   tenantId: string,
   *   currentTenantUserId: string,
   *   roleDetails?: Array<{ type?: string, code?: string }>,
   *   scope?: DataScopeType,
   *   type?: DataScopeType,
   *   fieldKey?: string,
   *   moduleCode?: string,
   *   transaction?: import('sequelize').Transaction
   * }} p
   * @returns {Promise<{ allVisible: boolean, tenantUserIds: string[], where: Record<string, unknown> }>}
   */
  const buildRowScopeWhere = async ({ tenantId, currentTenantUserId, roleDetails, roles, scope, type, fieldKey, moduleCode, transaction }) => {
    if (await services.user.resolveIsTenantAdmin({ tenantId, roleDetails, roles, currentTenantUserId })) {
      return { allVisible: true, tenantUserIds: [], where: {} };
    }
    const tenantUserIds = await resolveVisibleTenantUserIds({
      tenantId,
      currentTenantUserId,
      scope,
      type,
      moduleCode,
      transaction
    });
    const where = buildInWhere(fieldKey, tenantUserIds);
    return { allVisible: false, tenantUserIds, where };
  };

  /**
   * 按权限功能 code 读取模块 dataScope.type，解析可见租户用户 id（含共享组数据来源）。
   *
   * @param {{
   *   tenantId: string,
   *   currentTenantUserId: string,
   *   permissionCode: string,
   *   permissions?: { modules?: Array<Record<string, unknown>> },
   *   transaction?: import('sequelize').Transaction
   * }} p
   * @returns {Promise<{ tenantUserIds: string[], moduleCode: string | null, type: DataScopeType, dataScopeOpen: boolean }>}
   */
  const resolveTenantUserIdsByPermissionCode = async ({ tenantId, currentTenantUserId, permissionCode, permissions: permissionsTree, transaction }) => {
    const tree = permissionsTree || permissions;
    const found = findDataScopeByPermissionCode(tree, permissionCode);
    if (!found) {
      throw new Error(`未找到权限: ${permissionCode}`);
    }

    const ds = found.dataScope;
    const dataScopeOpen = !!(ds && ds.open === true);
    if (!dataScopeOpen) {
      const tenantUserIds = await resolveOrgRuleTenantUserIds({
        tenantId,
        currentTenantUserId,
        type: 'self',
        transaction
      });
      return {
        tenantUserIds,
        moduleCode: found.moduleCode,
        type: 'self',
        dataScopeOpen: false
      };
    }

    const scopeType = normalizeDataScopeType(ds.type, 'self');
    const tenantUserIds = await resolveVisibleTenantUserIds({
      tenantId,
      currentTenantUserId,
      type: scopeType,
      moduleCode: found.moduleCode,
      transaction
    });

    return {
      tenantUserIds,
      moduleCode: found.moduleCode,
      type: scopeType,
      dataScopeOpen: true
    };
  };

  /**
   * 数据权限入口（供 HTTP /data-permission）：租户管理员 allVisible=true 且不计算 ids。
   */
  const resolveDataPermission = async ({ tenantId, currentTenantUserId, roleDetails, roles, type, moduleCode, transaction }) => {
    const resolvedModuleCode = moduleCode != null && String(moduleCode).trim() ? String(moduleCode).trim() : null;
    if (await services.user.resolveIsTenantAdmin({ tenantId, roleDetails, roles, currentTenantUserId })) {
      return { allVisible: true, tenantUserIds: [], type, moduleCode: resolvedModuleCode };
    }
    const tenantUserIds = resolvedModuleCode
      ? await resolveVisibleTenantUserIds({ tenantId, currentTenantUserId, type, moduleCode: resolvedModuleCode, transaction })
      : await resolveOrgRuleTenantUserIds({ tenantId, currentTenantUserId, type, transaction });
    return { allVisible: false, tenantUserIds, type, moduleCode: resolvedModuleCode };
  };

  /**
   * 按权限码的数据权限入口（供 HTTP /data-permission-by-code）：租户管理员 allVisible=true 且不计算 ids。
   */
  const resolveDataPermissionByCode = async ({ tenantId, currentTenantUserId, roleDetails, roles, permissionCode, permissions: permissionsTree, transaction }) => {
    if (await services.user.resolveIsTenantAdmin({ tenantId, roleDetails, roles, currentTenantUserId })) {
      const tree = permissionsTree || permissions;
      const found = findDataScopeByPermissionCode(tree, permissionCode);
      if (!found) {
        throw new Error(`未找到权限: ${permissionCode}`);
      }
      const ds = found.dataScope;
      const dataScopeOpen = !!(ds && ds.open === true);
      const scopeType = dataScopeOpen ? normalizeDataScopeType(ds.type, 'self') : 'self';
      return {
        allVisible: true,
        tenantUserIds: [],
        moduleCode: found.moduleCode,
        type: scopeType,
        dataScopeOpen
      };
    }
    const result = await resolveTenantUserIdsByPermissionCode({
      tenantId,
      currentTenantUserId,
      permissionCode,
      permissions: permissionsTree,
      transaction
    });
    return { ...result, allVisible: false };
  };

  Object.assign(fastify[options.name].services, {
    dataScope: {
      resolveOwnerScopeTenantUserIds,
      resolveOrgRuleTenantUserIds,
      resolveSharedGroupDataSourceUserIds,
      resolveVisibleTenantUserIds,
      resolveTenantUserIdsByPermissionCode,
      resolveDataPermission,
      resolveDataPermissionByCode,
      buildInWhere,
      buildRowScopeWhere
    }
  });
});
