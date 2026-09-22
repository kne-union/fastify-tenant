const assert = require('assert');
const {
  getThirdLoginFromOptions,
  listThirdLoginBindings,
  mergeThirdLoginOptions,
  mergeThirdLoginTypeOptions,
  clearThirdLoginOptions,
  assertCanUnbindThirdLogin,
  assertThirdLoginBindingConflict,
  findUserByThirdLoginBinding
} = require('../libs/utils/thirdLoginBinding');

describe('thirdLoginBinding map', () => {
  it('merge keeps other platforms', () => {
    let options = mergeThirdLoginOptions(null, 'wecom', 'w1');
    options = mergeThirdLoginOptions(options, 'dingtalk', 'd1');
    assert.deepStrictEqual(listThirdLoginBindings(options).map(b => b.platform).sort(), ['dingtalk', 'wecom']);
    assert.strictEqual(getThirdLoginFromOptions(options, 'wecom').sourceId, 'w1');
    assert.strictEqual(getThirdLoginFromOptions(options, 'dingtalk').sourceId, 'd1');
  });

  it('get returns null without sourceId', () => {
    const options = mergeThirdLoginTypeOptions(null, 'wecom');
    assert.strictEqual(getThirdLoginFromOptions(options, 'wecom'), null);
    assert.deepStrictEqual(listThirdLoginBindings(options), []);
    assert.ok(options.thirdLogin.wecom);
  });

  it('mergeThirdLoginTypeOptions does not overwrite bound channel', () => {
    let options = mergeThirdLoginOptions(null, 'wecom', 'w1');
    options = mergeThirdLoginTypeOptions(options, 'wecom');
    assert.strictEqual(getThirdLoginFromOptions(options, 'wecom').sourceId, 'w1');
  });

  it('clear by platform keeps others', () => {
    let options = mergeThirdLoginOptions(null, 'wecom', 'w1');
    options = mergeThirdLoginOptions(options, 'dingtalk', 'd1');
    options = clearThirdLoginOptions(options, 'dingtalk');
    assert.strictEqual(getThirdLoginFromOptions(options, 'wecom').sourceId, 'w1');
    assert.strictEqual(getThirdLoginFromOptions(options, 'dingtalk'), null);
  });

  it('clear all removes thirdLogin', () => {
    let options = mergeThirdLoginOptions(null, 'wecom', 'w1');
    options = clearThirdLoginOptions(options);
    assert.strictEqual(options.thirdLogin, undefined);
  });

  it('assertCanUnbind blocks syncSource platform', () => {
    assert.throws(() => assertCanUnbindThirdLogin({ user: { syncSource: 'wecom' }, platform: 'wecom' }), /来源渠道不可解绑/);
    assert.doesNotThrow(() => assertCanUnbindThirdLogin({ user: { syncSource: 'wecom' }, platform: 'dingtalk' }));
    assert.doesNotThrow(() => assertCanUnbindThirdLogin({ user: { syncSource: null }, platform: 'wecom' }));
  });

  it('assertThirdLoginBindingConflict allows other platforms on same user', async () => {
    const currentUser = {
      id: 'u1',
      options: mergeThirdLoginOptions(null, 'wecom', 'w1')
    };
    const models = {
      user: {
        findAll: async () => [currentUser],
        findByPk: async () => currentUser
      }
    };
    await assertThirdLoginBindingConflict({
      models,
      tenantId: 't1',
      platform: 'dingtalk',
      sourceId: 'd1',
      excludeUserId: 'u1'
    });
  });

  it('assertThirdLoginBindingConflict rejects same platform different sourceId', async () => {
    const currentUser = {
      id: 'u1',
      options: mergeThirdLoginOptions(null, 'wecom', 'w1')
    };
    const models = {
      user: {
        findAll: async () => [currentUser],
        findByPk: async () => currentUser
      }
    };
    await assert.rejects(
      () =>
        assertThirdLoginBindingConflict({
          models,
          tenantId: 't1',
          platform: 'wecom',
          sourceId: 'w2',
          excludeUserId: 'u1'
        }),
      /当前用户已绑定其他第三方账号/
    );
  });

  it('findUserByThirdLoginBinding matches map entry', async () => {
    const users = [
      { id: 'u1', options: mergeThirdLoginOptions(null, 'wecom', 'w1') },
      {
        id: 'u2',
        options: mergeThirdLoginOptions(mergeThirdLoginOptions(null, 'wecom', 'wx'), 'dingtalk', 'd1')
      }
    ];
    const models = {
      user: {
        findAll: async () => users
      }
    };
    const found = await findUserByThirdLoginBinding({
      models,
      tenantId: 't1',
      platform: 'dingtalk',
      sourceId: 'd1'
    });
    assert.strictEqual(found.id, 'u2');
  });
});
