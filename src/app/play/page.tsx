import { Suspense } from 'react';
import PlayClient from './PlayClient';

export const metadata = {
  title: 'Alamat — Playable 3D MOBA Arena',
  description: 'Nine heroes, two teams, and one talisman worth fighting over.',
};

export default function PlayPage() {
  return (
    <Suspense fallback={<div style={{ background: '#020617', width: '100%', height: '100dvh' }} />}>
      <PlayClient />
    </Suspense>
  );
}
