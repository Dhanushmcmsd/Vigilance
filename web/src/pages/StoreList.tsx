import { useCallback, useEffect, useMemo, useState } from 'react';
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

type FetchError = {
  message: string;
  hint?: string;
};

function classifySupabaseError(err: {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
}): FetchError {
  const message = err.message ?? '';
  const code = err.code ?? '';

  if (code === '42P01' || /relation .* does not exist/i.test(message)) {
    return {
      message: 'The stores table is not set up yet.',
      hint: 'Run the latest Supabase migrations and seed_stores.sql.',
    };
  }
  if (code === '42501' || /permission denied/i.test(message)) {
    return {
      message: 'You do not have permission to view stores.',
      hint: 'Ensure RLS policies on public.stores grant SELECT to authenticated users.',
    };
  }
  if (/jwt|JWT|token/i.test(message)) {
    return {
      message: 'Your session has expired.',
      hint: 'Sign out and sign back in.',
    };
  }
  return {
    message: message || 'Failed to load stores.',
    hint: 'Check the browser console and your network connection.',
  };
}

export default function StoreList() {
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<FetchError | null>(null);
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const fetchStores = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data, error: supabaseError } = await supabase
      .from('stores')
      .select('id, store_code, name, store_incharge, address, lat, lng, inspections!left(id, submitted_at)')
      .order('name');

    if (supabaseError) {
      console.error('[StoreList] Supabase fetch failed:', {
        message: supabaseError.message,
        code: (supabaseError as { code?: string }).code,
        details: (supabaseError as { details?: string }).details,
        hint: (supabaseError as { hint?: string }).hint,
      });
      setError(classifySupabaseError(supabaseError as { message?: string; code?: string; details?: string; hint?: string }));
      setLoading(false);
      return;
    }

    setStores(
      (data ?? []).map((s: any) => ({
        ...s,
        completed: (s.inspections ?? []).some(
          (i: any) => String(i.submitted_at ?? '').slice(0, 10) === today,
        ),
      })),
    );
    setLoading(false);
  }, [today]);

  useEffect(() => {
    let mounted = true;
    fetchStores().catch((err) => {
      if (!mounted) return;
      console.error('[StoreList] Unexpected error:', err);
      setError({ message: 'Unexpected error while loading stores.', hint: String(err) });
      setLoading(false);
    });

    const channel = supabase
      .channel('inspections-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'inspections' },
        (payload: any) => {
          if (!mounted) return;
          setStores((prev) =>
            prev.map((s) => (s.id === payload.new.store_id ? { ...s, completed: true } : s)),
          );
        },
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [fetchStores]);

  if (loading) {
    return (
      <div className="p-6 space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-xl bg-gray-100" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="rounded-xl border border-red-200 bg-red-50 p-5">
          <h2 className="text-base font-semibold text-red-800">Could not load stores</h2>
          <p className="mt-1 text-sm text-red-700">{error.message}</p>
          {error.hint ? (
            <p className="mt-2 text-xs text-red-600">Hint: {error.hint}</p>
          ) : null}
          <button
            type="button"
            onClick={() => {
              void fetchStores();
            }}
            className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (stores.length === 0) {
    return (
      <div className="p-6">
        <div className="rounded-xl border border-gray-200 bg-white p-6 text-center">
          <h2 className="text-base font-semibold text-gray-900">No stores yet</h2>
          <p className="mt-1 text-sm text-gray-600">
            Run <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs">supabase/seed_stores.sql</code> to load
            the supermarket directory.
          </p>
        </div>
      </div>
    );
  }

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
            {store.completed ? <span className="text-green-600 font-semibold text-xs">Done</span> : null}
          </div>
          <p className="text-sm text-gray-700">{store.store_incharge ?? 'No incharge set'}</p>
          <p className="text-sm text-gray-500 truncate">{store.address ?? 'No address set'}</p>
        </Link>
      ))}
    </div>
  );
}
