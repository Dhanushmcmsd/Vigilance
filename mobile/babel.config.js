// NativeWind v4 + Expo SDK 53 Babel pipeline.
//   - babel-preset-expo handles JSX, TS, and runtime selection.
//     The `jsxImportSource: 'nativewind'` option turns every JSX element into
//     a CSS-interop wrapper at compile time (NativeWind v4 requirement).
//   - react-native-reanimated/plugin must stay at the bottom of `plugins`.
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
    plugins: [
      // Keep last — Reanimated's plugin must run after every other transform.
      'react-native-reanimated/plugin',
    ],
  };
};
