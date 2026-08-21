// The roster.
//
// Five to start, one per role, each drawn from a real figure in Philippine
// folklore rather than a reskin of a western archetype. The lore lines are not
// decoration: they are the only place the myth is told, and a player who never
// reads them should still learn what a Tikbalang is from how it plays.
//
// ⚠ IDS ARE PERMANENT NAMES. A save, a match record and a ladder entry all
// refer to a hero by id. Rename the `name`, never the `id`.
//
// BALANCE NOTES live beside the numbers they explain, because a number with no
// reason attached is a number nobody dares to change.

import type { Hero } from './types';

export const HEROES: Hero[] = [
  {
    id: 'tikbalang',
    name: 'Tikbalang',
    origin: 'The horse-headed trickster of the forest trails',
    lore:
      'It turns travellers in circles until they give up on the path they chose. Wear your shirt inside out and it lets you pass, which is the only apology it knows how to make.',
    role: 'vanguard',
    emoji: '🐴',
    palette: { skin: '#6b4a35', cloth: '#3f5a4a', accent: '#c9a227', hair: '#241a14' },
    // The tankiest and the slowest to act. A vanguard that is also quick has no
    // weakness, and every fight becomes about who has one.
    // The tallest and heaviest thing on the field, carrying nothing: a
    // vanguard's threat is its own body.
    build: { scale: 1.22, bulk: 1.25, gear: [] },
    health: 1150,
    speed: 6.2,
    attack: 62,
    attackRange: 2.2,
    attackCooldown: 0.85,
    abilities: [
      {
        id: 'tikbalang-charge',
        name: 'Trailbreak',
        blurb: 'Charges forward and throws whoever it meets back over its shoulder.',
        emoji: '💨',
        shape: 'dash',
        cooldown: 9,
        range: 7,
        width: 1.1,
        damage: 110,
        // Long wind-up for a long dash. This is the initiation of a whole fight,
        // so the other team is owed a moment to see it coming.
        windup: 0.35,
        lock: 0,
      },
      {
        id: 'tikbalang-maze',
        name: 'Turned Around',
        blurb: 'A ring of false trails. Anyone inside it loses sight of everything outside.',
        emoji: '🌫',
        shape: 'ground',
        cooldown: 14,
        range: 8,
        width: 3.4,
        damage: 40,
        windup: 0.6,
        lock: 0.25,
      },
    ],
    ultimate: {
      id: 'tikbalang-stampede',
      name: 'Stampede',
      blurb: 'The forest runs with it. A wide charge that carries every enemy it touches.',
      emoji: '🌪',
      shape: 'dash',
      cooldown: 70,
      range: 14,
      width: 2.4,
      damage: 260,
      windup: 0.5,
      lock: 0,
    },
  },
  {
    id: 'mangkukulam',
    name: 'Mangkukulam',
    origin: 'The one who works harm at a distance',
    lore:
      'Never seen at the act. A doll, a strand of hair, a name said the wrong number of times, and a person three towns away sits down and does not get up.',
    role: 'mystic',
    emoji: '🪡',
    palette: { skin: '#8a6a4f', cloth: '#4a2b4d', accent: '#d94f6a', hair: '#1a1418' },
    // Lowest health in the roster. Everything this hero does is at range and
    // delayed, so the counter has to be closing the distance.
    // Small and swamped by a robe, with the working bag always on them.
    build: { scale: 0.94, bulk: 0.92, gear: ['cape', 'pouch'] },
    health: 720,
    speed: 6.0,
    attack: 48,
    attackRange: 7.5,
    attackCooldown: 1.0,
    abilities: [
      {
        id: 'kulam-pin',
        name: 'The Pin',
        blurb: 'Marks a spot. Whoever stands there when it lands carries the hurt with them.',
        emoji: '📍',
        shape: 'ground',
        cooldown: 7,
        range: 9,
        width: 1.8,
        damage: 130,
        // The longest wind-up of any damage ability, on purpose: it hits hard
        // and it is entirely avoidable if you are looking.
        windup: 0.85,
        lock: 0.3,
      },
      {
        id: 'kulam-thread',
        name: 'Red Thread',
        blurb: 'A line drawn between two people. What one of them suffers, so does the other.',
        emoji: '🧵',
        shape: 'projectile',
        cooldown: 12,
        range: 11,
        width: 0.5,
        damage: 70,
        windup: 0.25,
        lock: 0.2,
      },
    ],
    ultimate: {
      id: 'kulam-effigy',
      name: 'Effigy',
      blurb: 'Everything done to the doll for the next few seconds is done to them.',
      emoji: '🕯',
      shape: 'ground',
      cooldown: 90,
      range: 10,
      width: 4.2,
      damage: 300,
      windup: 1.1,
      lock: 0.6,
    },
  },
  {
    id: 'aswang',
    name: 'Aswang',
    origin: 'The shape that is not the shape you saw',
    lore:
      'By day it is a neighbour who asks after your mother. The tell is the reflection: look at its eyes in water and you are standing upside down in them.',
    role: 'stalker',
    emoji: '🦇',
    palette: { skin: '#7d5b47', cloth: '#2b2430', accent: '#8f2f3f', hair: '#0f0d10' },
    // Lean and low. Blades out, because it never fights anything facing it.
    build: { scale: 0.98, bulk: 0.82, gear: ['knives'] },
    health: 780,
    // The fastest thing in the game and the most fragile. Nothing here can win
    // a fight it did not choose.
    speed: 7.6,
    attack: 74,
    attackRange: 2.0,
    attackCooldown: 0.65,
    abilities: [
      {
        id: 'aswang-shift',
        name: 'Change',
        blurb: 'Drops to four legs and runs. Faster, quieter, and it cannot strike while it runs.',
        emoji: '🐕‍🦺',
        shape: 'dash',
        cooldown: 8,
        range: 9,
        width: 0.9,
        damage: 0,
        windup: 0.15,
        lock: 0,
      },
      {
        id: 'aswang-rend',
        name: 'From Behind',
        blurb: 'A short lunge that cuts far deeper when it lands on a back.',
        emoji: '🩸',
        shape: 'cone',
        cooldown: 6,
        range: 3.2,
        width: 0.6,
        damage: 150,
        windup: 0.2,
        lock: 0.15,
      },
    ],
    ultimate: {
      id: 'aswang-unmake',
      name: 'Unmake',
      blurb: 'Sheds the borrowed shape entirely. Everything nearby learns what was under it.',
      emoji: '🌑',
      shape: 'cone',
      cooldown: 75,
      range: 5.5,
      width: 1.1,
      damage: 340,
      windup: 0.45,
      lock: 0.4,
    },
  },
  {
    id: 'diwata',
    name: 'Diwata',
    origin: 'The keeper of a place that was there first',
    lore:
      'Ask before you cut the tree. Say tabi-tabi po before you cross the mound. She is not unkind, she is simply owed a courtesy nobody remembers to pay.',
    role: 'warden',
    emoji: '🌿',
    palette: { skin: '#c49a6c', cloth: '#2f7d5f', accent: '#e8d07a', hair: '#3a2a1e' },
    // Upright and still, wrapped in something that moves when she does.
    build: { scale: 1.04, bulk: 0.95, gear: ['cape'] },
    health: 860,
    speed: 6.4,
    attack: 44,
    attackRange: 6.5,
    attackCooldown: 1.05,
    abilities: [
      {
        id: 'diwata-ward',
        name: 'Tabi-tabi',
        blurb: 'Ground nobody may cross without asking. It slows those who try anyway.',
        emoji: '🛡',
        shape: 'ground',
        cooldown: 11,
        range: 7,
        width: 3.0,
        damage: 0,
        windup: 0.4,
        lock: 0.2,
      },
      {
        id: 'diwata-santelmo',
        name: 'Santelmo',
        blurb: 'A ball of cold fire that mends whoever it passes through on the way.',
        emoji: '🔵',
        shape: 'projectile',
        cooldown: 8,
        range: 10,
        width: 0.7,
        damage: 85,
        windup: 0.2,
        lock: 0,
      },
    ],
    ultimate: {
      id: 'diwata-grove',
      name: 'The Grove Answers',
      blurb: 'The place itself takes a side. Roots hold, and the wounded stop bleeding.',
      emoji: '🌳',
      shape: 'ground',
      cooldown: 85,
      range: 8,
      width: 5.0,
      damage: 120,
      windup: 0.9,
      lock: 0.5,
    },
  },
  {
    id: 'bernardo',
    name: 'Bernardo Carpio',
    origin: 'The strength held between two mountains',
    lore:
      'He stands in the gap in the Montalban range with a hand on each cliff. When he shifts his shoulders, the ground in Manila moves. He has been getting free for a very long time.',
    role: 'ranger',
    emoji: '⛰',
    palette: { skin: '#a06a45', cloth: '#6b5030', accent: '#9aa5ad', hair: '#20160f' },
    // Broad through the shoulders, and the only one at range with something
    // in both hands.
    build: { scale: 1.14, bulk: 1.18, gear: ['crossbow'] },
    health: 820,
    speed: 6.1,
    attack: 66,
    // The longest reach in the roster, and the slowest attack to go with it.
    attackRange: 8.5,
    attackCooldown: 1.15,
    abilities: [
      {
        id: 'bernardo-slab',
        name: 'Slab',
        blurb: 'Tears a piece of the hillside loose and throws it flat along the ground.',
        emoji: '🪨',
        shape: 'projectile',
        cooldown: 7,
        range: 12,
        width: 0.9,
        damage: 140,
        windup: 0.35,
        lock: 0.25,
      },
      {
        id: 'bernardo-wall',
        name: 'The Gap',
        blurb: 'Stands a wall of rock where there was a path. It will not last, but it will hold.',
        emoji: '🧱',
        shape: 'ground',
        cooldown: 16,
        range: 8,
        width: 3.6,
        damage: 0,
        windup: 0.5,
        lock: 0.3,
      },
    ],
    ultimate: {
      id: 'bernardo-quake',
      name: 'Shoulders',
      blurb: 'He shifts his weight, and everything standing on the ground stops standing.',
      emoji: '🌋',
      shape: 'ground',
      cooldown: 80,
      range: 11,
      width: 6.0,
      damage: 280,
      windup: 1.0,
      lock: 0.7,
    },
  },
];

export const heroById = (id: string): Hero | undefined => HEROES.find((h) => h.id === id);
