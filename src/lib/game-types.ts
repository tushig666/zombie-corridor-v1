
export type ZombieType = 'Walker' | 'Runner' | 'Tank' | 'Elite';

export interface ZombieStats {
  type: ZombieType;
  baseHp: number;
  baseSpeed: number;
  scoreValue: number;
  scale: number;
}

export const ZOMBIE_CLASSES: Record<ZombieType, ZombieStats> = {
  Walker: { type: 'Walker', baseHp: 3, baseSpeed: 10.8, scoreValue: 10, scale: 1.4 },
  Runner: { type: 'Runner', baseHp: 2, baseSpeed: 19.2, scoreValue: 15, scale: 1.25 },
  Tank: { type: 'Tank', baseHp: 6, baseSpeed: 7.2, scoreValue: 50, scale: 2.1 },
  Elite: { type: 'Elite', baseHp: 8, baseSpeed: 12.8, scoreValue: 100, scale: 1.75 },
};

export interface ProgressionEngine {
  currentStage: number;
  timeInCurrentStage: number;
  stageDurationThreshold: number;
  globalDifficultyMultiplier: number;
  spawnCap: number;
  currentSpawnInterval: number;
}

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
  lastSpawnTime: number;
  wallZ: number;
  wallBaseSpeed: number;
  wallCurrentSpeed: number;
  wallMaxDistanceBehind: number;
  // Stats
  shotsFired: number;
  shotsHit: number;
  killsByType: Record<string, number>;
  startTime: number;
  // Progression
  progression: ProgressionEngine;
  stageTitle: string;
  showAlert: boolean;
}

export const INITIAL_GAME_STATE: GameState = {
  isGameActive: false,
  isGameOver: false,
  score: 0,
  distance: 0,
  elapsedTime: 0,
  hp: 100,
  maxHp: 100,
  speed: 14.0, 
  zombieDamageInterval: 1200,
  lastDamageTime: 0,
  nextShotTime: 0,
  shotCooldown: 200,
  lastSpawnTime: 0,
  wallZ: -20,
  wallBaseSpeed: 4.225, // 3.25 * 1.3 = 4.225
  wallCurrentSpeed: 4.225,
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
  stageTitle: 'CONTAINMENT BREACH',
  showAlert: false,
  progression: {
    currentStage: 1,
    timeInCurrentStage: 0,
    stageDurationThreshold: 30.0,
    globalDifficultyMultiplier: 1.0,
    spawnCap: 6,
    currentSpawnInterval: 3.0,
  }
};
