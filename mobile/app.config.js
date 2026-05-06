module.exports = {
  expo: {
    name: 'Vigilance MS',
    slug: 'vigilance-ms',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'automatic',
    splash: {
      image: './assets/splash.png',
      resizeMode: 'contain',
      backgroundColor: '#0f172a',
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.yourcompany.vigilancems',
      infoPlist: {
        NSCameraUsageDescription: 'Used to capture inspection photos.',
        NSPhotoLibraryUsageDescription: 'Used to attach photos to inspection reports.',
        NSLocationWhenInUseUsageDescription: 'Used to tag inspections with location.',
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#0f172a',
      },
      package: 'com.yourcompany.vigilancems',
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
      ['expo-location', { locationAlwaysAndWhenInUsePermission: 'Used for GPS tagging inspections.' }],
    ],
    extra: {
      eas: { projectId: 'YOUR_EAS_PROJECT_ID' },
    },
    owner: 'YOUR_EXPO_ACCOUNT',
  },
};
