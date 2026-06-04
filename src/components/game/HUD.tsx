
"use client";

import React from 'react';
import { GameState } from '@/lib/game-types';

interface HUDProps {
  state: GameState;
  distToWall: number;
}

export default function HUD({ state, distToWall }: HUDProps) {
  const isHealthDanger = state.hp <= 30;
  const isWallDanger = distToWall < 8;

  return (
    <div id="hud">
      <div id="vignette"></div>
      
      <div id="hud-left" className="hud-panel">
        <span className="hud-label">Integrity</span>
        <span id="hp-value" className={`hud-value ${isHealthDanger ? 'danger' : ''}`}>
          {Math.max(0, Math.ceil(state.hp))} HP
        </span>
        <span className="hud-label" style={{ marginTop: '10px' }}>Lockdown Stage</span>
        <span id="level-value" className="hud-value" style={{ fontSize: '1.2rem', color: 'var(--red-emergency)' }}>
          STAGE {state.level}
        </span>
      </div>

      <div id="hud-right" className="hud-panel">
        <span className="hud-label">Purge Score</span>
        <span id="score-value" className="hud-value">
          {state.score.toLocaleString()}
        </span>
        <span className="hud-label" style={{ marginTop: '10px' }}>Progress</span>
        <span id="distance-value" className="hud-value" style={{ fontSize: '1.2rem' }}>
          {state.distance}m
        </span>
      </div>

      <div id="crosshair"></div>

      {isWallDanger && (
        <div id="collapse-alert">
          COLLAPSE WALL CRITICALLY CLOSE
        </div>
      )}
    </div>
  );
}
