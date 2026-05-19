'use strict';

const { getUserOrgIds } = require('./tenantOrgIds');

/**
 * 统计各组织节点下属用户数（用户所属组织落在该节点或任意子级组织，支持多部门 tenantOrgIds）。
 * @param {Array<{ id: string, parentId?: string|null }>} orgRows
 * @param {Array<{ tenantOrgId?: string|null, tenantOrgIds?: string[] }>} users
 * @returns {Map<string, number>}
 */
function buildOrgSubtreeUserCounts(orgRows, users) {
  const byParent = new Map();
  for (const row of orgRows) {
    const id = String(row.id);
    const pid = row.parentId == null || row.parentId === '' ? null : String(row.parentId);
    if (!byParent.has(pid)) {
      byParent.set(pid, []);
    }
    byParent.get(pid).push(id);
  }

  const directCount = new Map();
  for (const user of users) {
    for (const orgId of getUserOrgIds(user)) {
      directCount.set(orgId, (directCount.get(orgId) || 0) + 1);
    }
  }

  const subtreeCount = new Map();
  const compute = orgId => {
    if (subtreeCount.has(orgId)) {
      return subtreeCount.get(orgId);
    }
    let count = directCount.get(orgId) || 0;
    for (const childId of byParent.get(orgId) || []) {
      count += compute(childId);
    }
    subtreeCount.set(orgId, count);
    return count;
  };

  for (const row of orgRows) {
    compute(String(row.id));
  }

  return subtreeCount;
}

module.exports = { buildOrgSubtreeUserCounts };
