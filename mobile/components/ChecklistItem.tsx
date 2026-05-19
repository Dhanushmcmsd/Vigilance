import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, Animated } from 'react-native';
import { haptics } from '../lib/haptics';
import { isViolationResponse } from '../lib/checklistScoring';

type ResponseType = 'Yes' | 'No' | 'N/A' | null;
type RiskLevel = 'RED' | 'YELLOW' | 'GREEN';

interface ChecklistItemProps {
  itemId: string;
  itemText: string;
  response: ResponseType;
  remark: string;
  onResponseChange: (itemId: string, response: ResponseType) => void;
  onRemarkChange: (itemId: string, remark: string) => void;
  risk_level?: RiskLevel;
  trigger_on_no?: boolean;
  min_remark_chars?: number;
  isRedAcknowledged?: boolean;
  onRedTriggered?: (itemId: string) => void;
}

// Per-risk visual + behaviour map.
const RISK_THEME: Record<RiskLevel, { border: string; bg: string; banner: string }> = {
  RED:    { border: '#DC2626', bg: '#FEF2F2', banner: '#DC2626' },
  YELLOW: { border: '#D97706', bg: '#FFFBEB', banner: '#D97706' },
  GREEN:  { border: 'transparent', bg: '#FFFFFF', banner: '#16A34A' },
};

export const ChecklistItem: React.FC<ChecklistItemProps> = ({
  itemId,
  itemText,
  response,
  remark,
  onResponseChange,
  onRemarkChange,
  risk_level,
  trigger_on_no = false,
  min_remark_chars,
  isRedAcknowledged = false,
  onRedTriggered,
}) => {
  const [showRemark, setShowRemark] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const remarkInputRef = useRef<TextInput>(null);
  const lastTriggeredResponseRef = useRef<ResponseType>(null);

  const isRed = risk_level === 'RED';
  const isYellow = risk_level === 'YELLOW';
  const theme = risk_level ? RISK_THEME[risk_level] : null;

  const effectiveMinChars = min_remark_chars ?? 0;
  const remarkLen = remark?.length ?? 0;
  const remarkBelowMin = effectiveMinChars > 0 && remarkLen < effectiveMinChars;

  useEffect(() => {
    if (response && isViolationResponse(response, trigger_on_no)) {
      setShowRemark(true);
      setTimeout(() => remarkInputRef.current?.focus(), 150);
    }
  }, [response, trigger_on_no]);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: showRemark ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [showRemark]);

  // Fire the RED-trigger callback exactly once per qualifying response change.
  useEffect(() => {
    if (!isRed || !onRedTriggered) return;
    if (isRedAcknowledged) return;
    if (response === null) return;
    if (lastTriggeredResponseRef.current === response) return;

    const triggers =
      (trigger_on_no && response === 'No') ||
      (!trigger_on_no && response === 'Yes');

    if (triggers) {
      lastTriggeredResponseRef.current = response;
      onRedTriggered(itemId);
    }
  }, [response, isRed, isRedAcknowledged, trigger_on_no, itemId, onRedTriggered]);

  const ResponseButton = ({
    label,
    value,
    activeColor,
    activeBg,
  }: {
    label: string;
    value: ResponseType;
    activeColor: string;
    activeBg: string;
  }) => {
    const isActive = response === value;
    return (
      <TouchableOpacity
        onPress={() => {
          haptics.tap();
          onResponseChange(itemId, value);
        }}
        activeOpacity={0.7}
        style={{
          flex: 1,
          minHeight: 44,
          borderRadius: 8,
          alignItems: 'center',
          justifyContent: 'center',
          marginHorizontal: 3,
          borderWidth: 1.5,
          backgroundColor: isActive ? activeBg : '#f9fafb',
          borderColor: isActive ? activeColor : '#e5e7eb',
        }}
      >
        <Text
          style={{
            fontWeight: '700',
            fontSize: 13,
            color: isActive ? activeColor : '#9ca3af',
            letterSpacing: 0.5,
          }}
        >
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View
      style={{
        backgroundColor: theme?.bg ?? '#fff',
        borderRadius: 10,
        marginBottom: 8,
        padding: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
        borderWidth: response === null ? 1.5 : 1,
        borderColor: response === null ? '#fbbf24' : '#e5e7eb',
        borderLeftWidth: isRed || isYellow ? 4 : 1,
        borderLeftColor: isRed || isYellow ? theme!.border : '#e5e7eb',
      }}
    >
      {/* Risk badge + RED pending-acknowledgement banner */}
      {risk_level && (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
          <View
            style={{
              paddingHorizontal: 8,
              paddingVertical: 2,
              borderRadius: 4,
              backgroundColor: RISK_THEME[risk_level].border,
            }}
          >
            <Text style={{ color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 }}>
              {risk_level}
            </Text>
          </View>
        </View>
      )}

      <Text style={{ fontSize: 14, color: '#1f2937', lineHeight: 20, marginBottom: 10 }}>
        {itemText}
      </Text>

      <View style={{ flexDirection: 'row' }}>
        <ResponseButton label="YES" value="Yes" activeColor="#16a34a" activeBg="#dcfce7" />
        <ResponseButton label="NO" value="No" activeColor="#dc2626" activeBg="#fee2e2" />
        <ResponseButton label="N/A" value="N/A" activeColor="#6b7280" activeBg="#f3f4f6" />
      </View>

      <TouchableOpacity
        onPress={() => setShowRemark(!showRemark)}
        style={{ marginTop: 8 }}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text style={{ fontSize: 12, color: '#2563eb', fontWeight: '500' }}>
          {showRemark ? '▲ Hide remark' : '+ Add remark'}
          {effectiveMinChars > 0 && ` (min ${effectiveMinChars} chars)`}
        </Text>
      </TouchableOpacity>

      {showRemark && (
        <Animated.View style={{ opacity: fadeAnim, marginTop: 8 }}>
          <TextInput
            ref={remarkInputRef}
            value={remark}
            onChangeText={(t) => onRemarkChange(itemId, t)}
            placeholder="Type your remark here (optional)..."
            placeholderTextColor="#9ca3af"
            multiline
            numberOfLines={3}
            style={{
              borderWidth: 1,
              borderColor: remarkBelowMin ? '#DC2626' : '#e5e7eb',
              borderRadius: 8,
              padding: 10,
              fontSize: 13,
              color: '#1f2937',
              backgroundColor: '#fff',
              minHeight: 60,
              textAlignVertical: 'top',
            }}
          />
          {effectiveMinChars > 0 && (
            <Text
              style={{
                marginTop: 4,
                fontSize: 11,
                fontWeight: '600',
                color: remarkBelowMin ? '#DC2626' : '#16a34a',
              }}
            >
              {remarkLen}/{effectiveMinChars} characters
              {remarkBelowMin ? ` — ${effectiveMinChars - remarkLen} more required` : ' ✓'}
            </Text>
          )}
        </Animated.View>
      )}
    </View>
  );
};
