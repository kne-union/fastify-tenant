# fastify-tenant

### 描述

用于实现一个租户系统

### 安装

```shell
npm i --save @kne/fastify-tenant
```

### 概述

### 项目概述

`@kne/fastify-tenant` 是基于 Fastify 框架的多租户系统插件，提供完整的租户管理能力，包括租户创建与配置、用户管理、组织架构、角色权限、共享组与数据范围、公司信息、租户设置等。

### 主要特性

#### 租户管理

- 租户 CRUD、状态管理（open / closed）
- 基本配置：名称、主题色、Logo、账号数量限制、多语言、服务时间
- 管理员侧完整管理接口

#### 用户管理

- 用户通过邀请链接 / 邀请码加入租户
- 可用租户列表查询、默认租户切换
- 租户用户 CRUD、状态管理（启用 / 禁用）
- 用户邀请与消息发送

#### 组织架构

- 树形组织结构管理（创建、编辑、删除）
- 组织负责人（leaderUserId）设置
- 批量导入组织与用户（JSON 行数据，前端解析 Excel 后提交）

#### 角色权限

- 角色 CRUD、状态管理（open / closed）
- 系统角色（system）与自定义角色（custom），系统角色不可修改 / 删除
- 角色权限配置与查询

#### 共享组与数据范围

- 共享组 CRUD、状态管理
- 共享组包含数据来源（dataSourceTenantUserIds）和成员（memberTenantUserIds）
- 共享模块（sharedModules）配置模块编码与访问权限（read / write）
- 数据范围（dataScope）支持 self / owner / org / orgSubtree 四种模式
- 按权限码自动解析可见租户用户 ID（含共享组扩展）

#### 公司信息

- 公司基本信息（名称、全称、行业、规模、地址等）
- 公司介绍（Banner、团队介绍、发展历程、联系方式）

#### 租户设置

- 环境变量管理（支持密钥类型，密钥值以 `******` 展示）
- 自定义组件管理（增删改查、复制）
- 租户权限配置

### 使用场景

| 场景 | 说明 |
|------|------|
| SaaS 多租户平台 | 为每个客户创建独立租户，实现数据隔离与权限管控 |
| 企业内部系统 | 按部门 / 项目组划分租户，配合组织架构与角色权限管理 |
| 协同办公平台 | 利用共享组跨组织共享数据，结合数据范围控制可见性 |
| 管理后台 | 管理员通过 `/admin` 接口统一管理所有租户 |


### 示例

### API

### 插件注册

| 属性名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| dbTableNamePrefix | string | `t_` | 数据库表名前缀 |
| name | string | `tenant` | 插件命名空间名称 |
| prefix | string | `/api/tenant` | API 路由前缀 |
| clientTokenHeader | string | `x-client-user-token` | 客户端用户令牌请求头 |
| tenantUserContextName | string | `tenantUserInfo` | 租户用户上下文名称 |
| getUserModel | function | 使用 fastify-account 的 user 模型 | 获取用户模型函数 |
| getUserAuthenticate | function | 使用 fastify-account 的用户认证 | 获取用户认证函数 |
| getAdminUserAuthenticate | function | 使用 fastify-account 的管理员认证 | 获取管理员认证函数 |
| permissionsProfile | string | `./libs/permissions.js` | 权限配置文件路径（支持 .js / .yml / .json） |

### 数据模型

#### tenant（租户）

| 字段 | 类型 | 说明 |
|------|------|------|
| name | STRING | 租户名称（唯一） |
| status | ENUM | 状态：open / closed |
| themeColor | STRING | 主题色 |
| logo | STRING | Logo |
| accountCount | INTEGER | 最大账号数量，默认 10 |
| description | TEXT | 描述 |
| supportLanguage | JSON | 支持语言，默认 ['zh-CN', 'en-US'] |
| defaultLanguage | STRING | 默认语言，默认 zh-CN |
| serviceStartTime | DATE | 服务开始时间 |
| serviceEndTime | DATE | 服务结束时间 |
| options | JSONB | 扩展字段 |

#### user（租户用户）

| 字段 | 类型 | 说明 |
|------|------|------|
| avatar | STRING | 头像 |
| name | STRING | 姓名 |
| gender | ENUM | 性别：F / M |
| email | STRING | 邮箱（租户内唯一） |
| phone | STRING | 手机号 |
| description | TEXT | 描述 |
| status | ENUM | 状态：open / closed |
| tenantOrgId | STRING | 主组织 ID（兼容，推荐使用 tenantOrgIds） |
| tenantOrgIds | JSON | 所属组织 ID 列表 |
| roles | JSON | 角色 ID 列表 |
| options | JSONB | 扩展字段 |

#### role（角色）

| 字段 | 类型 | 说明 |
|------|------|------|
| name | STRING | 名称 |
| code | STRING | 编码（租户内唯一） |
| type | ENUM | 类型：system / custom |
| permissions | JSON | 权限编码列表 |
| description | TEXT | 描述 |
| status | ENUM | 状态：open / closed |
| options | JSONB | 扩展字段 |

