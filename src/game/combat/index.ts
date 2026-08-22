// Barrel for the combat module. Import from '@/game/combat', never from the files.

export { KAPRE } from './foes';
export { checkContent, checkFoeReach } from './invariants';
export type { Foe } from './foes';

export { createBrute } from './brute';
export type { Brute, BruteSenses, BruteTick } from './brute';

export { coneHitsPoint, direction, lineHitsPoint, segmentHitsPoint } from './geometry';

export {
  BASIC_WIDTH,
  CAST_KEYS,
  EMPTY_COOLDOWNS,
  PROJECTILE_SPEED,
  abilityForSlot,
} from './casting';
export type { CastSlot, CooldownState, DashCast, ProjectileCast, WindupCast } from './casting';

export { createObjectives } from './objectives';
export type { HitReport, Objectives, Structure, StructureKind } from './objectives';

export { strikeLine, structureName } from './report';
export type { FoeOutcome } from './report';

export { createTowerFire } from './towerfire';
export type { TowerFire, TowerShot } from './towerfire';

export { createMinionManager } from './minions';
export type { Minion, MinionKind, MinionManager, MinionStrikeReport } from './minions';
