import React from 'react';
import { TouchableOpacity, View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface BranchCardProps {
  branchName: string;
  location: string;
  city: string;
  onPress: () => void;
}

export const BranchCard: React.FC<BranchCardProps> = ({ branchName, location, city, onPress }) => (
  <TouchableOpacity
    onPress={onPress}
    activeOpacity={0.7}
    style={{
      backgroundColor: '#fff',
      borderRadius: 12,
      padding: 16,
      marginBottom: 10,
      flexDirection: 'row',
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 3,
      elevation: 2,
    }}
  >
    <View style={{ flex: 1 }}>
      <Text style={{ fontSize: 16, fontWeight: '700', color: '#1f2937', marginBottom: 3 }}>
        {branchName}
      </Text>
      <Text style={{ fontSize: 13, color: '#6b7280' }}>
        {location}{city ? `, ${city}` : ''}
      </Text>
    </View>
    <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
  </TouchableOpacity>
);
