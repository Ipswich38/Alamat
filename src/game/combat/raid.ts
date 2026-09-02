// PvE Folklore Monster Raid Engine (Wave Survival Mode)
//
// ── PURPOSE ─────────────────────────────────────────────────────────────────
// Wave-based cooperative / solo defense against escalating mythical Philippine beasts:
// 1. Tikbalang Skirmishers (Galloping skirmishers)
// 2. Aswang Hunter Pack (Lifesteal stalkers)
// 3. Manananggal Swarm (Aerial projectile casters)
// 4. Kapre Elder (Bark-armored titan)
// 5. Awakened Bakunawa (Celestial Moon-Eater Dragon)
//
// Zero external assets: fully simulated with procedural AI state machines.

import { terrainHeight } from '@/game/render3d/terrain';

export interface RaidMonster {
  id: string;
  name: string;
  tagalogName: string;
  kind: 'tikbalang' | 'aswang' | 'manananggal' | 'kapre' | 'bakunawa';
  x: number;
  z: number;
  y: number;
  heading: number;
  hp: number;
  maxHp: number;
  attack: number;
  speed: number;
  attackRange: number;
  attackCooldown: number;
  lastAttackTime: number;
  alive: boolean;
  scale: number;
  color: number;
}

export interface RaidWaveInfo {
  wave: number;
  name: string;
  tagalogName: string;
  description: string;
  monsterCount: number;
}

export const RAID_WAVES: RaidWaveInfo[] = [
  {
    wave: 1,
    name: 'Tikbalang Ambush',
    tagalogName: 'Pagsalakay ng mga Tikbalang',
    description: 'Swift galloping half-man half-horse tricksters emerging from the northern bamboo groves.',
    monsterCount: 4,
  },
  {
    wave: 2,
    name: 'Aswang Stalker Pack',
    tagalogName: 'Pulutong ng mga Aswang',
    description: 'Nocturnal shape-shifters with terrifying lifesteal physical strikes.',
    monsterCount: 5,
  },
  {
    wave: 3,
    name: 'Manananggal Aerial Swarm',
    tagalogName: 'Kawan ng mga Manananggal',
    description: 'Winged severed aerial tormentors casting dark blood projectiles from distance.',
    monsterCount: 4,
  },
  {
    wave: 4,
    name: 'Ancient Kapre Titan',
    tagalogName: 'Dakilang Kapre ng Balete',
    description: 'Colossal tree guardian with devastating ground tremor shockwaves.',
    monsterCount: 1,
  },
  {
    wave: 5,
    name: 'Awakened Bakunawa Dragon',
    tagalogName: 'Gising na Bakunawa',
    description: 'The primordial moon-eating leviathan rising from the depths of the Pasig Agimat River.',
    monsterCount: 1,
  },
];

export interface RaidManager {
  currentWave: number;
  waveState: 'waiting' | 'spawning' | 'active' | 'wave_cleared' | 'victory';
  monsters: RaidMonster[];
  waveCountdown: number;
  startRaid(): void;
  update(
    dt: number,
    clock: number,
    playerX: number,
    playerZ: number,
    onPlayerDamage: (dmg: number, monsterName: string) => void,
    onMonsterKilled: (monster: RaidMonster) => void,
    onWaveCompleted: (wave: number) => void,
    onVictory: () => void
  ): void;
}

