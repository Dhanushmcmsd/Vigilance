// NativeWind v4 + Expo SDK 53 + React Native 0.79 (New Architecture) Babel config.
//
// WHY react-native-reanimated/plugin is here:
//   react-native-css-interop (NativeWind v4's runtime, package: react-native-css-interop)
//   declares react-native-reanimated >=3.6.2 as a required peer dep.
//   reanimated/plugin instruments JSX so Animated worklets survive the
//   New Architecture JS-to-native bridge. It MUST be the last plugin.
//
// WHY react-native-worklets is NOT here:
//   "react-native-worklets" (0.5.x) is a separate, unmaintained package —
//   NOT Software Mansion's worklets runtime. Reanimated 3.16+ bundles its own
//   worklets runtime internally; installing the standalone package causes a
//   duplicate worklet-directive transform and is incompatible with New Architecture.
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
    plugins: [
      // MUST be last — Reanimated's plugin must run after every other transform.
      'react-native-reanimated/plugin',
    ],
  };
};
