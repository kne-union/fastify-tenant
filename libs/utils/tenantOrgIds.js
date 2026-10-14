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

const quoteIdent = name => {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
    throw new Error(`invalid column: ${name}`);
  }
  return `"${name}"`;
};

/**
 * JSON 数组包含任意一个值。
 * PostgreSQL 用 JSONB `@>`（Op.contains）；SQLite 没有该运算符，改用 json_each。
 *
 * @param {string} attribute
 * @param {string} column
 * @param {string[]} values
 * @param {import('sequelize').Op} Op
 * @param {{ getDialect?: () => string, escape?: (value: unknown) => string, literal?: (value: string) => unknown } | undefined} sequelize
 */
const buildJsonArrayContainsWhere = (attribute, column, values, Op, sequelize) => {
  const unique = [...new Set((values || []).map(String).filter(Boolean))];
  if (!unique.length) {
    return null;
  }
  const dialect = sequelize && typeof sequelize.getDialect === 'function' ? sequelize.getDialect() : 'postgres';
  if (dialect === 'sqlite') {
    const clause = unique.map(value => `EXISTS (SELECT 1 FROM json_each(${quoteIdent(column)}) WHERE json_each.value = ${sequelize.escape(value)})`).join(' OR ');
    return { [Op.and]: [sequelize.literal(unique.length === 1 ? clause : `(${clause})`)] };
  }
  if (unique.length === 1) {
    return { [attribute]: { [Op.contains]: [unique[0]] } };
  }
  return { [Op.or]: unique.map(value => ({ [attribute]: { [Op.contains]: [value] } })) };
};

/**
 * @param {string[]} orgIds
 * @param {import('sequelize').Op} Op
 * @param {object} [sequelize]
 */
const buildUserOrgMembershipWhere = (orgIds, Op, sequelize) => buildJsonArrayContainsWhere('tenantOrgIds', 'tenant_org_ids', orgIds, Op, sequelize);

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
  buildJsonArrayContainsWhere,
  buildUserOrgMembershipWhere,
  attachUserOrgDisplay
};