#### org（组织）

| 字段 | 类型 | 说明 |
|------|------|------|
| name | STRING | 名称 |
| description | TEXT | 描述 |
| index | INTEGER | 排序 |
| parentId | STRING | 父级 ID |
| leaderUserId | STRING | 部门负责人（租户用户 ID） |
| options | JSONB | 扩展字段 |

#### company（公司信息）

| 字段 | 类型 | 说明 |
|------|------|------|
| name | STRING | 名称 |
| fullName | STRING | 全称 |
| logo | STRING | Logo |
| industry | STRING | 行业 |
| scale | STRING | 规模 |
| address | STRING | 地址 |
| phone | STRING | 电话 |
| email | STRING | 邮箱 |
| foundedDate | DATEONLY | 成立日期 |
| companyTags | JSON | 公司标签 |
| website | STRING | 主页 |
| description | TEXT | 描述 |
| banners | JSON | Banner 图片列表 |
| teamDescription | JSON | 团队介绍 |
| developmentHistory | JSON | 发展历程 |
| contact | JSON | 联系方式 |
| options | JSONB | 扩展字段 |

#### setting（租户设置）

| 字段 | 类型 | 说明 |
|------|------|------|
| args | JSON | 环境变量 |
| secrets | JSON | 密钥（不通过 API 返回） |
| customComponents | JSON | 自定义组件 |
| permissions | JSON | 租户权限 |
| options | JSON | 配置项 |

#### shared_group（共享组）

| 字段 | 类型 | 说明 |
|------|------|------|
| name | STRING | 共享组名称 |
| description | TEXT | 说明 |
| sharedModules | JSON | 共享模块列表 `[{ moduleCode, access }]`，access 为 read / write |
| createdTenantUserId | STRING | 创建人（租户用户 ID） |
| status | ENUM | 状态：open / closed |
| options | JSONB | 扩展字段 |

#### shared_group_data_source（共享组数据来源）

| 字段 | 类型 | 说明 |
|------|------|------|
| sharedGroupId | STRING | 共享组 ID |
| tenantUserId | STRING | 数据来源租户用户 ID |

#### shared_group_member（共享组成员）

| 字段 | 类型 | 说明 |
|------|------|------|
| sharedGroupId | STRING | 共享组 ID |
| tenantUserId | STRING | 共享组成员租户用户 ID |

### 权限模块

默认权限配置包含以下模块：

| 子模块 | 权限 | dataScope |
|--------|------|-----------|
| 公司信息 (company-setting) | view, edit | - |
| 组织架构 (org) | create, view, edit, remove | - |
| 角色管理 (role) | create, view, edit, remove | - |
| 共享组 (shared-group) | create, view, edit, remove | open: true, list: [read, write], type: org |
| 用户管理 (user-manager) | create, view, edit, remove, invite | - |

### 程序化 API

插件注册后通过 `fastify[options.name]` 访问命名空间，提供以下子模块：

| 子模块 | 说明 |
|--------|------|
| `services.tenant` | 租户管理服务 |
| `services.user` | 用户管理服务 |
| `services.org` | 组织架构服务 |
| `services.role` | 角色管理服务 |
| `services.permission` | 权限管理服务 |
| `services.company` | 公司信息服务 |
| `services.setting` | 租户设置服务 |
| `services.sharedGroup` | 共享组服务 |
| `services.dataScope` | 数据范围服务 |
| `authenticate.tenantUser` | 租户用户认证中间件 |
| `utils.mergePermissions` | 合并权限配置 |
| `utils.flattenPermissions` | 展平权限配置 |
| `appendPermissions(outside)` | 运行时追加权限配置 |

#### dataScope 服务方法

| 方法 | 参数 | 返回值 | 说明 |
|------|------|--------|------|
| `resolveOrgRuleTenantUserIds` | `{ tenantId, currentTenantUserId, scope?, type?, transaction? }` | `string[]` | 按组织范围解析可见租户用户 ID |
| `resolveOwnerScopeTenantUserIds` | `{ tenantId, currentTenantUserId, transaction? }` | `string[]` | 本人 + 作为负责人所辖部门内用户 |
| `resolveSharedGroupDataSourceUserIds` | `{ tenantId, currentTenantUserId, moduleCode, transaction? }` | `string[]` | 共享组数据来源用户 ID |
| `resolveVisibleTenantUserIds` | `{ tenantId, currentTenantUserId, scope?, type?, moduleCode?, transaction? }` | `string[]` | 合并组织规则与共享组数据来源 |
| `resolveDataPermission` | `{ tenantId, currentTenantUserId, roleDetails?, type?, moduleCode?, transaction? }` | `{ allVisible, tenantUserIds, type, moduleCode }` | 数据权限入口；租户管理员 `allVisible=true` 且 `tenantUserIds=[]` |
| `resolveDataPermissionByCode` | `{ tenantId, currentTenantUserId, roleDetails?, permissionCode, permissions?, transaction? }` | `{ allVisible, tenantUserIds, moduleCode, type, dataScopeOpen }` | 按权限码；管理员同上 |
| `buildRowScopeWhere` | `{ tenantId, currentTenantUserId, roleDetails?, scope?, type?, fieldKey?, moduleCode?, transaction? }` | `{ allVisible, tenantUserIds, where }` | 生成 Sequelize where；管理员 `where={}` |
| `resolveTenantUserIdsByPermissionCode` | `{ tenantId, currentTenantUserId, permissionCode, permissions?, transaction? }` | `{ tenantUserIds, moduleCode, type, dataScopeOpen }` | 按权限码解析可见用户（不含管理员短路） |

