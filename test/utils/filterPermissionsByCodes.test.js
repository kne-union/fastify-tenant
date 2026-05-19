'use strict';

const assert = require('node:assert/strict');
const filterPermissionsByCodes = require('../../libs/utils/filterPermissionsByCodes');

describe('filterPermissionsByCodes', () => {
  const tree = {
    modules: [
      {
        code: 'setting',
        name: '设置',
        modules: [
          {
            code: 'org',
            name: '组织',
            permissions: [
              { code: 'view', name: '查看' },
              { code: 'edit', name: '编辑' }
            ]
          }
        ]
      }
    ]
  };

  it('保留 code 在集合中的分支；子模块下 permissions 不做细粒度过滤', () => {
    const codes = ['setting', 'setting:org', 'setting:org:view'];
    const out = filterPermissionsByCodes(tree, codes);
    assert.equal(out.modules.length, 1);
    assert.equal(out.modules[0].code, 'setting');
    assert.equal(out.modules[0].modules.length, 1);
    assert.deepEqual(
      out.modules[0].modules[0].permissions.map(p => p.code),
      ['view', 'edit']
    );
  });

  it('根模块全部被过滤时返回空 modules', () => {
    const out = filterPermissionsByCodes(tree, ['other:code']);
    assert.deepEqual(out.modules, []);
  });
});
