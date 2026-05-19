// Expo app config — resolved at build time by Expo / EAS.
//
// Versioning strategy:
//   - `version` (user-facing semver) is derived from the most recent git tag
//     (e.g. `v1.2.3` → "1.2.3"), tying releases to git history.
//   - `versionCode` (Android) / `buildNumber` (iOS) is a monotonically
//     increasing integer derived from `git rev-list --count HEAD`. EAS's
//     `autoIncrement` flag in `eas.json` is still honoured as a fallback when
//     git history isn't available (e.g. on a managed EAS worker).
//
// Override via env vars in CI / EAS:
//   APP_VERSION         — overrides the version string (e.g. "1.2.3")
//   APP_BUILD_NUMBER    — overrides the integer build number
//   EAS_PROJECT_ID      — links this config to an EAS project for builds + updates
//   EXPO_OWNER          — Expo account that owns the project (required for EAS builds)

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

const easProjectId =
  process.env.EAS_PROJECT_ID || 'b63bc80d-778c-4eb8-b0f7-b974238318e6';
const expoOwner = process.env.EXPO_OWNER || 'dhanushraghav';

const config = {
  expo: {
    name: 'Vigilance',
    slug: 'vigilance-management-system',
    version,
    orientation: 'portrait',
    userInterfaceStyle: 'automatic',
    icon: './assets/icon.png',
    scheme: 'vigilance',
    newArchEnabled: true,
    assetBundlePatterns: ['**/*'],

    ios: {
      supportsTablet: false,
      bundleIdentifier: 'com.vigilance.kerala',
      buildNumber: String(buildNumber),
      infoPlist: {
        NSCameraUsageDescription:
          'Allow Vigilance to use the camera for inspection photos.',
        NSPhotoLibraryUsageDescription:
          'Allow Vigilance to access your photos for inspection reports.',
        NSLocationWhenInUseUsageDescription:
          'Vigilance needs your location to verify you are at the branch before starting an inspection.',
      },
    },

    android: {
      package: 'com.vigilance.kerala',
      versionCode: buildNumber,
      edgeToEdgeEnabled: false,
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#1e40af',
      },
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
      'expo-secure-store',
      'expo-font',
      'expo-asset',
      [
        'expo-splash-screen',
        {
          image: './assets/splash-icon.png',
          resizeMode: 'contain',
          backgroundColor: '#1e40af',
        },
      ],
      [
        'expo-image-picker',
        {
          photosPermission:
            'Allow Vigilance to access your photos for inspection reports.',
          cameraPermission:
            'Allow Vigilance to use the camera for inspection photos.',
        },
      ],
      [
        'expo-location',
        {
          locationAlwaysAndWhenInUsePermission:
            'Allow Vigilance to use your location for inspection records.',
        },
      ],
    ],

    web: {
      bundler: 'metro',
    },

    extra: {
      eas: easProjectId ? { projectId: easProjectId } : {},
      gitSha: safe('git rev-parse --short HEAD', 'unknown'),
    },
  },
};

// Only attach owner when set. EAS will refuse to build if `owner` points at
// an account the CLI isn't signed in as.
if (expoOwner) {
  config.expo.owner = expoOwner;
}

// EAS Update — OTA updates via expo-updates.
// Channel names must match the `channel` field in eas.json build profiles.
// OTA runtime — updates only apply within the same app version (1.1.0 → 1.1.0).
config.expo.runtimeVersion = { policy: 'appVersion' };
config.expo.updates = {
  enabled: true,
  checkAutomatically: 'ON_LOAD',
  fallbackToCacheTimeout: 0,
  url: `https://u.expo.dev/${easProjectId}`,
};
config.expo.plugins = config.expo.plugins || [];
if (!config.expo.plugins.includes('expo-updates')) {
  config.expo.plugins.push('expo-updates');
}

module.exports = config;
