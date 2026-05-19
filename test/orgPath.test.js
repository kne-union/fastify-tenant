'use strict';

const assert = require('node:assert/strict');
const { buildOrgNamePath } = require('../libs/utils/orgPath');

describe('buildOrgNamePath', () => {
  it('应拼接父级组织路径', () => {
    const orgById = new Map([
      ['1', { id: '1', name: '技术中心', parentId: null }],
      ['2', { id: '2', name: '前端组', parentId: '1' }]
    ]);
    assert.equal(buildOrgNamePath('2', orgById), '技术中心 / 前端组');
  });

  it('无组织时应返回空字符串', () => {
    assert.equal(buildOrgNamePath(null, new Map()), '');
  });
});
