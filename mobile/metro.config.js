// Metro config for Expo SDK 53 with NativeWind v4 CSS interop.
// withNativeWind injects the Tailwind compile step + CSS-to-React-Native
// translation so `className` strings work natively across iOS, Android and Web.
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

module.exports = withNativeWind(config, {
  input: './global.css',
  inlineRem: 16,
});
