import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { setupRealtimeSubscription, teardownRealtimeSubscription } from '../lib/queryClient';

/** Subscribe to Supabase realtime only after the user is authenticated. */
export function AuthenticatedRealtime() {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading || !user) return;

    setupRealtimeSubscription();
    return () => {
      teardownRealtimeSubscription();
    };
  }, [user, loading]);

  return null;
}
