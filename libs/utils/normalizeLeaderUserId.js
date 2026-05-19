'use strict';

/**
 * 部门负责人 id：支持对象表单项、空字符串；清空时统一为 null。
 *
 * @param {unknown} raw
 * @returns {string | null}
 */
const normalizeLeaderUserId = raw => {
  if (raw == null || raw === '') {
    return null;
  }
  if (typeof raw === 'object') {
    const id = raw.id ?? raw.value;
    if (id == null || id === '') {
      return null;
    }
    return String(id);
  }
  return String(raw);
};

module.exports = { normalizeLeaderUserId };
