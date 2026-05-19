'use strict';

const { normalizePhone } = require('./phone');

const ROW_TYPE_ORG = 'org';
const ROW_TYPE_USER = 'user';

function normalizeRowType(raw) {
  const s = String(raw || '')
    .trim()
    .toLowerCase();
  if (!s) {
    return null;
  }
  if (['组织', 'org', 'organization', '部门', 'o'].includes(s) || s.startsWith('组织')) {
    return ROW_TYPE_ORG;
  }
  if (['用户', 'user', 'member', '成员', 'u'].includes(s) || s.startsWith('用户')) {
    return ROW_TYPE_USER;
  }
  return null;
}

function parseIsLeader(raw) {
  if (raw == null || raw === '') {
    return false;
  }
  const s = String(raw).trim().toLowerCase();
  return ['是', 'yes', 'y', 'true', '1', '负责人'].includes(s);
}

function trimOrNull(v) {
  if (v == null || String(v).trim() === '') {
    return null;
  }
  return String(v).trim();
}

/**
 * @param {object} r - 单行原始 JSON
 * @param {number} index - 0-based 行下标（用于错误提示）
 * @returns {{ skip: true } | { skip: false, row: object }}
 */
function normalizeImportRow(r, index) {
  const rowNum = index + 1;
  const orgName = String(r.orgName || '').trim();
  const parentOrgName = trimOrNull(r.parentOrgName);
  const userName = trimOrNull(r.userName ?? r.leaderName);
  const email = trimOrNull(r.email);
  let phone = trimOrNull(r.phone);
  if (phone) {
    try {
      phone = normalizePhone(phone);
    } catch (e) {
      throw new Error(`第 ${rowNum} 条：${e.message}`);
    }
  }
  const description = trimOrNull(r.description);
  const isLeader = parseIsLeader(r.isLeader);

  let rowType = normalizeRowType(r.rowType);
  if (!rowType) {
    if (userName || email || phone) {
      rowType = ROW_TYPE_USER;
    } else if (orgName) {
      rowType = ROW_TYPE_ORG;
    }
  }

  const empty = !rowType && !orgName && !parentOrgName && !userName && !email && !phone && !description;
  if (empty) {
    return { skip: true };
  }

  if (!rowType) {
    throw new Error(`第 ${rowNum} 条：缺少行类型，请使用「组织」「用户」工作表或填写 rowType`);
  }

  if (rowType === ROW_TYPE_ORG) {
    if (!orgName) {
      throw new Error(`第 ${rowNum} 条：组织行须填写组织名称`);
    }
    return {
      skip: false,
      row: {
        sourceIndex: rowNum,
        rowType: ROW_TYPE_ORG,
        orgName,
        parentOrgName,
        userName: null,
        email: null,
        phone: null,
        description,
        isLeader: false
      }
    };
  }

  if (!orgName) {
    throw new Error(`第 ${rowNum} 条：用户行须填写所属组织名称`);
  }
  if (!userName) {
    throw new Error(`第 ${rowNum} 条：用户行须填写用户姓名`);
  }
  if (!email && !phone) {
    throw new Error(`第 ${rowNum} 条：用户行须填写邮箱或手机至少一项`);
  }

  return {
    skip: false,
    row: {
      sourceIndex: rowNum,
      rowType: ROW_TYPE_USER,
      orgName,
      parentOrgName: null,
      userName,
      email,
      phone,
      description,
      isLeader
    }
  };
}

function normalizeImportRows(rows) {
  const effective = [];
  for (let i = 0; i < rows.length; i++) {
    const parsed = normalizeImportRow(rows[i] || {}, i);
    if (!parsed.skip) {
      effective.push(parsed.row);
    }
  }
  if (!effective.length) {
    throw new Error('没有可导入的数据行');
  }
  return effective;
}

module.exports = {
  ROW_TYPE_ORG,
  ROW_TYPE_USER,
  normalizeRowType,
  parseIsLeader,
  normalizeImportRow,
  normalizeImportRows
};
