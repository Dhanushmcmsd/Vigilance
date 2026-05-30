import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Text, TouchableOpacity, View } from 'react-native';
import { supabase } from '../lib/supabase';

type StoreRow = {
  id: string;
  store_code: string | null;
  name: string;
  store_incharge: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  inspections?: { id: string; submitted_at: string }[];
  completed?: boolean;
};

interface Props {
  onSelectStore: (store: StoreRow) => void;
}

export default function StoreListScreen({ onSelectStore }: Props) {
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [loading, setLoading] = useState(true);

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      const { data, error } = await supabase
        .from('stores')
        .select('id, store_code, name, store_incharge, address, lat, lng, inspections!left(id, submitted_at)')
        .order('name');

      if (!mounted) return;
      if (error) {
        setLoading(false);
        return;
      }

      const rows = (data ?? []).map((s: any) => {
        const completedToday = (s.inspections ?? []).some((i: any) =>
          String(i.submitted_at ?? '').slice(0, 10) === today
        );
        return { ...s, completed: completedToday };
      });

      setStores(rows);
      setLoading(false);
    };

    load();

    const channel = supabase
      .channel('inspections-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'inspections' },
        (payload: any) => {
          setStores((prev) =>
            prev.map((s) =>
              s.id === payload.new.store_id ? { ...s, completed: true } : s
            )
          );
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [today]);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <FlatList
      data={stores}
      keyExtractor={(item) => item.id}
      contentContainerStyle={{ padding: 16, gap: 10 }}
      renderItem={({ item }) => (
        <TouchableOpacity
          onPress={() => onSelectStore(item)}
          style={{ backgroundColor: '#fff', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#e5e7eb' }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
            <Text style={{ fontWeight: '700', color: '#111827', flex: 1 }}>{item.name}</Text>
            {item.completed ? <Text style={{ color: '#16a34a', fontWeight: '700' }}>Done</Text> : null}
          </View>
          <Text style={{ color: '#374151', fontSize: 13 }}>{item.store_incharge ?? 'No incharge set'}</Text>
          <Text numberOfLines={1} style={{ color: '#6b7280', fontSize: 12, marginTop: 2 }}>
            {item.address ?? 'No address set'}
          </Text>
        </TouchableOpacity>
      )}
    />
  );
}
