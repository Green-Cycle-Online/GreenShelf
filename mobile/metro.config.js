// Default Expo Metro config. expo-router works with this out of the box on SDK 57
// (require.context and the router entry are enabled by @expo/metro-config).
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

module.exports = config;
