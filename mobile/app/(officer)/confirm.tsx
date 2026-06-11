import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Animated,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

interface PastInspection {
  id: string;
  inspection_date: string;
  status: string;
  compliance_score: number | null;
  branches: { branch_name: string };
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  submitted: { bg: '#dbeafe', text: '#1d4ed8' },
  approved:  { bg: '#dcfce7', text: '#15803d' },
  rejected:  { bg: '#fee2e2', text: '#b91c1c' },
  draft:     { bg: '#f3f4f6', text: '#6b7280' },
};

const RISK_COLORS: Record<string, string> = {
  low: '#16a34a', medium: '#d97706', high: '#dc2626', critical: '#7c3aed',
};

// Animated Checkmark
const AnimatedCheckmark = () => {
  const scale = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(200),
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 60, friction: 8 }),
        Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  return (
    <Animated.View
      style={[
        {
          width: 100,
          height: 100,
          borderRadius: 50,
          backgroundColor: '#dcfce7',
          alignItems: 'center',
          justifyContent: 'center',
          transform: [{ scale }],
          opacity,
        },
      ]}
    >
      <Ionicons name="checkmark" size={56} color="#16a34a" />
    </Animated.View>
  );
};

export default function ConfirmScreen() {
  const params = useLocalSearchParams<{
    inspectionId: string;
    branchName: string;
    branchType: string;
    date: string;
    timeIn: string;
    timeOut: string;
    answeredCount: string;
    totalItems: string;
    filesCount: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { userRolesId } = useAuth();

  const [inspection, setInspection] = useState<{ compliance_score: number | null; risk_level: string | null; id: string } | null>(null);
  const [pastInspections, setPastInspections] = useState<PastInspection[]>([]);
  const [loadingPast, setLoadingPast] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const { data, error } = await supabase
        .from('inspections')
        .select('compliance_score, risk_level, id')
        .eq('id', params.inspectionId)
        .single();
      if (error) {
        setLoadError(error.message);
      } else {
        setInspection(data);
      }

      const { data: pastData, error: pastError } = await supabase
        .from('inspections')
        .select('id, inspection_date, status, compliance_score, branches(branch_name)')
        .eq('officer_id', userRolesId)
        .eq('status', 'submitted')
        .order('inspection_date', { ascending: false })
        .limit(10);
      if (pastError) {
        setLoadError((prev) => prev ?? pastError.message);
      } else {
        setPastInspections((pastData as unknown as PastInspection[]) || []);
      }
      setLoadingPast(false);
    })();
  }, [params.inspectionId, userRolesId]);

  const shortId = params.inspectionId?.slice(0, 8).toUpperCase() || 'N/A';
  const score = inspection?.compliance_score;
  const riskLevel = inspection?.risk_level;
  const riskColor = riskLevel ? RISK_COLORS[riskLevel] : '#6b7280';

  return (
    <View style={{ flex: 1, backgroundColor: '#f8fafc', paddingTop: insets.top }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 20 }}>
        {/* Success Banner */}
        <View style={{ alignItems: 'center', paddingVertical: 32 }}>
          <AnimatedCheckmark />
          <Text style={{ fontSize: 26, fontWeight: '900', color: '#1f2937', marginTop: 20 }}>
            Inspection Submitted!
          </Text>
          <Text style={{ fontSize: 14, color: '#6b7280', marginTop: 6, textAlign: 'center' }}>
            Your inspection has been recorded and sent for review.
          </Text>
        </View>

        {/* Summary Card */}
        <View
          style={{
            backgroundColor: '#fff',
            borderRadius: 16,
            padding: 20,
            marginBottom: 16,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.06,
            shadowRadius: 6,
            elevation: 3,
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: '700', color: '#1f2937', marginBottom: 16 }}>
            Inspection Summary
          </Text>
          {[
            { label: 'Branch', value: params.branchName },
            { label: 'Type', value: params.branchType },
            { label: 'Date', value: params.date },
            { label: 'Time In', value: params.timeIn || '—' },
            { label: 'Time Out', value: params.timeOut || '—' },
            {
              label: 'Items Answered',
              value: `${params.answeredCount ?? '0'} / ${params.totalItems ?? params.answeredCount ?? '0'}`,
            },
            { label: 'Photos Attached', value: params.filesCount || '0' },
          ].map(({ label, value }) => (
            <View key={label} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' }}>
              <Text style={{ fontSize: 13, color: '#6b7280' }}>{label}</Text>
              <Text style={{ fontSize: 13, fontWeight: '600', color: '#1f2937' }}>{value}</Text>
            </View>
          ))}

          {/* Score */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingTop: 14, alignItems: 'center' }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#374151' }}>Compliance Score</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {loadError ? (
                <Text style={{ fontSize: 13, color: '#dc2626' }}>{loadError}</Text>
              ) : score !== null && score !== undefined ? (
                <Text style={{ fontSize: 22, fontWeight: '900', color: riskColor }}>
                  {score.toFixed(1)}%
                </Text>
              ) : (
                <ActivityIndicator size="small" color="#2563eb" />
              )}
              {riskLevel && (
                <View style={{ backgroundColor: riskColor + '22', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                  <Text style={{ color: riskColor, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' }}>
                    {riskLevel}
                  </Text>
                </View>
              )}
            </View>
          </View>

          <Text style={{ marginTop: 14, fontSize: 12, color: '#9ca3af' }}>
            Ref: #{shortId}
          </Text>
        </View>

        {/* CTA Buttons */}
        <TouchableOpacity
          onPress={() => router.replace('/(officer)')}
          style={{
            backgroundColor: '#2563eb',
            borderRadius: 14,
            minHeight: 52,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 12,
          }}
        >
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>Submit Another Inspection</Text>
        </TouchableOpacity>

        {/* Past Submissions */}
        <Text style={{ fontSize: 16, fontWeight: '700', color: '#1f2937', marginTop: 8, marginBottom: 12 }}>
          My Recent Submissions
        </Text>
        {loadingPast ? (
          <ActivityIndicator color="#2563eb" />
        ) : pastInspections.length === 0 ? (
          <Text style={{ color: '#9ca3af', textAlign: 'center', paddingVertical: 20 }}>No past submissions yet.</Text>
        ) : (
          pastInspections.map((item) => {
            const sc = STATUS_COLORS[item.status] || STATUS_COLORS.draft;
            return (
              <View
                key={item.id}
                style={{
                  backgroundColor: '#fff',
                  borderRadius: 12,
                  padding: 14,
                  marginBottom: 8,
                  flexDirection: 'row',
                  alignItems: 'center',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.04,
                  shadowRadius: 3,
                  elevation: 1,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: '#1f2937' }}>
                    {item.branches?.branch_name || 'Unknown Branch'}
                  </Text>
                  <Text style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                    {item.inspection_date}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <View style={{ backgroundColor: sc.bg, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
                    <Text style={{ color: sc.text, fontSize: 11, fontWeight: '700', textTransform: 'capitalize' }}>
                      {item.status}
                    </Text>
                  </View>
                  {item.compliance_score != null && (
                    <Text style={{ fontSize: 13, fontWeight: '700', color: RISK_COLORS[item.compliance_score >= 80 ? 'low' : item.compliance_score >= 60 ? 'medium' : 'high'] }}>
                      {item.compliance_score.toFixed(1)}%
                    </Text>
                  )}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}
