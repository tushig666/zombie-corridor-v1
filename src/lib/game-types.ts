
export type ZombieType = 'Walker' | 'Runner' | 'Tank' | 'Elite';

export interface ZombieStats {
  type: ZombieType;
  baseHp: number;
  baseSpeed: number;
  scoreValue: number;
  scale: number;
}

export const ZOMBIE_CLASSES: Record<ZombieType, ZombieStats> = {
  // Scales adjusted for roughly human height (eye-to-eye with player at 4.2m)
  Walker: { type: 'Walker', baseHp: 3, baseSpeed: 21.6, scoreValue: 10, scale: 3.2 },
  Runner: { type: 'Runner', baseHp: 2, baseSpeed: 38.4, scoreValue: 15, scale: 3.0 },
  Tank: { type: 'Tank', baseHp: 6, baseSpeed: 14.4, scoreValue: 50, scale: 4.5 },
  Elite: { type: 'Elite', baseHp: 8, baseSpeed: 25.6, scoreValue: 100, scale: 3.8 },
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
  // Weapon
  weaponType: 'Standard' | 'Shotgun' | 'AK47';
  // Audio Settings
  musicVolume: number;
  sfxVolume: number;
}

export const INITIAL_GAME_STATE: GameState = {
  isGameActive: false,
  isGameOver: false,
  score: 0,
  distance: 0,
  elapsedTime: 0,
  hp: 100,
  maxHp: 100,
  speed: 22.0, 
  zombieDamageInterval: 1200,
  lastDamageTime: 0,
  nextShotTime: 0,
  shotCooldown: 150, 
  lastSpawnTime: 0,
  wallZ: -30,
  wallBaseSpeed: 9.28, 
  wallCurrentSpeed: 9.28,
  wallMaxDistanceBehind: 45,
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
  weaponType: 'Standard',
  musicVolume: 0.4,
  sfxVolume: 0.6,
  progression: {
    currentStage: 1,
    timeInCurrentStage: 0,
    stageDurationThreshold: 30.0,
    globalDifficultyMultiplier: 1.0,
    spawnCap: 6,
    currentSpawnInterval: 3.0,
  }
};
