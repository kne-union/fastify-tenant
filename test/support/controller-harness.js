'use strict';

const Fastify = require('fastify');

const noop = async () => {};

function createControllerServices(overrides = {}) {
  const base = {
    user: {
      parseToken: async () => ({ tenant: {}, company: {}, tenantUser: {} }),
      join: noop,
      tenantList: async () => ({ list: [], defaultTenantId: null }),
      setDefaultTenant: noop,
      create: noop,
      detail: async () => ({ id: 'u1' }),
      save: noop,
      remove: noop,
      list: async () => ({ pageData: [], totalCount: 0 }),
      setStatus: noop,
      inviteToken: async () => ({ token: 't' }),
      sendInviteMessage: noop,
      permissionList: async () => ({ codes: [] })
    },
    company: {
      detail: async () => ({ id: 'c1' }),
      save: async b => b
    },
    org: {
      create: async b => b,
      list: async () => [],
      remove: noop,
      save: noop,
      importFromRows: async () => ({ createdOrgs: 0, createdUsers: 0, reusedUsers: 0, rowCount: 0 })
    },
    setting: {
      appendArgs: noop,
      removeArg: noop,
      appendCustomComponent: noop,
      customComponentDetail: async () => ({ id: 'cc1' }),
      removeCustomComponent: noop,
      saveCustomComponents: noop,
      copyCustomComponent: noop
    },
    tenant: {
      list: async () => ({ pageData: [], totalCount: 0 }),
      detail: async () => ({ id: 't1' }),
      create: async b => Object.assign({ id: 't1' }, b),
      save: async b => b,
      setStatus: noop,
      remove: noop
    },
    role: {
      create: async b => Object.assign({ id: 'r1' }, b),
      list: async () => ({ pageData: [], totalCount: 0 }),
      remove: noop,
      setStatus: noop,
      save: async b => b,
      permissionList: async () => ({ codes: [], permissions: {} }),
      savePermission: noop
    },
    permission: {
      list: async () => ({ codes: [], permissions: {} }),
      save: noop
    },
    sharedGroup: {
      list: async () => ({ pageData: [], totalCount: 0 }),
      create: async b => Object.assign({ id: 'sg1' }, b),
      save: async b => b,
      setStatus: noop,
      remove: noop
    },
    dataScope: {
      resolveOrgRuleTenantUserIds: async () => ['u1'],
      resolveVisibleTenantUserIds: async () => ['u1', 'u2'],
      resolveTenantUserIdsByPermissionCode: async () => ({
        tenantUserIds: ['u1'],
        moduleCode: 'setting:permission:shared-group',
        type: 'org',
        dataScopeOpen: true
      })
    }
  };
  return Object.assign(base, overrides);
}

function authNoop() {
  return async () => {};
}

async function registerTenantUserController(fastify, name, prefix, services) {
  fastify.decorate(name, {
    services,
    authenticate: {
      tenantUser: async request => {
        request.tenantUserInfo = {
          tenantId: 'tid-1',
          tenant: { id: 'tid-1', name: 'Tn', tenantCompany: { name: 'Co' } }
        };
      }
    }
  });
  await fastify.register(require('../../libs/controllers/tenant.js'), {
    name,
    prefix,
    getUserAuthenticate: authNoop
  });
}

async function registerTenantAdminController(fastify, name, prefix, services) {
  fastify.decorate(name, { services });
  await fastify.register(require('../../libs/controllers/tenant-admin.js'), {
    name,
    prefix,
    getUserAuthenticate: authNoop,
    getAdminUserAuthenticate: authNoop
  });
}

async function registerTenantPermissionController(fastify, name, prefix, services) {
  fastify.decorate(name, {
    services,
    authenticate: {
      tenantUser: async request => {
        request.tenantUserInfo = { tenantId: 'tid-1' };
      }
    }
  });
  await fastify.register(require('../../libs/controllers/tenant-permission.js'), {
    name,
    prefix,
    getUserAuthenticate: authNoop
  });
}

async function registerTenantAdminPermissionController(fastify, name, prefix, services) {
  fastify.decorate(name, { services });
  await fastify.register(require('../../libs/controllers/tenant-admin-permission.js'), {
    name,
    prefix,
    getUserAuthenticate: authNoop,
    getAdminUserAuthenticate: authNoop
  });
}

async function registerTenantSharedGroupController(fastify, name, prefix, services) {
  fastify.decorate(name, {
    services,
    authenticate: {
      tenantUser: async request => {
        request.tenantUserInfo = { tenantId: 'tid-1', id: 'tu-1' };
      }
    }
  });
  await fastify.register(require('../../libs/controllers/tenant-shared-group.js'), {
    name,
    prefix,
    getUserAuthenticate: authNoop
  });
}

async function registerTenantAdminSharedGroupController(fastify, name, prefix, services) {
  fastify.decorate(name, { services });
  await fastify.register(require('../../libs/controllers/tenant-admin-shared-group.js'), {
    name,
    prefix,
    getUserAuthenticate: authNoop,
    getAdminUserAuthenticate: authNoop
  });
}

module.exports = {
  Fastify,
  createControllerServices,
  registerTenantUserController,
  registerTenantAdminController,
  registerTenantPermissionController,
  registerTenantAdminPermissionController,
  registerTenantSharedGroupController,
  registerTenantAdminSharedGroupController
};
