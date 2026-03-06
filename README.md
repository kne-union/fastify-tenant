# fastify-tenant

### 描述

用于实现一个租户系统

### 安装

```shell
npm i --save @kne/fastify-tenant
```

### 概述

### 项目概述

`@kne/fastify-tenant` 是一个基于 Fastify 框架的多租户系统插件。该插件提供了完整的租户管理功能，包括租户创建、用户管理、组织架构、角色权限等核心能力。

### 核心功能

#### 租户管理

- 租户的创建、编辑、删除、状态管理
- 租户基本信息配置（名称、主题色、Logo、账号数量限制等）
- 租户服务时间设置（开始时间、结束时间）
- 多语言支持配置

#### 用户管理

- 用户加入租户（通过邀请链接/邀请码）
- 用户可用租户列表查询
- 默认租户切换
- 租户用户 CRUD 操作
- 用户状态管理（启用/禁用）
- 用户邀请功能

#### 组织架构

- 树形组织结构管理
- 组织节点的创建、编辑、删除

#### 角色权限

- 角色的创建、编辑、删除、状态管理
- 角色权限配置
- 权限列表管理
- 支持系统角色和自定义角色

#### 公司信息

- 公司基本信息管理（名称、全称、网站等）
- 公司介绍（Banner、团队介绍、发展历程、联系方式）

#### 租户设置

- 环境变量管理（支持密钥）
- 自定义组件管理
- 租户权限配置

### 插件配置项

| 属性名                      | 说明         | 类型       | 默认值                          |
|--------------------------|------------|----------|------------------------------|
| dbTableNamePrefix        | 数据库表名前缀    | string   | `t_`                         |
| name                     | 插件命名空间名称   | string   | `tenant`                     |
| prefix                   | API 路由前缀   | string   | `/api/tenant`                |
| clientTokenHeader        | 客户端用户令牌请求头 | string   | `x-client-user-token`        |
| tenantUserContextName    | 租户用户上下文名称  | string   | `tenantUserInfo`             |
| getUserModel             | 获取用户模型函数   | function | 使用 fastify-account 的 user 模型 |
| getUserAuthenticate      | 获取用户认证函数   | function | 使用 fastify-account 的用户认证     |
| getAdminUserAuthenticate | 获取管理员认证函数  | function | 使用 fastify-account 的管理员认证    |
| permissionsProfile       | 权限配置文件路径   | string   | `./libs/permissions.js`      |

### 数据模型

#### tenant（租户）

| 字段               | 类型      | 说明                         |
|------------------|---------|----------------------------|
| name             | STRING  | 租户名称（唯一）                   |
| status           | ENUM    | 状态：open/closed             |
| themeColor       | STRING  | 主题色                        |
| logo             | STRING  | Logo                       |
| accountCount     | INTEGER | 最大账号数量，默认 10               |
| description      | TEXT    | 描述                         |
| supportLanguage  | JSON    | 支持语言，默认 ['zh-CN', 'en-US'] |
| defaultLanguage  | STRING  | 默认语言，默认 zh-CN              |
| serviceStartTime | DATE    | 服务开始时间                     |
| serviceEndTime   | DATE    | 服务结束时间                     |
| options          | JSONB   | 扩展字段                       |

#### user（租户用户）

| 字段          | 类型     | 说明             |
|-------------|--------|----------------|
| avatar      | STRING | 头像             |
| name        | STRING | 姓名             |
| gender      | ENUM   | 性别：F/M         |
| email       | STRING | 邮箱（租户内唯一）      |
| phone       | STRING | 手机号            |
| description | TEXT   | 描述             |
| status      | ENUM   | 状态：open/closed |
| roles       | JSONB  | 角色列表           |
| options     | JSONB  | 扩展字段           |

#### role（角色）

| 字段          | 类型     | 说明               |
|-------------|--------|------------------|
| name        | STRING | 名称               |
| code        | STRING | 编码（租户内唯一）        |
| type        | ENUM   | 类型：system/custom |
| permissions | JSON   | 权限列表             |
| description | TEXT   | 描述               |
| status      | ENUM   | 状态：open/closed   |
| options     | JSONB  | 扩展字段             |

