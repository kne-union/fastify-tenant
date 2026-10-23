const fp = require('fastify-plugin');
const path = require('node:path');
const yml = require('js-yaml');
const fs = require('node:fs/promises');
const { BusinessError } = require('./libs/utils/errors');
const { locale, createError, createTranslator } = require('./libs/utils/intl');
const httpErrors = require('http-errors');
const { Unauthorized } = httpErrors;

module.exports = fp(
  async function (fastify, options) {
    // 注册 BusinessError 全局错误处理器
    fastify.setErrorHandler((error, request, reply) => {
      if (error instanceof BusinessError) {
        reply.status(error.status);
        return { code: error.code, message: error.message };
      }
      // 交给 Fastify 默认处理
      reply.send(error);
    });

    options = Object.assign(
      {},
      {
        dbTableNamePrefix: 't_',
        name: 'tenant',
        prefix: '/api/tenant',
        clientTokenHeader: 'x-client-user-token',
        thirdLoginTokenHeader: 'x-third-login-token',
        tenantUserContextName: 'tenantUserInfo',
        intlNamespace: 'intl',
        getUserModel: () => {
          if (!fastify.account) {
            throw new Error('请先安装fastify-account插件或者实现options.getUserModel');
          }
          return fastify.account.models.user;
        },
        getUserAuthenticate: () => {
          if (!fastify.account) {
            throw new Error('请先安装fastify-account插件或者实现options.getUserAuthenticate');
          }
          return fastify.account.authenticate.user;
        },
        getAdminUserAuthenticate: () => {
          if (!fastify.account) {
            throw new Error('请先安装fastify-account插件或者实现options.getAdminUserAuthenticate');
          }
          return fastify.account.authenticate.admin;
        },
        permissionsProfile: path.resolve(process.cwd(), './libs/permissions.js'),
        syncOrgTask: null,
        sendOrgMessage: null,
        onPermissionChange: null
      },
      options
    );

    const translator = createTranslator({ fastify, options });
    fastify.addHook('onError', translator.onError);

    const mergePermissions = require('./libs/utils/mergePermissions');
    const flattenPermissions = require('./libs/utils/flattenPermissions');
    // 外部注册的权限来源（如 fastify-oidc 的子应用权限），按 key 替换，不与基础权限累加
    const permissionSources = new Map();
    let basePermissions = { modules: [] };
    const rebuildPermissions = () => {
      fastify[options.name].permissions = [...permissionSources.values()].reduce((result, source) => mergePermissions(result, source.tree), basePermissions);
    };

    const changeListeners = new Set();

    fastify.register(require('@kne/fastify-namespace'), {
      options,
      name: options.name,
      modules: [
        ['controllers', path.resolve(__dirname, './libs/controllers')],
        [
          'models',
          await fastify.sequelize.addModels(path.resolve(__dirname, './libs/models'), {
            prefix: options.dbTableNamePrefix,
            modelPrefix: options.name,
            getUserModel: options.getUserModel
          })
        ],
        ['services', path.resolve(__dirname, './libs/services')],
        ['locale', locale],
        ['translator', translator],
        [
          'utils',
          {
            mergePermissions: require('./libs/utils/mergePermissions'),
            flattenPermissions: require('./libs/utils/flattenPermissions')
          }
        ],
        [
          'authenticate',
          {
            user: async request => {
              if (!request.headers[options.thirdLoginTokenHeader]) {
                return options.getUserAuthenticate()(request);
              }
              const { services } = fastify[options.name];
              let info;
              try {
                info = await request.jwtVerify({
                  extractToken: () => request.headers[options.thirdLoginTokenHeader]
                });
              } catch (e) {
                throw createError(Unauthorized, 'authenticationFailed');
              }
              //这里判断失效时间
              if (options.jwt?.expires && Date.now() - info.iat * 1000 > options.jwt.expires) {
                throw createError(Unauthorized, 'authenticationExpired');
              }
              request.authenticatePayload = {};
              request.userInfo = {};
              request[options.tenantUserContextName] = await services.user.getThirdLoginTenantUserInfo(info.payload);
            },
            tenantUser: async request => {
              const { services } = fastify[options.name];
              if (!request[options.tenantUserContextName]) {
                const tenantId = request.authenticatePayload?.tenantId;
                request[options.tenantUserContextName] = await services.user.getTenantUserInfo(tenantId ? Object.assign({}, request.userInfo, { tenantId }) : request.userInfo);
              }
            }
          }
        ],
        [
          'permissions',
          await (async () => {
            const outside = await (async () => {
              if (
                !(
                  options.permissionsProfile &&
                  (await fs
                    .access(options.permissionsProfile)
                    .then(() => true)
                    .catch(() => false))
                )
              ) {
                return {};
              }
              try {
                const permissionsProfile = await fs.readFile(options.permissionsProfile, 'utf8');

                if (path.extname(options.permissionsProfile) === '.yml') {
                  return yml.load(permissionsProfile);
                }
                if (path.extname(options.permissionsProfile) === '.json') {
                  return JSON.parse(permissionsProfile);
                }
                if (path.extname(options.permissionsProfile) === '.js') {
                  return require(options.permissionsProfile);
                }
              } catch (e) {
                console.error(e);
                return {};
              }
            })();
            basePermissions = mergePermissions(require('./libs/permissions'), outside);
            return basePermissions;
          })()
        ],
        [
          'appendPermissions',
          outside => {
            basePermissions = mergePermissions(basePermissions, outside);
            rebuildPermissions();
          }
        ],
        [
          'setPermissionSource',
          (key, tree, { defaultDisabled = false } = {}) => {
            permissionSources.set(key, { tree: tree && Array.isArray(tree.modules) ? tree : { modules: [] }, defaultDisabled });
            rebuildPermissions();
          }
        ],
        [
          'removePermissionSource',
          key => {
            permissionSources.delete(key);
            rebuildPermissions();
          }
        ],
        [
          'getDefaultDisabledPermissionCodes',
          () => {
            const codes = new Set();
            permissionSources.forEach(source => {
              if (source.defaultDisabled) {
                flattenPermissions(source.tree).forEach(item => codes.add(item.code));
              }
            });
            return codes;
          }
        ],
        [
          'onChange',
          listener => {
            changeListeners.add(listener);
            return () => changeListeners.delete(listener);
          }
        ],
        [
          'emitChange',
          // 不阻塞业务操作：监听器异常只记录日志
          event => {
            const payload = Object.assign({}, event, { tenantId: event.tenantId && String(event.tenantId) });
            return Promise.all(
              [...changeListeners].map(listener =>
                Promise.resolve()
                  .then(() => listener(payload))
                  .catch(err => fastify.log.warn({ err, event: payload }, 'fastify-tenant: onChange 监听器执行失败'))
              )
            );
          }
        ]
      ]
    });
  },
  {
    name: 'fastify-tenant',
    dependencies: ['fastify-user']
  }
);
