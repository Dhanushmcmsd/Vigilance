import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, type Plugin } from 'vitest/config';
import react from '@vitejs/plugin-react';

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const mocksDir = path.resolve(rootDir, './src/tests/mocks');

const mobileLibMocks: Record<string, string> = {
  './supabase': path.resolve(mocksDir, 'mobileSupabase.ts'),
  './deviceInfo': path.resolve(mocksDir, 'mobileDeviceInfo.ts'),
  './uploadInspectionFiles': path.resolve(mocksDir, 'mobileUploadInspectionFiles.ts'),
};

function mockMobileLibImports(): Plugin {
  return {
    name: 'mock-mobile-lib-imports',
    enforce: 'pre',
    resolveId(source, importer) {
      const normImporter = importer?.replace(/\\/g, '/');
      if (!normImporter?.includes('mobile/lib/')) return null;
      const mock = mobileLibMocks[source];
      return mock ?? null;
    },
  };
}

export default defineConfig({
  plugins: [react(), mockMobileLibImports()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/tests/setup.ts'],
  },
  define: {
    __DEV__: false,
  },
  resolve: {
    alias: [
      { find: '@', replacement: path.resolve(rootDir, './src') },
      { find: '@mobile', replacement: path.resolve(rootDir, '../mobile') },
      { find: /^react-native$/, replacement: path.resolve(mocksDir, 'reactNative.ts') },
      {
        find: '@react-native-async-storage/async-storage',
        replacement: path.resolve(mocksDir, 'asyncStorage.ts'),
      },
      {
        find: '@react-native-community/netinfo',
        replacement: path.resolve(mocksDir, 'netInfo.ts'),
      },
      { find: 'react-native-mmkv', replacement: path.resolve(mocksDir, 'mmkv.ts') },
      { find: 'react-native-url-polyfill/auto', replacement: path.resolve(mocksDir, 'empty.ts') },
      { find: 'react-native-url-polyfill', replacement: path.resolve(mocksDir, 'empty.ts') },
      { find: 'expo-secure-store', replacement: path.resolve(mocksDir, 'expoSecureStore.ts') },
      { find: '@expo/vector-icons', replacement: path.resolve(mocksDir, 'expoVectorIcons.ts') },
    ],
  },
});
