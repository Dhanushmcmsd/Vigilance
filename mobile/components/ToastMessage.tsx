import React, { useEffect, useRef } from 'react';
import { Animated, Text, View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface ToastMessageProps {
  message: string;
  type: 'success' | 'error' | 'warning';
  duration?: number;
  visible: boolean;
  onHide: () => void;
}

const COLORS = {
  success: { bg: '#16a34a', text: '#fff', icon: '✓' },
  error:   { bg: '#dc2626', text: '#fff', icon: '✕' },
  warning: { bg: '#d97706', text: '#fff', icon: '⚠' },
};

export const ToastMessage: React.FC<ToastMessageProps> = ({
  message,
  type,
  duration = 3000,
  visible,
  onHide,
}) => {
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(-100)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 80,
        friction: 10,
      }).start();
      const timer = setTimeout(() => {
        Animated.timing(translateY, {
          toValue: -100,
          duration: 250,
          useNativeDriver: true,
        }).start(() => onHide());
      }, duration);
      return () => clearTimeout(timer);
    } else {
      translateY.setValue(-100);
    }
  }, [visible]);

  if (!visible) return null;

  const colors = COLORS[type];

  return (
    <Animated.View
      style={[
        styles.container,
        {
          top: insets.top + 8,
          backgroundColor: colors.bg,
          transform: [{ translateY }],
        },
      ]}
    >
      <Text style={[styles.icon, { color: colors.text }]}>{colors.icon}</Text>
      <Text style={[styles.message, { color: colors.text }]} numberOfLines={2}>
        {message}
      </Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 9999,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  icon: { fontSize: 16, fontWeight: '700', marginRight: 10 },
  message: { fontSize: 14, fontWeight: '500', flex: 1, lineHeight: 20 },
});
