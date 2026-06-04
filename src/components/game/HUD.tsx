
"use client";

import React from 'react';
import { GameState } from '@/lib/game-types';
import { Heart, Trophy, MapPin, Gauge } from 'lucide-react';

interface HUDProps {
  state: GameState;
}

export default function HUD({ state }: HUDProps) {
  return (
    <div className="absolute inset-0 pointer-events-none p-6 font-headline">
      {/* Top Left: HP & Level */}
      <div className="absolute top-6 left-6 flex flex-col gap-2">
        <div className="flex items-center gap-3 bg-black/40 backdrop-blur-md border-l-4 border-primary p-4 rounded-r-md">
          <Heart className="w-6 h-6 text-primary fill-primary" />
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground font-bold uppercase tracking-widest">Integrity</span>
            <span className="text-3xl font-bold leading-none">{Math.max(0, Math.ceil(state.hp))}%</span>
          </div>
          <div className="w-32 h-2 bg-secondary/50 ml-4 overflow-hidden rounded-full">
            <div 
              className="h-full bg-primary transition-all duration-300" 
              style={{ width: `${Math.max(0, state.hp)}%` }} 
            />
          </div>
        </div>
        
        <div className="flex items-center gap-3 bg-black/40 backdrop-blur-md border-l-4 border-muted p-2 rounded-r-md w-fit">
          <Gauge className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-bold uppercase tracking-widest">Level {state.level}</span>
        </div>
      </div>

      {/* Top Right: Score & Distance */}
      <div className="absolute top-6 right-6 flex flex-col items-end gap-2">
        <div className="flex items-center gap-3 bg-black/40 backdrop-blur-md border-r-4 border-primary p-4 rounded-l-md text-right">
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground font-bold uppercase tracking-widest">Purge Score</span>
            <span className="text-3xl font-bold leading-none">{state.score.toLocaleString()}</span>
          </div>
          <Trophy className="w-6 h-6 text-primary" />
        </div>

        <div className="flex items-center gap-3 bg-black/40 backdrop-blur-md border-r-4 border-muted p-2 rounded-l-md text-right w-fit">
          <span className="text-sm font-bold uppercase tracking-widest">{state.distance}m Traveled</span>
          <MapPin className="w-4 h-4 text-muted-foreground" />
        </div>
      </div>
    </div>
  );
}
