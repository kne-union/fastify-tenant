const getThirdLoginMap = options => {
  const thirdLogin = options && options.thirdLogin;
  if (!thirdLogin || typeof thirdLogin !== 'object' || Array.isArray(thirdLogin)) {
    return {};
  }
  return thirdLogin;
};

/** Binding for one platform; requires sourceId. */
const getThirdLoginFromOptions = (options, platform) => {
  if (!platform) {
    return null;
  }
  const entry = getThirdLoginMap(options)[String(platform)];
  if (!entry || entry.sourceId == null || entry.sourceId === '') {
    return null;
  }
  return {
    platform: String(platform),
    sourceId: String(entry.sourceId),
    boundAt: entry.boundAt || null
  };
};

const listThirdLoginBindings = options => {
  const map = getThirdLoginMap(options);
  return Object.keys(map)
    .map(platform => getThirdLoginFromOptions(options, platform))
    .filter(Boolean);
};

const mergeThirdLoginOptions = (existingOptions, platform, sourceId) => {
  const options = Object.assign({}, existingOptions || {});
  const map = Object.assign({}, getThirdLoginMap(options));
  map[String(platform)] = {
    sourceId: String(sourceId),
    boundAt: new Date().toISOString()
  };
  options.thirdLogin = map;
  return options;
};

// Only set unbound type hint for org-sync synced users (no sourceId).
const mergeThirdLoginTypeOptions = (existingOptions, platform) => {
  const options = Object.assign({}, existingOptions || {});
  const key = String(platform);
  if (getThirdLoginFromOptions(options, key)) {
    // Already bound by OAuth/bindToken; do not let org-sync overwrite binding.
    return options;
  }

  const map = Object.assign({}, getThirdLoginMap(options));
  map[key] = Object.assign({}, map[key] || {});
  delete map[key].sourceId;
  delete map[key].boundAt;
  options.thirdLogin = map;
  return options;
};

const clearThirdLoginOptions = (existingOptions, platform) => {
  const options = Object.assign({}, existingOptions || {});
  if (!platform) {
    delete options.thirdLogin;
    return options;
  }

  const map = Object.assign({}, getThirdLoginMap(options));
  delete map[String(platform)];
  if (Object.keys(map).length === 0) {
    delete options.thirdLogin;
  } else {
    options.thirdLogin = map;
  }
  return options;
};

const findUserByThirdLoginBinding = async ({ models, tenantId, platform, sourceId, status = 'open' }) => {
  const users = await models.user.findAll({
    where: { tenantId, status }
  });
  const normalizedSourceId = String(sourceId);
  const normalizedPlatform = String(platform);
  return (
    users.find(user => {
      const binding = getThirdLoginFromOptions(user.options, normalizedPlatform);
      return binding && binding.sourceId === normalizedSourceId;
    }) || null
  );
};

/** Default match: org-synced user whose sourceId is the platform userid (or rewritten beisen sourceId). */
const findUserBySyncSourceId = async ({ models, tenantId, platform, sourceId, status = 'open' }) => {
  if (sourceId == null || sourceId === '') {
    return null;
  }
  const normalizedSourceId = String(sourceId);
  if (platform) {
    const exact = await models.user.findOne({
      where: {
        tenantId,
        status,
        syncSource: String(platform),
        sourceId: normalizedSourceId
      }
    });
    if (exact) {
      return exact;
    }
  }
  // 北森等：登录平台是企微/钉钉，但用户 syncSource 仍是 beisen
  return models.user.findOne({
    where: {
      tenantId,
      status,
      sourceId: normalizedSourceId
    }
  });
};

const assertThirdLoginBindingConflict = async ({ models, tenantId, platform, sourceId, excludeUserId }) => {
  const existing = await findUserByThirdLoginBinding({ models, tenantId, platform, sourceId });
  if (existing && String(existing.id) !== String(excludeUserId)) {
    throw new Error('该第三方账号已绑定到其他用户');
  }

  if (excludeUserId) {
    const currentUser = await models.user.findByPk(excludeUserId);
    const currentBinding = getThirdLoginFromOptions(currentUser?.options, platform);
    if (currentBinding && currentBinding.sourceId !== String(sourceId)) {
      throw new Error('当前用户已绑定其他第三方账号');
    }
  }
};

const assertCanUnbindThirdLogin = ({ user, platform }) => {
  if (!platform) {
    return;
  }
  const syncSource = user?.syncSource;
  if (syncSource && String(syncSource) === String(platform)) {
    throw new Error('来源渠道不可解绑');
  }
};

module.exports = {
  getThirdLoginMap,
  getThirdLoginFromOptions,
  listThirdLoginBindings,
  mergeThirdLoginOptions,
  mergeThirdLoginTypeOptions,
  clearThirdLoginOptions,
  findUserByThirdLoginBinding,
  findUserBySyncSourceId,
  assertThirdLoginBindingConflict,
  assertCanUnbindThirdLogin
};
