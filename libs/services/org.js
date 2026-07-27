const fp = require('fastify-plugin');
const { mergeThirdLoginTypeOptions } = require('../utils/thirdLoginBinding');
const { getSequelize } = require('../utils/sequelize');
const { ROW_TYPE_ORG, ROW_TYPE_USER, normalizeImportRows } = require('../utils/orgImportRows');
const { orgLevelKey, collectOrgIdsByName } = require('../utils/orgLevel');
const { buildOrgSubtreeUserCounts } = require('../utils/orgUserCount');
const { buildUserOrgMembershipWhere, userBelongsToOrg, pickOrgIdsFromInput } = require('../utils/tenantOrgIds');
const { normalizeLeaderUserId } = require('../utils/normalizeLeaderUserId');
const { withTransaction } = require('../utils/withTransaction');

module.exports = fp(async (fastify, options) => {
  const { models, services } = fastify[options.name];
  const { Op } = fastify.sequelize.Sequelize;

  const leaderInclude = {
    model: models.user,
    as: 'leader',
    attributes: ['id', 'name', 'email', 'phone', 'avatar', 'status']
  };

  /**
   * @param {{ tenantId: string, leaderUserId?: string|null, orgId?: string|null, autoEnroll?: boolean, transaction?: import('sequelize').Transaction }} p
   */
  const assertLeaderUser = async ({ tenantId, leaderUserId, orgId, autoEnroll = false, transaction }) => {
    if (leaderUserId == null || leaderUserId === '') {
      return;
    }
    const u = await models.user.findByPk(leaderUserId, { transaction });
    if (!u || u.tenantId !== tenantId) {
      throw new Error('负责人不存在或不属于当前租户');
    }
    if (!orgId) {
      return;
    }
    const orgIdStr = String(orgId);
    if (userBelongsToOrg(u, orgIdStr)) {
      return;
    }
    if (autoEnroll) {
      const newOrgIds = [...(Array.isArray(u.tenantOrgIds) ? u.tenantOrgIds : []), orgIdStr];
      const tenantOrgIds = pickOrgIdsFromInput({ tenantOrgIds: newOrgIds });
      await u.update({ tenantOrgIds }, { transaction });
      return;
    }
    throw new Error('负责人必须是当前部门的成员');
  };

  const list = async ({ tenantId, status }) => {
    const where = { tenantId };
    if (status !== undefined) {
      where.status = status;
    } else {
      where.status = 'open';
    }
    const orgs = await models.org.findAll({
      where,
      include: [leaderInclude],
      order: [['createdAt', 'ASC']]
    });
    const orgRows = orgs.map(o => ({ id: o.id, parentId: o.parentId }));
    const userWhere = { tenantId };
    if (status !== undefined) {
      userWhere.status = status;
    } else {
      userWhere.status = 'open';
    }
    const users = await models.user.findAll({
      where: userWhere,
      attributes: ['tenantOrgIds'],
      raw: true
    });
    const userCountMap = buildOrgSubtreeUserCounts(orgRows, users);
    orgs.forEach(org => {
      const userCount = userCountMap.get(String(org.id)) || 0;
      if (typeof org.setDataValue === 'function') {
        org.setDataValue('userCount', userCount);
      }
      org.userCount = userCount;
    });
    return orgs;
  };

  const detail = async ({ id, transaction } = {}) => {
    const org = await models.org.findByPk(id, { include: [leaderInclude], transaction });
    if (!org) {
      throw new Error('组织不存在');
    }
    return org;
  };

  const assertUniqueOrgNameAtLevel = async ({ tenantId, parentId, name, excludeOrgId, transaction }) => {
    const where = {
      tenantId,
      name: String(name).trim(),
      parentId: parentId || null
    };
    if (excludeOrgId) {
      where.id = { [Op.ne]: excludeOrgId };
    }
    const count = await models.org.count({ where, transaction });
    if (count > 0) {
      throw new Error('同级下已存在相同名称的组织');
    }
  };

  const resolveParentIdByOrgName = async ({ tenantId, parentOrgName, orgPathToId, transaction }) => {
    const batchIds = collectOrgIdsByName(orgPathToId, parentOrgName);
    if (batchIds.length > 1) {
      throw new Error(`上级组织名称「${parentOrgName}」在本批数据中对应多个节点，无法唯一确定`);
    }
    if (batchIds.length === 1) {
      return batchIds[0];
    }
    const dbParents = await models.org.findAll({
      where: { tenantId, name: parentOrgName, status: 'open' },
      transaction
    });
    if (dbParents.length === 0) {
      throw new Error(`找不到上级组织「${parentOrgName}」`);
    }
    if (dbParents.length > 1) {
      throw new Error(`上级组织名称「${parentOrgName}」在租户内存在多个节点，无法唯一确定`);
    }
    return dbParents[0].id;
  };

  const create = async ({ tenantId, parentId, name, description, leaderUserId: leaderUserIdRaw }) => {
    const leaderUserId = normalizeLeaderUserId(leaderUserIdRaw);
    await services.tenant.detail({ id: tenantId, withTenantSetting: false });
    if (parentId) {
      await detail({ id: parentId });
    }
    await assertUniqueOrgNameAtLevel({ tenantId, parentId, name });
    await assertLeaderUser({ tenantId, leaderUserId });
    const org = await models.org.create({
      tenantId,
      parentId,
      name,
      description,
      leaderUserId: null
    });
    if (leaderUserId) {
      await assertLeaderUser({ tenantId, leaderUserId, orgId: org.id, autoEnroll: true });
      await org.update({ leaderUserId });
    }
    return org;
  };

  const remove = async ({ tenantId, id }) => {
    await services.tenant.detail({ id: tenantId, withTenantSetting: false });
    const org = await detail({ id });
    if (org.tenantId !== tenantId) {
      throw new Error('操作失败');
    }
    if ((await models.org.count({ where: { tenantId, parentId: id } })) > 0) {
      throw new Error('请先删除所有子节点再进行操作');
    }
    const orgMembershipWhere = buildUserOrgMembershipWhere([id], Op);
    if (
      orgMembershipWhere &&
      (await models.user.count({
        where: { tenantId, ...orgMembershipWhere }
      })) > 0
    ) {
      throw new Error('请先移除当前组织下所有用户再进行操作');
    }
    await org.destroy();
  };

  const save = async ({ tenantId, id, ...data }) => {
    await services.tenant.detail({ id: tenantId, withTenantSetting: false });
    const org = await detail({ id });
    if (org.tenantId !== tenantId) {
      throw new Error('操作失败');
    }
    const patch = { ...data };
    if (Object.prototype.hasOwnProperty.call(data, 'leaderUserId')) {
      patch.leaderUserId = normalizeLeaderUserId(data.leaderUserId);
      await assertLeaderUser({ tenantId, leaderUserId: patch.leaderUserId, orgId: id, autoEnroll: true });
    }
    const nextName = Object.prototype.hasOwnProperty.call(patch, 'name') ? patch.name : org.name;
    const nextParentId = Object.prototype.hasOwnProperty.call(patch, 'parentId') ? patch.parentId : org.parentId;
    if (nextName !== org.name || nextParentId !== org.parentId) {
      await assertUniqueOrgNameAtLevel({
        tenantId,
        parentId: nextParentId,
        name: nextName,
        excludeOrgId: id
      });
    }
    return await org.update(patch);
  };

  const enums = async (authenticatePayload, { ids, names }) => {
    const { tenantId } = authenticatePayload;
    const whereQuery = {
      tenantId,
      status: 'open',
      [Op.or]: [{ id: { [Op.in]: ids || [] } }, { name: { [Op.in]: names || [] } }]
    };
    const positions = await models.org.findAll({
      where: whereQuery
    });

    return positions.map(item => {
      return {
        value: item.id,
        description: item.name
      };
    });
  };

  const resolveOrgIdByName = async ({ tenantId, orgName, orgPathToId, transaction }) => {
    const ids = new Set(collectOrgIdsByName(orgPathToId, orgName));
    const dbOrgs = await models.org.findAll({
      where: { tenantId, name: orgName, status: 'open' },
      transaction
    });
    dbOrgs.forEach(o => {
      if (o.name === orgName) {
        ids.add(o.id);
      }
    });
    if (ids.size === 0) {
      throw new Error(`找不到组织「${orgName}」`);
    }
    if (ids.size > 1) {
      throw new Error(`组织名称「${orgName}」对应多个节点，请确保名称在租户内唯一或调整 Excel 后重试`);
    }
    return [...ids][0];
  };

  const assertImportUserContactUnique = async ({ tenantId, row, batchEmails, batchPhones, transaction }) => {
    if (row.email) {
      if (batchEmails.has(row.email)) {
        throw new Error(`第 ${row.sourceIndex} 条：邮箱「${row.email}」在本批数据中重复`);
      }
      batchEmails.add(row.email);
      const emailUsed = await models.user.findOne({
        where: { tenantId, email: row.email },
        transaction
      });
      if (emailUsed) {
        throw new Error(`第 ${row.sourceIndex} 条：邮箱「${row.email}」已被使用`);
      }
    }
    if (row.phone) {
      if (batchPhones.has(row.phone)) {
        throw new Error(`第 ${row.sourceIndex} 条：手机号「${row.phone}」在本批数据中重复`);
      }
      batchPhones.add(row.phone);
      const phoneUsed = await models.user.findOne({
        where: { tenantId, phone: row.phone },
        transaction
      });
      if (phoneUsed) {
        throw new Error(`第 ${row.sourceIndex} 条：手机号「${row.phone}」已被使用`);
      }
    }
  };

  const createTenantUserForOrg = async ({ tenantId, row, orgId, batchEmails, batchPhones, transaction }) => {
    await assertImportUserContactUnique({ tenantId, row, batchEmails, batchPhones, transaction });
    const created = await services.user.create({
      tenantId,
      name: row.userName,
      email: row.email || undefined,
      phone: row.phone || undefined,
      tenantOrgIds: [orgId],
      roles: [],
      description: row.description || null,
      transaction
    });
    return created.id;
  };

  const importFromRows = async ({ tenantId, parentOrgId, rows }) => {
    await services.tenant.detail({ id: tenantId, withTenantSetting: false });
    const anchorParentId = parentOrgId || null;
    const effective = normalizeImportRows(rows);
    const orgRows = effective.filter(r => r.rowType === ROW_TYPE_ORG);
    const userRows = effective.filter(r => r.rowType === ROW_TYPE_USER);

    const sq = getSequelize(fastify);
    const t = await sq.transaction();

    if (anchorParentId) {
      const p = await detail({ id: anchorParentId, transaction: t });
      if (p.tenantId !== tenantId) {
        throw new Error('锚点组织不属于当前租户');
      }
    }

    const orgPathToId = new Map();
    const batchEmails = new Set();
    const batchPhones = new Set();
    let createdOrgs = 0;
    let createdUsers = 0;

    try {
      for (const row of orgRows) {
        const orgName = row.orgName;
        let parentId = anchorParentId;
        if (row.parentOrgName) {
          try {
            parentId = await resolveParentIdByOrgName({
              tenantId,
              parentOrgName: row.parentOrgName,
              orgPathToId,
              transaction: t
            });
          } catch (e) {
            throw new Error(`第 ${row.sourceIndex} 条：${e.message}`);
          }
        }

        const levelKey = orgLevelKey(parentId, orgName);
        if (orgPathToId.has(levelKey)) {
          throw new Error(`第 ${row.sourceIndex} 条：同级下组织名称「${orgName}」在本批数据中重复`);
        }
        try {
          await assertUniqueOrgNameAtLevel({ tenantId, parentId, name: orgName, transaction: t });
        } catch (e) {
          throw new Error(`第 ${row.sourceIndex} 条：${e.message}`);
        }

        const orgRow = await models.org.create(
          {
            tenantId,
            parentId,
            name: orgName,
            description: row.description,
            leaderUserId: null
          },
          { transaction: t }
        );
        orgPathToId.set(levelKey, orgRow.id);
        createdOrgs++;
      }

      for (const row of userRows) {
        let orgId;
        try {
          orgId = await resolveOrgIdByName({ tenantId, orgName: row.orgName, orgPathToId, transaction: t });
        } catch (e) {
          throw new Error(`第 ${row.sourceIndex} 条：${e.message}（请先导入该组织或确认名称正确）`);
        }

        const userId = await createTenantUserForOrg({
          tenantId,
          row,
          orgId,
          batchEmails,
          batchPhones,
          transaction: t
        });
        createdUsers++;

        if (row.isLeader) {
          const orgRow = await models.org.findByPk(orgId, { transaction: t });
          if (orgRow.leaderUserId && orgRow.leaderUserId !== userId) {
            throw new Error(`第 ${row.sourceIndex} 条：组织「${row.orgName}」已有负责人`);
          }
          await assertLeaderUser({ tenantId, leaderUserId: userId, orgId, transaction: t });
          await orgRow.update({ leaderUserId: userId }, { transaction: t });
        }
      }

      await t.commit();
    } catch (e) {
      await t.rollback();
      throw e;
    }

    return {
      createdOrgs,
      createdUsers,
      rowCount: effective.length
    };
  };

  const syncOrg = async ({ tenantId, syncSource, orgs, users }, outerTransaction) => {
    return withTransaction(
      fastify,
      async transaction => {
        const trans = outerTransaction || transaction;
        const sourceIdToLocalId = new Map();
        let syncedOrgs = 0;
        let syncedUsers = 0;

        // 收集本次同步数据中的 sourceId
        const incomingOrgSourceIds = new Set(orgs.map(o => o.sourceId));
        const incomingUserSourceIds = new Set(users.map(u => u.sourceId));

        // 1. 处理组织：按层级顺序创建/更新
        for (const orgData of orgs) {
          const { sourceId, parentSourceId, name, description, ...rest } = orgData;
          // 查找本地parentId
          let parentId = null;
          if (parentSourceId) {
            parentId = sourceIdToLocalId.get(parentSourceId) || null;
          }

          // 查找是否已存在同源同sourceId的组织
          let org = await models.org.findOne({
            where: { tenantId, syncSource, sourceId },
            transaction: trans
          });

          if (org) {
            // 更新
            await org.update(
              {
                name,
                description,
                parentId,
                status: 'open',
                ...rest
              },
              { transaction: trans }
            );
          } else {
            // 创建
            org = await models.org.create(
              {
                tenantId,
                parentId,
                name,
                description,
                status: 'open',
                synced: true,
                syncSource,
                sourceId,
                ...rest
              },
              { transaction: trans }
            );
          }

          sourceIdToLocalId.set(sourceId, org.id);
          syncedOrgs++;
        }

        // 2. 关闭不在本次同步数据中的组织
        await models.org.update(
          { status: 'closed' },
          {
            where: {
              tenantId,
              syncSource,
              sourceId: { [Op.notIn]: [...incomingOrgSourceIds] },
              status: 'open'
            },
            transaction: trans
          }
        );

        // 3. 处理用户
        for (const userData of users) {
          try {
            const { sourceId, orgSourceId, name, email, phone, ...rest } = userData;
            // 查找对应的组织
            const orgId = orgSourceId ? sourceIdToLocalId.get(orgSourceId) || null : null;

            // 查找是否已存在同源同sourceId的用户
            let tenantUser = await models.user.findOne({
              where: { tenantId, syncSource, sourceId },
              transaction: trans
            });

            if (tenantUser) {
              // 更新
              const updateData = {
                name,
                status: 'open',
                // org-sync should only sync org/user data; third-party id binding happens in third-login-result
                // after OAuth verification.
                options: mergeThirdLoginTypeOptions(tenantUser.options, syncSource),
                ...rest
              };
              if (orgId) {
                const existingOrgIds = Array.isArray(tenantUser.tenantOrgIds) ? tenantUser.tenantOrgIds : [];
                if (!existingOrgIds.includes(orgId)) {
                  existingOrgIds.push(orgId);
                }
                updateData.tenantOrgIds = existingOrgIds;
              }
              await tenantUser.update(updateData, { transaction: trans });
            } else {
              // 创建
              const tenantOrgIds = orgId ? [orgId] : [];
              tenantUser = await services.user.create({
                tenantId,
                name,
                email: email || undefined,
                phone: phone || undefined,
                tenantOrgIds,
                synced: true,
                syncSource,
                sourceId,
                // Only store the channel type; keep sourceId binding empty until OAuth/bind.
                options: mergeThirdLoginTypeOptions(null, syncSource),
                transaction: trans,
                ...rest
              });
            }

            syncedUsers++;
          } catch (e) {
            fastify.log.error(`同步用户失败: ${JSON.stringify(userData)}, 错误: ${e.message}`);
          }
        }

        // 4. 关闭不在本次同步数据中的用户
        await models.user.update(
          { status: 'closed' },
          {
            where: {
              tenantId,
              syncSource,
              sourceId: { [Op.notIn]: [...incomingUserSourceIds] },
              status: 'open'
            },
            transaction: trans
          }
        );

        // 5. 更新同步记录
        await models.orgSync.update(
          { status: 'success', lastSyncAt: new Date() },
          {
            where: { tenantId, type: syncSource },
            transaction: trans
          }
        );

        return { syncedOrgs, syncedUsers };
      },
      outerTransaction
    );
  };

  Object.assign(fastify[options.name].services, {
    org: { list, detail, create, remove, save, enums, importFromRows, syncOrg }
  });
});
