module.exports = function (api) {
  api.cache(true);
  return {
    // babel-preset-expo bundles the expo-router and reanimated babel plugins,
    // so no extra plugins are needed here for SDK 57.
    presets: ['babel-preset-expo'],
  };
};
