import React, { useEffect, useRef } from 'react';
import { View, Text, Animated } from 'react-native';

interface ProgressBarProps {
  answered: number;
  total: number;
  /**
   * When true, force the bar into a RED state regardless of progress —
   * used to signal pending RED-risk supervisor acknowledgements.
   */
  red?: boolean;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ answered, total, red = false }) => {
  const animatedWidth = useRef(new Animated.Value(0)).current;
  const percent = total > 0 ? (answered / total) * 100 : 0;

  useEffect(() => {
    Animated.timing(animatedWidth, {
      toValue: percent,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [percent]);

  const barColor = red
    ? '#DC2626'
    : percent === 100
    ? '#16a34a'
    : percent >= 60
    ? '#2563eb'
    : '#f59e0b';

  return (
    <View className="px-4 py-2 bg-white border-b border-gray-100">
      <View className="flex-row justify-between mb-1">
        <Text className="text-xs font-medium text-gray-500">
          {answered} of {total} answered
        </Text>
        <Text className="text-xs font-bold" style={{ color: barColor }}>
          {Math.round(percent)}%
        </Text>
      </View>
      <View className="h-2 bg-gray-200 rounded-full overflow-hidden">
        <Animated.View
          style={[
            {
              height: '100%',
              backgroundColor: barColor,
              borderRadius: 9999,
              width: animatedWidth.interpolate({
                inputRange: [0, 100],
                outputRange: ['0%', '100%'],
              }),
            },
          ]}
        />
      </View>
    </View>
  );
};
