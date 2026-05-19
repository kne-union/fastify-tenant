'use strict';

const TENANT_USER_STATUSES = new Set(['open', 'closed']);

/**
 * 租户用户 status 仅支持 open / closed；兼容历史或前端误传的 active / inactive。
 *
 * @param {unknown} status
 * @returns {'open' | 'closed' | null}
 */
const normalizeTenantUserStatus = status => {
  if (status == null || status === '') {
    return null;
  }
  const s = String(status).trim();
  if (s === 'active') {
    return 'open';
  }
  if (s === 'inactive') {
    return 'closed';
  }
  if (TENANT_USER_STATUSES.has(s)) {
    return /** @type {'open' | 'closed'} */ (s);
  }
  return null;
};

module.exports = { normalizeTenantUserStatus, TENANT_USER_STATUSES };
