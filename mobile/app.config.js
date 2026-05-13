// Expo app config — values are resolved at build time.
//
// Versioning strategy:
//   - `version` (the user-facing semver string shown in the OS settings) is
//     derived from the most recent git tag, e.g. `v1.2.3` → "1.2.3". This
//     ties releases to git history so every store build is reproducible.
//   - `buildNumber` (iOS) / `versionCode` (Android) is a monotonically
//     increasing integer derived from the git commit count. EAS's
//     `autoIncrement: true` flag in `eas.json` still works as a fallback for
//     local-without-git builds.
//   - For OTA updates (`eas update`), `runtimeVersion` is bound to `version`
//     using the `appVersion` policy. Any change to the major/minor/patch
//     version requires a fresh native build; patch-level bugfixes that don't
//     touch native modules can ship as OTA updates.
//
// Override via env vars in CI:
//   APP_VERSION         — overrides the version string (e.g. "1.2.3")
//   APP_BUILD_NUMBER    — overrides the integer build number

const { execSync } = require('child_process');

function safe(cmd, fallback) {
  try {
    return execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return fallback;
  }
}

const FALLBACK_VERSION = '1.1.0';

function resolveVersion() {
  if (process.env.APP_VERSION) return process.env.APP_VERSION;
  const tag = safe('git describe --tags --abbrev=0', '');
  if (tag && /^v?\d+\.\d+\.\d+/.test(tag)) {
    return tag.replace(/^v/, '');
  }
  return FALLBACK_VERSION;
}

function resolveBuildNumber() {
  if (process.env.APP_BUILD_NUMBER) {
    const n = parseInt(process.env.APP_BUILD_NUMBER, 10);
    if (!Number.isNaN(n)) return n;
  }
  const count = safe('git rev-list --count HEAD', '1');
  const n = parseInt(count, 10);
  return Number.isNaN(n) ? 1 : n;
}

const version = resolveVersion();
const buildNumber = resolveBuildNumber();

module.exports = {
  expo: {
    name: 'Vigilance MS',
    slug: 'vigilance-ms',
    version,
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'automatic',
    scheme: 'vigilancems',
    newArchEnabled: true,

    runtimeVersion: { policy: 'appVersion' },
    updates: {
      url: 'https://u.expo.dev/YOUR_EAS_PROJECT_ID',
      enabled: true,
      checkAutomatically: 'ON_LOAD',
      fallbackToCacheTimeout: 0,
    },

    splash: {
      image: './assets/splash.png',
      resizeMode: 'contain',
      backgroundColor: '#0f172a',
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.yourcompany.vigilancems',
      buildNumber: String(buildNumber),
      infoPlist: {
        NSCameraUsageDescription: 'Used to capture inspection photos.',
        NSPhotoLibraryUsageDescription: 'Used to attach photos to inspection reports.',
        NSLocationWhenInUseUsageDescription:
          'Vigilance needs your location to verify you are at the branch before starting an inspection.',
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#0f172a',
      },
      package: 'com.yourcompany.vigilancems',
      versionCode: buildNumber,
      permissions: [
        'CAMERA',
        'READ_EXTERNAL_STORAGE',
        'WRITE_EXTERNAL_STORAGE',
        'ACCESS_FINE_LOCATION',
        'ACCESS_COARSE_LOCATION',
      ],
      minSdkVersion: 26,
    },
    plugins: [
      'expo-router',
      'expo-image-picker',
      'expo-secure-store',
      'expo-haptics',
      'react-native-mmkv',
      [
        'expo-location',
        {
          locationAlwaysAndWhenInUsePermission: 'Allow Vigilance to use your location.',
        },
      ],
    ],
    extra: {
      eas: { projectId: 'YOUR_EAS_PROJECT_ID' },
      gitSha: safe('git rev-parse --short HEAD', 'unknown'),
    },
    owner: 'YOUR_EXPO_ACCOUNT',
  },
};
