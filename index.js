const fp = require('fastify-plugin');
const path = require('node:path');
const yml = require('js-yaml');
const fs = require('node:fs/promises');

module.exports = fp(
  async (fastify, options) => {
    options = Object.assign(
      {},
      {
        dbTableNamePrefix: 't_',
        name: 'tenant',
        prefix: '/api/tenant',
        clientTokenHeader: 'x-client-user-token',
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
        permissionsProfile: path.resolve(process.cwd(), './libs/permissions.js')
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
            tenantUser: async request => {
              const { services } = fastify[options.name];
              request[options.tenantUserContextName] = await services.user.getTenantUserInfo(request.userInfo);
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
