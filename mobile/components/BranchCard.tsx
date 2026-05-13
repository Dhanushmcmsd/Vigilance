import React from 'react';
import { TouchableOpacity, View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { COLOR, FONT, RADIUS, SPACING, TOUCH } from '../lib/a11y';

interface BranchCardProps {
  branchName: string;
  location: string;
  city: string;
  onPress: () => void;
  /** Optional caption rendered under the location (e.g. "1.2 km away" for nearMe). */
  subtitle?: string;
}

export const BranchCard: React.FC<BranchCardProps> = ({
  branchName,
  location,
  city,
  onPress,
  subtitle,
}) => (
  <TouchableOpacity
    onPress={onPress}
    activeOpacity={0.7}
    accessibilityRole="button"
    accessibilityLabel={`Select ${branchName}, ${[location, city].filter(Boolean).join(', ')}`}
    style={{
      backgroundColor: COLOR.surface,
      borderRadius: RADIUS.md,
      paddingHorizontal: SPACING.lg,
      paddingVertical: SPACING.md,
      marginBottom: SPACING.sm,
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: TOUCH.rowHeight,
      borderWidth: 1,
      borderColor: COLOR.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 3,
      elevation: 2,
    }}
  >
    <View style={{ flex: 1 }}>
      <Text
        style={{
          fontSize: FONT.bodyLg,
          fontWeight: '700',
          color: COLOR.text,
          marginBottom: 2,
        }}
      >
        {branchName}
      </Text>
      <Text style={{ fontSize: FONT.body, color: COLOR.textMuted }}>
        {location}
        {city ? `, ${city}` : ''}
      </Text>
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
    <Ionicons name="chevron-forward" size={22} color={COLOR.borderStrong} />
  </TouchableOpacity>
);