#### org（组织）

| 字段          | 类型      | 说明   |
|-------------|---------|------|
| name        | STRING  | 名称   |
| description | TEXT    | 描述   |
| index       | INTEGER | 排序   |
| parentId    | STRING  | 父级ID |
| options     | JSONB   | 扩展字段 |

#### company（公司信息）

| 字段                 | 类型     | 说明          |
|--------------------|--------|-------------|
| name               | STRING | 名称          |
| fullName           | STRING | 全称          |
| website            | STRING | 主页          |
| description        | TEXT   | 描述          |
| banners            | JSON   | Banner 图片列表 |
| teamDescription    | JSON   | 团队介绍        |
| developmentHistory | JSON   | 发展历程        |
| contact            | JSON   | 联系方式        |
| options            | JSONB  | 扩展字段        |

#### setting（租户设置）

| 字段               | 类型   | 说明    |
|------------------|------|-------|
| args             | JSON | 环境变量  |
| secrets          | JSON | 密钥    |
| customComponents | JSON | 自定义组件 |
| permissions      | JSON | 租户权限  |
| options          | JSON | 配置项   |

### 权限模块

默认权限配置包含以下模块：

#### 设置模块 (setting)

| 子模块                    | 权限                                 |
|------------------------|------------------------------------|
| 公司信息 (company-setting) | view, edit                         |
| 组织架构 (org)             | create, view, edit, remove         |
| 权限管理 (permission)      | -                                  |
| 角色管理 (role)            | create, view, edit, remove         |
| 共享组 (shared-group)     | create, view, edit, remove         |
| 用户管理 (user-manager)    | create, view, edit, remove, invite |

### 安装使用

```bash
npm install @kne/fastify-tenant
```

### 依赖要求

- `@kne/fastify-namespace`: *
- `@kne/fastify-sequelize`: *
- `fastify-plugin`: >=5


### 示例

### API

### 租户用户 API

#### 解析租户邀请数据

POST `/api/tenant/parse-join-token`

| 参数    | 位置   | 类型     | 必填 | 说明   |
|-------|------|--------|----|------|
| token | body | string | 是  | 邀请令牌 |

#### 加入租户

POST `/api/tenant/join`

| 参数    | 位置   | 类型     | 必填 | 说明   |
|-------|------|--------|----|------|
| token | body | string | 是  | 邀请令牌 |

#### 用户可用租户列表

GET `/api/tenant/available-list`

无参数

#### 切换用户默认租户

POST `/api/tenant/switch-default-tenant`

| 参数       | 位置   | 类型     | 必填 | 说明   |
|----------|------|--------|----|------|
| tenantId | body | string | 是  | 租户ID |

#### 获取登录租户用户信息

GET `/api/tenant/getUserInfo`

无参数

#### 获取公司信息

GET `/api/tenant/company-detail`

无参数

#### 保存公司信息

POST `/api/tenant/company-save`

| 参数 | 位置   | 类型     | 必填 | 说明     |
|----|------|--------|----|--------|
| -  | body | object | -  | 公司信息对象 |

---

### 组织架构 API

#### 创建组织节点

POST `/api/tenant/org-create`

| 参数          | 位置   | 类型     | 必填 | 说明   |
|-------------|------|--------|----|------|
| name        | body | string | 是  | 名称   |
| parentId    | body | string | 否  | 父级ID |
| description | body | string | 否  | 描述   |

#### 获取租户组织

GET `/api/tenant/org-list`

无参数

#### 删除组织节点

POST `/api/tenant/org-remove`

| 参数 | 位置   | 类型     | 必填 | 说明     |
|----|------|--------|----|--------|
| id | body | string | 是  | 组织节点ID |

#### 编辑组织节点

POST `/api/tenant/org-save`

