// 响应 schema 会参与 fast-json-stringify 序列化：对象一律 additionalProperties: true 以免裁掉未声明字段；
// 用 nullable 而非类型数组（类型数组遇到不匹配的值会直接 500），类型不确定的字段（如外键 id）只写说明不声明类型
const str = description => ({ type: 'string', nullable: true, description });
const num = description => ({ type: 'number', nullable: true, description });
const bool = description => ({ type: 'boolean', nullable: true, description });
const any = description => ({ description });
const strArray = description => ({ type: 'array', nullable: true, description, items: { type: 'string' } });
const list = (description, items) => ({ type: 'array', nullable: true, description, items });
const obj = (description, properties = {}) => ({ type: 'object', nullable: true, description, additionalProperties: true, properties });

const timestamps = () => ({
  createdAt: any('创建时间'),
  updatedAt: any('更新时间')
});

const success = (description, schema) => ({
  200: Object.assign({}, schema || { type: 'object' }, { description })
});

const empty = (description = '操作成功，返回空对象') => success(description);

const pageResult = (description, item) => ({
  type: 'object',
  additionalProperties: true,
  properties: {
    pageData: list(`当前页${description}列表`, item),
    totalCount: num('符合条件的总条数')
  }
});

const company = () =>
  obj('公司信息', {
    id: str('公司信息 ID'),
    tenantId: any('所属租户 ID'),
    name: str('公司名称'),
    fullName: str('公司全称'),
    logo: str('公司 Logo 文件 ID'),
    industry: str('所属行业'),
    scale: str('公司规模'),
    address: str('公司地址'),
    phone: str('联系电话'),
    email: str('联系邮箱'),
    foundedDate: any('成立日期'),
    companyTags: any('公司标签列表'),
    website: str('公司主页'),
    description: str('公司描述'),
    banners: any('banner 图片文件 ID 列表'),
    teamDescription: any('团队介绍'),
    developmentHistory: any('发展历程'),
    contact: any('联系方式'),
    options: any('扩展字段'),
    ...timestamps()
  });

const tenantSetting = () =>
  obj('租户设置（环境变量、自定义组件、租户权限等；密钥不返回）', {
    id: str('租户设置 ID'),
    args: any('租户环境变量列表'),
    customComponents: any('租户自定义组件列表'),
    permissions: any('租户已开通的权限码列表'),
    options: any('租户配置项，如 allowThirdLoginBind')
  });

const tenant = () =>
  obj('租户信息', {
    id: str('租户 ID'),
    name: str('租户名称'),
    status: str('租户状态：open 开启，closed 关闭'),
    themeColor: str('主题色'),
    logo: str('租户 Logo 文件 ID'),
    accountCount: num('最大账号数量'),
    description: str('租户描述'),
    supportLanguage: any('支持的系统语言列表'),
    defaultLanguage: str('默认系统语言'),
    serviceStartTime: any('服务开始时间'),
    serviceEndTime: any('服务结束时间'),
    options: any('扩展字段；托管租户含 managedBy'),
    tenantCompany: company(),
    tenantSetting: tenantSetting(),
    ...timestamps()
  });

const roleBrief = () =>
  obj('角色摘要', {
    id: str('列表接口为角色 ID；详情接口 roleDetails 中为角色编码'),
    code: str('角色编码'),
    name: str('角色名称'),
    description: str('角色描述'),
    type: str('角色类型：system 系统角色，custom 自定义角色')
  });

const tenantUser = () =>
  obj('租户用户信息', {
    id: str('租户用户 ID'),
    tenantId: any('所属租户 ID'),
    userId: any('关联的账号用户 ID，未加入时为空'),
    name: str('姓名'),
    avatar: str('头像文件 ID'),
    gender: str('性别：F 女，M 男'),
    email: str('邮箱'),
    phone: str('手机号'),
    description: str('描述'),
    status: str('状态：open 正常，closed 关闭'),
    roles: any('角色：列表接口为角色摘要对象数组，其余为角色 ID 数组'),
    roleDetails: list('角色详情列表', roleBrief()),
    tenantOrgIds: strArray('所属组织 ID 列表'),
    tenantOrgs: list(
      '所属组织列表',
      obj('所属组织', {
        id: str('组织 ID'),
        name: str('组织名称'),
        path: str('组织名称路径')
      })
    ),
    tenantOrgPath: str('所属组织名称路径，多个以“；”分隔'),
    synced: bool('是否通过组织同步进入系统'),
    syncSource: str('同步源标识'),
    sourceId: str('同步源中的原始 ID'),
    options: any('扩展字段，含第三方登录绑定信息'),
    tenant: any('所属租户信息（详情、可用租户列表返回）'),
    ...timestamps()
  });

