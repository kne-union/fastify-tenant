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