dataScope type 取值：`self`（仅本人）、`owner`（本人 + 负责部门）、`org`（同组织）、`orgSubtree`（组织子树）。

`allVisible`：`true` 表示全部可见、不过滤数据（忽略空的 `tenantUserIds`）；接口与 `buildRowScopeWhere` 默认 / 普通用户为 `false`。

---

### 租户用户 API

以下接口需用户认证，租户侧接口自动从上下文获取 `tenantId`。

#### 解析租户邀请数据

POST `/api/tenant/parse-join-token`

| 参数 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| token | body | string | 是 | 邀请令牌 |

#### 加入租户

POST `/api/tenant/join`

| 参数 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| token | body | string | 是 | 邀请令牌 |

#### 用户可用租户列表

GET `/api/tenant/available-list`

无参数

#### 切换用户默认租户

POST `/api/tenant/switch-default-tenant`

| 参数 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| tenantId | body | string | 是 | 租户 ID |

#### 获取登录租户用户信息

GET `/api/tenant/getUserInfo`

无参数。返回 `{ userInfo, tenantUserInfo, company, tenant }`。

#### 获取当前租户系统语言设置

GET `/api/tenant/languages`

无参数。返回 `{ supportLanguage: string[], defaultLanguage: string }`（取自当前登录租户）。

#### 获取当前用户数据权限（可见租户用户）

GET `/api/tenant/data-permission`

按组织范围规则解析当前登录租户用户可见的租户用户 ID 列表。传入非空 `moduleCode` 时额外合并该模块下共享组数据来源；不传或空则忽略共享组。

租户管理员（系统角色 `type=system` 且 `code=admin`）返回 `allVisible: true` 且 `tenantUserIds: []`（未计算，不是无人可见）；调用方应跳过数据范围过滤。普通用户默认 `allVisible: false`。

| 参数 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| type | query | string | 否 | 数据范围：`self` / `owner` / `org` / `orgSubtree`，默认 `owner` |
| moduleCode | query | string | 否 | 非空时合并共享组；不传或空则忽略共享组 |

返回 `{ allVisible: boolean, tenantUserIds: string[], type: string, moduleCode: string | null }`。

#### 按权限码获取当前用户数据权限（可见租户用户）

GET `/api/tenant/data-permission-by-code`

根据功能权限码从权限树定位所属模块的 `dataScope`：已开启时按配置的 `type` 解析组织范围并合并该模块共享组数据来源；未开启时回退为仅本人（`self`）。租户管理员同样返回 `allVisible: true`（默认普通用户为 `false`）。

| 参数 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| permissionCode | query | string | 是 | 功能权限码，如 `setting:permission:shared-group:view` |

返回 `{ allVisible: boolean, tenantUserIds: string[], moduleCode: string | null, type: string, dataScopeOpen: boolean }`。

#### 获取公司信息

GET `/api/tenant/company-detail`

无参数

#### 保存公司信息

POST `/api/tenant/company-save`

| 参数 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| name | body | string | 否 | 公司名称 |
| fullName | body | string | 否 | 公司全称 |
| logo | body | string | 否 | Logo |
| industry | body | string | 否 | 行业 |
| scale | body | string | 否 | 规模 |
| address | body | string | 否 | 地址 |
| phone | body | string | 否 | 电话 |
| email | body | string | 否 | 邮箱 |
| foundedDate | body | string | 否 | 成立日期 |
| companyTags | body | array\<object\> | 否 | 公司标签 |
| website | body | string | 否 | 主页 |
| description | body | string | 否 | 描述 |
| banners | body | array\<object\> | 否 | Banner 图片列表 |
| teamDescription | body | object | 否 | 团队介绍 |
| developmentHistory | body | object | 否 | 发展历程 |
| contact | body | object | 否 | 联系方式 |
| options | body | object | 否 | 扩展字段 |

---

### 组织架构 API（租户侧）

#### 创建组织节点

POST `/api/tenant/org-create`

| 参数 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| name | body | string | 是 | 名称 |
| parentId | body | string | 否 | 父级 ID |
| description | body | string | 否 | 描述 |
| leaderUserId | body | string \| null | 否 | 部门负责人（租户用户 ID） |

#### 获取租户组织

GET `/api/tenant/org-list`

无参数

#### 删除组织节点

POST `/api/tenant/org-remove`

| 参数 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| id | body | string | 是 | 组织节点 ID |

