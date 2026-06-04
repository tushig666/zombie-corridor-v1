
export type ZombieType = 'WALKER' | 'RUNNER' | 'TANK' | 'ELITE';

export interface ZombieStats {
  type: ZombieType;
  maxHealth: number;
  speed: number;
  scoreReward: number;
  height: number;
  color: string;
}

export const ZOMBIE_DATA: Record<ZombieType, ZombieStats> = {
  WALKER: { type: 'WALKER', maxHealth: 3, speed: 1.5, scoreReward: 10, height: 1.8, color: '#33aa33' },
  RUNNER: { type: 'RUNNER', maxHealth: 2, speed: 4.0, scoreReward: 15, height: 1.6, color: '#66cc66' },
  TANK: { type: 'TANK', maxHealth: 10, speed: 0.8, scoreReward: 50, height: 2.5, color: '#226622' },
  ELITE: { type: 'ELITE', maxHealth: 20, speed: 2.5, scoreReward: 100, height: 2.0, color: '#aa33aa' },
};

export interface GameState {
  hp: number;
  maxHp: number;
  score: number;
  distance: number;
  level: number;
  isGameOver: boolean;
  startTime: number;
  lastDifficultyAdjustment: number;
  difficultyModifiers: {
    spawnRate: number;
    zombieSpeed: number;
    eliteChance: number;
  };
}

export const INITIAL_GAME_STATE: GameState = {
  hp: 100,
  maxHp: 100,
  score: 0,
  distance: 0,
  level: 1,
  isGameOver: false,
  startTime: 0,
  lastDifficultyAdjustment: 0,
  difficultyModifiers: {
    spawnRate: 1.0,
    zombieSpeed: 1.0,
    eliteChance: 0.05,
  },
};