| 参数          | 位置   | 类型     | 必填 | 说明     |
|-------------|------|--------|----|--------|
| id          | body | string | 是  | 组织节点ID |
| name        | body | string | 否  | 名称     |
| description | body | string | 否  | 描述     |

---

### 租户用户管理 API

#### 创建租户用户

POST `/api/tenant/user-create`

| 参数          | 位置   | 类型     | 必填 | 说明   |
|-------------|------|--------|----|------|
| name        | body | string | 是  | 姓名   |
| tenantOrgId | body | string | 否  | 组织ID |
| avatar      | body | string | 否  | 头像   |
| email       | body | string | 否  | 邮箱   |
| phone       | body | string | 否  | 手机号  |
| description | body | string | 否  | 描述   |

#### 获取租户用户详情

GET `/api/tenant/user-detail`

| 参数 | 位置    | 类型     | 必填 | 说明   |
|----|-------|--------|----|------|
| id | query | string | 是  | 用户ID |

#### 编辑租户用户

POST `/api/tenant/user-save`

| 参数          | 位置   | 类型     | 必填 | 说明   |
|-------------|------|--------|----|------|
| id          | body | string | 是  | 用户ID |
| name        | body | string | 是  | 姓名   |
| tenantOrgId | body | string | 否  | 组织ID |
| avatar      | body | string | 否  | 头像   |
| email       | body | string | 否  | 邮箱   |
| phone       | body | string | 否  | 手机号  |
| description | body | string | 否  | 描述   |

#### 删除租户用户

POST `/api/tenant/user-remove`

| 参数 | 位置   | 类型     | 必填 | 说明   |
|----|------|--------|----|------|
| id | body | string | 是  | 用户ID |

#### 租户用户列表

GET `/api/tenant/user-list`

| 参数          | 位置    | 类型     | 必填 | 默认值 | 说明   |
|-------------|-------|--------|----|-----|------|
| filter      | query | object | 否  | -   | 过滤条件 |
| perPage     | query | number | 否  | 20  | 每页数量 |
| currentPage | query | number | 否  | 1   | 当前页码 |

#### 修改租户用户状态

POST `/api/tenant/user-set-status`

| 参数     | 位置   | 类型     | 必填 | 说明             |
|--------|------|--------|----|----------------|
| id     | body | string | 是  | 用户ID           |
| status | body | string | 是  | 状态：open/closed |

#### 获取用户邀请链接

GET `/api/tenant/user-invite-token`

| 参数 | 位置    | 类型     | 必填 | 说明   |
|----|-------|--------|----|------|
| id | query | string | 是  | 用户ID |

#### 发送邀请租户消息

POST `/api/tenant/send-invite-message`

| 参数 | 位置   | 类型     | 必填 | 说明   |
|----|------|--------|----|------|
| id | body | string | 是  | 用户ID |

---

### 自定义组件 API

#### 自定义组件详情

GET `/api/tenant/custom-component-detail`

| 参数  | 位置    | 类型     | 必填 | 说明   |
|-----|-------|--------|----|------|
| key | query | string | 是  | 组件标识 |

---

### 角色管理 API

#### 创建租户角色

POST `/api/tenant/role/create`

| 参数                  | 位置   | 类型     | 必填 | 说明               |
|---------------------|------|--------|----|------------------|
| name                | body | string | 是  | 名称               |
| code                | body | string | 是  | 编码               |
| description         | body | string | 否  | 描述               |
| status              | body | string | 否  | 状态：open/closed   |
| type                | body | string | 否  | 类型：system/custom |
| options             | body | object | 否  | 扩展配置             |
| createdTenantUserId | body | string | 否  | 创建者ID            |

#### 租户角色列表

GET `/api/tenant/role/list`

| 参数          | 位置    | 类型     | 必填 | 默认值 | 说明   |
|-------------|-------|--------|----|-----|------|
| filter      | query | object | 否  | {}  | 过滤条件 |
| perPage     | query | number | 否  | 20  | 每页数量 |
| currentPage | query | number | 否  | 1   | 当前页码 |

