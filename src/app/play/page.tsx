import { Suspense } from 'react';
import Arena3D from '@/components/game/Arena3D';

export const metadata = {
  title: 'Alamat — Playable 3D MOBA Arena',
  description: 'Heroes of Philippine folklore, in a duel arena where nothing locks on.',
};

export default async function PlayPage({
  searchParams,
}: {
  searchParams: Promise<{ hero?: string; territory?: string }>;
}) {
  const params = await searchParams;
  const heroId = params?.hero || 'tikbalang';
  const territoryId = params?.territory || 'kapatagan';

  return (
    <Suspense fallback={<div style={{ background: '#020617', width: '100%', height: '100dvh' }} />}>
      <Arena3D heroId={heroId} territoryId={territoryId} />
    </Suspense>
  );
}
