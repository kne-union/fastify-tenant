'use strict';

const assert = require('node:assert/strict');
const flattenPermissions = require('../libs/utils/flattenPermissions');

describe('flattenPermissions', () => {
  it('应扁平化顶级模块与权限', () => {
    const data = {
      modules: [
        {
          name: '设置',
          code: 'setting',
          permissions: [
            { name: '查看', code: 'view' },
            { name: '编辑', code: 'edit' }
          ]
        }
      ]
    };
    const out = flattenPermissions(data);
    assert.deepEqual(out, [
      { name: '设置', code: 'setting', type: 'module' },
      { name: '查看', code: 'setting:view', type: 'permission' },
      { name: '编辑', code: 'setting:edit', type: 'permission' }
    ]);
  });

  it('应使用冒号拼接嵌套模块 code', () => {
    const data = {
      modules: [
        {
          name: '父',
          code: 'parent',
          modules: [
            {
              name: '子',
              code: 'child',
              permissions: [{ name: '创建', code: 'create' }]
            }
          ]
        }
      ]
    };
    const out = flattenPermissions(data);
    assert.deepEqual(out, [
      { name: '父', code: 'parent', type: 'module' },
      { name: '子', code: 'parent:child', type: 'module' },
      { name: '创建', code: 'parent:child:create', type: 'permission' }
    ]);
  });

  it('无子模块与权限时仅输出模块节点', () => {
    const data = {
      modules: [{ name: '仅模块', code: 'only' }]
    };
    assert.deepEqual(flattenPermissions(data), [
      { name: '仅模块', code: 'only', type: 'module' }
    ]);
  });
});
