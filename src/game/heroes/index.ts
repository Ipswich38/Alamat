// Barrel for the hero module. Import from '@/game/heroes', never from the files.

export { HEROES, heroById } from './catalogue';
export type { Hero, HeroRole, Ability, AbilityShape } from './types';

export { HERO_SCALE, HERO_HEIGHT, SELECTION_RING, heroRadius, heroHeight } from './metrics';
