import React from 'react';
import { Modal, View, Text, TouchableOpacity } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { COLOR, FONT, RADIUS, SPACING } from '../lib/a11y';

interface DistrictNotification {
  id: string;
  title: string;
  body: string;
}

/** First unread district_reassigned notification — shown once per assignment. */
export function DistrictAssignmentModal() {
  const { userRolesId, userRole } = useAuth();
  const qc = useQueryClient();

  const { data: notification } = useQuery<DistrictNotification | null>({
    queryKey: ['district-assignment-alert', userRolesId],
    enabled: !!userRolesId && userRole === 'officer',
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('id, title, body')
        .eq('recipient_id', userRolesId!)
        .eq('type', 'district_reassigned')
        .eq('is_read', false)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const dismiss = async () => {
    if (!notification) return;
    await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('id', notification.id);
    void qc.invalidateQueries({ queryKey: ['district-assignment-alert'] });
  };

  if (!notification) return null;

  const districtMatch = notification.body.match(/cover (.+?) district/i);
  const district = districtMatch?.[1] ?? 'your new';

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => void dismiss()}>
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.55)',
          justifyContent: 'center',
          padding: SPACING.lg,
        }}
      >
        <View
          style={{
            backgroundColor: COLOR.surface,
            borderRadius: RADIUS.lg,
            padding: SPACING.lg,
            borderWidth: 1,
            borderColor: COLOR.border,
          }}
        >
          <Text style={{ color: COLOR.text, fontSize: FONT.h2, fontWeight: '700', marginBottom: SPACING.sm }}>
            📍 New Assignment
          </Text>
          <Text style={{ color: COLOR.textMuted, fontSize: FONT.body, lineHeight: 22, marginBottom: SPACING.md }}>
            You have been assigned to cover {district} district.{'\n'}
            {district} stores are now visible in your store list.
          </Text>
          <TouchableOpacity
            onPress={() => void dismiss()}
            style={{
              alignSelf: 'flex-end',
              backgroundColor: COLOR.brand,
              paddingHorizontal: SPACING.lg,
              paddingVertical: SPACING.sm,
              borderRadius: RADIUS.md,
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '600' }}>Got it</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