const org = () =>
  obj('组织节点', {
    id: str('组织 ID'),
    tenantId: any('所属租户 ID'),
    parentId: any('父级组织 ID，根节点为空'),
    name: str('组织名称'),
    description: str('组织描述'),
    index: num('排序'),
    leaderUserId: any('部门负责人（租户用户 ID）'),
    leader: obj('部门负责人信息', {
      id: str('租户用户 ID'),
      name: str('姓名'),
      email: str('邮箱'),
      phone: str('手机号'),
      avatar: str('头像文件 ID'),
      status: str('状态')
    }),
    status: str('状态：open 开启，closed 关闭'),
    userCount: num('本节点及下级组织的用户数（仅列表返回）'),
    synced: bool('是否通过组织同步进入系统'),
    syncSource: str('同步源标识'),
    sourceId: str('同步源中的原始 ID'),
    options: any('扩展字段'),
    ...timestamps()
  });

const role = () =>
  obj('角色信息', {
    id: str('角色 ID'),
    tenantId: any('所属租户 ID'),
    name: str('角色名称'),
    code: str('角色编码'),
    type: str('角色类型：system 系统角色，custom 自定义角色'),
    permissions: strArray('角色拥有的权限码列表'),
    description: str('角色描述'),
    status: str('状态：open 开启，closed 关闭'),
    options: any('扩展字段'),
    ...timestamps()
  });

const sharedGroup = () =>
  obj('共享组信息', {
    id: str('共享组 ID'),
    tenantId: any('所属租户 ID'),
    name: str('共享组名称'),
    description: str('共享组说明'),
    sharedModules: any('共享模块列表 [{ moduleCode, access }]，access 为 read | write'),
    createdTenantUserId: any('创建人（租户用户 ID）'),
    status: str('状态：open 开启，closed 关闭'),
    options: any('扩展字段'),
    dataSources: any('数据来源成员列表（含租户用户信息）'),
    members: any('共享组成员列表（含租户用户信息）'),
    ...timestamps()
  });

const permissionTree = () => obj('权限树（modules 嵌套模块，permissions 为功能权限；名称按请求语言翻译）', { modules: any('权限模块列表') });

const permissionResult = description =>
  obj(description, {
    codes: strArray('已开通（已授权）的权限码列表'),
    permissions: permissionTree()
  });

const customComponent = () =>
  obj('自定义组件，不存在时为 null', {
    id: str('自定义组件 ID'),
    content: str('组件内容'),
    options: any('扩展配置'),
    ...timestamps()
  });

const sourceOptions = () => any('可选的第三方渠道列表 [{ value, label }]');

const thirdLoginConfigList = () =>
  obj('第三方登录配置', {
    sourceOptions: sourceOptions(),
    list: list(
      '已配置的第三方登录渠道列表',
      obj('第三方登录渠道', {
        source: str('渠道：wecom 企业微信，dingtalk 钉钉，beisen 北森'),
        targetId: str('关联的租户环境变量目标 ID'),
        props: any('渠道配置参数')
      })
    ),
    allowThirdLoginBind: bool('是否允许用户自定义绑定第三方账号')
  });

const thirdLoginBindSetting = () => obj('第三方登录自定义绑定开关', { allowThirdLoginBind: bool('是否允许用户自定义绑定第三方账号') });

const thirdLoginBindToken = () =>
  obj('第三方登录绑定链接', {
    bindToken: str('绑定短链 token'),
    token: str('同 bindToken'),
    url: str('绑定链接地址'),
    expiresAt: num('过期时间戳（毫秒）'),
    expiresIn: num('有效期（秒）'),
    platform: str('第三方渠道'),
    targetId: str('关联的租户环境变量目标 ID')
  });

const orgSyncConfig = () =>
  obj('组织关联配置', {
    enabled: bool('是否已开启组织关联'),
    source: str('同步源：wecom 企业微信，dingtalk 钉钉，beisen 北森'),
    syncInterval: str('同步周期：daily / weekly / monthly / yearly / off'),
    targetId: str('关联的租户环境变量目标 ID'),
    lastSyncTime: any('最后同步时间'),
    status: str('同步状态'),
    props: any('同步源配置参数'),
    syncSupported: bool('宿主是否实现了组织同步任务'),
    sourceOptions: sourceOptions()
  });

const orgImportResult = () =>
  obj('批量导入结果', {
    createdOrgs: num('新建的组织数量'),
    createdUsers: num('新建的用户数量'),
    rowCount: num('有效导入行数')
  });

const orgMessageResult = () => obj('发送结果', { count: num('实际发送到的外部用户数量') });

const languages = () =>
  obj('租户系统语言设置', {
    supportLanguage: strArray('支持的系统语言列表'),
    defaultLanguage: str('默认系统语言')
  });

const inviteToken = () => obj('邀请信息', { token: str('邀请 token，有效期 7 天') });

module.exports = {
  str,
  num,
  bool,
  any,
  strArray,
  list,
  obj,
  success,
  empty,
  pageResult,
  company,
  tenant,
  tenantUser,
  org,
  role,
  sharedGroup,
  permissionTree,
  permissionResult,
  customComponent,
  thirdLoginConfigList,
  thirdLoginBindSetting,
  thirdLoginBindToken,
  orgSyncConfig,
  orgImportResult,
  orgMessageResult,
  languages,
  inviteToken
};
