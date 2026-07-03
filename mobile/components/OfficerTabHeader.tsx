import React from 'react';
import { View, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function OfficerTabHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  const insets = useSafeAreaInsets();

  return (
    <LinearGradient
      colors={['#0f172a', '#0f766e']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        paddingHorizontal: 16,
        paddingTop: insets.top + 16,
        paddingBottom: 24,
        flexDirection: 'row',
        alignItems: 'center',
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
      }}
    >
      <View style={{ flex: 1 }}>
        <Text style={{ color: '#99f6e4', fontSize: 11, fontWeight: '800', letterSpacing: 1.2 }}>
          VIGILANCE
        </Text>
        <Text style={{ fontSize: 24, fontWeight: '900', color: '#fff', marginTop: 4 }}>{title}</Text>
        {subtitle ? (
          <Text style={{ color: '#ccfbf1', fontSize: 12, marginTop: 3 }}>{subtitle}</Text>
        ) : null}
      </View>
      <View
        style={{
          width: 48,
          height: 48,
          borderRadius: 16,
          backgroundColor: 'rgba(255,255,255,0.16)',
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.24)',
        }}
      >
        <Text style={{ color: '#fff', fontSize: 24, fontWeight: '900' }}>V</Text>
      </View>
    </LinearGradient>
  );
}
