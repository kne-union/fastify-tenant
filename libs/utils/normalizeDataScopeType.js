'use strict';

/** @typedef {'self' | 'owner' | 'org' | 'orgSubtree'} DataScopeType */

const DATA_SCOPE_TYPES = new Set(['self', 'owner', 'org', 'orgSubtree']);

/**
 * @param {unknown} raw
 * @param {DataScopeType} [fallback='self']
 * @returns {DataScopeType}
 */
const normalizeDataScopeType = (raw, fallback = 'self') => {
  const t = raw != null ? String(raw).trim() : '';
  if (t && DATA_SCOPE_TYPES.has(t)) {
    return /** @type {DataScopeType} */ (t);
  }
  return DATA_SCOPE_TYPES.has(fallback) ? /** @type {DataScopeType} */ (fallback) : 'self';
};

module.exports = { normalizeDataScopeType, DATA_SCOPE_TYPES };
