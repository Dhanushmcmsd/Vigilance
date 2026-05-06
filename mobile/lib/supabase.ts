import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

// LargeSecureStore: splits values > 2048 bytes across multiple SecureStore keys
const MAX_SECURE_STORE_VALUE_SIZE = 1800;

class LargeSecureStore {
  private async _saveChunk(key: string, value: string): Promise<void> {
    const chunks: string[] = [];
    let offset = 0;
    while (offset < value.length) {
      chunks.push(value.slice(offset, offset + MAX_SECURE_STORE_VALUE_SIZE));
      offset += MAX_SECURE_STORE_VALUE_SIZE;
    }
    await SecureStore.setItemAsync(`${key}_count`, String(chunks.length));
    for (let i = 0; i < chunks.length; i++) {
      await SecureStore.setItemAsync(`${key}_${i}`, chunks[i]);
    }
  }

  async getItem(key: string): Promise<string | null> {
    const countStr = await SecureStore.getItemAsync(`${key}_count`);
    if (!countStr) return null;
    const count = parseInt(countStr, 10);
    let value = '';
    for (let i = 0; i < count; i++) {
      const chunk = await SecureStore.getItemAsync(`${key}_${i}`);
      if (chunk == null) return null;
      value += chunk;
    }
    return value;
  }

  async removeItem(key: string): Promise<void> {
    const countStr = await SecureStore.getItemAsync(`${key}_count`);
    if (!countStr) return;
    const count = parseInt(countStr, 10);
    await SecureStore.deleteItemAsync(`${key}_count`);
    for (let i = 0; i < count; i++) {
      await SecureStore.deleteItemAsync(`${key}_${i}`);
    }
  }

  async setItem(key: string, value: string): Promise<void> {
    await this._saveChunk(key, value);
  }
}

const secureStore = new LargeSecureStore();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: secureStore,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
