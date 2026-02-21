/**
 * useGameAudio — Procedural Web Audio API engine for VOID STRIKER
 * All sounds are synthesized; zero asset files required.
 */

import { useRef, useCallback, useEffect } from "react";

// ── Tiny helper: create + connect an OscillatorNode ──────────────────────────
function osc(
  ctx: AudioContext,
  dest: AudioNode,
  type: OscillatorType,
  freq: number,
  gainVal: number,
  startTime: number,
  duration: number,
  freqEnd?: number,
) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(gainVal, startTime);
  g.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
  g.connect(dest);

  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, startTime);
  if (freqEnd !== undefined) {
    o.frequency.exponentialRampToValueAtTime(freqEnd, startTime + duration);
  }
  o.connect(g);
  o.start(startTime);
  o.stop(startTime + duration + 0.05);
}

// ── White-noise burst via ScriptProcessor fallback / AudioBuffer ──────────────
function noise(
  ctx: AudioContext,
  dest: AudioNode,
  gainVal: number,
  startTime: number,
  duration: number,
  hpFreq = 200,
) {
  const bufLen = Math.ceil(ctx.sampleRate * duration);
  const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;

  const src = ctx.createBufferSource();
  src.buffer = buf;

  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = hpFreq;

  const g = ctx.createGain();
  g.gain.setValueAtTime(gainVal, startTime);
  g.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

  src.connect(hp).connect(g).connect(dest);
  src.start(startTime);
}

// ── Background music oscillators ──────────────────────────────────────────────
const BASS_PATTERN = [55, 55, 82.4, 55, 73.4, 55, 82.4, 73.4]; // A1, E2, D2 bassline
const PAD_NOTES    = [220, 261.6, 329.6, 440];                   // Am chord

