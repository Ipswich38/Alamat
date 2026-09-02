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
  BATTLE_SPELLS,
} from './casting';
export type { CastSlot, CooldownState, DashCast, ProjectileCast, WindupCast, BattleSpell, BattleSpellId } from './casting';

export { createObjectives } from './objectives';
export type { HitReport, Objectives, Structure, StructureKind } from './objectives';

export { strikeLine, structureName } from './report';
export type { FoeOutcome } from './report';

export { createTowerFire } from './towerfire';
export type { TowerFire, TowerShot } from './towerfire';

export { createMinionManager, MINION_STATS } from './minions';
export type { Minion, MinionKind, MinionManager, MinionStrikeReport } from './minions';

export { createCreepManager } from './creeps';
export type { CreepKind, CreepManager, CreepStrikeReport, CreepTickResult, CreepUnit, JungleBuffType } from './creeps';

export { createBossManager } from './bosses';
export type { BossKind, BossManager, BossStrikeReport, BossTickResult, EpicBoss, PushingTreantUnit } from './bosses';
