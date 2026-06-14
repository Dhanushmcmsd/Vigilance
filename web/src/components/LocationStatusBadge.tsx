export type LocationStatusValue = 'inside' | 'outside' | 'unverified' | null | undefined;

const FULL_BADGE: Record<
  Exclude<LocationStatusValue, null | undefined>,
  { label: string; background: string; color: string; border: string }
> = {
  inside: {
    label: '✅ Report filed inside the store location',
    background: '#e8f5e9',
    color: '#2e7d32',
    border: '#a5d6a7',
  },
  outside: {
    label: '⚠️ Report was filled outside the location',
    background: '#fff8e1',
    color: '#f57f17',
    border: '#ffe082',
  },
  unverified: {
    label: '📍 Location unverified',
    background: '#f5f5f5',
    color: '#757575',
    border: '#e0e0e0',
  },
};

const COMPACT_BADGE: Record<
  Exclude<LocationStatusValue, null | undefined>,
  { label: string; dot: string }
> = {
  inside: { label: 'Inside location', dot: '#4caf50' },
  outside: { label: 'Outside location', dot: '#ff9800' },
  unverified: { label: 'Location unverified', dot: '#9e9e9e' },
};

function normalizeStatus(status: LocationStatusValue): 'inside' | 'outside' | 'unverified' {
  if (status === 'inside' || status === 'outside' || status === 'unverified') {
    return status;
  }
  return 'unverified';
}

export function LocationStatusBadge({ status }: { status: LocationStatusValue }) {
  const normalized = normalizeStatus(status);
  const config = FULL_BADGE[normalized];

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '5px 12px',
        borderRadius: 20,
        fontSize: 13,
        fontWeight: 500,
        backgroundColor: config.background,
        color: config.color,
        border: `1px solid ${config.border}`,
      }}
    >
      {config.label}
    </span>
  );
}

export function LocationStatusCompact({ status }: { status: LocationStatusValue }) {
  const normalized = normalizeStatus(status);
  const config = COMPACT_BADGE[normalized];

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        fontSize: 12,
        fontWeight: 500,
        color: 'rgba(255,255,255,0.75)',
      }}
    >
      <span
        aria-hidden
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          display: 'inline-block',
          marginRight: 5,
          backgroundColor: config.dot,
          flexShrink: 0,
        }}
      />
      {config.label}
    </span>
  );
}
