module.exports = ({ config }) => {
  const versionCode = process.env.ANDROID_VERSION_CODE === undefined
    ? config.android?.versionCode
    : Number(process.env.ANDROID_VERSION_CODE);
  if (versionCode !== undefined && (!Number.isInteger(versionCode) || versionCode < 1 || versionCode > 2100000000)) {
    throw new Error('ANDROID_VERSION_CODE debe ser un entero entre 1 y 2100000000');
  }
  const iosUrlScheme = process.env.GOOGLE_IOS_URL_SCHEME;
  return {
    ...config,
    android: { ...config.android, ...(versionCode === undefined ? {} : { versionCode }) },
    plugins: [
      ...(config.plugins ?? []),
      ...(iosUrlScheme ? [['@react-native-google-signin/google-signin', { iosUrlScheme }]] : []),
    ],
  };
};
