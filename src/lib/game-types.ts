
export type ZombieType = 'Walker' | 'Runner' | 'Tank' | 'Elite';

export interface ZombieStats {
  type: ZombieType;
  baseHp: number;
  baseSpeed: number;
  scoreValue: number;
  height: number;
  color: string;
}

export const ZOMBIE_CLASSES: Record<ZombieType, ZombieStats> = {
  Walker: { type: 'Walker', baseHp: 3, baseSpeed: 2.7, scoreValue: 10, height: 1.8, color: '#33aa33' },
  Runner: { type: 'Runner', baseHp: 2, baseSpeed: 4.8, scoreValue: 15, height: 1.6, color: '#66cc66' },
  Tank: { type: 'Tank', baseHp: 6, baseSpeed: 1.8, scoreValue: 50, height: 2.5, color: '#226622' },
  Elite: { type: 'Elite', baseHp: 8, baseSpeed: 3.2, scoreValue: 100, height: 2.0, color: '#aa33aa' },
};

export interface GameState {
  isGameActive: boolean;
  isGameOver: boolean;
  score: number;
  distance: number;
  elapsedTime: number;
  hp: number;
  maxHp: number;
  speed: number;
  zombieDamageInterval: number;
  lastDamageTime: number;
  nextShotTime: number;
  shotCooldown: number;
  stage: number;
  baseSpawnInterval: number;
  currentSpawnInterval: number;
  minSpawnInterval: number;
  stageDuration: number;
  lastStageUpdateTime: number;
  lastSpawnTime: number;
  maxActiveZombies: number;
  wallZ: number;
  wallBaseSpeed: number;
  wallCurrentSpeed: number;
  wallMaxDistanceBehind: number;
  // Stats for AI review
  shotsFired: number;
  shotsHit: number;
  killsByType: Record<string, number>;
  startTime: number;
}

export const INITIAL_GAME_STATE: GameState = {
  isGameActive: false,
  isGameOver: false,
  score: 0,
  distance: 0,
  elapsedTime: 0,
  hp: 100,
  maxHp: 100,
  speed: 8.0,
  zombieDamageInterval: 1200,
  lastDamageTime: 0,
  nextShotTime: 0,
  shotCooldown: 200,
  stage: 1,
  baseSpawnInterval: 2500,
  currentSpawnInterval: 2500,
  minSpawnInterval: 600,
  stageDuration: 20000,
  lastStageUpdateTime: 0,
  lastSpawnTime: 0,
  maxActiveZombies: 25,
  wallZ: -20,
  wallBaseSpeed: 3.5,
  wallCurrentSpeed: 3.5,
  wallMaxDistanceBehind: 35,
  shotsFired: 0,
  shotsHit: 0,
  killsByType: {
    Walker: 0,
    Runner: 0,
    Tank: 0,
    Elite: 0
  },
  startTime: 0,
};
