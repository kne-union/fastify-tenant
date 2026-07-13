'use strict';

const Fastify = require('fastify');
const { Sequelize } = require('sequelize');
const mergePermissions = require('../../libs/utils/mergePermissions');
const flattenPermissions = require('../../libs/utils/flattenPermissions');
const { getUserOrgIds } = require('../../libs/utils/tenantOrgIds');

const NS = 'tenantTest';

/**
 * 构建可注册本仓库各 service 插件的 Fastify 实例（内存假模型 + 可控 JWT / message）。
 */
async function buildServiceApp() {
  const fastify = Fastify({ logger: false });
  const Op = Sequelize.Op;
  const sequelize = {
    transaction: async fn => {
      const t = {
        committed: false,
        async commit() {
          this.committed = true;
        },
        async rollback() {
          this.committed = false;
        }
      };
      if (typeof fn === 'function') {
        try {
          const result = await fn(t);
          await t.commit();
          return result;
        } catch (e) {
          await t.rollback();
          throw e;
        }
      }
      return t;
    }
  };
  fastify.decorate('sequelize', { instance: sequelize, Sequelize, transaction: sequelize.transaction });

  const tenants = new Map();
  const companies = new Map();
  const settings = new Map();
  const roles = new Map();
  const orgs = new Map();
  const users = new Map();
  const userDefaults = new Map();
  const customComponents = new Map();

  let idSeq = 1;
  const nid = prefix => `${prefix}_${idSeq++}`;

  const models = {
    tenant: {
      async create(data) {
        const id = nid('tenant');
        const row = {
          ...data,
          id,
          status: data.status || 'open',
          accountCount: data.accountCount ?? 10,
          update: async patch => Object.assign(row, patch),
          destroy: async () => tenants.delete(id),
          setDataValue(k, v) {
            row[`_${k}`] = v;
          },
          getDataValue(k) {
            return row[`_${k}`];
          }
        };
        tenants.set(id, row);
        return row;
      },
      async findByPk(id, opts = {}) {
        const row = tenants.get(id);
        if (!row) return null;
        return row;
      },
      async findAndCountAll({ where, limit, offset, order } = {}) {
        let list = [...tenants.values()];
        if (where && where.status) list = list.filter(t => t.status === where.status);
        if (where && where[Op.or]) {
          const kw = where[Op.or][0]?.name?.[Op.like];
          if (kw) {
            const k = kw.replace(/%/g, '');
            list = list.filter(t => (t.name && t.name.includes(k)) || (t.description && t.description.includes(k)));
          }
        }
        const total = list.length;
        const rows = list.slice(offset, offset + limit);
        return { count: total, rows };
      }
    },
    company: {
      async findOne({ where: { tenantId } }) {
        return companies.get(tenantId) || null;
      },
      async create(data) {
        const row = {
          ...data,
          id: nid('company'),
          update: async patch => Object.assign(row, patch),
          destroy: async () => companies.delete(data.tenantId)
        };
        companies.set(data.tenantId, row);
        return row;
      }
    },
    tenantCompany: {
      async findByPk() {
        return null;
      }
    },
    setting: {
      async findOne(opts = {}) {
        const tenantId = opts.where?.tenantId;
        if (!tenantId) return null;
        let s = settings.get(tenantId);
        if (!s) return null;
        return s;
      },
      async create({ tenantId }) {
        const row = {
          id: nid('setting'),
          tenantId,
          args: [],
          secrets: [],
          customComponents: [],
          permissions: [],
          options: {},
          save: async function () {
            settings.set(tenantId, this);
          },
          setDataValue(k, v) {
            row[`_${k}`] = v;
          },
          getDataValue(k) {
            return row[`_${k}`];
          }
        };
        settings.set(tenantId, row);
        return row;
      }
    },
    customComponent: {
      async create({ content, tenantId }) {
        const row = { id: nid('cc'), content, tenantId, save: async function () {}, destroy: async () => {} };
        customComponents.set(row.id, row);
        return row;
      },
      async findByPk(id) {
        return customComponents.get(id) || null;
      },
      async destroy({ where: { id } }) {
        customComponents.delete(id);
      }
    },
    role: {
      async create(data) {
        const id = nid('role');
        const row = {
          ...data,
          id,
          permissions: data.permissions || [],
          status: data.status || 'open',
          update: async patch => Object.assign(row, patch),
          destroy: async () => roles.delete(id)
        };
        roles.set(id, row);
        return row;
      },
      async findByPk(id, opts = {}) {
        const r = roles.get(id);
        if (!r) return null;
        if (opts.where && opts.where.tenantId && r.tenantId !== opts.where.tenantId) return null;
        return r;
      },
      async findOne({ where } = {}) {
        if (!where) return null;
        return (
          [...roles.values()].find(r => {
            for (const k of Object.keys(where)) {
              if (r[k] !== where[k]) return false;
            }
            return true;
          }) || null
        );
      },
      async findAll(opts = {}) {
        let list = [...roles.values()];
        if (opts.where) {
          const w = opts.where;
          if (w.tenantId) list = list.filter(r => r.tenantId === w.tenantId);
          if (w.status) list = list.filter(r => r.status === w.status);
          if (w.id && w.id[Op.in]) {
            const idSet = new Set(w.id[Op.in].map(String));
            list = list.filter(r => idSet.has(String(r.id)));
          }
          if (w[Op.not]) {
            const exclude = w[Op.not];
            list = list.filter(
              r => !(exclude.type != null && r.type === exclude.type && exclude.code != null && r.code === exclude.code)
            );
          }
          if (w[Op.or]) {
            list = list.filter(r =>
              w[Op.or].some(cond => {
                if (cond.id && cond.id[Op.in]) return cond.id[Op.in].includes(r.id);
                if (cond.type && cond.code) return r.type === cond.type && r.code === cond.code;
                return false;
              })
            );
          }
        }
        return list;
      },
      async findAndCountAll({ where, limit, offset } = {}) {
        let list = [...roles.values()];

        const applyClause = clause => {
          if (!clause || typeof clause !== 'object') {
            return;
          }
          if (clause.tenantId) {
            list = list.filter(r => r.tenantId === clause.tenantId);
          }
          if (clause.status) {
            list = list.filter(r => r.status === clause.status);
          }
          if (typeof clause.type === 'string') {
            list = list.filter(r => r.type === clause.type);
          }
          if (clause.type && typeof clause.type === 'object' && clause.type[Op.eq]) {
            list = list.filter(r => r.type === clause.type[Op.eq]);
          }
          if (clause.attribute && clause.attribute.col === 'type' && clause.logic != null) {
            list = list.filter(r => r.type === clause.logic);
          }
          if (clause[Op.or]) {
            const kw = clause[Op.or][0]?.name?.[Op.like];
            if (kw) {
              const k = String(kw).replace(/%/g, '');
              list = list.filter(r => [r.name, r.code, r.description].some(f => f && String(f).includes(k)));
            }
          }
        };

        if (where[Op.and]) {
          where[Op.and].forEach(applyClause);
        } else {
          applyClause(where);
        }

        return { count: list.length, rows: list.slice(offset, offset + limit) };
      }
    },
    org: {
      async create(data, opts = {}) {
        const id = nid('org');
        const row = {
          ...data,
          id,
          tenantId: data.tenantId,
          status: data.status || 'open',
          update: async patch => Object.assign(row, patch),
          destroy: async () => orgs.delete(id)
        };
        orgs.set(id, row);
        return row;
      },
      async findByPk(id, opts = {}) {
        return orgs.get(id) || null;
      },
      async findOne({ where, transaction, order } = {}) {
        return (
          [...orgs.values()].find(o => {
            for (const k of Object.keys(where || {})) {
              if (o[k] !== where[k]) return false;
            }
            return true;
          }) || null
        );
      },
      async findAll({ where, attributes } = {}) {
        const { Op } = require('sequelize');
        return [...orgs.values()]
          .filter(o => {
            if (!where) {
              return true;
            }
            if (where.tenantId != null && o.tenantId !== where.tenantId) {
              return false;
            }
            if (where.status != null && o.status !== where.status) {
              return false;
            }
            if (where.name != null && o.name !== where.name) {
              return false;
            }
            if (where.parentId !== undefined && o.parentId !== where.parentId) {
              return false;
            }
            if (where[Op.or]) {
              return where[Op.or].some(clause => {
                if (clause.id?.[Op.in]) {
                  return clause.id[Op.in].includes(o.id);
                }
                if (clause.name?.[Op.in]) {
                  return clause.name[Op.in].includes(o.name);
                }
                return Object.entries(clause).every(([ck, cv]) => o[ck] === cv);
              });
            }
            for (const k of Object.keys(where)) {
              if (o[k] !== where[k]) return false;
            }
            return true;
          })
          .map(o => {
            if (!attributes || !attributes.length) {
              return o;
            }
            const row = {};
            attributes.forEach(key => {
              row[key] = o[key];
            });
            return row;
          });
      },
      async count({ where } = {}) {
        return [...orgs.values()].filter(o => {
          for (const k of Object.keys(where || {})) {
            if (o[k] !== where[k]) return false;
          }
          return true;
        }).length;
      },
      async update(patch, { where } = {}) {
        for (const o of orgs.values()) {
          if (o.tenantId === where.tenantId && o.leaderUserId === where.leaderUserId) {
            Object.assign(o, patch);
          }
        }
      }
    },
    user: {
      matchesCondition(u, cond) {
        const { Op } = require('sequelize');
        if (!cond || typeof cond !== 'object') {
          return true;
        }
        if (cond[Op.or]) {
          return cond[Op.or].some(sub => models.user.matchesCondition(u, sub));
        }
        if (cond.tenantOrgId != null && cond.tenantOrgId !== '') {
          return getUserOrgIds(u).includes(String(cond.tenantOrgId));
        }
        const contains = cond.tenantOrgIds?.[Op.contains];
        if (Array.isArray(contains) && contains.length) {
          const ids = getUserOrgIds(u);
          return contains.some(id => ids.includes(String(id)));
        }
        if (cond.name?.[Op.like]) {
          const pat = String(cond.name[Op.like]).replace(/%/g, '');
          return u.name && u.name.includes(pat);
        }
        if (cond.description?.[Op.like]) {
          const pat = String(cond.description[Op.like]).replace(/%/g, '');
          return (u.description || '').includes(pat);
        }
        if (cond.roles?.[Op.contains]) {
          return cond.roles[Op.contains].every(code => (u.roles || []).includes(code));
        }
        return Object.entries(cond).every(([ck, cv]) => u[ck] === cv);
      },
      matchesWhere(u, where) {
        const { Op } = require('sequelize');
        if (!where) {
          return true;
        }
        if (where.tenantId != null && u.tenantId !== where.tenantId) {
          return false;
        }
        if (where[Op.and]) {
          if (!where[Op.and].every(cond => models.user.matchesCondition(u, cond))) {
            return false;
          }
        }
        if (where[Op.or]) {
          if (!models.user.matchesCondition(u, { [Op.or]: where[Op.or] })) {
            return false;
          }
        }
        if (where.roles?.[Op.contains]) {
          if (!where.roles[Op.contains].every(code => (u.roles || []).includes(code))) {
            return false;
          }
        }
        if (where.tenantOrgIds?.[Op.contains]) {
          if (!models.user.matchesCondition(u, { tenantOrgIds: where.tenantOrgIds })) {
            return false;
          }
        }
        if (where.id != null && where.id !== u.id) {
          return false;
        }
        if (where.id?.[Op.like]) {
          const pat = String(where.id[Op.like]).replace(/%/g, '');
          if (!String(u.id).includes(pat)) {
            return false;
          }
        }
        for (const [k, v] of Object.entries(where)) {
          if (k === 'tenantId' || k === String(Op.and) || k === String(Op.or)) {
            continue;
          }
          if (k === 'roles' || k === 'id' || k === 'tenantOrgIds') {
            continue;
          }
          if (v && typeof v === 'object' && Array.isArray(v[Op.in])) {
            if (!v[Op.in].includes(u[k])) {
              return false;
            }
            continue;
          }
          if (u[k] !== v) {
            return false;
          }
        }
        return true;
      },
      async create(data, opts = {}) {
        const id = nid('user');
        const row = {
          ...data,
          id,
          status: data.status || 'open',
          roles: data.roles || [],
          update: async patch => Object.assign(row, patch),
          destroy: async () => users.delete(id),
          setDataValue(k, v) {
            row[`_${k}`] = v;
          },
          getDataValue(k) {
            return row[`_${k}`];
          }
        };
        users.set(id, row);
        return row;
      },
      async findByPk(id, opts = {}) {
        const u = users.get(id) || null;
        if (!u) return null;
        const inc = opts.include;
        if (Array.isArray(inc) && inc.length) {
          const t = tenants.get(u.tenantId);
          if (t) {
            u.tenant = t;
            u.tenant.company = companies.get(u.tenantId) || { name: '' };
          }
        }
        return u;
      },
      async findOne({ where, include, transaction } = {}) {
        for (const u of users.values()) {
          let ok = true;
          for (const k of Object.keys(where)) {
            if (u[k] !== where[k]) ok = false;
          }
          if (!ok) continue;
          if (include && include.model) {
            const t = tenants.get(u.tenantId);
            if (t) {
              u.tenant = t;
              u.tenant.company = companies.get(u.tenantId) || { name: '' };
            }
          }
          return u;
        }
        return null;
      },
      async findAll({ where, include } = {}) {
        return [...users.values()].filter(u => {
          for (const k of Object.keys(where)) {
            if (u[k] !== where[k]) return false;
          }
          return true;
        });
      },
      async count({ where, transaction } = {}) {
        let n = 0;
        for (const u of users.values()) {
          if (models.user.matchesWhere(u, where)) {
            n++;
          }
        }
        return n;
      },
      async findAndCountAll({ where, offset, limit } = {}) {
        const rows = [...users.values()].filter(u => models.user.matchesWhere(u, where));
        const start = offset || 0;
        const end = limit != null ? start + limit : rows.length;
        return { count: rows.length, rows: rows.slice(start, end) };
      }
    },
    userDefault: {
      async findOne({ where } = {}) {
        for (const d of userDefaults.values()) {
          if (d.userId === where.userId) return d;
        }
        return null;
      },
      async create(data) {
        const row = { ...data, update: async p => Object.assign(row, p) };
        userDefaults.set(data.userId, row);
        return row;
      }
    }
  };

  const permissionsTree = require('../../libs/permissions');

  const ns = {
    models,
    services: {},
    permissions: permissionsTree,
    utils: {
      mergePermissions,
      flattenPermissions
    }
  };
  fastify.decorate(NS, ns);

  fastify.decorate('jwt', {
    decode: token => ({ payload: JSON.parse(Buffer.from(String(token), 'base64').toString('utf8')) }),
    sign: ({ payload }) => Buffer.from(JSON.stringify(payload), 'utf8').toString('base64')
  });

  fastify.decorate('message', {
    services: {
      sendMessage: async () => {}
    }
  });

  fastify.decorate('config', { ORIGIN: 'http://test.local' });

  const opts = { name: NS };

  await fastify.register(require('../../libs/services/setting.js'), opts);
  await fastify.register(require('../../libs/services/company.js'), opts);
  await fastify.register(require('../../libs/services/role.js'), opts);
  await fastify.register(require('../../libs/services/permission.js'), opts);
  await fastify.register(require('../../libs/services/tenant.js'), opts);
  await fastify.register(require('../../libs/services/org.js'), opts);
  await fastify.register(require('../../libs/services/user.js'), opts);

  return {
    fastify,
    ns,
    stores: { tenants, companies, settings, roles, orgs, users, userDefaults, customComponents }
  };
}

module.exports = { buildServiceApp, NS };
