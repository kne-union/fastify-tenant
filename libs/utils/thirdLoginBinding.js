const { normalizePhone } = require('./phone');

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

const findUnboundUserForFirstMatch = async ({ models, tenantId, phone, email, platform }) => {
  const users = await models.user.findAll({
    where: { tenantId, status: 'open' }
  });
  const unbound = users.filter(user => {
    const binding = getThirdLoginFromOptions(user.options);
    if (binding) return false; // bound
    if (platform) {
      const typedPlatform = String(user.options?.thirdLogin?.platform || '');
      // If the user has a typed platform (from org-sync), only match the same platform.
      if (typedPlatform) {
        return typedPlatform === String(platform);
      }
    }
    return true;
  });

  if (phone) {
    const normalizedPhone = normalizePhone(phone);
    const phoneMatches = unbound.filter(user => user.phone && normalizePhone(user.phone) === normalizedPhone);
    if (phoneMatches.length > 1) {
      throw new Error('手机号匹配到多个用户，无法自动绑定');
    }
    if (phoneMatches.length === 1) {
      return phoneMatches[0];
    }
  }

  if (email) {
    const normalizedEmail = String(email).trim().toLowerCase();
    const emailMatches = unbound.filter(user => user.email && String(user.email).trim().toLowerCase() === normalizedEmail);
    if (emailMatches.length > 1) {
      throw new Error('邮箱匹配到多个用户，无法自动绑定');
    }
    if (emailMatches.length === 1) {
      return emailMatches[0];
    }
  }

  return null;
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
  findUnboundUserForFirstMatch,
  assertThirdLoginBindingConflict
};
