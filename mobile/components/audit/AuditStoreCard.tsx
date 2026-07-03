import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLOR, RADIUS, SPACING, TOUCH } from '../../lib/a11y';
import { AUDIT, auditScoreColor } from '../../lib/auditTheme';

interface Props {
  branchName: string;
  city: string | null;
  region: string | null;
  reportCount: number;
  lastScore: number | null;
  lastDate: string | null;
  onPress: () => void;
  highlightDot?: boolean;
}

export function AuditStoreCard({
  branchName,
  city,
  region,
  reportCount,
  lastScore,
  lastDate,
  onPress,
  highlightDot,
}: Props) {
  const locationLine = [city, region].filter(Boolean).join(' · ');
  const scoreColor = auditScoreColor(lastScore);

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`View audit reports for ${branchName}`}
      style={{
        backgroundColor: COLOR.surface,
        borderRadius: RADIUS.xl,
        paddingHorizontal: SPACING.lg,
        paddingVertical: SPACING.md,
        marginBottom: SPACING.md,
        minHeight: TOUCH.rowHeight,
        borderWidth: 1,
        borderColor: '#dbeafe',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.08,
        shadowRadius: 16,
        elevation: 4,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 14,
            backgroundColor: AUDIT.accentSoft,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 12,
          }}
        >
          <Ionicons name="storefront-outline" size={22} color={AUDIT.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={{ fontSize: 16, fontWeight: '800', color: COLOR.text, flex: 1 }} numberOfLines={2}>
              {branchName}
            </Text>
            {highlightDot ? (
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: AUDIT.success,
                }}
              />
            ) : null}
          </View>
          {locationLine ? (
            <Text style={{ fontSize: 13, color: COLOR.textMuted, marginTop: 2 }} numberOfLines={1}>
              {locationLine}
            </Text>
          ) : null}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 10, gap: 8, alignItems: 'center' }}>
            <View
              style={{
                backgroundColor: AUDIT.accentSoft,
                borderRadius: RADIUS.md,
                paddingHorizontal: 10,
                paddingVertical: 4,
              }}
            >
              <Text style={{ fontSize: 12, color: '#0f766e', fontWeight: '700' }}>
                {reportCount} {reportCount === 1 ? 'report' : 'reports'}
              </Text>
            </View>
            {lastDate ? (
              <Text style={{ fontSize: 12, color: COLOR.textMuted }}>
                Last{' '}
                {new Date(lastDate).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                })}
              </Text>
            ) : null}
          </View>
        </View>
        <View style={{ alignItems: 'flex-end', marginLeft: 8 }}>
          {lastScore !== null ? (
            <Text style={{ fontSize: 22, fontWeight: '900', color: scoreColor }}>
              {lastScore.toFixed(0)}%
            </Text>
          ) : (
            <Text style={{ fontSize: 12, color: COLOR.textMuted, fontWeight: '600' }}>No score</Text>
          )}
          <Ionicons name="chevron-forward" size={18} color={COLOR.textMuted} style={{ marginTop: 6 }} />
        </View>
      </View>
    </TouchableOpacity>
  );
}
