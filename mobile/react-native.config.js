// React Native autolinking config.
//
// WHY react-native-worklets is excluded from native autolinking:
//   react-native-reanimated@3.17.x (Expo SDK 53's pinned version) bundles the
//   worklets *native* runtime internally. Its codegen declares a C++ class
//   `NativeWorkletsModuleSpecJSI` in node_modules/react-native-reanimated/
//   android/build/generated/source/codegen/jni/rnreanimated.h.
//
//   The standalone react-native-worklets@0.3.0 package also declares the SAME
//   C++ class in its own codegen (rnworklets.h). With both autolinked, the
//   Android CMake build emits "error: redefinition of NativeWorkletsModuleSpecJSI"
//   and the build fails.
//
//   We still NEED the react-native-worklets npm package on disk because
//   react-native-css-interop@0.2.x (NativeWind v4's runtime) hardcodes
//   `require('react-native-worklets/plugin')` in its Babel transformer. That
//   plugin is a JS file — purely a build-time tool — so disabling the package's
//   native autolinking has no JS-side impact.
//
//   Setting platforms.android = null and platforms.ios = null is the
//   community-supported way to keep a package JS-only.
//   Docs: https://github.com/react-native-community/cli/blob/main/docs/dependencies.md
module.exports = {
  dependencies: {
    'react-native-worklets': {
      platforms: {
        android: null,
        ios: null,
      },
    },
  },
};
