const fp = require('fastify-plugin');
const path = require('node:path');

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
        }
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
          'authenticate',
          {
            tenantUser: async request => {
              const { services } = fastify[options.name];
              request[options.tenantUserContextName] = await services.user.getTenantUserInfo(request.userInfo);
            }
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