#### 编辑组织节点

POST `/api/tenant/org-save`

| 参数 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| id | body | string | 是 | 组织节点 ID |
| name | body | string | 否 | 名称 |
| description | body | string | 否 | 描述 |
| leaderUserId | body | string \| null | 否 | 部门负责人（传 null 清空） |

#### 批量导入组织与用户

POST `/api/tenant/org-batch-import`

需登录租户用户上下文，无需传 tenantId。

| 参数 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| parentOrgId | body | string | 否 | 锚点组织节点 ID |
| rows | body | array | 是 | 行对象列表，至少 1 条 |

`rows[]` 每项字段：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| rowType | string | 是 | 枚举：org / user |
| orgName | string \| null | 否 | 组织名称 |
| parentOrgName | string \| null | 否 | 上级组织名称 |
| userName | string \| null | 否 | 负责人姓名 |
| email | string \| null | 否 | 邮箱 |
| phone | string \| null | 否 | 手机 |
| description | string \| null | 否 | 描述 |
| isLeader | boolean \| null | 否 | 是否为部门负责人 |

返回值：

| 字段 | 类型 | 说明 |
|------|------|------|
| createdOrgs | number | 新建组织数 |
| createdUsers | number | 新建租户用户数 |
| rowCount | number | 有效导入行数 |

---

### 租户用户管理 API（租户侧）

#### 创建租户用户

POST `/api/tenant/user-create`

| 参数 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| name | body | string | 是 | 姓名 |
| tenantOrgId | body | string | 否 | 组织 ID（兼容） |
| tenantOrgIds | body | array\<string\> | 否 | 所属组织 ID 列表 |
| avatar | body | string | 否 | 头像 |
| email | body | string | 否 | 邮箱 |
| phone | body | string | 否 | 手机号 |
| description | body | string | 否 | 描述 |

#### 获取租户用户详情

GET `/api/tenant/user-detail`

| 参数 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| id | query | string | 是 | 用户 ID |

#### 编辑租户用户

POST `/api/tenant/user-save`

| 参数 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| id | body | string | 是 | 用户 ID |
| name | body | string | 是 | 姓名 |
| tenantOrgId | body | string | 否 | 组织 ID（兼容） |
| tenantOrgIds | body | array\<string\> | 否 | 所属组织 ID 列表 |
| avatar | body | string | 否 | 头像 |
| email | body | string | 否 | 邮箱 |
| phone | body | string | 否 | 手机号 |
| description | body | string | 否 | 描述 |

#### 删除租户用户

POST `/api/tenant/user-remove`

| 参数 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| id | body | string | 是 | 用户 ID |

#### 租户用户列表

GET `/api/tenant/user-list`

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|------|--------|------|
| filter | query | object | 否 | - | 过滤条件 |
| perPage | query | number | 否 | 20 | 每页数量 |
| currentPage | query | number | 否 | 1 | 当前页码 |

#### 租户用户列表（数据权限）

GET `/api/tenant/user-list-by-data-permission`

带数据权限过滤的用户列表：租户管理员（系统角色 `admin`）可见全部；普通用户默认仅本部门及以下（`orgSubtree`）。传入非空 `moduleCode`，或传入 `permissionCode`（会校验菜单权限并解析所属模块）时，额外合并该模块共享组数据来源。

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|------|--------|------|
| filter | query | object | 否 | - | 过滤条件（同 user-list） |
| perPage | query | number | 否 | 20 | 每页数量 |
| currentPage | query | number | 否 | 1 | 当前页码 |
| type | query | string | 否 | orgSubtree | 数据范围：`self` / `owner` / `org` / `orgSubtree` |
| moduleCode | query | string | 否 | - | 非空时合并该模块下共享组数据来源 |
| permissionCode | query | string | 否 | - | 功能权限码：校验当前用户是否拥有该权限，并用于定位模块以合并共享组 |

#### 修改租户用户状态

POST `/api/tenant/user-set-status`

| 参数 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| id | body | string | 是 | 用户 ID |
| status | body | string | 是 | 状态：open / closed |

#### 获取用户邀请链接

GET `/api/tenant/user-invite-token`

| 参数 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| id | query | string | 是 | 用户 ID |

#### 发送邀请租户消息

POST `/api/tenant/send-invite-message`

| 参数 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| id | body | string | 是 | 用户 ID |

---

### 自定义组件 API（租户侧）

#### 自定义组件详情

GET `/api/tenant/custom-component-detail`

| 参数 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| key | query | string | 是 | 组件标识 |

---

### 角色管理 API（租户侧）

#### 创建租户角色

POST `/api/tenant/role/create`

| 参数 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| name | body | string | 是 | 名称 |
| code | body | string | 是 | 编码 |
| description | body | string | 否 | 描述，默认空 |
| status | body | string | 否 | 状态：open / closed，默认 open |
| type | body | string | 否 | 类型：system / custom，默认 custom |
| options | body | object | 否 | 扩展配置 |
| createdTenantUserId | body | string | 否 | 创建者 ID |

#### 租户角色列表

