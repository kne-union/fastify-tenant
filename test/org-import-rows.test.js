'use strict';

const assert = require('node:assert/strict');
const {
  normalizeRowType,
  parseIsLeader,
  normalizeImportRow,
  normalizeImportRows
} = require('../libs/utils/orgImportRows');

describe('orgImportRows', () => {
  it('normalizeRowType', () => {
    assert.equal(normalizeRowType('组织'), 'org');
    assert.equal(normalizeRowType('用户'), 'user');
    assert.equal(normalizeRowType('ORG'), 'org');
    assert.equal(normalizeRowType(''), null);
  });

  it('parseIsLeader', () => {
    assert.equal(parseIsLeader('是'), true);
    assert.equal(parseIsLeader('yes'), true);
    assert.equal(parseIsLeader(''), false);
  });

  it('normalizeImportRow 组织行', () => {
    const r = normalizeImportRow(
      { rowType: '组织', orgName: '研发部', parentOrgName: null, description: 'desc' },
      0
    );
    assert.equal(r.skip, false);
    assert.equal(r.row.rowType, 'org');
    assert.equal(r.row.orgName, '研发部');
  });

  it('normalizeImportRow 用户行', () => {
    const r = normalizeImportRow(
      {
        rowType: '用户',
        orgName: '研发部',
        userName: '张三',
        email: 'a@b.com',
        isLeader: '是'
      },
      1
    );
    assert.equal(r.row.rowType, 'user');
    assert.equal(r.row.isLeader, true);
  });

  it('用户行手机号格式化为 +86', () => {
    const r = normalizeImportRow(
      {
        rowType: '用户',
        orgName: '研发部',
        userName: '张三',
        email: null,
        phone: '13800138001'
      },
      0
    );
    assert.equal(r.row.phone, '+86 13800138001');
  });

  it('normalizeImportRows 跳过空行', () => {
    const rows = normalizeImportRows([
      { rowType: '组织', orgName: 'A' },
      { rowType: '', orgName: '', userName: '', email: '', phone: '' }
    ]);
    assert.equal(rows.length, 1);
  });
});
