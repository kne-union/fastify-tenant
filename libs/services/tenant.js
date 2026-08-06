const fp = require('fastify-plugin');
const pick = require('lodash/pick');
const { escapeLike } = require('../utils/escapeLike');

const DEFAULT_FOLDER_TYPE = 'admin-file-system';
const PENDING_LOGO_PATH = 'Tenant/_pending';

const parsePhotoStringId = value => {
  if (!value) {
    return '';
  }
  if (typeof value === 'object' && value.id) {
    return String(value.id);
  }
  return String(value).split('?')[0].trim();
};

const findChildFolder = (nodes, name) => {
  return (nodes || []).find(node => {
    const kind = node?.options?.kind || (node?.options?.fileId ? 'file' : 'folder');
    return kind === 'folder' && String(node.name) === String(name);
  });
};

const findFileNodeByFileId = (nodes, fileId) => {
  const target = String(fileId);
  return (nodes || []).find(node => {
    const kind = node?.options?.kind || (node?.options?.fileId ? 'file' : 'folder');
    return kind === 'file' && String(node.options?.fileId) === target;
  });
};

const findPendingLogoNode = (tree, fileId) => {
  const tenantFolder = findChildFolder(tree, 'Tenant');
  if (!tenantFolder) {
    return null;
  }
  const pendingFolder = findChildFolder(tenantFolder.children, '_pending');
  if (!pendingFolder) {
    return null;
  }
  return findFileNodeByFileId(pendingFolder.children, fileId) || null;
};

module.exports = fp(async (fastify, options) => {
  const { models, services } = fastify[options.name];
  const { Op } = fastify.sequelize.Sequelize;

  const relocateTenantLogo = async ({ logo, tenantId }) => {
    const folder = fastify.fileManager?.services?.folder;
    if (!folder) {
      return;
    }
    const fileId = parsePhotoStringId(logo);
    if (!fileId || !tenantId) {
      return;
    }
    const type = DEFAULT_FOLDER_TYPE;
    const targetParentId = await folder.ensurePath({ type, path: `Tenant/${tenantId}` });
    let pendingNode = null;
    try {
      const tree = await folder.getTree({ type });
      pendingNode = findPendingLogoNode(tree, fileId);
    } catch (e) {
      fastify.log?.warn?.({ err: e }, 'tenant.create: failed to load folder tree for logo relocate');
    }
    if (pendingNode?.id) {
      await folder.move({ type, ids: [pendingNode.id], parentId: targetParentId });
      return;
    }
    await folder.addFiles({ type, ids: [fileId], parentId: targetParentId });
  };

  const create = async ({ name, description, logo, themeColor, accountCount, supportLanguage, defaultLanguage, serviceStartTime, serviceEndTime }) => {
    const tenant = await models.tenant.create({
      name,
      description,
      logo,
      themeColor,
      accountCount,
      supportLanguage,
      defaultLanguage,
      serviceStartTime,
      serviceEndTime
    });

    await services.company.save({
      tenantId: tenant.id,
      name: tenant.name
    });

    await services.role.create({
      tenantId: tenant.id,
      name: '租户管理员',
      code: 'admin',
      description: '拥有租户所有权限',
      type: 'system'
    });

    await services.role.create({
      tenantId: tenant.id,
      name: '默认角色',
      code: 'default',
      description: '拥有用户都拥有的角色',
      type: 'system'
    });

    await services.permission.initTenantPermissions({ tenantId: tenant.id });

    if (logo) {
      try {
        await relocateTenantLogo({ logo, tenantId: tenant.id });
      } catch (e) {
        fastify.log?.warn?.({ err: e, tenantId: tenant.id }, `tenant.create: failed to relocate logo from ${PENDING_LOGO_PATH}`);
      }
    }

    return tenant;
  };

  const save = async ({ id, ...data }) => {
    const tenant = await detail({ id, withTenantSetting: false });
    await tenant.update(pick(data, ['name', 'description', 'logo', 'accountCount', 'themeColor', 'supportLanguage', 'defaultLanguage', 'serviceStartTime', 'serviceEndTime']));
    return tenant;
  };

  const saveLanguages = async ({ tenantId, supportLanguage, defaultLanguage }) => {
    if (!Array.isArray(supportLanguage) || supportLanguage.length === 0) {
      throw new Error('支持语言列表不能为空');
    }
    const languages = supportLanguage.map(item => String(item)).filter(Boolean);
    if (languages.length === 0) {
      throw new Error('支持语言列表不能为空');
    }
    const defaultLang = defaultLanguage ? String(defaultLanguage) : languages[0];
    if (!languages.includes(defaultLang)) {
      throw new Error('默认语言必须在支持语言列表中');
    }
    const tenant = await detail({ id: tenantId, withTenantSetting: false });
    await tenant.update({
      supportLanguage: languages,
      defaultLanguage: defaultLang
    });
    return {
      supportLanguage: languages,
      defaultLanguage: defaultLang
    };
  };

  const getLanguages = async ({ tenantId }) => {
    const tenant = await detail({ id: tenantId, withTenantSetting: false });
    return {
      supportLanguage: tenant.supportLanguage || [],
      defaultLanguage: tenant.defaultLanguage || ''
    };
  };

  const list = async ({ perPage, currentPage, filter = {} }) => {
    const whereQuery = {};
    ['status'].forEach(name => {
      if (filter[name]) {
        whereQuery[name] = filter[name];
      }
    });
    if (filter['keyword']) {
      const escaped = escapeLike(filter['keyword']);
      whereQuery[Op.or] = [
        {
          name: {
            [Op.like]: `%${escaped}%`
          }
        },
        {
          description: {
            [Op.like]: `%${escaped}%`
          }
        }
      ];
    }

    const { count, rows } = await models.tenant.findAndCountAll({
      where: Object.assign({}, whereQuery),
      limit: perPage,
      offset: (currentPage - 1) * perPage,
      order: [['createdAt', 'DESC']]
    });

    return { pageData: rows, totalCount: count };
  };

  const detail = async ({ id, withTenantSetting = true }) => {
    const tenant = await models.tenant.findByPk(id, {
      include: [models.company]
    });
    if (!tenant) {
      throw new Error('租户不存在');
    }
    if (withTenantSetting) {
      const tenantSetting = await services.setting.detail({ tenantId: tenant.id });
      tenant.setDataValue('tenantSetting', tenantSetting);
    }
    return tenant;
  };

  const setStatus = async ({ id, status }) => {
    const tenant = await detail({ id, withTenantSetting: false });
    await tenant.update({ status });
    return tenant;
  };

  const remove = async ({ id }) => {
    const tenant = await detail({ id, withTenantSetting: false });
    await services.company.remove({ tenantId: id });
    await tenant.destroy();
  };

  const getToken = async ({ id }) => {
    const tenant = await detail({ id, withTenantSetting: false });
    const token = fastify.jwt.sign({ payload: { id: tenant.id } });
    return { token };
  };

  const parseToken = async ({ token }) => {
    const { payload } = fastify.jwt.decode(token);
    const tenant = await detail({ id: payload.id });

    return { tenant };
  };

  Object.assign(fastify[options.name].services, {
    tenant: { create, save, saveLanguages, getLanguages, list, detail, setStatus, remove, getToken, parseToken }
  });
});
