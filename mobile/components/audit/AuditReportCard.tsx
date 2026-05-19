import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AUDIT, auditScoreColor } from '../../lib/auditTheme';
import { formatReportDayLine, type AuditReportRow } from '../../lib/auditReports';
import { RADIUS, SPACING } from '../../lib/a11y';

interface Props {
  item: AuditReportRow;
  onPress: () => void;
  showDayHeader?: boolean;
}

export const AuditReportCard: React.FC<Props> = ({ item, onPress, showDayHeader = true }) => {
  const { weekday, dateLine } = formatReportDayLine(item.inspection_date);
  const scoreColor = auditScoreColor(item.compliance_score);

  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        backgroundColor: AUDIT.surface,
        borderRadius: RADIUS.xl,
        padding: SPACING.lg,
        marginBottom: SPACING.md,
        borderWidth: 1,
        borderColor: AUDIT.border,
        flexDirection: 'row',
        alignItems: 'center',
      }}
      activeOpacity={0.85}
    >
      <View style={{ flex: 1 }}>
        {showDayHeader && (
          <>
            <Text style={{ fontSize: 12, fontWeight: '800', color: AUDIT.accent, letterSpacing: 0.5 }}>
              {weekday.toUpperCase()}
            </Text>
            <Text style={{ fontSize: 16, fontWeight: '800', color: AUDIT.text, marginTop: 2 }}>
              {dateLine}
            </Text>
          </>
        )}
        <Text
          style={{
            fontSize: showDayHeader ? 13 : 15,
            fontWeight: showDayHeader ? '600' : '800',
            color: showDayHeader ? AUDIT.textMuted : AUDIT.text,
            marginTop: showDayHeader ? 6 : 0,
          }}
        >
          Officer: {item.officer?.name ?? 'Unknown'}
        </Text>
        <View style={{ flexDirection: 'row', marginTop: 8, gap: 8, alignItems: 'center' }}>
          <Ionicons name="document-text-outline" size={16} color={AUDIT.accent} />
          <Text style={{ fontSize: 12, fontWeight: '700', color: AUDIT.accent }}>
            Open checklist PDF
          </Text>
        </View>
      </View>
      {item.compliance_score !== null && (
        <Text style={{ fontSize: 26, fontWeight: '900', color: scoreColor, marginRight: 8 }}>
          {item.compliance_score.toFixed(0)}%
        </Text>
      )}
      <Ionicons name="chevron-forward" size={20} color={AUDIT.textMuted} />
    </TouchableOpacity>
  );
};