GET `/api/tenant/role/list`

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|------|--------|------|
| filter | query | object | 否 | {} | 过滤条件 |
| filter.keyword | query | string | 否 | - | 名称 / 编码 / 描述模糊搜索 |
| filter.type | query | string | 否 | - | 角色类型：system / custom |
| filter.status | query | string | 否 | - | 状态：open / closed |
| perPage | query | number | 否 | 20 | 每页数量 |
| currentPage | query | number | 否 | 1 | 当前页码 |

#### 删除租户角色

POST `/api/tenant/role/remove`

| 参数 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| id | body | string | 是 | 角色 ID |

#### 修改租户角色状态

POST `/api/tenant/role/set-status`

| 参数 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| id | body | string | 是 | 角色 ID |
| status | body | string | 是 | 状态：open / closed |

#### 编辑租户角色

POST `/api/tenant/role/save`

| 参数 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| id | body | string | 是 | 角色 ID |
| name | body | string | 否 | 名称 |
| code | body | string | 否 | 编码 |
| description | body | string | 否 | 描述 |
| status | body | string | 否 | 状态 |
| type | body | string | 否 | 类型 |
| options | body | object | 否 | 扩展配置 |

#### 租户角色权限列表

GET `/api/tenant/role/permission-list`

| 参数 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| id | query | string | 是 | 角色 ID |

#### 保存租户角色权限

POST `/api/tenant/role/save-permission`

| 参数 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| id | body | string | 是 | 角色 ID |
| permissions | body | array\<string\> | 是 | 权限编码列表 |

---

### 权限 API（租户侧）

#### 租户权限列表

GET `/api/tenant/permission/list`

无参数

---

### 共享组 API（租户侧）

#### 共享组列表

GET `/api/tenant/shared_group/list`

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|------|--------|------|
| filter | query | object | 否 | {} | 过滤条件 |
| perPage | query | number | 否 | 20 | 每页数量 |
| currentPage | query | number | 否 | 1 | 当前页码 |

#### 创建共享组

POST `/api/tenant/shared_group/create`

| 参数 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| name | body | string | 是 | 共享组名称 |
| description | body | string | 否 | 说明 |
| sharedModules | body | array | 否 | 共享模块列表，默认 [] |
| sharedModules[].moduleCode | body | string | 是 | 模块编码 |
| sharedModules[].access | body | string | 是 | 访问权限：read / write |
| dataSourceTenantUserIds | body | array\<string\> | 否 | 数据来源租户用户 ID 列表，默认 [] |
| memberTenantUserIds | body | array\<string\> | 否 | 成员租户用户 ID 列表，默认 [] |
| status | body | string | 否 | 状态：open / closed |
| options | body | object | 否 | 扩展字段 |

#### 编辑共享组

POST `/api/tenant/shared_group/save`

| 参数 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| id | body | string | 是 | 共享组 ID |
| name | body | string | 否 | 共享组名称 |
| description | body | string | 否 | 说明 |
| sharedModules | body | array | 否 | 共享模块列表 |
| dataSourceTenantUserIds | body | array\<string\> | 否 | 数据来源租户用户 ID 列表 |
| memberTenantUserIds | body | array\<string\> | 否 | 成员租户用户 ID 列表 |
| status | body | string | 否 | 状态 |
| options | body | object | 否 | 扩展字段 |

#### 修改共享组状态

POST `/api/tenant/shared_group/set-status`

| 参数 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| id | body | string | 是 | 共享组 ID |
| status | body | string | 是 | 状态：open / closed |

#### 删除共享组

POST `/api/tenant/shared_group/remove`

| 参数 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| id | body | string | 是 | 共享组 ID |

---

### 管理员 - 租户管理 API

以下接口需用户认证 + 管理员认证，body 中须显式传 `tenantId`。

#### 租户列表

GET `/api/tenant/admin/list`

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|------|--------|------|
| filter | query | object | 否 | - | 过滤条件 |
| perPage | query | number | 否 | 20 | 每页数量 |
| currentPage | query | number | 否 | 1 | 当前页码 |

#### 租户详情

GET `/api/tenant/admin/detail`

| 参数 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| id | query | string | 是 | 租户 ID |

#### 添加租户

POST `/api/tenant/admin/create`

| 参数 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| name | body | string | 是 | 租户名称 |
| themeColor | body | string | 是 | 主题色 |
| logo | body | string | 是 | Logo |
| serviceStartTime | body | string | 是 | 服务开始时间 |
| serviceEndTime | body | string | 是 | 服务结束时间 |
| status | body | string | 否 | 状态：open / closed |
| accountCount | body | number | 否 | 最大账号数量 |
| description | body | string | 否 | 描述 |
| supportLanguage | body | array\<string\> | 否 | 支持语言 |
| defaultLanguage | body | string | 否 | 默认语言 |

#### 保存租户

POST `/api/tenant/admin/save`

