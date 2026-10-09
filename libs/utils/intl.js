const locale = require('../locale');
const { BusinessError } = require('./errors');

const FALLBACK_LOCALE = 'zh-CN';

// 其他插件（如 fastify-account）的错误也可能带 messageId，只翻译本包抛出的错误
const MESSAGE_SCOPE = '@kne/fastify-tenant';

const isScopedError = error => !!(error && error.messageScope === MESSAGE_SCOPE && error.messageId);

const format = (template, values) => template.replace(/\{(\w+)\}/g, (match, key) => (values && values[key] !== undefined ? String(values[key]) : match));

// messageValues 可以包含 Error（逐行导入时包装底层错误），格式化时取其 message
const plainValues = values => values && Object.fromEntries(Object.entries(values).map(([key, value]) => [key, value instanceof Error ? value.message : value]));

const fallbackMessage = (messageId, messageValues) => format(locale[FALLBACK_LOCALE][messageId] || messageId, plainValues(messageValues));

const tag = (error, messageId, messageValues) => Object.assign(error, { messageScope: MESSAGE_SCOPE, messageId, messageValues });

/**
 * 创建带 messageId 的错误：message 先取内置中文，响应前由 onError 钩子按请求语言替换
 */
const createError = (ErrorClass, messageId, messageValues) => {
  const message = fallbackMessage(messageId, messageValues);
  return tag(ErrorClass ? new ErrorClass(message) : new Error(message), messageId, messageValues);
};

const createBusinessError = (code, messageId, messageValues, status) => tag(new BusinessError(code, fallbackMessage(messageId, messageValues), status), messageId, messageValues);

/**
 * 通过 @kne/fastify-intl 按请求语言翻译；未注册 fastify-intl 或语言包缺失时回退到内置中文
 */
const createTranslator = ({ fastify, options }) => {
  const getIntl = () => {
    const intl = fastify[options.intlNamespace];
    return intl && typeof intl.createIntl === 'function' ? intl : null;
  };

  // 依次为请求语言、fastify-intl 默认语言的 intl 实例
  const getIntlInstances = async request => {
    const intl = getIntl();
    if (!intl) {
      return [];
    }
    const langs = [...new Set([request && intl.getRequestLocale(request), intl.options?.defaultLocale].filter(Boolean))];
    return Promise.all(langs.map(lang => intl.createIntl(lang, options.name)));
  };

  const formatWith = (instances, messageId, messageValues) => {
    const instance = instances.find(item => item.messages[messageId]);
    return instance ? instance.formatMessage({ id: messageId }, plainValues(messageValues)) : undefined;
  };

  const t = async (request, messageId, messageValues) => formatWith(await getIntlInstances(request), messageId, messageValues) ?? fallbackMessage(messageId, messageValues);

  /**
   * 翻译接口返回结果中的权限树名称：按完整 code（如 setting:org:view）查 permission.{code}，查不到保留原名
   */
  const withTranslatedPermissions = async (request, result) => {
    const instances = await getIntlInstances(request);
    if (!(result && result.permissions && instances.length)) {
      return result;
    }
    const translateName = (item, code) => formatWith(instances, `permission.${code}`) ?? item.name;
    const translateModule = (module, parentCode) => {
      const code = parentCode ? `${parentCode}:${module.code}` : module.code;
      return Object.assign(
        {},
        module,
        { name: translateName(module, code) },
        module.modules && { modules: module.modules.map(child => translateModule(child, code)) },
        module.permissions && { permissions: module.permissions.map(item => Object.assign({}, item, { name: translateName(item, `${code}:${item.code}`) })) }
      );
    };
    return Object.assign({}, result, { permissions: Object.assign({}, result.permissions, { modules: (result.permissions.modules || []).map(module => translateModule(module)) }) });
  };

  const translateError = async (request, error) => {
    if (!isScopedError(error)) {
      return error;
    }
    for (const value of Object.values(error.messageValues || {})) {
      await translateError(request, value);
    }
    error.message = await t(request, error.messageId, error.messageValues);
    return error;
  };

  const onError = async (request, reply, error) => {
    await translateError(request, error);
  };

  return { t, translateError, onError, withTranslatedPermissions };
};

module.exports = { locale, createError, createBusinessError, createTranslator };