#### 删除租户角色

POST `/api/tenant/role/remove`

| 参数 | 位置   | 类型     | 必填 | 说明   |
|----|------|--------|----|------|
| id | body | string | 是  | 角色ID |

#### 修改租户角色状态

POST `/api/tenant/role/set-status`

| 参数     | 位置   | 类型     | 必填 | 说明             |
|--------|------|--------|----|----------------|
| id     | body | string | 是  | 角色ID           |
| status | body | string | 是  | 状态：open/closed |

#### 编辑租户角色

POST `/api/tenant/role/save`

| 参数          | 位置   | 类型     | 必填 | 说明   |
|-------------|------|--------|----|------|
| id          | body | string | 是  | 角色ID |
| name        | body | string | 否  | 名称   |
| code        | body | string | 否  | 编码   |
| description | body | string | 否  | 描述   |
| status      | body | string | 否  | 状态   |
| type        | body | string | 否  | 类型   |
| options     | body | object | 否  | 扩展配置 |

#### 租户角色权限列表

GET `/api/tenant/role/permission-list`

| 参数 | 位置    | 类型     | 必填 | 说明   |
|----|-------|--------|----|------|
| id | query | string | 是  | 角色ID |

#### 保存租户角色权限

POST `/api/tenant/role/save-permission`

| 参数          | 位置   | 类型     | 必填 | 说明     |
|-------------|------|--------|----|--------|
| id          | body | string | 是  | 角色ID   |
| permissions | body | array  | 是  | 权限编码列表 |

---

### 权限 API

#### 租户权限列表

GET `/api/tenant/permission/list`

无参数

---

### 管理员 - 租户管理 API

#### 租户列表

GET `/api/tenant/admin/list`

| 参数          | 位置    | 类型     | 必填 | 默认值 | 说明   |
|-------------|-------|--------|----|-----|------|
| filter      | query | object | 否  | -   | 过滤条件 |
| perPage     | query | number | 否  | 20  | 每页数量 |
| currentPage | query | number | 否  | 1   | 当前页码 |

#### 租户详情

GET `/api/tenant/admin/detail`

| 参数 | 位置    | 类型     | 必填 | 说明   |
|----|-------|--------|----|------|
| id | query | string | 是  | 租户ID |

#### 添加租户

POST `/api/tenant/admin/create`

| 参数               | 位置   | 类型     | 必填 | 说明             |
|------------------|------|--------|----|----------------|
| name             | body | string | 是  | 租户名称           |
| themeColor       | body | string | 是  | 主题色            |
| logo             | body | string | 是  | Logo           |
| serviceStartTime | body | string | 是  | 服务开始时间         |
| serviceEndTime   | body | string | 是  | 服务结束时间         |
| status           | body | string | 否  | 状态：open/closed |
| accountCount     | body | number | 否  | 最大账号数量         |
| description      | body | string | 否  | 描述             |
| supportLanguage  | body | array  | 否  | 支持语言           |
| defaultLanguage  | body | string | 否  | 默认语言           |

#### 保存租户

POST `/api/tenant/admin/save`

| 参数               | 位置   | 类型     | 必填 | 说明     |
|------------------|------|--------|----|--------|
| id               | body | string | 是  | 租户ID   |
| name             | body | string | 否  | 租户名称   |
| themeColor       | body | string | 否  | 主题色    |
| logo             | body | string | 否  | Logo   |
| status           | body | string | 否  | 状态     |
| accountCount     | body | number | 否  | 最大账号数量 |
| description      | body | string | 否  | 描述     |
| supportLanguage  | body | array  | 否  | 支持语言   |
| defaultLanguage  | body | string | 否  | 默认语言   |
| serviceStartTime | body | string | 否  | 服务开始时间 |
| serviceEndTime   | body | string | 否  | 服务结束时间 |

#### 设置租户状态

POST `/api/tenant/admin/set-status`

| 参数     | 位置   | 类型     | 必填 | 说明   |
|--------|------|--------|----|------|
| id     | body | string | 是  | 租户ID |
| status | body | string | 是  | 状态   |

