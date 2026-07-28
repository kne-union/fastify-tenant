const getThirdLoginFromOptions = options => {
  const binding = options && options.thirdLogin;
  if (!binding || !binding.platform || !binding.sourceId) {
    return null;
  }
  return {
    platform: String(binding.platform),
    sourceId: String(binding.sourceId),
    boundAt: binding.boundAt || null
  };
};

const mergeThirdLoginOptions = (existingOptions, platform, sourceId) => {
  const options = Object.assign({}, existingOptions || {});
  options.thirdLogin = {
    platform: String(platform),
    sourceId: String(sourceId),
    boundAt: new Date().toISOString()
  };
  return options;
};

// Only set platform/type for org-sync synced users.
// Keep them "unbound" (no sourceId) so third-login-result can bind after OAuth verification.
const mergeThirdLoginTypeOptions = (existingOptions, platform) => {
  const options = Object.assign({}, existingOptions || {});
  const existingBinding = getThirdLoginFromOptions(options);
  if (existingBinding) {
    // Already bound by OAuth/bindToken; do not let org-sync overwrite binding.
    return options;
  }

  options.thirdLogin = Object.assign({}, options.thirdLogin || {});
  options.thirdLogin.platform = String(platform);
  // Ensure unbound state: no sourceId means getThirdLoginFromOptions returns null.
  delete options.thirdLogin.sourceId;
  delete options.thirdLogin.boundAt;
  return options;
};

const clearThirdLoginOptions = existingOptions => {
  const options = Object.assign({}, existingOptions || {});
  delete options.thirdLogin;
  return options;
};

const findUserByThirdLoginBinding = async ({ models, tenantId, platform, sourceId, status = 'open' }) => {
  const users = await models.user.findAll({
    where: { tenantId, status }
  });
  const normalizedSourceId = String(sourceId);
  return (
    users.find(user => {
      const binding = getThirdLoginFromOptions(user.options);
      return binding && binding.platform === platform && binding.sourceId === normalizedSourceId;
    }) || null
  );
};

/** Default match: org-synced user whose sync sourceId is the platform userid. */
const findUserBySyncSourceId = async ({ models, tenantId, platform, sourceId, status = 'open' }) => {
  if (!platform || sourceId == null || sourceId === '') {
    return null;
  }
  return models.user.findOne({
    where: {
      tenantId,
      status,
      syncSource: String(platform),
      sourceId: String(sourceId)
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
    const currentBinding = getThirdLoginFromOptions(currentUser?.options);
    if (currentBinding && (currentBinding.platform !== platform || currentBinding.sourceId !== String(sourceId))) {
      throw new Error('当前用户已绑定其他第三方账号');
    }
  }
};

module.exports = {
  getThirdLoginFromOptions,
  mergeThirdLoginOptions,
  mergeThirdLoginTypeOptions,
  clearThirdLoginOptions,
  findUserByThirdLoginBinding,
  findUserBySyncSourceId,
  assertThirdLoginBindingConflict
};
