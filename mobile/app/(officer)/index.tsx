import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { getAllDrafts } from '../../lib/storage';

const GREETING = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
};

const DATE_STR = new Date().toLocaleDateString('en-IN', {
  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
});

export default function BranchTypeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { userName, signOut } = useAuth();
  const [draftCount, setDraftCount] = useState(0);

  useEffect(() => {
    getAllDrafts().then((d) => setDraftCount(d.length));
  }, []);

  const navigate = (type: 'CFC' | 'Store') => {
    router.push({ pathname: '/(officer)/select-branch', params: { branchType: type } });
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#f1f5f9', paddingTop: insets.top }}>
      <StatusBar barStyle="dark-content" />

      {/* Header */}
      <View
        style={{
          backgroundColor: '#1e40af',
          paddingHorizontal: 20,
          paddingTop: 16,
          paddingBottom: 20,
        }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View>
            <Text style={{ fontSize: 22, fontWeight: '800', color: '#fff' }}>
              {GREETING()}, {userName.split(' ')[0]}!
            </Text>
            <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>{DATE_STR}</Text>
          </View>
          <TouchableOpacity
            onPress={signOut}
            style={{
              backgroundColor: 'rgba(255,255,255,0.15)',
              borderRadius: 10,
              padding: 8,
            }}
          >
            <Ionicons name="log-out-outline" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 20 }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={{ fontSize: 16, fontWeight: '600', color: '#374151', marginBottom: 16 }}>
          Select Branch Type
        </Text>

        {/* CFC Card */}
        <TouchableOpacity
          onPress={() => navigate('CFC')}
          activeOpacity={0.85}
          style={{
            backgroundColor: '#1e40af',
            borderRadius: 20,
            padding: 28,
            marginBottom: 16,
            minHeight: 160,
            justifyContent: 'space-between',
            shadowColor: '#1e40af',
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.35,
            shadowRadius: 12,
            elevation: 6,
          }}
        >
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              backgroundColor: 'rgba(255,255,255,0.15)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="storefront-outline" size={30} color="#fff" />
          </View>
          <View>
            <Text style={{ fontSize: 28, fontWeight: '900', color: '#fff', letterSpacing: 1 }}>CFC</Text>
            <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.75)', marginTop: 4 }}>
              Central Fulfillment Centre
            </Text>
          </View>
          <Ionicons name="arrow-forward" size={22} color="rgba(255,255,255,0.7)" />
        </TouchableOpacity>

        {/* Store Card */}
        <TouchableOpacity
          onPress={() => navigate('Store')}
          activeOpacity={0.85}
          style={{
            backgroundColor: '#0f766e',
            borderRadius: 20,
            padding: 28,
            marginBottom: 24,
            minHeight: 160,
            justifyContent: 'space-between',
            shadowColor: '#0f766e',
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.35,
            shadowRadius: 12,
            elevation: 6,
          }}
        >
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              backgroundColor: 'rgba(255,255,255,0.15)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="bag-outline" size={30} color="#fff" />
          </View>
          <View>
            <Text style={{ fontSize: 28, fontWeight: '900', color: '#fff', letterSpacing: 1 }}>Store</Text>
            <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.75)', marginTop: 4 }}>
              Retail Store Branch
            </Text>
          </View>
          <Ionicons name="arrow-forward" size={22} color="rgba(255,255,255,0.7)" />
        </TouchableOpacity>

        {/* Drafts Button */}
        <TouchableOpacity
          onPress={() => {}}
          style={{
            backgroundColor: '#fff',
            borderRadius: 14,
            padding: 16,
            flexDirection: 'row',
            alignItems: 'center',
            borderWidth: 1.5,
            borderColor: '#e5e7eb',
          }}
        >
          <Ionicons name="document-text-outline" size={22} color="#6b7280" />
          <Text style={{ fontSize: 15, fontWeight: '600', color: '#374151', marginLeft: 12, flex: 1 }}>
            My Drafts
          </Text>
          {draftCount > 0 && (
            <View
              style={{
                backgroundColor: '#ef4444',
                borderRadius: 12,
                paddingHorizontal: 8,
                paddingVertical: 3,
              }}
            >
              <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>{draftCount}</Text>
            </View>
          )}
          <Ionicons name="chevron-forward" size={18} color="#9ca3af" style={{ marginLeft: 8 }} />
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
