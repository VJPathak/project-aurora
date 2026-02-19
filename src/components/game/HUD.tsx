/** Heads-Up Display — score, lives, level bar */

import { Heart, Zap, Star } from "lucide-react";

interface HUDProps {
  score: number;
  lives: number;
  level: number;
}

export default function HUD({ score, lives, level }: HUDProps) {
  return (
    <div className="absolute inset-x-0 top-0 z-10 flex items-start justify-between px-6 py-4 pointer-events-none select-none">
      {/* Left — Score */}
      <div className="flex flex-col gap-1">
        <span className="text-xs tracking-widest text-muted-foreground uppercase">Score</span>
        <span
          className="text-2xl font-display font-bold text-glow-cyan"
          style={{ color: "hsl(var(--neon-cyan))" }}
        >
          {score.toLocaleString().padStart(8, "0")}
        </span>
      </div>

      {/* Center — Level */}
      <div className="flex flex-col items-center gap-1">
        <div className="flex items-center gap-1.5">
          <Zap size={14} style={{ color: "hsl(var(--neon-gold))" }} />
          <span className="text-xs tracking-widest text-muted-foreground uppercase">Level</span>
          <Zap size={14} style={{ color: "hsl(var(--neon-gold))" }} />
        </div>
        <span
          className="text-2xl font-display font-bold text-glow-gold"
          style={{ color: "hsl(var(--neon-gold))" }}
        >
          {level.toString().padStart(2, "0")}
        </span>
        {/* Difficulty bar */}
        <div className="flex gap-0.5 mt-0.5">
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={i}
              className="w-3 h-1.5 rounded-sm transition-all duration-300"
              style={{
                background: i < Math.min(level, 10)
                  ? `hsl(${50 - i * 4}, 100%, 55%)`
                  : "hsl(var(--muted))",
                boxShadow: i < Math.min(level, 10)
                  ? `0 0 6px hsl(${50 - i * 4}, 100%, 55%)`
                  : "none",
              }}
            />
          ))}
        </div>
      </div>

      {/* Right — Lives */}
      <div className="flex flex-col items-end gap-1">
        <span className="text-xs tracking-widest text-muted-foreground uppercase">Lives</span>
        <div className="flex gap-1.5">
          {Array.from({ length: 3 }).map((_, i) => (
            <Heart
              key={i}
              size={22}
              fill={i < lives ? "hsl(var(--neon-magenta))" : "transparent"}
              strokeWidth={1.5}
              style={{
                color: "hsl(var(--neon-magenta))",
                filter: i < lives ? "drop-shadow(0 0 6px hsl(var(--neon-magenta)))" : "none",
                opacity: i < lives ? 1 : 0.25,
                transition: "all 0.3s",
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