#### 删除租户

POST `/api/tenant/admin/remove`

| 参数 | 位置   | 类型     | 必填 | 说明   |
|----|------|--------|----|------|
| id | body | string | 是  | 租户ID |

---

### 管理员 - 环境变量管理 API

#### 设置租户环境变量

POST `/api/tenant/admin/append-args`

| 参数       | 位置   | 类型     | 必填 | 说明     |
|----------|------|--------|----|--------|
| tenantId | body | string | 是  | 租户ID   |
| args     | body | array  | 是  | 环境变量列表 |

args 数组项结构：

| 参数     | 类型      | 必填 | 说明             |
|--------|---------|----|----------------|
| key    | string  | 是  | 变量名            |
| value  | string  | 是  | 变量值            |
| secret | boolean | 否  | 是否为密钥，默认 false |

#### 删除环境变量

POST `/api/tenant/admin/remove-arg`

| 参数       | 位置   | 类型     | 必填 | 说明   |
|----------|------|--------|----|------|
| tenantId | body | string | 是  | 租户ID |
| key      | body | string | 是  | 变量名  |

---

### 管理员 - 自定义组件管理 API

#### 设置租户自定义组件

POST `/api/tenant/admin/append-custom-component`

| 参数              | 位置   | 类型     | 必填 | 说明    |
|-----------------|------|--------|----|-------|
| tenantId        | body | string | 是  | 租户ID  |
| customComponent | body | object | 是  | 自定义组件 |

customComponent 结构：

| 参数          | 类型     | 必填 | 说明   |
|-------------|--------|----|------|
| key         | string | 是  | 组件标识 |
| name        | string | 是  | 组件名称 |
| type        | string | 是  | 组件类型 |
| content     | string | 是  | 组件内容 |
| description | string | 否  | 组件描述 |

#### 自定义组件详情

GET `/api/tenant/admin/custom-component-detail`

| 参数       | 位置    | 类型     | 必填 | 说明   |
|----------|-------|--------|----|------|
| tenantId | query | string | 是  | 租户ID |
| key      | query | string | 是  | 组件标识 |

#### 删除自定义组件

POST `/api/tenant/admin/remove-custom-component`

| 参数       | 位置   | 类型     | 必填 | 说明   |
|----------|------|--------|----|------|
| tenantId | body | string | 是  | 租户ID |
| key      | body | string | 是  | 组件标识 |

#### 保存自定义组件

POST `/api/tenant/admin/save-custom-component`

| 参数              | 位置   | 类型     | 必填 | 说明    |
|-----------------|------|--------|----|-------|
| tenantId        | body | string | 是  | 租户ID  |
| customComponent | body | object | 是  | 自定义组件 |

#### 复制自定义组件

POST `/api/tenant/admin/copy-custom-component`

| 参数       | 位置   | 类型     | 必填 | 说明   |
|----------|------|--------|----|------|
| tenantId | body | string | 是  | 租户ID |
| key      | body | string | 是  | 组件标识 |

---

### 管理员 - 公司信息 API

#### 查询公司信息

GET `/api/tenant/admin/company-detail`

| 参数       | 位置    | 类型     | 必填 | 说明   |
|----------|-------|--------|----|------|
| tenantId | query | string | 是  | 租户ID |

#### 保存公司信息

POST `/api/tenant/admin/company-save`

| 参数       | 位置   | 类型     | 必填 | 说明     |
|----------|------|--------|----|--------|
| tenantId | body | string | 是  | 租户ID   |
| -        | body | object | -  | 公司信息对象 |

---

### 管理员 - 组织架构 API

#### 创建组织节点

POST `/api/tenant/admin/org-create`

| 参数          | 位置   | 类型     | 必填 | 说明   |
|-------------|------|--------|----|------|
| tenantId    | body | string | 是  | 租户ID |
| name        | body | string | 是  | 名称   |
| parentId    | body | string | 否  | 父级ID |
| description | body | string | 否  | 描述   |