| 参数 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| id | body | string | 是 | 租户 ID |
| name | body | string | 否 | 租户名称 |
| themeColor | body | string | 否 | 主题色 |
| logo | body | string | 否 | Logo |
| status | body | string | 否 | 状态 |
| accountCount | body | number | 否 | 最大账号数量 |
| description | body | string | 否 | 描述 |
| supportLanguage | body | array\<string\> | 否 | 支持语言 |
| defaultLanguage | body | string | 否 | 默认语言 |
| serviceStartTime | body | string | 否 | 服务开始时间 |
| serviceEndTime | body | string | 否 | 服务结束时间 |

#### 保存租户系统语言设置

POST `/api/tenant/admin/save-languages`

仅管理员可写。更新租户 `supportLanguage` / `defaultLanguage`。

| 参数 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| tenantId | body | string | 是 | 租户 ID |
| supportLanguage | body | array\<string\> | 是 | 支持语言列表，至少 1 项 |
| defaultLanguage | body | string | 是 | 默认语言，必须在 supportLanguage 内 |

返回 `{ supportLanguage, defaultLanguage }`。

#### 设置租户状态

POST `/api/tenant/admin/set-status`

| 参数 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| id | body | string | 是 | 租户 ID |
| status | body | string | 是 | 状态 |

#### 删除租户

POST `/api/tenant/admin/remove`

| 参数 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| id | body | string | 是 | 租户 ID |

---

### 管理员 - 环境变量管理 API

#### 设置租户环境变量

POST `/api/tenant/admin/append-args`

| 参数 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| tenantId | body | string | 是 | 租户 ID |
| args | body | array | 是 | 环境变量列表，至少 1 条 |

`args[]` 每项字段：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| key | string | 是 | 变量名 |
| value | string | 是 | 变量值 |
| secret | boolean | 否 | 是否为密钥，默认 false |

#### 删除环境变量

POST `/api/tenant/admin/remove-arg`

| 参数 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| tenantId | body | string | 是 | 租户 ID |
| key | body | string | 是 | 变量名 |

---

### 管理员 - 自定义组件管理 API

#### 设置租户自定义组件

POST `/api/tenant/admin/append-custom-component`

| 参数 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| tenantId | body | string | 是 | 租户 ID |
| customComponent | body | object | 是 | 自定义组件 |

`customComponent` 结构：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| key | string | 是 | 组件标识 |
| name | string | 是 | 组件名称 |
| type | string | 是 | 组件类型 |
| content | string | 是 | 组件内容 |
| description | string | 否 | 组件描述 |

#### 自定义组件详情

GET `/api/tenant/admin/custom-component-detail`

| 参数 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| tenantId | query | string | 是 | 租户 ID |
| key | query | string | 是 | 组件标识 |

#### 删除自定义组件

POST `/api/tenant/admin/remove-custom-component`

| 参数 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| tenantId | body | string | 是 | 租户 ID |
| key | body | string | 是 | 组件标识 |

#### 保存自定义组件

POST `/api/tenant/admin/save-custom-component`

| 参数 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| tenantId | body | string | 是 | 租户 ID |
| customComponent | body | object | 是 | 自定义组件（结构同上） |

#### 复制自定义组件

POST `/api/tenant/admin/copy-custom-component`

| 参数 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| tenantId | body | string | 是 | 租户 ID |
| key | body | string | 是 | 组件标识 |

---

### 管理员 - 公司信息 API

#### 查询公司信息

GET `/api/tenant/admin/company-detail`

| 参数 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| tenantId | query | string | 是 | 租户 ID |

#### 保存公司信息

POST `/api/tenant/admin/company-save`

| 参数 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| tenantId | body | string | 是 | 租户 ID |
| name | body | string | 否 | 公司名称 |
| fullName | body | string | 否 | 公司全称 |
| logo | body | string | 否 | Logo |
| industry | body | string | 否 | 行业 |
| scale | body | string | 否 | 规模 |
| address | body | string | 否 | 地址 |
| phone | body | string | 否 | 电话 |
| email | body | string | 否 | 邮箱 |
| foundedDate | body | string | 否 | 成立日期 |
| companyTags | body | array\<object\> | 否 | 公司标签 |
| website | body | string | 否 | 主页 |
| description | body | string | 否 | 描述 |
| banners | body | array\<object\> | 否 | Banner 图片列表 |
| teamDescription | body | object | 否 | 团队介绍 |
| developmentHistory | body | object | 否 | 发展历程 |
| contact | body | object | 否 | 联系方式 |
| options | body | object | 否 | 扩展字段 |

---

### 管理员 - 组织架构 API

#### 创建组织节点

POST `/api/tenant/admin/org-create`

| 参数 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| tenantId | body | string | 是 | 租户 ID |
| name | body | string | 是 | 名称 |
| parentId | body | string | 否 | 父级 ID |
| description | body | string | 否 | 描述 |
| leaderUserId | body | string \| null | 否 | 部门负责人（租户用户 ID） |

#### 获取租户组织

GET `/api/tenant/admin/org-list`

| 参数 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| tenantId | query | string | 是 | 租户 ID |

#### 删除组织节点

