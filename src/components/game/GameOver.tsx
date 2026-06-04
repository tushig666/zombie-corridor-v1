
"use client";

import React from 'react';
import { GameState } from '@/lib/game-types';
import { PostGamePerformanceReviewOutput } from '@/ai/flows/post-game-performance-review-flow';
import { Loader2, RefreshCw, LogOut } from 'lucide-react';

interface GameOverProps {
  state: GameState;
  review: PostGamePerformanceReviewOutput | null;
  onRestart: () => void;
  onQuit: () => void;
}

export default function GameOver({ state, review, onRestart, onQuit }: GameOverProps) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-background/95 z-[60] backdrop-blur-sm p-4 overflow-y-auto">
      <div className="max-w-2xl w-full flex flex-col gap-6 animate-in zoom-in-95 duration-300">
        <div className="text-center">
          <h2 className="text-6xl font-black text-primary mb-2 tracking-tighter italic">CONTAINMENT BREACHED</h2>
          <p className="text-muted-foreground uppercase tracking-[0.2em] font-bold text-sm">Subject Neutralized</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-card p-6 border-b-2 border-primary text-center">
            <span className="text-xs text-muted-foreground uppercase tracking-widest block mb-1">Final Score</span>
            <span className="text-4xl font-black text-primary">{state.score.toLocaleString()}</span>
          </div>
          <div className="bg-card p-6 border-b-2 border-primary text-center">
            <span className="text-xs text-muted-foreground uppercase tracking-widest block mb-1">Max Distance</span>
            <span className="text-4xl font-black text-primary">{state.distance}m</span>
          </div>
        </div>

        {/* AI Performance Review Section */}
        <div className="bg-muted/30 p-8 rounded-lg border border-border">
          <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
            <span className="w-2 h-2 bg-primary rounded-full animate-pulse" />
            FACILITY PERFORMANCE ANALYSIS
          </h3>
          
          {!review ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin mr-2" />
              <span>Analyzing combat data...</span>
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <p className="text-foreground/90 italic leading-relaxed text-lg">"{review.summary}"</p>
              </div>
              
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h4 className="text-primary text-xs font-black uppercase tracking-widest mb-3">ACHIEVEMENTS</h4>
                  <ul className="space-y-2">
                    {review.achievementsHighlighted.map((ach, i) => (
                      <li key={i} className="text-sm flex gap-2">
                        <span className="text-primary">▶</span> {ach}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="text-primary text-xs font-black uppercase tracking-widest mb-3">OPTIMIZATION DATA</h4>
                  <ul className="space-y-2">
                    {review.improvementStrategies.map((strat, i) => (
                      <li key={i} className="text-sm flex gap-2">
                        <span className="text-primary">▶</span> {strat}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-4 mt-4">
          <button 
            onClick={onRestart}
            className="flex-1 flex items-center justify-center gap-2 bg-primary hover:bg-accent text-white font-black py-4 rounded-sm transition-all"
          >
            <RefreshCw className="w-5 h-5" />
            RE-INITIALIZE
          </button>
          <button 
            onClick={onQuit}
            className="flex-1 flex items-center justify-center gap-2 bg-secondary hover:bg-muted text-white font-black py-4 rounded-sm transition-all"
          >
            <LogOut className="w-5 h-5" />
            RETURN TO BASE
          </button>
        </div>
      </div>
    </div>
  );
}
