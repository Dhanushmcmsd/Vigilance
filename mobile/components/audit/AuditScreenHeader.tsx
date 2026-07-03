import React from 'react';
import { View, Text, TouchableOpacity, TextInput, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AUDIT } from '../../lib/auditTheme';
import { SPACING } from '../../lib/a11y';

interface Props {
  eyebrow: string;
  title: string;
  subtitle?: string;
  onBack?: () => void;
  rightAction?: React.ReactNode;
  style?: ViewStyle;
}

export function AuditScreenHeader({ eyebrow, title, subtitle, onBack, rightAction, style }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <LinearGradient
      colors={[AUDIT.headerFrom, AUDIT.headerTo]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[
        {
          paddingTop: insets.top + 12,
          paddingHorizontal: 16,
          paddingBottom: 22,
          borderBottomLeftRadius: 24,
          borderBottomRightRadius: 24,
        },
        style,
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        {onBack ? (
          <TouchableOpacity
            onPress={onBack}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={{
              marginRight: 12,
              width: 40,
              height: 40,
              borderRadius: 14,
              backgroundColor: 'rgba(255,255,255,0.12)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
        ) : null}
        <View style={{ flex: 1 }}>
          <Text
            style={{
              color: AUDIT.textOnHeaderMuted,
              fontSize: 11,
              fontWeight: '800',
              letterSpacing: 1.2,
            }}
          >
            {eyebrow}
          </Text>
          <Text style={{ fontSize: 24, fontWeight: '900', color: AUDIT.textOnHeader, marginTop: 4 }}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={{ fontSize: 13, color: '#ccfbf1', marginTop: 4, lineHeight: 18 }}>{subtitle}</Text>
          ) : null}
        </View>
        {rightAction ?? (
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
            <Text style={{ color: '#fff', fontSize: 22, fontWeight: '900' }}>V</Text>
          </View>
        )}
      </View>
    </LinearGradient>
  );
}

export function AuditSearchBar({
  value,
  onChangeText,
  placeholder,
}: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
}) {
  return (
    <View
      style={{
        backgroundColor: AUDIT.surface,
        paddingHorizontal: SPACING.lg,
        paddingTop: 14,
        paddingBottom: 12,
        marginHorizontal: 16,
        marginTop: -10,
        borderRadius: 18,
        shadowColor: AUDIT.headerFrom,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.1,
        shadowRadius: 18,
        elevation: 7,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: AUDIT.surfaceMuted,
          borderRadius: 14,
          paddingHorizontal: 12,
          borderWidth: 1,
          borderColor: AUDIT.border,
        }}
      >
        <Ionicons name="search" size={20} color={AUDIT.textMuted} />
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={AUDIT.textMuted}
          style={{ flex: 1, color: AUDIT.text, fontSize: 15, paddingVertical: 12, paddingLeft: 8 }}
        />
        {value.length > 0 ? (
          <TouchableOpacity onPress={() => onChangeText('')}>
            <Ionicons name="close-circle" size={20} color={AUDIT.textMuted} />
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}
