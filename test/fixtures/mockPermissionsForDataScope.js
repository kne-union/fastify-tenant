'use strict';

/**
 * 数据范围相关单元测试用的最小权限树，不依赖 libs/permissions 内置配置。
 */
module.exports = {
  modules: [
    {
      code: 'setting',
      modules: [
        {
          code: 'org',
          permissions: [{ code: 'view' }]
        },
        {
          code: 'permission',
          modules: [
            {
              code: 'shared-group',
              dataScope: {
                open: true,
                list: ['read', 'write'],
                type: 'org'
              },
              permissions: [
                { code: 'create' },
                { code: 'view' },
                { code: 'edit' },
                { code: 'remove' }
              ]
            }
          ]
        },
        {
          code: 'biz-data',
          modules: [
            {
              code: 'order',
              dataScope: {
                open: true,
                list: ['read', 'write'],
                type: 'owner'
              },
              permissions: [{ code: 'view' }, { code: 'edit' }]
            }
          ]
        }
      ]
    }
  ]
};
