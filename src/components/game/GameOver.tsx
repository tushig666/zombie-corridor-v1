"use client";

import React from 'react';
import { GameState } from '@/lib/game-types';

interface GameOverProps {
  state: GameState;
  onRestart: () => void;
  onQuit: () => void;
}

export default function GameOver({ state, onRestart, onQuit }: GameOverProps) {
  return (
    <div id="gameover-screen">
      <h2 className="go-title">CONTAINMENT FAILED</h2>
      
      <div className="go-stats">
        <div>
          FINAL SCORE: <span id="final-score" className="go-stat-val">{state.score.toLocaleString()}</span>
        </div>
        <div>
          DISTANCE REACHED: <span id="final-distance" className="go-stat-val">{state.distance}m</span>
        </div>
      </div>

      <div className="go-buttons">
        <button id="btn-restart" className="btn" onClick={onRestart}>
          RUN AGAIN
        </button>
        <button id="btn-quit" className="btn" onClick={onQuit}>
          BACK TO START
        </button>
      </div>
    </div>
  );
}
