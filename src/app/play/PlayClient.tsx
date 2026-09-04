'use client';

import { useSearchParams } from 'next/navigation';
import Arena3D from '@/components/game/Arena3D';

/*
 * Reads the match settings on the client rather than from server searchParams.
 *
 * A server component that awaits searchParams is rendered on demand, and
 * `output: 'export'` cannot emit a dynamic route, so the Android build had no
 * way to package this page at all. Query strings still work exactly the same
 * from the browser's point of view; only where they are read has moved.
 *
 * Needs the Suspense boundary its parent provides: useSearchParams suspends.
 */
export default function PlayClient() {
  const params = useSearchParams();
  const heroId = params.get('hero') || 'veer';
  const territoryId = params.get('territory') || 'warding';
  const modeParam = params.get('mode');
  const mode = modeParam === 'duel' || modeParam === 'raid' ? modeParam : 'classic';

  return <Arena3D heroId={heroId} territoryId={territoryId} mode={mode} />;
}