POST `/api/tenant/admin/org-remove`

| 参数 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| tenantId | body | string | 是 | 租户 ID |
| id | body | string | 是 | 组织节点 ID |

#### 编辑组织节点

POST `/api/tenant/admin/org-save`

| 参数 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| tenantId | body | string | 是 | 租户 ID |
| id | body | string | 是 | 组织节点 ID |
| name | body | string | 否 | 名称 |
| description | body | string | 否 | 描述 |
| leaderUserId | body | string \| null | 否 | 部门负责人（传 null 清空） |

#### 批量导入组织与用户

POST `/api/tenant/admin/org-batch-import`

body 须含 tenantId。

| 参数 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| tenantId | body | string | 是 | 租户 ID |
| parentOrgId | body | string | 否 | 锚点组织节点 ID |
| rows | body | array | 是 | 行对象列表，字段同租户侧批量导入 |

返回值同租户侧批量导入。

---

### 管理员 - 用户管理 API

#### 创建租户用户

POST `/api/tenant/admin/user-create`

| 参数 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| tenantId | body | string | 是 | 租户 ID |
| name | body | string | 是 | 姓名 |
| tenantOrgId | body | string \| null | 否 | 组织 ID（兼容），默认 null |
| tenantOrgIds | body | array\<string\> | 否 | 所属组织 ID 列表，默认 [] |
| roles | body | array\<string\> | 否 | 角色 ID 列表，默认 [] |
| avatar | body | string | 否 | 头像，默认空 |
| email | body | string \| null | 否 | 邮箱，默认 null |
| phone | body | string | 否 | 手机号，默认空 |
| description | body | string | 否 | 描述，默认空 |

#### 编辑租户用户

POST `/api/tenant/admin/user-save`

| 参数 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| id | body | string | 是 | 用户 ID |
| tenantId | body | string | 是 | 租户 ID |
| name | body | string | 是 | 姓名 |
| tenantOrgId | body | string \| null | 否 | 组织 ID（兼容） |
| tenantOrgIds | body | array\<string\> | 否 | 所属组织 ID 列表 |
| roles | body | array\<string\> | 否 | 角色 ID 列表 |
| avatar | body | string | 否 | 头像 |
| email | body | string \| null | 否 | 邮箱 |
| phone | body | string | 否 | 手机号 |
| description | body | string | 否 | 描述 |

#### 删除租户用户

POST `/api/tenant/admin/user-remove`

| 参数 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| id | body | string | 是 | 用户 ID |
| tenantId | body | string | 是 | 租户 ID |

#### 租户用户列表

GET `/api/tenant/admin/user-list`

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|------|--------|------|
| tenantId | query | string | 是 | - | 租户 ID |
| filter | query | object | 否 | - | 过滤条件 |
| perPage | query | number | 否 | 20 | 每页数量 |
| currentPage | query | number | 否 | 1 | 当前页码 |

#### 获取租户用户详情

GET `/api/tenant/admin/user-detail`

| 参数 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| id | query | string | 是 | 用户 ID |
| tenantId | query | string | 是 | 租户 ID |

#### 修改租户用户状态

POST `/api/tenant/admin/user-set-status`

| 参数 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| tenantId | body | string | 是 | 租户 ID |
| id | body | string | 是 | 用户 ID |
| status | body | string | 是 | 状态：open / closed |

#### 查看租户用户权限列表

GET `/api/tenant/admin/user-permission-list`

| 参数 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| tenantId | query | string | 是 | 租户 ID |
| id | query | string | 是 | 用户 ID |

#### 获取用户邀请链接

GET `/api/tenant/admin/user-invite-token`

| 参数 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| tenantId | query | string | 是 | 租户 ID |
| id | query | string | 是 | 用户 ID |

#### 发送邀请租户消息

POST `/api/tenant/admin/send-invite-message`

| 参数 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| tenantId | body | string | 是 | 租户 ID |
| id | body | string | 是 | 用户 ID |

---

### 管理员 - 角色管理 API

#### 创建租户角色

POST `/api/tenant/admin/role/create`

| 参数 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| tenantId | body | string | 是 | 租户 ID |
| name | body | string | 是 | 名称 |
| code | body | string | 是 | 编码 |
| description | body | string | 否 | 描述，默认空 |
| status | body | string | 否 | 状态：open / closed，默认 open |
| type | body | string | 否 | 类型：system / custom，默认 custom |
| options | body | object | 否 | 扩展配置 |
| createdTenantUserId | body | string | 否 | 创建者 ID |

#### 租户角色列表

GET `/api/tenant/admin/role/list`

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|------|--------|------|
| tenantId | query | string | 是 | - | 租户 ID |
| filter | query | object | 否 | {} | 过滤条件 |
| filter.keyword | query | string | 否 | - | 名称 / 编码 / 描述模糊搜索 |
| filter.type | query | string | 否 | - | 角色类型：system / custom |
| filter.status | query | string | 否 | - | 状态：open / closed |
| perPage | query | number | 否 | 20 | 每页数量 |
| currentPage | query | number | 否 | 1 | 当前页码 |

