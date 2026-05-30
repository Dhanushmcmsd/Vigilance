import React from 'react';
import { TouchableOpacity, View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { COLOR, FONT, RADIUS, SPACING, TOUCH } from '../lib/a11y';

export type BranchCardStatusTone = 'completed' | 'in_progress' | 'resume';

interface BranchCardProps {
  branchName: string;
  location: string;
  city: string;
  onPress: () => void;
  subtitle?: string;
  disabled?: boolean;
  statusLabel?: string;
  statusTone?: BranchCardStatusTone;
  /** Overrides the default accessibility label derived from disabled state. */
  accessibilityLabel?: string;
}

const statusColors: Record<BranchCardStatusTone, { bg: string; text: string }> = {
  completed: { bg: '#ecfdf5', text: '#047857' },
  in_progress: { bg: '#fffbeb', text: '#b45309' },
  resume: { bg: '#eff6ff', text: '#1d4ed8' },
};

export const BranchCard: React.FC<BranchCardProps> = ({
  branchName,
  location,
  city,
  onPress,
  subtitle,
  disabled = false,
  statusLabel,
  statusTone = 'completed',
  accessibilityLabel: accessibilityLabelProp,
}) => {
  const tone = statusLabel ? statusColors[statusTone] : null;
  const locationLine = [location, city].filter(Boolean).join(', ');
  const accentColor = disabled
    ? '#cbd5e1'
    : statusTone === 'in_progress'
      ? '#f59e0b'
      : statusTone === 'resume'
        ? '#2563eb'
        : '#14b8a6';
  const defaultA11yLabel = disabled
    ? `Unavailable, ${branchName}, ${locationLine}${statusLabel ? `, ${statusLabel}` : ''}`
    : statusLabel?.toLowerCase().includes('refill')
      ? `Refill inspection, ${branchName}, ${locationLine}, ${statusLabel}`
      : `Select ${branchName}, ${locationLine}${statusLabel ? `, ${statusLabel}` : ''}`;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={disabled ? 1 : 0.7}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      accessibilityLabel={accessibilityLabelProp ?? defaultA11yLabel}
      style={{
        backgroundColor: disabled ? '#f8fafc' : COLOR.surface,
        borderRadius: RADIUS.xl,
        paddingHorizontal: SPACING.lg,
        paddingVertical: SPACING.md,
        marginBottom: SPACING.md,
        flexDirection: 'row',
        alignItems: 'center',
        minHeight: TOUCH.rowHeight,
        borderWidth: 1,
        borderColor: disabled ? '#e2e8f0' : '#dbeafe',
        opacity: disabled ? 0.72 : 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: disabled ? 0 : 0.08,
        shadowRadius: 16,
        elevation: disabled ? 0 : 4,
      }}
    >
      <View
        style={{
          width: 4,
          alignSelf: 'stretch',
          borderRadius: 999,
          backgroundColor: accentColor,
          marginRight: SPACING.md,
        }}
      />
      <View
        style={{
          width: 42,
          height: 42,
          borderRadius: RADIUS.lg,
          backgroundColor: disabled ? '#e2e8f0' : '#ccfbf1',
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: SPACING.md,
        }}
      >
        <Ionicons name="storefront-outline" size={21} color={disabled ? COLOR.textMuted : '#0f766e'} />
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontSize: FONT.bodyLg,
            fontWeight: '800',
            color: disabled ? COLOR.textMuted : COLOR.text,
            marginBottom: 4,
          }}
          numberOfLines={1}
        >
          {branchName}
        </Text>
        <Text style={{ fontSize: FONT.body, color: COLOR.textMuted, lineHeight: 18 }} numberOfLines={2}>
          {location}
          {city ? `, ${city}` : ''}
        </Text>
        {statusLabel && tone ? (
          <View
            style={{
              alignSelf: 'flex-start',
              marginTop: 6,
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: RADIUS.pill,
              backgroundColor: tone.bg,
            }}
          >
            <Text style={{ fontSize: 12, fontWeight: '600', color: tone.text }}>{statusLabel}</Text>
          </View>
        ) : null}
        {subtitle ? (
          <Text
            style={{
              fontSize: FONT.body,
              fontWeight: '700',
              color: '#0f766e',
              marginTop: 6,
            }}
            numberOfLines={2}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      {!disabled ? (
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            backgroundColor: '#f1f5f9',
            alignItems: 'center',
            justifyContent: 'center',
            marginLeft: SPACING.sm,
          }}
        >
          <Ionicons name="chevron-forward" size={18} color={COLOR.borderStrong} />
        </View>
      ) : statusTone === 'completed' ? (
        <Ionicons name="checkmark-circle" size={24} color="#047857" />
      ) : (
        <Ionicons name="lock-closed-outline" size={20} color={COLOR.textMuted} />
      )}
    </TouchableOpacity>
  );
};
