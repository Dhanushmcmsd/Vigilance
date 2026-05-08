import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
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

export default function StoreList() {
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [loading, setLoading] = useState(true);
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  useEffect(() => {
    let mounted = true;

    const fetchStores = async () => {
      const { data, error } = await supabase
        .from('stores')
        .select('id, store_code, name, store_incharge, address, lat, lng, inspections!left(id, submitted_at)')
        .order('name');

      if (!mounted) return;
      if (error) {
        setLoading(false);
        return;
      }

      setStores(
        (data ?? []).map((s: any) => ({
          ...s,
          completed: (s.inspections ?? []).some((i: any) => String(i.submitted_at ?? '').slice(0, 10) === today),
        }))
      );
      setLoading(false);
    };

    fetchStores();

    const channel = supabase
      .channel('inspections-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'inspections' },
        (payload: any) => {
          setStores((prev) =>
            prev.map((s) => (s.id === payload.new.store_id ? { ...s, completed: true } : s))
          );
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [today]);

  if (loading) return <div className="p-6">Loading stores...</div>;

  return (
    <div className="p-6 space-y-3">
      {stores.map((store) => (
        <Link
          key={store.id}
          to={`/stores/${store.id}`}
          className="block rounded-xl border border-gray-200 bg-white p-4 hover:border-blue-300"
        >
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-base font-semibold text-gray-900">{store.name}</h3>
            {store.completed ? <span className="text-green-600 font-bold">✓</span> : null}
          </div>
          <p className="text-sm text-gray-700">{store.store_incharge ?? 'No incharge set'}</p>
          <p className="text-sm text-gray-500 truncate">{store.address ?? 'No address set'}</p>
        </Link>
      ))}
    </div>
  );
}
