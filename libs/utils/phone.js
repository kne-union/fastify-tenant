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

/**
 * 将筛选输入转为可对入库手机号（`+86 1xxxxxxxxxx`）做 LIKE 的片段。
 * 入库带空格，前端常传 `+86138…`；统一取国内号码数字，避免格式差异导致不命中。
 * @param {string|object|null|undefined} raw
 * @returns {string}
 */
function resolvePhoneFilterPattern(raw) {
  if (raw == null || raw === '') {
    return '';
  }
  let input = raw;
  if (typeof raw === 'object') {
    const num = raw.value ?? raw.phone ?? raw.number ?? '';
    const code = raw.code ?? raw.ab;
    if (num == null || String(num).trim() === '') {
      return '';
    }
    if (code != null && String(code).trim() !== '') {
      input = `+${String(code).replace(/\D/g, '')}${String(num).trim()}`;
    } else {
      input = num;
    }
  }
  const s = String(input).trim();
  if (!s) {
    return '';
  }
  try {
    const normalized = normalizePhone(s);
    if (normalized) {
      const national = normalized.replace(/^\+\d+\s+/, '');
      if (national) {
        return national;
      }
    }
  } catch (_) {
    // 不完整输入可能无法 normalize，回退到去非数字
  }
  let digits = s.replace(/\D/g, '');
  if (!digits) {
    return s;
  }
  if (digits.startsWith('0086')) {
    digits = digits.slice(4);
  } else if (digits.startsWith('86') && digits.length > 11) {
    digits = digits.slice(2);
  }
  return digits;
}

module.exports = {
  normalizePhone,
  resolvePhoneFilterPattern
};
