import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { BranchCard } from '../../components/BranchCard';
import { useLocationGate } from '../../lib/useLocationGate';
import { LocationGateModal } from '../../components/LocationGateModal';

interface Branch {
  id: string;
  branch_name: string;
  location: string;
  city: string;
  latitude: number | null;
  longitude: number | null;
  geofence_radius: number;
}

const SkeletonCard = () => (
  <View
    style={{
      backgroundColor: '#e5e7eb',
      borderRadius: 12,
      padding: 16,
      marginBottom: 10,
      height: 72,
    }}
  >
    <View style={{ width: '60%', height: 14, backgroundColor: '#d1d5db', borderRadius: 6, marginBottom: 8 }} />
    <View style={{ width: '40%', height: 11, backgroundColor: '#d1d5db', borderRadius: 6 }} />
  </View>
);

export default function SelectBranchScreen() {
  const { branchType } = useLocalSearchParams<{ branchType: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [branches, setBranches] = useState<Branch[]>([]);
  const [filtered, setFiltered] = useState<Branch[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pendingBranch, setPendingBranch] = useState<Branch | null>(null);
  const [officerCoords, setOfficerCoords] = useState<{ latitude: number; longitude: number } | null>(null);

  const locationGate = useLocationGate(
    pendingBranch?.latitude ?? null,
    pendingBranch?.longitude ?? null,
    pendingBranch?.geofence_radius ?? 200,
  );

  useEffect(() => {
    fetchBranches();
  }, [branchType]);

  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(
      q
        ? branches.filter(
            (b) =>
              b.branch_name.toLowerCase().includes(q) ||
              b.city.toLowerCase().includes(q) ||
              b.location.toLowerCase().includes(q)
          )
        : branches
    );
  }, [search, branches]);

  useEffect(() => {
    if (locationGate.status === 'within_range' && locationGate.officerCoords) {
      setOfficerCoords(locationGate.officerCoords);
    }
  }, [locationGate.status, locationGate.officerCoords]);

  const fetchBranches = async () => {
    setLoading(true);
    setError('');
    const { data, error: err } = await supabase
      .from('branches')
      .select('id, branch_name, location, city, latitude, longitude, geofence_radius, branch_types!inner(type_name)')
      .eq('is_active', true)
      .eq('branch_types.type_name', branchType)
      .order('branch_name');
    setLoading(false);
    if (err) {
      setError('Failed to load branches. Check your connection.');
      return;
    }
    setBranches((data as unknown as Branch[]) || []);
  };

  const handleBranchPress = (item: Branch) => {
    setPendingBranch(item);
    locationGate.check();
  };

  const handleConfirm = () => {
    if (!pendingBranch) return;
    router.push({
      pathname: '/(officer)/checklist',
      params: {
        branchId: pendingBranch.id,
        branchName: pendingBranch.branch_name,
        branchType,
        officerLat: officerCoords?.latitude?.toString() ?? '',
        officerLon: officerCoords?.longitude?.toString() ?? '',
      },
    });
    setPendingBranch(null);
  };

  const handleRetry = () => {
    locationGate.check();
  };

  const handleCancel = () => {
    setPendingBranch(null);
  };

  const gateModalVisible =
    pendingBranch !== null && locationGate.status !== 'idle';

  return (
    <View style={{ flex: 1, backgroundColor: '#f8fafc', paddingTop: insets.top }}>
      {/* Header */}
      <View
        style={{
          backgroundColor: '#fff',
          paddingHorizontal: 16,
          paddingVertical: 14,
          flexDirection: 'row',
          alignItems: 'center',
          borderBottomWidth: 1,
          borderBottomColor: '#e5e7eb',
        }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={{ marginRight: 12 }}
        >
          <Ionicons name="arrow-back" size={24} color="#1f2937" />
        </TouchableOpacity>
        <Text style={{ fontSize: 18, fontWeight: '700', color: '#1f2937', flex: 1 }}>
          Select {branchType} Branch
        </Text>
      </View>

      {/* Search */}
      <View
        style={{
          backgroundColor: '#fff',
          paddingHorizontal: 16,
          paddingVertical: 10,
          borderBottomWidth: 1,
          borderBottomColor: '#e5e7eb',
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: '#f3f4f6',
            borderRadius: 12,
            paddingHorizontal: 12,
          }}
        >
          <Ionicons name="search" size={18} color="#9ca3af" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search branches..."
            placeholderTextColor="#9ca3af"
            style={{
              flex: 1,
              paddingVertical: 12,
              paddingHorizontal: 8,
              fontSize: 15,
              color: '#1f2937',
            }}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={18} color="#9ca3af" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* List */}
      {loading ? (
        <View style={{ padding: 16 }}>
          {[1, 2, 3, 4, 5].map((i) => <SkeletonCard key={i} />)}
        </View>
      ) : error ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <Ionicons name="cloud-offline-outline" size={48} color="#9ca3af" />
          <Text style={{ marginTop: 12, color: '#6b7280', textAlign: 'center' }}>{error}</Text>
          <TouchableOpacity
            onPress={fetchBranches}
            style={{
              marginTop: 16,
              backgroundColor: '#2563eb',
              borderRadius: 10,
              paddingHorizontal: 24,
              paddingVertical: 10,
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '600' }}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 16 }}
          renderItem={({ item }) => (
            <BranchCard
              branchName={item.branch_name}
              location={item.location}
              city={item.city}
              onPress={() => handleBranchPress(item)}
            />
          )}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingTop: 60 }}>
              <Ionicons name="search-outline" size={40} color="#d1d5db" />
              <Text style={{ color: '#9ca3af', marginTop: 12 }}>No branches found</Text>
            </View>
          }
        />
      )}

      <LocationGateModal
        visible={gateModalVisible}
        status={locationGate.status}
        distanceMetres={locationGate.distanceMetres}
        branchName={pendingBranch?.branch_name ?? ''}
        branchLocation={pendingBranch?.location ?? ''}
        radiusMetres={pendingBranch?.geofence_radius ?? 200}
        onConfirm={handleConfirm}
        onRetry={handleRetry}
        onCancel={handleCancel}
      />
    </View>
  );
}
