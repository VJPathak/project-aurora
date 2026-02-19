import { useState, useCallback } from "react";
import GameCanvas, { GameState } from "@/components/game/GameCanvas";
import HUD from "@/components/game/HUD";
import MenuOverlay from "@/components/game/MenuOverlay";

export default function Index() {
  const [gameState, setGameState] = useState<GameState>("menu");
  const [score, setScore]   = useState(0);
  const [lives, setLives]   = useState(3);
  const [level, setLevel]   = useState(1);
  const [finalScore, setFinalScore] = useState(0);

  const handleStart  = useCallback(() => setGameState("playing"), []);
  const handleResume = useCallback(() => setGameState("playing"), []);

  const handleGameOver = useCallback((s: number) => {
    setFinalScore(s);
    setGameState("gameover");
  }, []);

  return (
    <div
      className="relative w-screen h-screen overflow-hidden select-none"
      style={{ background: "hsl(var(--background))", fontFamily: "var(--font-hud)" }}
    >
      {/* Game canvas — always mounted for smooth transitions */}
      <div className="absolute inset-0">
        <GameCanvas
          gameState={gameState}
          onScoreChange={setScore}
          onLivesChange={setLives}
          onLevelChange={setLevel}
          onGameOver={handleGameOver}
          onStateChange={setGameState}
        />
      </div>

      {/* HUD (only when playing or paused) */}
      {(gameState === "playing" || gameState === "paused") && (
        <HUD score={score} lives={lives} level={level} />
      )}

      {/* Overlays */}
      {gameState === "menu" && (
        <MenuOverlay type="menu" onStart={handleStart} />
      )}
      {gameState === "paused" && (
        <MenuOverlay type="paused" onStart={handleStart} onResume={handleResume} />
      )}
      {gameState === "gameover" && (
        <MenuOverlay type="gameover" score={finalScore} onStart={handleStart} />
      )}

      {/* Thin scanline overlay for CRT effect */}
      <div
        className="absolute inset-0 pointer-events-none z-30"
        style={{
          background: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.04) 2px, rgba(0,0,0,0.04) 4px)",
        }}
      />

      {/* Corner decorations */}
      <div className="absolute bottom-4 left-4 text-xs pointer-events-none z-10"
           style={{ color: "hsl(var(--muted-foreground))", fontFamily: "var(--font-hud)", opacity: 0.5 }}>
        VOID STRIKER v1.0
      </div>
      <div className="absolute bottom-4 right-4 text-xs pointer-events-none z-10"
           style={{ color: "hsl(var(--muted-foreground))", fontFamily: "var(--font-hud)", opacity: 0.5 }}>
        {gameState === "playing" ? "ESC to pause" : ""}
      </div>
    </div>
  );
}
