'use strict';

/**
 * 将导入/录入的手机号统一为「+86 1xxxxxxxxxx」形式（无国家码时默认 +86）
 * @param {string|null|undefined} raw
 * @returns {string|null}
 */
function normalizePhone(raw) {
  if (raw == null || String(raw).trim() === '') {
    return null;
  }
  let s = String(raw).trim().replace(/[\s-]/g, '');
  if (!s) {
    return null;
  }

  if (s.startsWith('+')) {
    const digits = s.slice(1).replace(/\D/g, '');
    if (!digits) {
      return null;
    }
    if (digits.startsWith('86')) {
      const national = digits.slice(2);
      if (!national) {
        throw new Error('手机号格式不正确');
      }
      return `+86 ${national}`;
    }
    const cc = digits.length > 11 ? digits.slice(0, digits.length - 11) : digits.slice(0, 2);
    const rest = digits.slice(cc.length);
    return `+${cc} ${rest}`;
  }

  let digits = s.replace(/\D/g, '');
  if (digits.startsWith('0086')) {
    digits = digits.slice(4);
  } else if (digits.startsWith('86') && digits.length > 11) {
    digits = digits.slice(2);
  }
  if (digits.startsWith('0') && digits.length > 10) {
    digits = digits.slice(1);
  }

  if (!digits) {
    throw new Error('手机号格式不正确');
  }

  return `+86 ${digits}`;
}

module.exports = {
  normalizePhone
};
