module.exports = {
  modules: [
    {
      name: '设置',
      code: 'setting',
      modules: [
        {
          name: '公司信息',
          code: 'company-setting',
          permissions: [
            {
              name: '查看',
              code: 'view'
            },
            {
              name: '编辑',
              code: 'edit'
            }
          ]
        },
        {
          name: '组织架构',
          code: 'org',
          permissions: [
            {
              name: '创建',
              code: 'create'
            },
            {
              name: '查看',
              code: 'view'
            },
            {
              name: '编辑',
              code: 'edit'
            },
            {
              name: '删除',
              code: 'remove'
            }
          ]
        },
        {
          name: '权限管理',
          code: 'permission',
          modules: [
            {
              name: '角色',
              code: 'role',
              permissions: [
                {
                  name: '创建',
                  code: 'create'
                },
                {
                  name: '查看',
                  code: 'view'
                },
                {
                  name: '编辑',
                  code: 'edit'
                },
                {
                  name: '删除',
                  code: 'remove'
                }
              ]
            },
            {
              name: '共享组',
              code: 'shared-group',
              permissions: [
                {
                  name: '创建',
                  code: 'create'
                },
                {
                  name: '查看',
                  code: 'view'
                },
                {
                  name: '编辑',
                  code: 'edit'
                },
                {
                  name: '删除',
                  code: 'remove'
                }
              ]
            }
          ]
        },
        {
          name: '用户管理',
          code: 'user-manager',
          permissions: [
            {
              name: '创建',
              code: 'create'
            },
            {
              name: '查看',
              code: 'view'
            },
            {
              name: '编辑',
              code: 'edit'
            },
            {
              name: '删除',
              code: 'remove'
            }
          ]
        }
      ]
    }
  ]
};
