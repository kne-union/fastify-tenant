'use strict';

const assert = require('node:assert/strict');
const mergePermissions = require('../libs/utils/mergePermissions');

describe('mergePermissions', () => {
  it('应深拷贝 origin，不修改原对象', () => {
    const origin = {
      modules: [{ code: 'a', name: 'A', permissions: [{ code: 'view', name: '查看' }] }]
    };
    const target = { modules: [{ code: 'b', name: 'B', permissions: [] }] };
    mergePermissions(origin, target);
    assert.equal(origin.modules.length, 1);
    assert.equal(origin.modules[0].code, 'a');
  });

  it('应追加不存在于 origin 的模块', () => {
    const origin = { modules: [{ code: 'x', name: 'X', index: 0 }] };
    const target = { modules: [{ code: 'y', name: 'Y', index: 0 }] };
    const out = mergePermissions(origin, target);
    assert.equal(out.modules.length, 2);
    const codes = out.modules.map(m => m.code).sort();
    assert.deepEqual(codes, ['x', 'y']);
  });

  it('相同 code 时应合并 name 并拼接 permissions', () => {
    const origin = {
      modules: [
        {
          code: 'setting',
          name: '设置',
          permissions: [{ code: 'view', name: '查看' }],
          modules: []
        }
      ]
    };
    const target = {
      modules: [
        {
          code: 'setting',
          name: '设置-覆盖名',
          permissions: [{ code: 'edit', name: '编辑' }]
        }
      ]
    };
    const out = mergePermissions(origin, target);
    assert.equal(out.modules.length, 1);
    const mod = out.modules[0];
    assert.equal(mod.name, '设置-覆盖名');
    assert.deepEqual(
      mod.permissions.map(p => p.code),
      ['view', 'edit']
    );
  });

  it('应递归合并子 modules', () => {
    const origin = {
      modules: [
        {
          code: 'parent',
          name: '父',
          modules: [{ code: 'child', name: '子', permissions: [{ code: 'a', name: 'A' }] }]
        }
      ]
    };
    const target = {
      modules: [
        {
          code: 'parent',
          name: '父',
          modules: [{ code: 'child', name: '子', permissions: [{ code: 'b', name: 'B' }] }]
        }
      ]
    };
    const out = mergePermissions(origin, target);
    const child = out.modules[0].modules[0];
    assert.deepEqual(
      child.permissions.map(p => p.code),
      ['a', 'b']
    );
  });

  it('在合并 target.modules 后应按 index 降序排序 modules', () => {
    const origin = {
      modules: [
        { code: 'low', name: '低', index: 1 },
        { code: 'high', name: '高', index: 10 }
      ]
    };
    // target 非空才会执行排序逻辑（见 mergePermissions 中 core 实现）
    const target = { modules: [{ code: 'high', name: '高', index: 10, permissions: [] }] };
    const out = mergePermissions(origin, target);
    assert.deepEqual(
      out.modules.map(m => m.code),
      ['high', 'low']
    );
  });

  it('target.modules 为空或非数组时不应抛错', () => {
    const origin = { modules: [{ code: 'a', name: 'A' }] };
    assert.doesNotThrow(() => mergePermissions(origin, {}));
    assert.doesNotThrow(() => mergePermissions(origin, { modules: null }));
  });
});