export function createRaidManager(): RaidManager {
  let currentWave = 1;
  let waveState: 'waiting' | 'spawning' | 'active' | 'wave_cleared' | 'victory' = 'waiting';
  let waveCountdown = 5.0; // 5s preparation before wave 1
  let monsters: RaidMonster[] = [];

  const spawnWaveMonsters = (waveIdx: number) => {
    const waveInfo = RAID_WAVES[waveIdx - 1];
    if (!waveInfo) return;

    monsters = [];
    const count = waveInfo.monsterCount;

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const spawnDist = waveIdx >= 4 ? 35 : 45 + Math.random() * 10;
      const x = Math.cos(angle) * spawnDist;
      const z = Math.sin(angle) * spawnDist;

      let name = 'Monster';
      let tagalogName = 'Halimaw';
      let kind: RaidMonster['kind'] = 'tikbalang';
      let hp = 450;
      let attack = 45;
      let speed = 4.8;
      let attackRange = 2.0;
      let attackCooldown = 1.2;
      let scale = 1.0;
      let color = 0x8b5cf6;

      if (waveIdx === 1) {
        kind = 'tikbalang';
        name = `Tikbalang Skirmisher ${i + 1}`;
        tagalogName = 'Tikbalang';
        hp = 380;
        attack = 38;
        speed = 5.6;
        attackRange = 2.2;
        attackCooldown = 1.1;
        scale = 1.1;
        color = 0x10b981;
      } else if (waveIdx === 2) {
        kind = 'aswang';
        name = `Aswang Hunter ${i + 1}`;
        tagalogName = 'Aswang';
        hp = 520;
        attack = 55;
        speed = 5.2;
        attackRange = 2.0;
        attackCooldown = 0.95;
        scale = 1.0;
        color = 0xef4444;
      } else if (waveIdx === 3) {
        kind = 'manananggal';
        name = `Manananggal Witch ${i + 1}`;
        tagalogName = 'Manananggal';
        hp = 420;
        attack = 65;
        speed = 4.4;
        attackRange = 8.5; // ranged
        attackCooldown = 1.6;
        scale = 1.15;
        color = 0xa855f7;
      } else if (waveIdx === 4) {
        kind = 'kapre';
        name = 'Ancient Kapre Titan';
        tagalogName = 'Dakilang Kapre';
        hp = 3200;
        attack = 110;
        speed = 3.8;
        attackRange = 3.5;
        attackCooldown = 1.8;
        scale = 2.2;
        color = 0x78350f;
      } else if (waveIdx === 5) {
        kind = 'bakunawa';
        name = 'Awakened Bakunawa Primordial';
        tagalogName = 'Gising na Bakunawa';
        hp = 5500;
        attack = 140;
        speed = 4.0;
        attackRange = 6.0;
        attackCooldown = 1.5;
        scale = 2.5;
        color = 0x00e5ff;
      }

      monsters.push({
        id: `raid-m-${waveIdx}-${i}`,
        name,
        tagalogName,
        kind,
        x,
        z,
        y: terrainHeight(x, z),
        heading: Math.atan2(-x, -z),
        hp,
        maxHp: hp,
        attack,
        speed,
        attackRange,
        attackCooldown,
        lastAttackTime: 0,
        alive: true,
        scale,
        color,
      });
    }

    waveState = 'active';
  };

  const startRaid = () => {
    currentWave = 1;
    waveState = 'waiting';
    waveCountdown = 4.0;
    monsters = [];
  };

  const update = (
    dt: number,
    clock: number,
    playerX: number,
    playerZ: number,
    onPlayerDamage: (dmg: number, monsterName: string) => void,
    onMonsterKilled: (monster: RaidMonster) => void,
    onWaveCompleted: (wave: number) => void,
    onVictory: () => void
  ) => {
    if (waveState === 'waiting') {
      waveCountdown -= dt;
      if (waveCountdown <= 0) {
        waveState = 'spawning';
        spawnWaveMonsters(currentWave);
      }
      return;
    }

    if (waveState === 'wave_cleared') {
      waveCountdown -= dt;
      if (waveCountdown <= 0) {
        if (currentWave < RAID_WAVES.length) {
          currentWave += 1;
          waveState = 'spawning';
          spawnWaveMonsters(currentWave);
        } else {
          waveState = 'victory';
          onVictory();
        }
      }
      return;
    }

    if (waveState === 'active') {
      let aliveCount = 0;

      for (const m of monsters) {
        if (!m.alive) continue;
        aliveCount++;

        // Monster AI toward player
        const dx = playerX - m.x;
        const dz = playerZ - m.z;
        const dist = Math.hypot(dx, dz);

        m.heading = Math.atan2(dx, dz);

        if (dist > m.attackRange) {
          // Move toward player
          const moveDist = Math.min(dist - m.attackRange, m.speed * dt);
          m.x += (dx / dist) * moveDist;
          m.z += (dz / dist) * moveDist;
          m.y = terrainHeight(m.x, m.z);
        } else {
          // In attack range
          if (clock - m.lastAttackTime >= m.attackCooldown) {
            m.lastAttackTime = clock;
            onPlayerDamage(m.attack, m.name);
          }
        }
      }

      if (aliveCount === 0) {
        waveState = 'wave_cleared';
        waveCountdown = 5.0; // 5s rest before next wave
        onWaveCompleted(currentWave);
      }
    }
  };

  return {
    get currentWave() {
      return currentWave;
    },
    get waveState() {
      return waveState;
    },
    get monsters() {
      return monsters;
    },
    get waveCountdown() {
      return waveCountdown;
    },
    startRaid,
    update,
  };
}
