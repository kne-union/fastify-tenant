const fp = require('fastify-plugin');
const path = require('node:path');
const yml = require('js-yaml');
const fs = require('node:fs/promises');
const { BusinessError } = require('./libs/utils/errors');
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
        sendOrgMessage: null
      },
      options
    );

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
                throw Unauthorized('身份认证失败');
              }
              //这里判断失效时间
              if (options.jwt?.expires && Date.now() - info.iat * 1000 > options.jwt.expires) {
                throw Unauthorized('身份认证超时');
              }
              request.authenticatePayload = {};
              request.userInfo = {};
              request[options.tenantUserContextName] = await services.user.getThirdLoginTenantUserInfo(info.payload);
            },
            tenantUser: async request => {
              const { services } = fastify[options.name];
              if (!request[options.tenantUserContextName]) {
                request[options.tenantUserContextName] = await services.user.getTenantUserInfo(request.userInfo);
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
            const result = require('./libs/permissions');
            const mergePermissions = require('./libs/utils/mergePermissions');
            return mergePermissions(result, outside);
          })()
        ],
        [
          'appendPermissions',
          outside => {
            const { permissions, utils } = fastify[options.name];
            fastify[options.name].permissions = utils.mergePermissions(permissions, outside);
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
