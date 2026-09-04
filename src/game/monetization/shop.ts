// Shop router + mock telemetry — lean top-ups capped at ₱149

import { TOPUP_BUNDLES } from './types';
import { SKINS } from './skins';
import { MYSTIC_DRAW_S1, ANITO_DRAW_S1 } from './gacha';
import { BATTLE_PASS_S1, LAKBAY_S1 } from './passes';

export type ShopTab = 'skins' | 'pass' | 'draw' | 'heroes' | 'topup';

export function getShopData() {
  return {
    skins: SKINS,
    draw: MYSTIC_DRAW_S1,
    pass: BATTLE_PASS_S1,
    bundles: TOPUP_BUNDLES,
  };
}

// Mock telemetry — local only, ready for PostHog
export function logShopEvent(event: string, props: Record<string, unknown> = {}) {
  if (typeof window !== 'undefined') {
    // eslint-disable-next-line no-console
    console.log(`[shop] ${event}`, props);
    try {
      const key = 'alamat_shop_events';
      const raw = localStorage.getItem(key);
      const arr = raw ? (JSON.parse(raw) as unknown[]) : [];
      arr.unshift({ at: Date.now(), event, props });
      localStorage.setItem(key, JSON.stringify(arr.slice(0, 80)));
    } catch {}
  }
}
