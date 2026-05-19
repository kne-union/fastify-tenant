'use strict';

/**
 * 在内存中根据 parentId 关系，从 rootId 向下收集子树内所有组织 id（含 root）。
 * @param {Array<{ id: string, parentId?: string|null }>} orgRows
 * @param {string} rootId
 * @returns {Set<string>}
 */
function collectOrgSubtreeIds(orgRows, rootId) {
  const byParent = new Map();
  for (const row of orgRows) {
    const pid = row.parentId == null || row.parentId === '' ? null : String(row.parentId);
    if (!byParent.has(pid)) {
      byParent.set(pid, []);
    }
    byParent.get(pid).push(String(row.id));
  }
  const out = new Set();
  const stack = [String(rootId)];
  while (stack.length) {
    const id = stack.pop();
    if (out.has(id)) {
      continue;
    }
    out.add(id);
    const children = byParent.get(id) || [];
    for (const c of children) {
      if (!out.has(c)) {
        stack.push(c);
      }
    }
  }
  return out;
}

module.exports = { collectOrgSubtreeIds };