#### 获取租户组织

GET `/api/tenant/admin/org-list`

| 参数       | 位置    | 类型     | 必填 | 说明   |
|----------|-------|--------|----|------|
| tenantId | query | string | 是  | 租户ID |

#### 删除组织节点

POST `/api/tenant/admin/org-remove`

| 参数       | 位置   | 类型     | 必填 | 说明     |
|----------|------|--------|----|--------|
| tenantId | body | string | 是  | 租户ID   |
| id       | body | string | 是  | 组织节点ID |

#### 编辑组织节点

POST `/api/tenant/admin/org-save`

| 参数          | 位置   | 类型     | 必填 | 说明     |
|-------------|------|--------|----|--------|
| tenantId    | body | string | 是  | 租户ID   |
| id          | body | string | 是  | 组织节点ID |
| name        | body | string | 否  | 名称     |
| description | body | string | 否  | 描述     |

---

### 管理员 - 用户管理 API

#### 创建租户用户

POST `/api/tenant/admin/user-create`

| 参数          | 位置   | 类型     | 必填 | 说明   |
|-------------|------|--------|----|------|
| tenantId    | body | string | 是  | 租户ID |
| name        | body | string | 是  | 姓名   |
| tenantOrgId | body | string | 否  | 组织ID |
| roles       | body | array  | 否  | 角色列表 |
| avatar      | body | string | 否  | 头像   |
| email       | body | string | 否  | 邮箱   |
| phone       | body | string | 否  | 手机号  |
| description | body | string | 否  | 描述   |

#### 编辑租户用户

POST `/api/tenant/admin/user-save`

| 参数          | 位置   | 类型     | 必填 | 说明   |
|-------------|------|--------|----|------|
| id          | body | string | 是  | 用户ID |
| tenantId    | body | string | 是  | 租户ID |
| name        | body | string | 是  | 姓名   |
| tenantOrgId | body | string | 否  | 组织ID |
| roles       | body | array  | 否  | 角色列表 |
| avatar      | body | string | 否  | 头像   |
| email       | body | string | 否  | 邮箱   |
| phone       | body | string | 否  | 手机号  |
| description | body | string | 否  | 描述   |

#### 删除租户用户

POST `/api/tenant/admin/user-remove`

| 参数       | 位置   | 类型     | 必填 | 说明   |
|----------|------|--------|----|------|
| id       | body | string | 是  | 用户ID |
| tenantId | body | string | 是  | 租户ID |

#### 租户用户列表

GET `/api/tenant/admin/user-list`

| 参数          | 位置    | 类型     | 必填 | 默认值 | 说明   |
|-------------|-------|--------|----|-----|------|
| tenantId    | query | string | 是  | -   | 租户ID |
| filter      | query | object | 否  | -   | 过滤条件 |
| perPage     | query | number | 否  | 20  | 每页数量 |
| currentPage | query | number | 否  | 1   | 当前页码 |

#### 获取租户用户详情

GET `/api/tenant/admin/user-detail`

| 参数       | 位置    | 类型     | 必填 | 说明   |
|----------|-------|--------|----|------|
| id       | query | string | 是  | 用户ID |
| tenantId | query | string | 是  | 租户ID |

#### 修改租户用户状态

POST `/api/tenant/admin/user-set-status`

| 参数       | 位置   | 类型     | 必填 | 说明             |
|----------|------|--------|----|----------------|
| tenantId | body | string | 是  | 租户ID           |
| id       | body | string | 是  | 用户ID           |
| status   | body | string | 是  | 状态：open/closed |

#### 查看租户用户权限列表

GET `/api/tenant/admin/user-permission-list`

| 参数       | 位置    | 类型     | 必填 | 说明   |
|----------|-------|--------|----|------|
| tenantId | query | string | 是  | 租户ID |
| id       | query | string | 是  | 用户ID |

#### 获取用户邀请链接

GET `/api/tenant/admin/user-invite-token`