#### 删除租户角色

POST `/api/tenant/admin/role/remove`

| 参数 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| tenantId | body | string | 是 | 租户 ID |
| id | body | string | 是 | 角色 ID |

#### 修改租户角色状态

POST `/api/tenant/admin/role/set-status`

| 参数 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| tenantId | body | string | 是 | 租户 ID |
| id | body | string | 是 | 角色 ID |
| status | body | string | 是 | 状态：open / closed |

#### 编辑租户角色

POST `/api/tenant/admin/role/save`

| 参数 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| id | body | string | 是 | 角色 ID |
| tenantId | body | string | 是 | 租户 ID |
| name | body | string | 否 | 名称 |
| code | body | string | 否 | 编码 |
| description | body | string | 否 | 描述 |
| status | body | string | 否 | 状态 |
| type | body | string | 否 | 类型 |
| options | body | object | 否 | 扩展配置 |

#### 租户角色权限列表

GET `/api/tenant/admin/role/permission-list`

| 参数 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| tenantId | query | string | 是 | 租户 ID |
| id | query | string | 是 | 角色 ID |

#### 保存租户角色权限

POST `/api/tenant/admin/role/save-permission`

| 参数 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| tenantId | body | string | 是 | 租户 ID |
| id | body | string | 是 | 角色 ID |
| permissions | body | array\<string\> | 是 | 权限编码列表 |

---

### 管理员 - 权限管理 API

#### 租户权限列表

GET `/api/tenant/admin/permission/list`

| 参数 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| tenantId | query | string | 是 | 租户 ID |

#### 保存租户权限

POST `/api/tenant/admin/permission/save`

| 参数 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| tenantId | body | string | 是 | 租户 ID |
| permissions | body | array\<string\> | 是 | 权限编码列表 |

---

### 管理员 - 共享组 API

#### 租户共享组列表

GET `/api/tenant/admin/shared_group/list`

| 参数 | 位置 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|------|--------|------|
| tenantId | query | string | 是 | - | 租户 ID |
| filter | query | object | 否 | {} | 过滤条件 |
| perPage | query | number | 否 | 20 | 每页数量 |
| currentPage | query | number | 否 | 1 | 当前页码 |

#### 创建租户共享组

POST `/api/tenant/admin/shared_group/create`

| 参数 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| tenantId | body | string | 是 | 租户 ID |
| name | body | string | 是 | 共享组名称 |
| description | body | string | 否 | 说明 |
| sharedModules | body | array | 否 | 共享模块列表 |
| sharedModules[].moduleCode | body | string | 是 | 模块编码 |
| sharedModules[].access | body | string | 是 | 访问权限：read / write |
| dataSourceTenantUserIds | body | array\<string\> | 否 | 数据来源租户用户 ID 列表 |
| memberTenantUserIds | body | array\<string\> | 否 | 成员租户用户 ID 列表 |
| status | body | string | 否 | 状态 |
| options | body | object | 否 | 扩展字段 |

#### 编辑租户共享组

POST `/api/tenant/admin/shared_group/save`

| 参数 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| tenantId | body | string | 是 | 租户 ID |
| id | body | string | 是 | 共享组 ID |
| name | body | string | 否 | 共享组名称 |
| description | body | string | 否 | 说明 |
| sharedModules | body | array | 否 | 共享模块列表 |
| dataSourceTenantUserIds | body | array\<string\> | 否 | 数据来源租户用户 ID 列表 |
| memberTenantUserIds | body | array\<string\> | 否 | 成员租户用户 ID 列表 |
| status | body | string | 否 | 状态 |
| options | body | object | 否 | 扩展字段 |

#### 修改租户共享组状态

POST `/api/tenant/admin/shared_group/set-status`

| 参数 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| tenantId | body | string | 是 | 租户 ID |
| id | body | string | 是 | 共享组 ID |
| status | body | string | 是 | 状态：open / closed |

#### 删除租户共享组

POST `/api/tenant/admin/shared_group/remove`

| 参数 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| tenantId | body | string | 是 | 租户 ID |
| id | body | string | 是 | 共享组 ID |

---

### 错误响应

业务错误使用统一格式返回：

| 字段 | 类型 | 说明 |
|------|------|------|
| code | string | 错误码，如 `USER_EMAIL_DUPLICATE` |
| message | string | 错误描述 |

常见错误码：

| 错误码 | HTTP 状态 | 说明 |
|--------|-----------|------|
| USER_EMAIL_DUPLICATE | 400 | 邮箱在租户内已存在 |
| USER_PHONE_DUPLICATE | 400 | 手机号在租户内已存在 |
| USER_CONTACT_REQUIRED | 400 | 手机号或邮箱不能同时为空 |
| ROLE_NOT_FOUND | 404 | 角色不存在 |
| ROLE_SYSTEM_IMMUTABLE | 400 | 系统角色不可修改 / 删除 |
| ROLE_IN_USE | 400 | 角色已被用户关联，不能删除 |
