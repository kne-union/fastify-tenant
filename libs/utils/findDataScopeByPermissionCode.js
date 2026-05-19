'use strict';

const { normalizeDataScopeList } = require('./normalizeDataScopeList');

/**
 * 在权限树中按完整权限 code（如 setting:permission:shared-group:create）定位所属模块及其 dataScope。
 *
 * @param {{ modules?: Array<Record<string, unknown>> }} permissions
 * @param {string} permissionCode
 * @returns {{ moduleCode: string, permissionCode: string, dataScope: Record<string, unknown> | null } | null}
 */
const findDataScopeByPermissionCode = (permissions, permissionCode) => {
  const target = permissionCode != null ? String(permissionCode).trim() : '';
  if (!target || !permissions || !Array.isArray(permissions.modules)) {
    return null;
  }

  let found = null;

  const visitModule = (mod, parentCode) => {
    if (!mod || typeof mod.code !== 'string') {
      return;
    }
    const currentCode = parentCode ? `${parentCode}:${mod.code}` : mod.code;

    if (Array.isArray(mod.permissions)) {
      for (const perm of mod.permissions) {
        if (!perm || typeof perm.code !== 'string') {
          continue;
        }
        const fullCode = `${currentCode}:${perm.code}`;
        if (fullCode === target) {
          const raw = mod.dataScope && typeof mod.dataScope === 'object' ? { ...mod.dataScope } : null;
          if (raw) {
            raw.list = normalizeDataScopeList(raw.list);
          }
          found = {
            moduleCode: currentCode,
            permissionCode: fullCode,
            dataScope: raw
          };
        }
      }
    }

    if (Array.isArray(mod.modules)) {
      mod.modules.forEach(child => visitModule(child, currentCode));
    }
  };

  permissions.modules.forEach(mod => visitModule(mod, ''));
  return found;
};

module.exports = findDataScopeByPermissionCode;
