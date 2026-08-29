// apps/web/components/StationPanel.tsx
'use client';

import { StatusBadge } from 'ui';
import type { StationWithStatus } from '../lib/types';

export function StationPanel({
  station,
  onClose,
}: {
  station: StationWithStatus | null;
  onClose: () => void;
}) {
  if (!station) return null;
  return (
    <aside
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        width: 320,
        height: '100%',
        background: 'white',
        padding: 16,
      }}
    >
      <button onClick={onClose}>Close</button>
      <h2>{station.name_en ?? station.name_th}</h2>
      <p lang="th">{station.name_th}</p>
      <StatusBadge status={station.status} />
      <p>Structure: {station.structure}</p>
      <p>Accessible: {station.accessible ? 'Yes' : 'No'}</p>
      <p>Last verified: {station.last_verified_at}</p>
    </aside>
  );
}
