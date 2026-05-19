'use strict';

/**
 * 根据 parentId 链拼接组织完整路径，如「技术中心 / 前端组」
 * @param {string|number|null|undefined} orgId
 * @param {Map<string, { id: string, name: string, parentId?: string|null }>} orgById
 * @returns {string}
 */
function buildOrgNamePath(orgId, orgById) {
  if (orgId == null || orgId === '') {
    return '';
  }
  const parts = [];
  let currentId = String(orgId);
  const seen = new Set();
  while (currentId && !seen.has(currentId)) {
    seen.add(currentId);
    const org = orgById.get(currentId);
    if (!org) {
      break;
    }
    parts.unshift(org.name);
    currentId = org.parentId == null || org.parentId === '' ? null : String(org.parentId);
  }
  return parts.join(' / ');
}

module.exports = { buildOrgNamePath };
