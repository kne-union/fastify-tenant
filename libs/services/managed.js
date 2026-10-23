const fp = require('fastify-plugin');
const pick = require('lodash/pick');
const { Forbidden } = require('http-errors');
const { createError } = require('../utils/intl');
const { normalizePhone } = require('../utils/phone');
const { withTransaction } = require('../utils/withTransaction');
const { getSequelize } = require('../utils/sequelize');
const { getManagedBy, isManagedTenant, resolveManagedTenantName } = require('../utils/managedTenant');

const TENANT_FIELDS = ['logo', 'themeColor', 'description', 'accountCount', 'supportLanguage', 'defaultLanguage', 'serviceStartTime', 'serviceEndTime'];
const COMPANY_FIELDS = ['fullName', 'logo', 'industry', 'scale', 'address', 'phone', 'email', 'foundedDate', 'companyTags', 'website', 'description', 'banners', 'teamDescription', 'developmentHistory', 'contact'];

/**
 * 宿主（如 fastify-oidc 主系统）同步过来的「托管租户」：
 * 基本信息、租户权限、角色、组织、成员只能通过 applySnapshot 写入，本地写接口一律拒绝
 */
module.exports = fp(async (fastify, options) => {
  const { models, services } = fastify[options.name];
  const { Op } = fastify.sequelize.Sequelize;

  const assertNotManaged = async tenantOrId => {
    const tenant = tenantOrId && typeof tenantOrId === 'object' ? tenantOrId : await models.tenant.findByPk(tenantOrId);
    if (isManagedTenant(tenant)) {
      throw createError(Forbidden, 'tenantManaged');
    }
  };

  const findByHostTenantId = async ({ issuer, hostTenantId }, { transaction } = {}) => {
    const candidates = await models.tenant.findAll({
      where: { options: { managedBy: { hostTenantId: String(hostTenantId) } } },
      transaction
    });
    return candidates.find(item => getManagedBy(item).issuer === issuer) || null;
  };

  const syncSourceOf = issuer => `oidc:${issuer}`;

  const sortOrgsByHierarchy = orgs => {
    const ids = new Set(orgs.map(org => String(org.id)));
    const sorted = [];
    const visited = new Set();
    const byId = new Map(orgs.map(org => [String(org.id), org]));
    const visit = org => {
      const id = String(org.id);
      if (visited.has(id)) {
        return;
      }
      visited.add(id);
      const parentId = org.parentId != null ? String(org.parentId) : null;
      if (parentId && ids.has(parentId)) {
        visit(byId.get(parentId));
      }
      sorted.push(org);
    };
    orgs.forEach(visit);
    return sorted;
  };

  const upsertTenant = async ({ issuer, snapshot, transaction }) => {
    const hostTenant = snapshot.tenant;
    const hostTenantId = String(hostTenant.id);
    let tenant = await findByHostTenantId({ issuer, hostTenantId }, { transaction });
    if (!tenant && !snapshot.enabled) {
      return null;
    }
    const isNameTaken = async name => {
      const row = await models.tenant.findOne({ where: { name }, transaction });
      return !!row && (!tenant || String(row.id) !== String(tenant.id));
    };
    const name = await resolveManagedTenantName(hostTenant.name, isNameTaken);
    const values = Object.assign({}, pick(hostTenant, TENANT_FIELDS), {
      name,
      status: snapshot.enabled && hostTenant.status !== 'closed' ? 'open' : 'closed',
      options: Object.assign({}, tenant?.options, {
        managedBy: Object.assign({ issuer, hostTenantId, syncedAt: new Date().toISOString() }, snapshot.files || tenant?.options?.managedBy?.files ? { files: snapshot.files || tenant.options.managedBy.files } : {})
      })
    });
    if (tenant) {
      await tenant.update(values, { transaction });
    } else {
      tenant = await models.tenant.create(values, { transaction });
    }
    await upsertCompany({ tenantId: tenant.id, hostTenant, transaction });
    return tenant;
  };

  // 旧宿主快照只有 companyName：仅在首次创建时用它建公司信息
  const upsertCompany = async ({ tenantId, hostTenant, transaction }) => {
    const company = await models.company.findOne({ where: { tenantId }, transaction });
    if (!hostTenant.company) {
      if (!company) {
        await models.company.create({ tenantId, name: hostTenant.companyName || hostTenant.name }, { transaction });
      }
      return;
    }
    const values = Object.assign(pick(hostTenant.company, COMPANY_FIELDS), { name: hostTenant.company.name || hostTenant.companyName || hostTenant.name });
    if (company) {
      await company.update(values, { transaction });
      return;
    }
    await models.company.create(Object.assign({ tenantId }, values), { transaction });
  };

  const savePermissions = async ({ tenantId, permissions, transaction }) => {
    const setting = await models.setting.findOne({ where: { tenantId }, transaction });
    if (setting) {
      await setting.update({ permissions }, { transaction });
      return;
    }
    await models.setting.create({ tenantId, permissions }, { transaction });
  };

  const upsertRoles = async ({ tenantId, roles, transaction }) => {
    const codeToId = new Map();
    for (const role of roles) {
      const values = pick(role, ['name', 'description', 'type', 'status', 'permissions']);
      let row = await models.role.findOne({ where: { tenantId, code: role.code }, transaction });
      if (row) {
        await row.update(values, { transaction });
      } else {
        row = await models.role.create(Object.assign({ tenantId, code: role.code }, values), { transaction });
      }
      codeToId.set(role.code, row.id);
    }
    const incoming = roles.map(role => role.code);
    await models.role.update({ status: 'closed' }, { where: { tenantId, type: { [Op.ne]: 'system' }, code: { [Op.notIn]: incoming.length ? incoming : [''] } }, transaction });
    return codeToId;
  };

  const upsertOrgs = async ({ tenantId, syncSource, orgs, transaction }) => {
    const sourceToId = new Map();
    for (const org of sortOrgsByHierarchy(orgs)) {
      const sourceId = String(org.id);
      const values = {
        name: org.name,
        description: org.description,
        index: org.index || 0,
        status: org.status === 'closed' ? 'closed' : 'open',
        parentId: org.parentId != null ? sourceToId.get(String(org.parentId)) || null : null
      };
      let row = await models.org.findOne({ where: { tenantId, syncSource, sourceId }, transaction });
      if (row) {
        await row.update(values, { transaction });
      } else {
        row = await models.org.create(Object.assign({ tenantId, synced: true, syncSource, sourceId, leaderUserId: null }, values), { transaction });
      }
      sourceToId.set(sourceId, row.id);
    }
    const incoming = [...sourceToId.keys()];
    await models.org.update({ status: 'closed' }, { where: { tenantId, syncSource, sourceId: { [Op.notIn]: incoming.length ? incoming : [''] } }, transaction });
    return sourceToId;
  };

  const upsertMembers = async ({ tenantId, syncSource, members, roleCodeToId, orgSourceToId, transaction }) => {
    const sourceToId = new Map();
    const sq = getSequelize(fastify);
    for (const member of members) {
      const sourceId = String(member.id);
      // 每个成员一个 SAVEPOINT：单条失败只回滚该成员，不影响整体同步
      const savepoint = await sq.transaction({ transaction });
      try {
        const values = {
          userId: member.userId,
          name: member.name,
          email: member.email || null,
          phone: member.phone ? normalizePhone(member.phone) : null,
          avatar: member.avatar || null,
          status: member.status === 'closed' ? 'closed' : 'open',
          roles: (member.roleCodes || []).map(code => roleCodeToId.get(code)).filter(Boolean),
          tenantOrgIds: (member.tenantOrgIds || []).map(id => orgSourceToId.get(String(id))).filter(Boolean)
        };
        let row = await models.user.findOne({ where: { tenantId, syncSource, sourceId }, transaction: savepoint });
        if (row) {
          await row.update(values, { transaction: savepoint });
        } else {
          row = await models.user.create(Object.assign({ tenantId, synced: true, syncSource, sourceId }, values), { transaction: savepoint });
        }
        if (member.userId && !(await models.userDefault.findOne({ where: { userId: member.userId }, transaction: savepoint }))) {
          await models.userDefault.create({ userId: member.userId, tenantId }, { transaction: savepoint });
        }
        await savepoint.commit();
        sourceToId.set(sourceId, row.id);
      } catch (e) {
        await savepoint.rollback().catch(() => {});
        fastify.log.warn({ err: e, tenantId, sourceId }, 'fastify-tenant: 同步托管租户成员失败');
      }
    }
    const incoming = members.map(member => String(member.id));
    await models.user.update({ status: 'closed' }, { where: { tenantId, syncSource, sourceId: { [Op.notIn]: incoming.length ? incoming : [''] } }, transaction });
    return sourceToId;
  };

  const assignLeaders = async ({ tenantId, orgs, orgSourceToId, memberSourceToId, transaction }) => {
    for (const org of orgs) {
      const orgId = orgSourceToId.get(String(org.id));
      if (!orgId) {
        continue;
      }
      const leaderUserId = org.leaderTenantUserId != null ? memberSourceToId.get(String(org.leaderTenantUserId)) || null : null;
      await models.org.update({ leaderUserId }, { where: { tenantId, id: orgId }, transaction });
    }
  };

  /**
   * snapshot: { tenant, enabled, permissions, roles, orgs, members }，其中 id 均为宿主侧 id，权限 code 已是本地 code
   * 宿主租户未开通本应用且本地也没有时不创建，返回 null
   */
  const applySnapshot = async ({ issuer, snapshot }) => {
    if (!issuer || !snapshot?.tenant?.id) {
      throw createError(null, 'managedSnapshotInvalid');
    }
    const syncSource = syncSourceOf(issuer);
    const result = await withTransaction(fastify, async transaction => {
      const tenant = await upsertTenant({ issuer, snapshot, transaction });
      if (!tenant || !snapshot.enabled) {
        // 未开通：租户已置为关闭，按租户通知全部成员
        return { tenant, userIds: undefined };
      }
      const tenantId = tenant.id;
      await savePermissions({ tenantId, permissions: snapshot.permissions || [], transaction });
      const roleCodeToId = await upsertRoles({ tenantId, roles: snapshot.roles || [], transaction });
      const orgs = snapshot.orgs || [];
      const orgSourceToId = await upsertOrgs({ tenantId, syncSource, orgs, transaction });
      const members = snapshot.members || [];
      const memberSourceToId = await upsertMembers({ tenantId, syncSource, members, roleCodeToId, orgSourceToId, transaction });
      await assignLeaders({ tenantId, orgs, orgSourceToId, memberSourceToId, transaction });
      return { tenant, userIds: members.map(member => member.userId).filter(Boolean) };
    });
    if (result.tenant) {
      await services.permissionChange?.notify({ tenantId: result.tenant.id, userIds: result.userIds, reason: 'managed-snapshot' });
      fastify[options.name].emitChange?.({ tenantId: result.tenant.id, type: 'snapshot' });
    }
    return result.tenant;
  };

  Object.assign(fastify[options.name].services, {
    managed: { isManagedTenant, assertNotManaged, findByHostTenantId, applySnapshot }
  });
});
