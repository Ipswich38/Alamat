import { Suspense } from 'react';
import Arena3D from '@/components/game/Arena3D';

export const metadata = {
  title: 'Talisman — Playable 3D MOBA Arena',
  description: 'Heroes of old legend, in a duel arena where nothing locks on.',
};

export default async function PlayPage({
  searchParams,
}: {
  searchParams: Promise<{ hero?: string; territory?: string; mode?: 'classic' | 'duel' | 'raid' }>;
}) {
  const params = await searchParams;
  const heroId = params?.hero || 'veer';
  const territoryId = params?.territory || 'warding';
  const mode = params?.mode || 'classic';

  return (
    <Suspense fallback={<div style={{ background: '#020617', width: '100%', height: '100dvh' }} />}>
      <Arena3D heroId={heroId} territoryId={territoryId} mode={mode} />
    </Suspense>
  );
}
