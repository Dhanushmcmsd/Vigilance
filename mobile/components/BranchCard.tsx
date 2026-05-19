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
}) => {
  const tone = statusLabel ? statusColors[statusTone] : null;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={disabled ? 1 : 0.7}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      accessibilityLabel={`${disabled ? 'Unavailable' : 'Select'} ${branchName}, ${[location, city].filter(Boolean).join(', ')}${statusLabel ? `, ${statusLabel}` : ''}`}
      style={{
        backgroundColor: disabled ? '#f3f4f6' : COLOR.surface,
        borderRadius: RADIUS.md,
        paddingHorizontal: SPACING.lg,
        paddingVertical: SPACING.md,
        marginBottom: SPACING.sm,
        flexDirection: 'row',
        alignItems: 'center',
        minHeight: TOUCH.rowHeight,
        borderWidth: 1,
        borderColor: disabled ? '#e5e7eb' : COLOR.border,
        opacity: disabled ? 0.72 : 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: disabled ? 0 : 0.06,
        shadowRadius: 3,
        elevation: disabled ? 0 : 2,
      }}
    >
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontSize: FONT.bodyLg,
            fontWeight: '700',
            color: disabled ? COLOR.textMuted : COLOR.text,
            marginBottom: 2,
          }}
        >
          {branchName}
        </Text>
        <Text style={{ fontSize: FONT.body, color: COLOR.textMuted }}>
          {location}
          {city ? `, ${city}` : ''}
        </Text>
        {statusLabel && tone ? (
          <View
            style={{
              alignSelf: 'flex-start',
              marginTop: 6,
              paddingHorizontal: 8,
              paddingVertical: 3,
              borderRadius: 6,
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
              color: COLOR.brand,
              marginTop: 4,
            }}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      {!disabled ? (
        <Ionicons name="chevron-forward" size={22} color={COLOR.borderStrong} />
      ) : (
        <Ionicons name="lock-closed-outline" size={20} color={COLOR.textMuted} />
      )}
    </TouchableOpacity>
  );
};
