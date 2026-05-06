import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, Animated } from 'react-native';

type ResponseType = 'Yes' | 'No' | 'N/A' | null;

interface ChecklistItemProps {
  itemId: string;
  itemText: string;
  response: ResponseType;
  remark: string;
  onResponseChange: (itemId: string, response: ResponseType) => void;
  onRemarkChange: (itemId: string, remark: string) => void;
}

export const ChecklistItem: React.FC<ChecklistItemProps> = ({
  itemId,
  itemText,
  response,
  remark,
  onResponseChange,
  onRemarkChange,
}) => {
  const [showRemark, setShowRemark] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const remarkInputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (response === 'No') {
      setShowRemark(true);
      setTimeout(() => remarkInputRef.current?.focus(), 150);
    }
  }, [response]);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: showRemark ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [showRemark]);

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
        onPress={() => onResponseChange(itemId, value)}
        activeOpacity={0.7}
        style={[
          {
            flex: 1,
            minHeight: 44,
            borderRadius: 8,
            alignItems: 'center',
            justifyContent: 'center',
            marginHorizontal: 3,
            borderWidth: 1.5,
            backgroundColor: isActive ? activeBg : '#f9fafb',
            borderColor: isActive ? activeColor : '#e5e7eb',
          },
        ]}
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
      style={[
        {
          backgroundColor: '#fff',
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
        },
      ]}
    >
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
        </Text>
      </TouchableOpacity>
      {showRemark && (
        <Animated.View style={{ opacity: fadeAnim, marginTop: 8 }}>
          <TextInput
            ref={remarkInputRef}
            value={remark}
            onChangeText={(t) => onRemarkChange(itemId, t)}
            placeholder="Type your remark here..."
            placeholderTextColor="#9ca3af"
            multiline
            numberOfLines={2}
            style={{
              borderWidth: 1,
              borderColor: '#e5e7eb',
              borderRadius: 8,
              padding: 10,
              fontSize: 13,
              color: '#1f2937',
              backgroundColor: '#f9fafb',
              minHeight: 60,
              textAlignVertical: 'top',
            }}
          />
        </Animated.View>
      )}
    </View>
  );
};
