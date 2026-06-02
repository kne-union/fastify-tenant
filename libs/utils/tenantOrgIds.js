'use strict';

/**
 * @param {{ tenantOrgIds?: unknown }} user
 * @returns {string[]}
 */
const getUserOrgIds = user => {
  const ids = [];
  if (user && Array.isArray(user.tenantOrgIds)) {
    for (const id of user.tenantOrgIds) {
      if (id != null && id !== '') {
        ids.push(String(id));
      }
    }
  }
  return [...new Set(ids)];
};

/**
 * 从接口入参解析组织 id 列表。
 *
 * @param {{ tenantOrgIds?: unknown }} input
 * @returns {string[]}
 */
const pickOrgIdsFromInput = ({ tenantOrgIds }) => {
  const raw = [];
  const push = value => {
    if (value == null || value === '') {
      return;
    }
    if (typeof value === 'object' && value.id != null && value.id !== '') {
      raw.push(String(value.id));
      return;
    }
    raw.push(String(value));
  };

  if (tenantOrgIds != null) {
    const list = Array.isArray(tenantOrgIds) ? tenantOrgIds : [tenantOrgIds];
    list.forEach(push);
  }

  return [...new Set(raw.filter(Boolean))];
};

/**
 * 用户是否属于指定组织。
 *
 * @param {{ tenantOrgIds?: unknown }} user
 * @param {string} orgId
 */
const userBelongsToOrg = (user, orgId) => {
  const target = String(orgId);
  return getUserOrgIds(user).includes(target);
};

/**
 * @param {string[]} orgIds
 * @param {import('sequelize').Op} Op
 */
const buildUserOrgMembershipWhere = (orgIds, Op) => {
  const unique = [...new Set((orgIds || []).map(String).filter(Boolean))];
  if (!unique.length) {
    return null;
  }
  if (unique.length === 1) {
    return { tenantOrgIds: { [Op.contains]: [unique[0]] } };
  }
  return { [Op.or]: unique.map(oid => ({ tenantOrgIds: { [Op.contains]: [oid] } })) };
};

/**
 * @param {import('sequelize').Model} item
 * @param {Map<string, { id: string, name?: string, parentId?: string|null }>} orgById
 * @param {(orgId: string, orgById: Map) => string} buildOrgNamePath
 */
const attachUserOrgDisplay = (item, orgById, buildOrgNamePath) => {
  const orgIds = getUserOrgIds(item);
  const tenantOrgs = orgIds
    .map(id => {
      const org = orgById.get(id);
      if (!org) {
        return { id, name: id, path: id };
      }
      const path = buildOrgNamePath(id, orgById);
      return { id, name: org.name || id, path };
    })
    .filter(Boolean);
  const tenantOrgPath = tenantOrgs
    .map(o => o.path)
    .filter(Boolean)
    .join('；');
  item.setDataValue('tenantOrgIds', orgIds);
  item.setDataValue('tenantOrgs', tenantOrgs);
  item.setDataValue('tenantOrgPath', tenantOrgPath);
};

module.exports = {
  getUserOrgIds,
  pickOrgIdsFromInput,
  userBelongsToOrg,
  buildUserOrgMembershipWhere,
  attachUserOrgDisplay
};