export function useGameAudio() {
  const acRef      = useRef<AudioContext | null>(null);
  const masterRef  = useRef<GainNode | null>(null);
  const musicRef   = useRef<{ nodes: AudioNode[]; stop: () => void } | null>(null);
  const muted      = useRef(false);

  // ── Lazy init AudioContext on first user gesture ──────────────────────────
  const getCtx = useCallback((): AudioContext => {
    if (!acRef.current) {
      acRef.current = new AudioContext();
      const master = acRef.current.createGain();
      master.gain.value = 0.55;
      master.connect(acRef.current.destination);
      masterRef.current = master;
    }
    if (acRef.current.state === "suspended") acRef.current.resume();
    return acRef.current;
  }, []);

  // ── Sound effects ─────────────────────────────────────────────────────────

  /** Player laser shot */
  const sfxShoot = useCallback(() => {
    if (muted.current) return;
    const ctx = getCtx();
    const t = ctx.currentTime;
    osc(ctx, masterRef.current!, "sawtooth", 900, 0.12, t, 0.08, 200);
    osc(ctx, masterRef.current!, "square",   1800, 0.06, t, 0.06, 400);
  }, [getCtx]);

  /** Enemy hit spark */
  const sfxHit = useCallback(() => {
    if (muted.current) return;
    const ctx = getCtx();
    const t = ctx.currentTime;
    noise(ctx, masterRef.current!, 0.18, t, 0.07, 1000);
    osc(ctx, masterRef.current!, "square", 440, 0.1, t, 0.06, 200);
  }, [getCtx]);

  /** Enemy explosion */
  const sfxExplode = useCallback((big = false) => {
    if (muted.current) return;
    const ctx = getCtx();
    const t = ctx.currentTime;
    const vol = big ? 0.55 : 0.32;
    const dur = big ? 0.6  : 0.35;
    noise(ctx, masterRef.current!, vol, t, dur, 40);
    osc(ctx, masterRef.current!, "sine", big ? 120 : 80, vol * 0.6, t, dur * 0.8, 20);
  }, [getCtx]);

  /** Player takes damage */
  const sfxDamage = useCallback(() => {
    if (muted.current) return;
    const ctx = getCtx();
    const t = ctx.currentTime;
    noise(ctx, masterRef.current!, 0.45, t, 0.25, 60);
    osc(ctx, masterRef.current!, "sawtooth", 180, 0.3, t, 0.3, 60);
  }, [getCtx]);

  /** Level up fanfare — intensity scales with level */
  const sfxLevelUp = useCallback((level = 1) => {
    if (muted.current) return;
    const ctx = getCtx();
    const t = ctx.currentTime;
    // More notes and higher pitch for higher levels
    const baseNotes = [523.3, 659.3, 783.99, 1046.5];
    const extraNotes = level >= 3 ? [1318.5] : [];
    const extraNotes2 = level >= 5 ? [1568] : [];
    const melody = [...baseNotes, ...extraNotes, ...extraNotes2];
    const vol = Math.min(0.25, 0.15 + level * 0.012);
    melody.forEach((freq, i) => {
      osc(ctx, masterRef.current!, "square", freq, vol, t + i * 0.08, 0.14);
    });
    // Add a victory chord on higher levels
    if (level >= 4) {
      osc(ctx, masterRef.current!, "sine", 440, 0.08, t + melody.length * 0.08, 0.4);
      osc(ctx, masterRef.current!, "sine", 554.4, 0.08, t + melody.length * 0.08, 0.4);
      osc(ctx, masterRef.current!, "sine", 659.3, 0.08, t + melody.length * 0.08, 0.4);
    }
  }, [getCtx]);

  /** Triple shot unlock */
  const sfxPowerUp = useCallback(() => {
    if (muted.current) return;
    const ctx = getCtx();
    const t = ctx.currentTime;
    osc(ctx, masterRef.current!, "sine", 440, 0.2, t,       0.12);
    osc(ctx, masterRef.current!, "sine", 660, 0.2, t + 0.1, 0.12);
    osc(ctx, masterRef.current!, "sine", 880, 0.25, t + 0.2, 0.2);
  }, [getCtx]);

  /** Game over sting */
  const sfxGameOver = useCallback(() => {
    if (muted.current) return;
    const ctx = getCtx();
    const t = ctx.currentTime;
    [400, 300, 200, 120].forEach((freq, i) => {
      osc(ctx, masterRef.current!, "sawtooth", freq, 0.22, t + i * 0.18, 0.22, freq * 0.5);
    });
    noise(ctx, masterRef.current!, 0.3, t + 0.5, 0.5, 30);
  }, [getCtx]);

  /** Enemy bullet fired */
  const sfxEnemyShoot = useCallback(() => {
    if (muted.current) return;
    const ctx = getCtx();
    const t = ctx.currentTime;
    osc(ctx, masterRef.current!, "sawtooth", 300, 0.06, t, 0.12, 80);
  }, [getCtx]);

  /** Set music intensity based on game level (1-10 scale) */
  const setMusicLevel = useCallback((level: number) => {
    if (!acRef.current || !masterRef.current) return;
    // Increase arp and hihat volumes as level rises
    const intensity = Math.min(level / 8, 1);
    masterRef.current.gain.setValueAtTime(
      muted.current ? 0 : 0.45 + intensity * 0.25,
      acRef.current.currentTime
    );
  }, []);

  // ── Background music ──────────────────────────────────────────────────────
  const startMusic = useCallback(() => {
    if (musicRef.current) return; // already playing
    const ctx = getCtx();

    const nodes: AudioNode[] = [];
    const stopFns: (() => void)[] = [];

    // ─── Pad (long chords) ────
    const padGain = ctx.createGain();
    padGain.gain.value = 0.04;
    padGain.connect(masterRef.current!);
    nodes.push(padGain);

    PAD_NOTES.forEach(freq => {
      const o = ctx.createOscillator();
      o.type = "sawtooth";
      o.frequency.value = freq;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.25;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 2;
      lfo.connect(lfoGain);
      lfoGain.connect(o.frequency);
      lfo.start();
      o.connect(padGain);
      o.start();
      stopFns.push(() => { o.stop(); lfo.stop(); });
    });

    // ─── Sub-bass sequencer ────
    const BPM = 120;
    const step = 60 / BPM;
    const bassGain = ctx.createGain();
    bassGain.gain.value = 0.18;
    const bassFilter = ctx.createBiquadFilter();
    bassFilter.type = "lowpass";
    bassFilter.frequency.value = 180;
    bassGain.connect(bassFilter);
    bassFilter.connect(masterRef.current!);
    nodes.push(bassGain, bassFilter);

    let beatIndex = 0;
    const scheduleBass = () => {
      const freq = BASS_PATTERN[beatIndex % BASS_PATTERN.length];
      const t = ctx.currentTime;
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.setValueAtTime(1, t);
      g.gain.exponentialRampToValueAtTime(0.01, t + step * 0.85);
      o.connect(g).connect(bassGain);
      o.start(t);
      o.stop(t + step);
      beatIndex++;
    };

    let bassInterval: ReturnType<typeof setInterval> | null = setInterval(scheduleBass, step * 1000);
    scheduleBass();

    // ─── Hi-hat clicks ────
    const hihatGain = ctx.createGain();
    hihatGain.gain.value = 0.04;
    hihatGain.connect(masterRef.current!);
    nodes.push(hihatGain);

    let hhInterval: ReturnType<typeof setInterval> | null = setInterval(() => {
      noise(ctx, hihatGain, 0.6, ctx.currentTime, 0.03, 8000);
    }, step * 500); // 16th notes

    // ─── Kick drum ────
    const kickGain = ctx.createGain();
    kickGain.gain.value = 0.45;
    kickGain.connect(masterRef.current!);
    nodes.push(kickGain);

    let kickInterval: ReturnType<typeof setInterval> | null = setInterval(() => {
      const t = ctx.currentTime;
      osc(ctx, kickGain, "sine", 120, 1, t, 0.15, 40);
      noise(ctx, kickGain, 0.2, t, 0.04, 60);
    }, step * 2000); // quarter notes

    // ─── Arpeggiated melody ────
    const arpNotes  = [440, 523.3, 659.3, 783.99, 880, 783.99, 659.3, 523.3];
    const arpGain   = ctx.createGain();
    arpGain.gain.value = 0.06;
    const arpDelay  = ctx.createDelay(0.5);
    arpDelay.delayTime.value = step * 0.75;
    const arpDelGain = ctx.createGain();
    arpDelGain.gain.value = 0.35;
    arpGain.connect(arpDelay);
    arpDelay.connect(arpDelGain);
    arpDelGain.connect(arpGain); // feedback
    arpGain.connect(masterRef.current!);
    nodes.push(arpGain, arpDelay, arpDelGain);

    let arpIdx = 0;
    let arpInterval: ReturnType<typeof setInterval> | null = setInterval(() => {
      const freq = arpNotes[arpIdx % arpNotes.length];
      osc(ctx, arpGain, "square", freq, 0.5, ctx.currentTime, step * 0.45);
      arpIdx++;
    }, step * 500);

    const stop = () => {
      stopFns.forEach(fn => fn());
      [bassInterval, hhInterval, kickInterval, arpInterval].forEach(iv => {
        if (iv !== null) clearInterval(iv);
      });
      bassInterval = hhInterval = kickInterval = arpInterval = null;
      // fade out master
      if (masterRef.current) {
        const g = masterRef.current;
        const now = ctx.currentTime;
        g.gain.setValueAtTime(g.gain.value, now);
        g.gain.linearRampToValueAtTime(0, now + 1.5);
      }
    };

    musicRef.current = { nodes, stop };
  }, [getCtx]);

  const stopMusic = useCallback(() => {
    if (musicRef.current) {
      musicRef.current.stop();
      musicRef.current = null;
    }
  }, []);

  const toggleMute = useCallback(() => {
    muted.current = !muted.current;
    if (masterRef.current && acRef.current) {
      const now = acRef.current.currentTime;
      masterRef.current.gain.setValueAtTime(masterRef.current.gain.value, now);
      masterRef.current.gain.linearRampToValueAtTime(muted.current ? 0 : 0.55, now + 0.3);
    }
    return muted.current;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopMusic();
      acRef.current?.close();
    };
  }, [stopMusic]);

  return {
    sfxShoot,
    sfxHit,
    sfxExplode,
    sfxDamage,
    sfxLevelUp,
    sfxPowerUp,
    sfxGameOver,
    sfxEnemyShoot,
    startMusic,
    stopMusic,
    setMusicLevel,
    toggleMute,
    isMuted: () => muted.current,
  };
}
