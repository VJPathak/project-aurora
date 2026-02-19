import { useState, useCallback } from "react";
import GameCanvas, { GameState } from "@/components/game/GameCanvas";
import HUD from "@/components/game/HUD";
import MenuOverlay from "@/components/game/MenuOverlay";
import { useGameAudio } from "@/hooks/use-game-audio";
import { Volume2, VolumeX } from "lucide-react";

export default function Index() {
  const [gameState, setGameState] = useState<GameState>("menu");
  const [score, setScore]   = useState(0);
  const [lives, setLives]   = useState(3);
  const [level, setLevel]   = useState(1);
  const [finalScore, setFinalScore] = useState(0);
  const [isMuted, setIsMuted] = useState(false);

  const audio = useGameAudio();

  const handleStart  = useCallback(() => {
    audio.startMusic();
    setGameState("playing");
  }, [audio]);

  const handleResume = useCallback(() => {
    audio.startMusic();
    setGameState("playing");
  }, [audio]);

  const handleGameOver = useCallback((s: number) => {
    audio.stopMusic();
    setFinalScore(s);
    setGameState("gameover");
  }, [audio]);

  const handleMuteToggle = useCallback(() => {
    const nowMuted = audio.toggleMute();
    setIsMuted(nowMuted);
  }, [audio]);

  // Expose only the SFX callbacks to GameCanvas
  const audioCallbacks = {
    sfxShoot:      audio.sfxShoot,
    sfxHit:        audio.sfxHit,
    sfxExplode:    audio.sfxExplode,
    sfxDamage:     audio.sfxDamage,
    sfxLevelUp:    audio.sfxLevelUp,
    sfxGameOver:   audio.sfxGameOver,
    sfxEnemyShoot: audio.sfxEnemyShoot,
  };

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
          audio={audioCallbacks}
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

      {/* Mute button */}
      <button
        onClick={handleMuteToggle}
        className="absolute top-4 right-4 z-40 p-2 rounded-md border transition-all duration-200 hover:scale-110 active:scale-95"
        style={{
          background: "hsl(var(--card)/0.7)",
          borderColor: isMuted ? "hsl(var(--muted-foreground))" : "hsl(var(--neon-cyan)/0.6)",
          color: isMuted ? "hsl(var(--muted-foreground))" : "hsl(var(--neon-cyan))",
          boxShadow: isMuted ? "none" : "0 0 12px hsl(var(--neon-cyan)/0.3)",
          backdropFilter: "blur(4px)",
        }}
        title={isMuted ? "Unmute" : "Mute"}
      >
        {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
      </button>

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
