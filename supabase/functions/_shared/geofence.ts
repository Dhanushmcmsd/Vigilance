export type LocationStatus = 'inside' | 'outside' | 'unverified';

export interface GeofenceCheckInput {
  latitude?: number | null;
  longitude?: number | null;
  rpcResult?: string | boolean | null;
  rpcError?: { message?: string } | null;
  /** Ignored — location_status must never be trusted from the client. */
  clientLocationStatus?: unknown;
}

/** Map PostGIS RPC output (+ GPS presence) to a persisted location_status value. */
export function resolveLocationStatus(input: GeofenceCheckInput): LocationStatus {
  void input.clientLocationStatus;

  const { latitude, longitude, rpcResult, rpcError } = input;

  if (rpcError || rpcResult === null || latitude == null || longitude == null) {
    return 'unverified';
  }
  if (rpcResult === true || rpcResult === 'inside') {
    return 'inside';
  }
  if (rpcResult === false || rpcResult === 'outside') {
    return 'outside';
  }
  return 'unverified';
}

export interface InspectionGeofenceRecord {
  id: string;
  officer_latitude?: number | null;
  officer_longitude?: number | null;
  location_status?: unknown;
}

type RpcClient = {
  rpc: (
    fn: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: string | boolean | null; error: { message?: string } | null }>;
};

type UpdateClient = {
  from: (table: string) => {
    update: (values: Record<string, unknown>) => {
      eq: (column: string, value: string) => Promise<{ error: { message?: string } | null }>;
    };
  };
};

/** Server-side geofence verification for the submission webhook. Never blocks submission. */
export async function verifyAndPersistLocationStatus(
  supabase: RpcClient & UpdateClient,
  record: InspectionGeofenceRecord,
): Promise<LocationStatus> {
  const latitude = record.officer_latitude ?? null;
  const longitude = record.officer_longitude ?? null;

  if (latitude == null || longitude == null) {
    const location_status = resolveLocationStatus({
      latitude,
      longitude,
      rpcResult: null,
      rpcError: null,
      clientLocationStatus: record.location_status,
    });
    await supabase.from('inspections').update({ location_status }).eq('id', record.id);
    return location_status;
  }

  const { data: geoResult, error: geoError } = await supabase.rpc(
    'compute_inspection_location_status',
    { p_inspection_id: record.id },
  );

  if (geoError) {
    console.warn('Geofence check failed or GPS missing:', geoError.message);
  }

  const location_status = resolveLocationStatus({
    latitude,
    longitude,
    rpcResult: geoResult,
    rpcError: geoError,
    clientLocationStatus: record.location_status,
  });

  await supabase.from('inspections').update({ location_status }).eq('id', record.id);
  return location_status;
}
