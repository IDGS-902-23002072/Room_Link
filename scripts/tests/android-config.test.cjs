const assert = require('node:assert/strict');
const { test } = require('node:test');
const configure = require('../../frontend/Room_Link/app.config.js');
const config = require('../../frontend/Room_Link/app.json').expo;

test('versionCode de CI conserva identidad y rechaza versiones inválidas', () => {
  const original = JSON.stringify(config);
  const previous = process.env.ANDROID_VERSION_CODE;
  try {
    delete process.env.ANDROID_VERSION_CODE;
    assert.equal(configure({ config }).android.versionCode, config.android.versionCode);
    process.env.ANDROID_VERSION_CODE = '1795780000';
    const result = configure({ config });
    assert.equal(result.android.versionCode, 1795780000);
    assert.equal(result.android.package, config.android.package);
    assert.deepEqual(result.android.adaptiveIcon, config.android.adaptiveIcon);
    for (const invalid of ['0', '-1', 'NaN', '1.5', '2100000001', '']) {
      process.env.ANDROID_VERSION_CODE = invalid;
      assert.throws(() => configure({ config }), /ANDROID_VERSION_CODE/);
    }
    assert.equal(JSON.stringify(config), original);
  } finally {
    if (previous === undefined) delete process.env.ANDROID_VERSION_CODE;
    else process.env.ANDROID_VERSION_CODE = previous;
  }
});
