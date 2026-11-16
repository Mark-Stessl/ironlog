const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// The web version runs SQLite as WebAssembly; Metro has to treat .wasm as an asset.
config.resolver.assetExts.push('wasm');

module.exports = config;
