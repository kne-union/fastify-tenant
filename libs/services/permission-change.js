const fp = require('fastify-plugin');

module.exports = fp(async (fastify, options) => {
  const { models } = fastify[options.name];

  const resolveUserIds = async ({ tenantId, tenantUserIds, roleKeys }) => {
    const rows = await models.user.findAll({ where: { tenantId }, attributes: ['id', 'userId', 'roles'] });
    const tenantUserIdSet = tenantUserIds && new Set(tenantUserIds.map(String));
    const roleKeySet = roleKeys && new Set(roleKeys.filter(Boolean).map(String));
    return rows
      .filter(row => !tenantUserIdSet || tenantUserIdSet.has(String(row.id)))
      .filter(row => !roleKeySet || (row.roles || []).some(role => roleKeySet.has(String(role))))
      .map(row => row.userId);
  };

  /**
   * 角色、成员、租户状态变化后通知调用方（如 fastify-oidc 撤销已签发的令牌）。
   * 未配置 options.onPermissionChange 时不做任何事；回调失败只记录日志，不影响业务操作。
   */
  const notify = async ({ tenantId, userIds, tenantUserIds, roleKeys, reason }) => {
    if (typeof options.onPermissionChange !== 'function') {
      return;
    }
    try {
      const targets = userIds || (await resolveUserIds({ tenantId, tenantUserIds, roleKeys }));
      const uniqueUserIds = [...new Set(targets.filter(Boolean).map(String))];
      if (uniqueUserIds.length) {
        await options.onPermissionChange({ tenantId: tenantId && String(tenantId), userIds: uniqueUserIds, reason });
      }
    } catch (e) {
      fastify.log.warn({ err: e, tenantId, reason }, 'fastify-tenant: onPermissionChange 执行失败');
    }
  };

  Object.assign(fastify[options.name].services, {
    permissionChange: { notify }
  });
});