| 参数       | 位置    | 类型     | 必填 | 说明   |
|----------|-------|--------|----|------|
| tenantId | query | string | 是  | 租户ID |
| id       | query | string | 是  | 用户ID |

#### 发送邀请租户消息

POST `/api/tenant/admin/send-invite-message`

| 参数       | 位置   | 类型     | 必填 | 说明   |
|----------|------|--------|----|------|
| tenantId | body | string | 是  | 租户ID |
| id       | body | string | 是  | 用户ID |

---

### 管理员 - 角色管理 API

#### 创建租户角色

POST `/api/tenant/admin/role/create`

| 参数                  | 位置   | 类型     | 必填 | 说明               |
|---------------------|------|--------|----|------------------|
| tenantId            | body | string | 是  | 租户ID             |
| name                | body | string | 是  | 名称               |
| code                | body | string | 是  | 编码               |
| description         | body | string | 否  | 描述               |
| status              | body | string | 否  | 状态：open/closed   |
| type                | body | string | 否  | 类型：system/custom |
| options             | body | object | 否  | 扩展配置             |
| createdTenantUserId | body | string | 否  | 创建者ID            |

#### 租户角色列表

GET `/api/tenant/admin/role/list`

| 参数          | 位置    | 类型     | 必填 | 默认值 | 说明   |
|-------------|-------|--------|----|-----|------|
| tenantId    | query | string | 是  | -   | 租户ID |
| filter      | query | object | 否  | {}  | 过滤条件 |
| perPage     | query | number | 否  | 20  | 每页数量 |
| currentPage | query | number | 否  | 1   | 当前页码 |

#### 删除租户角色

POST `/api/tenant/admin/role/remove`

| 参数       | 位置   | 类型     | 必填 | 说明   |
|----------|------|--------|----|------|
| tenantId | body | string | 是  | 租户ID |
| id       | body | string | 是  | 角色ID |

#### 修改租户角色状态

POST `/api/tenant/admin/role/set-status`

| 参数       | 位置   | 类型     | 必填 | 说明             |
|----------|------|--------|----|----------------|
| tenantId | body | string | 是  | 租户ID           |
| id       | body | string | 是  | 角色ID           |
| status   | body | string | 是  | 状态：open/closed |

#### 编辑租户角色

POST `/api/tenant/admin/role/save`

| 参数          | 位置   | 类型     | 必填 | 说明   |
|-------------|------|--------|----|------|
| id          | body | string | 是  | 角色ID |
| tenantId    | body | string | 是  | 租户ID |
| name        | body | string | 否  | 名称   |
| code        | body | string | 否  | 编码   |
| description | body | string | 否  | 描述   |
| status      | body | string | 否  | 状态   |
| type        | body | string | 否  | 类型   |
| options     | body | object | 否  | 扩展配置 |

#### 租户角色权限列表

GET `/api/tenant/admin/role/permission-list`

| 参数       | 位置    | 类型     | 必填 | 说明   |
|----------|-------|--------|----|------|
| tenantId | query | string | 是  | 租户ID |
| id       | query | string | 是  | 角色ID |

#### 保存租户角色权限

POST `/api/tenant/admin/role/save-permission`

| 参数          | 位置   | 类型     | 必填 | 说明     |
|-------------|------|--------|----|--------|
| tenantId    | body | string | 是  | 租户ID   |
| id          | body | string | 是  | 角色ID   |
| permissions | body | array  | 是  | 权限编码列表 |

---

### 管理员 - 权限管理 API

#### 租户权限列表

GET `/api/tenant/admin/permission/list`

| 参数       | 位置    | 类型     | 必填 | 说明   |
|----------|-------|--------|----|------|
| tenantId | query | string | 是  | 租户ID |

#### 保存租户权限

POST `/api/tenant/admin/permission/save`

| 参数          | 位置   | 类型     | 必填 | 说明     |
|-------------|------|--------|----|--------|
| tenantId    | body | string | 是  | 租户ID   |
| permissions | body | array  | 是  | 权限编码列表 |
