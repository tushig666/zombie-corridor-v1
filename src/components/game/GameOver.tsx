
"use client";

import React from 'react';
import { GameState } from '@/lib/game-types';
import { PostGamePerformanceReviewOutput } from '@/ai/flows/post-game-performance-review-flow';
import { Loader2 } from 'lucide-react';

interface GameOverProps {
  state: GameState;
  review: PostGamePerformanceReviewOutput | null;
  onRestart: () => void;
  onQuit: () => void;
}

export default function GameOver({ state, review, onRestart, onQuit }: GameOverProps) {
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

      {/* AI Analysis Overlay */}
      <div style={{ maxWidth: '600px', width: '100%', padding: '20px', background: 'rgba(0,0,0,0.5)', border: '1px solid var(--red-emergency)', marginBottom: '30px', fontSize: '0.9rem' }}>
        <h3 style={{ color: 'var(--red-emergency)', marginBottom: '10px', fontSize: '1rem' }}>FACILITY PERFORMANCE ANALYSIS</h3>
        {!review ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#888' }}>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>DECRYPTING COMBAT LOGS...</span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <p style={{ fontStyle: 'italic', borderLeft: '2px solid var(--red-emergency)', paddingLeft: '10px' }}>"{review.summary}"</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div>
                <span style={{ fontSize: '0.7rem', color: 'var(--red-emergency)', fontWeight: 'bold' }}>ACHIEVEMENTS:</span>
                <ul style={{ listStyle: 'none', padding: 0, margin: '5px 0' }}>
                  {review.achievementsHighlighted.slice(0, 2).map((a, i) => <li key={i}>- {a}</li>)}
                </ul>
              </div>
              <div>
                <span style={{ fontSize: '0.7rem', color: 'var(--red-emergency)', fontWeight: 'bold' }}>TACTICAL ADVICE:</span>
                <ul style={{ listStyle: 'none', padding: 0, margin: '5px 0' }}>
                  {review.improvementStrategies.slice(0, 2).map((s, i) => <li key={i}>- {s}</li>)}
                </ul>
              </div>
            </div>
          </div>
        )}
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
