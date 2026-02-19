import spaceBg from "@/assets/space-bg.jpg";

interface MenuOverlayProps {
  type: "menu" | "gameover" | "paused";
  score?: number;
  onStart: () => void;
  onResume?: () => void;
}

export default function MenuOverlay({ type, score = 0, onStart, onResume }: MenuOverlayProps) {
  const isMenu     = type === "menu";
  const isGameOver = type === "gameover";
  const isPaused   = type === "paused";

  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center z-20"
      style={{
        background: isMenu
          ? `linear-gradient(rgba(4,10,20,0.6), rgba(4,10,20,0.85)), url(${spaceBg}) center/cover`
          : "rgba(4,10,20,0.82)",
        backdropFilter: "blur(2px)",
      }}
    >
      <div className="animate-zoom-in flex flex-col items-center gap-6 max-w-md w-full px-8">

        {/* Title */}
        {isMenu && (
          <>
            <div className="flex flex-col items-center gap-2">
              <p className="text-xs tracking-[0.4em] text-muted-foreground uppercase animate-pulse-glow"
                 style={{ color: "hsl(var(--neon-cyan))" }}>
                — SECTOR 7 —
              </p>
              <h1
                className="font-display text-5xl md:text-6xl font-black text-center leading-none text-glow-cyan"
                style={{ color: "hsl(var(--neon-cyan))", letterSpacing: "0.06em" }}
              >
                VOID
              </h1>
              <h1
                className="font-display text-5xl md:text-6xl font-black text-center leading-none text-glow-magenta"
                style={{ color: "hsl(var(--neon-magenta))", letterSpacing: "0.06em" }}
              >
                STRIKER
              </h1>
            </div>
            <p className="text-center text-sm text-muted-foreground leading-relaxed">
              Defend the sector from alien invaders.<br />
              <span style={{ color: "hsl(var(--neon-gold))" }}>Survive long enough to unlock triple-shot.</span>
            </p>
          </>
        )}

        {isGameOver && (
          <div className="flex flex-col items-center gap-3">
            <p className="font-display text-4xl font-black text-glow-magenta animate-flicker"
               style={{ color: "hsl(var(--neon-magenta))" }}>
              GAME OVER
            </p>
            <p className="text-muted-foreground text-sm tracking-widest">FINAL SCORE</p>
            <p className="font-display text-3xl font-bold text-glow-gold"
               style={{ color: "hsl(var(--neon-gold))" }}>
              {score.toLocaleString()}
            </p>
          </div>
        )}

        {isPaused && (
          <p className="font-display text-4xl font-black text-glow-cyan"
             style={{ color: "hsl(var(--neon-cyan))" }}>
            PAUSED
          </p>
        )}

        {/* Controls hint */}
        {(isMenu || isPaused) && (
          <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-xs mt-1"
               style={{ color: "hsl(var(--muted-foreground))" }}>
            <div className="flex justify-between gap-3">
              <kbd className="px-2 py-1 rounded border border-border font-mono text-xs"
                   style={{ color: "hsl(var(--neon-cyan))", borderColor: "hsl(var(--neon-cyan)/0.4)" }}>
                W A S D
              </kbd>
              <span>Move</span>
            </div>
            <div className="flex justify-between gap-3">
              <kbd className="px-2 py-1 rounded border border-border font-mono text-xs"
                   style={{ color: "hsl(var(--neon-cyan))", borderColor: "hsl(var(--neon-cyan)/0.4)" }}>
                SPACE
              </kbd>
              <span>Shoot</span>
            </div>
            <div className="flex justify-between gap-3">
              <kbd className="px-2 py-1 rounded border border-border font-mono text-xs"
                   style={{ color: "hsl(var(--neon-cyan))", borderColor: "hsl(var(--neon-cyan)/0.4)" }}>
                ↑↓←→
              </kbd>
              <span>Move</span>
            </div>
            <div className="flex justify-between gap-3">
              <kbd className="px-2 py-1 rounded border border-border font-mono text-xs"
                   style={{ color: "hsl(var(--neon-cyan))", borderColor: "hsl(var(--neon-cyan)/0.4)" }}>
                ESC
              </kbd>
              <span>Pause</span>
            </div>
          </div>
        )}

        {/* Buttons */}
        <div className="flex flex-col gap-3 w-full mt-2">
          {isPaused && onResume && (
            <button
              onClick={onResume}
              className="w-full py-3 font-display font-bold tracking-widest text-sm rounded-md border-2 transition-all duration-200 hover:scale-105 active:scale-95"
              style={{
                background: "transparent",
                color: "hsl(var(--neon-cyan))",
                borderColor: "hsl(var(--neon-cyan))",
                boxShadow: "0 0 16px hsl(var(--neon-cyan)/0.3)",
              }}
            >
              RESUME
            </button>
          )}
          <button
            onClick={onStart}
            className="w-full py-3 font-display font-bold tracking-widest text-sm rounded-md border-2 transition-all duration-200 hover:scale-105 active:scale-95"
            style={{
              background: "hsl(var(--neon-cyan)/0.12)",
              color: "hsl(var(--primary-foreground))",
              borderColor: "hsl(var(--neon-cyan))",
              boxShadow: "0 0 24px hsl(var(--neon-cyan)/0.4), inset 0 0 24px hsl(var(--neon-cyan)/0.05)",
              backgroundColor: "hsl(var(--neon-cyan))",
            }}
          >
            {isMenu ? "START MISSION" : isGameOver ? "PLAY AGAIN" : "RESTART"}
          </button>
        </div>

        {/* Enemy legend */}
        {isMenu && (
          <div className="w-full mt-2 border rounded-md p-4 text-xs space-y-2"
               style={{ borderColor: "hsl(var(--border))", background: "hsl(var(--card)/0.6)" }}>
            <p className="text-muted-foreground uppercase tracking-widest text-center mb-3">Enemy Types</p>
            <div className="flex justify-around">
              <div className="flex flex-col items-center gap-1">
                <div className="w-5 h-5 rotate-45" style={{ background: "hsl(var(--neon-magenta))", boxShadow: "0 0 8px hsl(var(--neon-magenta))" }}/>
                <span style={{ color: "hsl(var(--neon-magenta))" }}>GRUNT</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <div className="w-0 h-0"
                     style={{ borderLeft: "12px solid transparent", borderRight: "12px solid transparent", borderTop: "20px solid hsl(var(--neon-gold))", filter: "drop-shadow(0 0 6px hsl(var(--neon-gold)))" }}/>
                <span style={{ color: "hsl(var(--neon-gold))" }}>DART</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <div className="w-6 h-6 rounded-full border-2" style={{ borderColor: "hsl(var(--neon-red))", boxShadow: "0 0 8px hsl(var(--neon-red))" }}/>
                <span style={{ color: "hsl(var(--neon-red))" }}>TANK</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
