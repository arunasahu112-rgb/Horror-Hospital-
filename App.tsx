import React, { useEffect, useRef, useState, useCallback } from 'react';
import { HospitalGame } from './game/HospitalGame';
import { horrorAudio } from './audio/horrorAudio';
import {
  Flashlight,
  Volume2,
  VolumeX,
  RotateCcw,
  Play,
  Heart,
  Key,
  Footprints,
  Hand,
  Compass,
  AlertTriangle,
  FileText
} from 'lucide-react';

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<HospitalGame | null>(null);

  // Game UI States
  const [gameState, setGameState] = useState<'title' | 'playing' | 'victory'>('title');
  const [recordsCount, setRecordsCount] = useState<number>(0);
  const [totalRecords, setTotalRecords] = useState<number>(4);
  const [recentRecordName, setRecentRecordName] = useState<string | null>(null);
  const [interactPrompt, setInteractPrompt] = useState<string | null>(null);
  const [battery, setBattery] = useState<number>(100);
  const [sanity, setSanity] = useState<number>(100);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isSprinting, setIsSprinting] = useState<boolean>(false);

  // Mobile Touch Joystick State
  const joystickTouchId = useRef<number | null>(null);
  const joystickCenter = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const [stickPos, setStickPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Mobile Right Look Touch State
  const lookTouchId = useRef<number | null>(null);
  const lastLookPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Initialize Three.js Game Engine
  useEffect(() => {
    if (!containerRef.current) return;

    const game = new HospitalGame(containerRef.current, {
      onCollectRecord: (id, name, count, total) => {
        setRecordsCount(count);
        setTotalRecords(total);
        setRecentRecordName(name);
        setTimeout(() => setRecentRecordName(null), 4000);
      },
      onInteractPrompt: (prompt) => {
        setInteractPrompt(prompt);
      },
      onVictory: () => {
        setGameState('victory');
      },
      onBatteryChange: (percent) => {
        setBattery(percent);
      },
      onSanityChange: (percent) => {
        setSanity(percent);
      },
    });

    gameRef.current = game;

    return () => {
      game.dispose();
      gameRef.current = null;
    };
  }, []);

  const handleStart = () => {
    if (gameRef.current) {
      gameRef.current.startGame();
    }
    setGameState('playing');
  };

  const handleRestart = () => {
    if (gameRef.current) {
      gameRef.current.restartGame();
    }
    setRecordsCount(0);
    setGameState('playing');
  };

  const toggleMute = () => {
    const muted = horrorAudio.toggleMute();
    setIsMuted(muted);
  };

  const toggleFlashlight = () => {
    if (gameRef.current) {
      gameRef.current.toggleFlashlight();
    }
  };

  const handleInteract = () => {
    if (gameRef.current) {
      gameRef.current.interact();
    }
  };

  const toggleSprint = () => {
    const next = !isSprinting;
    setIsSprinting(next);
    if (gameRef.current) {
      gameRef.current.setSprint(next);
    }
  };

  // --- MOBILE JOYSTICK TOUCH HANDLERS ---
  const handleJoystickTouchStart = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (joystickTouchId.current !== null) return;
    const touch = e.changedTouches[0];
    joystickTouchId.current = touch.identifier;
    const rect = e.currentTarget.getBoundingClientRect();
    joystickCenter.current = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
    updateJoystick(touch.clientX, touch.clientY);
  }, []);

  const updateJoystick = (clientX: number, clientY: number) => {
    const dx = clientX - joystickCenter.current.x;
    const dy = clientY - joystickCenter.current.y;
    const maxRadius = 45;
    const dist = Math.hypot(dx, dy);

    let normX = dx;
    let normY = dy;
    if (dist > maxRadius) {
      normX = (dx / dist) * maxRadius;
      normY = (dy / dist) * maxRadius;
    }

    setStickPos({ x: normX, y: normY });

    if (gameRef.current) {
      // normalized -1 to +1
      gameRef.current.setJoystickInput(normX / maxRadius, normY / maxRadius);
    }
  };

  const handleJoystickTouchMove = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === joystickTouchId.current) {
        updateJoystick(touch.clientX, touch.clientY);
        break;
      }
    }
  }, []);

  const handleJoystickTouchEnd = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === joystickTouchId.current) {
        joystickTouchId.current = null;
        setStickPos({ x: 0, y: 0 });
        if (gameRef.current) {
          gameRef.current.setJoystickInput(0, 0);
        }
        break;
      }
    }
  }, []);

  // --- MOBILE LOOK TOUCH ZONE HANDLERS (RIGHT HALF SCREEN) ---
  const handleLookTouchStart = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (lookTouchId.current !== null) return;
    const touch = e.changedTouches[0];
    lookTouchId.current = touch.identifier;
    lastLookPos.current = { x: touch.clientX, y: touch.clientY };
  }, []);

  const handleLookTouchMove = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === lookTouchId.current) {
        const deltaX = touch.clientX - lastLookPos.current.x;
        const deltaY = touch.clientY - lastLookPos.current.y;
        lastLookPos.current = { x: touch.clientX, y: touch.clientY };

        if (gameRef.current) {
          gameRef.current.addTouchLook(deltaX, deltaY);
        }
        break;
      }
    }
  }, []);

  const handleLookTouchEnd = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === lookTouchId.current) {
        lookTouchId.current = null;
        break;
      }
    }
  }, []);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black select-none font-sans text-neutral-200">
      {/* 3D WebGL Canvas Container */}
      <div ref={containerRef} className="absolute inset-0 w-full h-full z-0 pointer-events-auto" />

      {/* Atmospheric Vignette & Film Grain Overlay */}
      <div className="absolute inset-0 pointer-events-none z-10 bg-[radial-gradient(circle_at_center,transparent_40%,rgba(0,0,0,0.85)_100%)]" />

      {/* ===================== TITLE SCREEN ===================== */}
      {gameState === 'title' && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-between p-6 sm:p-10 bg-black/85 text-center">
          <div className="w-full flex justify-end">
            <button
              onClick={toggleMute}
              className="p-3 bg-neutral-900/80 border border-neutral-700/60 rounded-full text-neutral-300 hover:text-white transition-colors"
              title="Toggle Audio"
            >
              {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5 text-emerald-400" />}
            </button>
          </div>

          <div className="max-w-xl flex flex-col items-center my-auto">
            {/* Title Lockup */}
            <div className="inline-flex items-center gap-2 px-3 py-1 mb-4 rounded-full border border-red-900/60 bg-red-950/40 text-red-400 text-xs tracking-widest uppercase font-mono">
              <AlertTriangle className="w-3.5 h-3.5" /> Biohazard Quarantine Sector
            </div>

            <h1 className="text-4xl sm:text-6xl font-black tracking-wider text-neutral-100 font-mono mb-2 uppercase drop-shadow-[0_4px_12px_rgba(255,0,0,0.25)]">
              ABANDONED: <span className="text-emerald-500">HOSPITAL 13</span>
            </h1>

            <p className="text-neutral-400 text-sm sm:text-base leading-relaxed mb-8 max-w-md">
              You awoke trapped in the subterranean wards of Hospital 13.
              Search the decaying rooms for the <span className="text-emerald-400 font-semibold">4 Medical Access Records</span> to override the North Emergency Gate before your battery runs dry.
            </p>

            <button
              onClick={handleStart}
              className="flex items-center gap-3 px-8 py-4 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-black font-mono font-bold text-lg rounded tracking-wider shadow-[0_0_25px_rgba(16,185,129,0.35)] transition-all cursor-pointer"
            >
              <Play className="w-6 h-6 fill-current" /> ENTER WARD 13
            </button>
          </div>

          {/* Controls hint */}
          <div className="max-w-xl w-full bg-neutral-950/80 border border-neutral-800 rounded-lg p-4 text-xs text-neutral-400 font-mono flex flex-col sm:flex-row justify-around gap-4 text-left">
            <div>
              <p className="text-emerald-400 font-semibold mb-1 uppercase">Desktop Controls</p>
              <p>WASD / Arrows · Walk</p>
              <p>Mouse · Look around (Click to Lock)</p>
              <p>Shift · Sprint · F · Flashlight · E · Inspect</p>
            </div>
            <div>
              <p className="text-emerald-400 font-semibold mb-1 uppercase">Mobile Controls</p>
              <p>Left Thumb · Move Joystick</p>
              <p>Right Screen Drag · Look Around</p>
              <p>On-Screen Buttons · Flashlight & Inspect</p>
            </div>
          </div>
        </div>
      )}

      {/* ===================== IN-GAME HUD ===================== */}
      {gameState === 'playing' && (
        <div className="absolute inset-0 z-20 pointer-events-none flex flex-col justify-between p-4 sm:p-6">
          {/* Top Status Bar */}
          <header className="flex justify-between items-start gap-3 w-full">
            {/* Sector badge */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2 bg-neutral-900/90 border border-neutral-700/80 px-3 py-1.5 rounded text-xs font-mono text-neutral-300">
                <Compass className="w-3.5 h-3.5 text-emerald-400" />
                <span>WARD 13 · SUB-LEVEL 2</span>
              </div>

              {/* Sanity / Heart rate */}
              <div className="flex items-center gap-2 bg-neutral-900/90 border border-neutral-700/80 px-3 py-1 rounded text-xs font-mono">
                <Heart className={`w-3.5 h-3.5 ${sanity < 40 ? 'text-red-500 animate-pulse' : 'text-emerald-400'}`} />
                <span className="text-neutral-300">PULSE:</span>
                <span className={`tabular-nums font-semibold ${sanity < 40 ? 'text-red-400' : 'text-emerald-400'}`}>
                  {Math.round(75 + (100 - sanity) * 0.8)} BPM
                </span>
              </div>
            </div>

            {/* Objective Tracker & Flashlight */}
            <div className="flex items-center gap-3">
              {/* Flashlight battery */}
              <div className="flex items-center gap-2 bg-neutral-900/90 border border-neutral-700/80 px-3 py-1.5 rounded text-xs font-mono">
                <Flashlight className={`w-3.5 h-3.5 ${battery < 25 ? 'text-amber-500' : 'text-yellow-300'}`} />
                <span className="text-neutral-400">BATTERY:</span>
                <span className={`tabular-nums font-bold ${battery < 20 ? 'text-red-400' : 'text-neutral-200'}`}>
                  {battery}%
                </span>
              </div>

              {/* Records Found Counter */}
              <div className="flex items-center gap-2 bg-neutral-900/90 border border-neutral-700/80 px-3 py-1.5 rounded text-xs font-mono">
                <Key className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-neutral-400">RECORDS:</span>
                <span className="text-emerald-400 font-bold tabular-nums">
                  {recordsCount} / {totalRecords}
                </span>
              </div>

              {/* Audio Toggle */}
              <button
                onClick={toggleMute}
                className="pointer-events-auto p-2 bg-neutral-900/90 border border-neutral-700/80 rounded hover:bg-neutral-800 text-neutral-300"
                title="Mute Audio"
              >
                {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
              </button>
            </div>
          </header>

          {/* Center Crosshair & Interaction Prompt */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            {/* Center reticle */}
            <div className="w-1.5 h-1.5 rounded-full bg-neutral-400/60 ring-4 ring-neutral-900/40" />

            {/* Interactive Action Prompt */}
            {interactPrompt && (
              <div
                onClick={handleInteract}
                className="mt-6 pointer-events-auto px-4 py-2 bg-emerald-950/90 border border-emerald-500/80 rounded shadow-lg text-emerald-200 text-xs sm:text-sm font-mono tracking-wide flex items-center gap-2 cursor-pointer active:scale-95 transition-transform"
              >
                <Hand className="w-4 h-4 text-emerald-400" />
                <span>{interactPrompt}</span>
              </div>
            )}

            {/* Recent Collection Toast */}
            {recentRecordName && (
              <div className="mt-4 px-4 py-2 bg-neutral-900/90 border border-emerald-500/50 rounded text-xs font-mono text-emerald-300 flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-400" />
                <span>ACQUIRED: {recentRecordName}</span>
              </div>
            )}
          </div>

          {/* ===================== MOBILE TOUCH CONTROLS ===================== */}
          {/* Right Touch Look Area (covers right half of screen for camera panning) */}
          <div
            className="absolute top-20 right-0 bottom-24 w-1/2 pointer-events-auto z-10 touch-none"
            onTouchStart={handleLookTouchStart}
            onTouchMove={handleLookTouchMove}
            onTouchEnd={handleLookTouchEnd}
            onTouchCancel={handleLookTouchEnd}
          />

          {/* Bottom HUD & Action Controls */}
          <footer className="flex justify-between items-end w-full pb-2 z-20">
            {/* Left: Virtual Joystick */}
            <div
              className="pointer-events-auto relative w-32 h-32 rounded-full border-2 border-neutral-700/60 bg-neutral-900/60 flex items-center justify-center touch-none select-none active:border-emerald-500/60 transition-colors"
              onTouchStart={handleJoystickTouchStart}
              onTouchMove={handleJoystickTouchMove}
              onTouchEnd={handleJoystickTouchEnd}
              onTouchCancel={handleJoystickTouchEnd}
            >
              {/* Center thumb stick */}
              <div
                className="w-12 h-12 rounded-full bg-emerald-500/80 border border-emerald-300 shadow-md"
                style={{
                  transform: `translate(${stickPos.x}px, ${stickPos.y}px)`,
                  transition: stickPos.x === 0 && stickPos.y === 0 ? 'transform 0.15s ease-out' : 'none',
                }}
              />
              <span className="absolute bottom-1 text-[9px] font-mono text-neutral-400 uppercase tracking-tighter">
                MOVE
              </span>
            </div>

            {/* Right: Quick Action Buttons (Flashlight, Sprint, Interact) */}
            <div className="pointer-events-auto flex items-center gap-3">
              {/* Sprint Button */}
              <button
                onClick={toggleSprint}
                className={`p-3.5 rounded-full border ${
                  isSprinting
                    ? 'bg-emerald-600 border-emerald-400 text-black shadow-[0_0_12px_rgba(16,185,129,0.5)]'
                    : 'bg-neutral-900/90 border-neutral-700 text-neutral-300'
                } active:scale-90 transition-transform`}
                title="Sprint"
              >
                <Footprints className="w-5 h-5" />
              </button>

              {/* Flashlight Toggle */}
              <button
                onClick={toggleFlashlight}
                className="p-3.5 rounded-full bg-neutral-900/90 border border-neutral-700 text-neutral-300 active:scale-90 hover:border-yellow-400 transition-transform"
                title="Toggle Flashlight"
              >
                <Flashlight className="w-5 h-5 text-yellow-300" />
              </button>

              {/* Interact Button */}
              <button
                onClick={handleInteract}
                className="p-4 rounded-full bg-emerald-700 border border-emerald-400 text-white font-bold active:scale-90 shadow-[0_0_15px_rgba(16,185,129,0.4)] transition-transform"
                title="Interact / Collect"
              >
                <Hand className="w-6 h-6" />
              </button>
            </div>
          </footer>
        </div>
      )}

      {/* ===================== VICTORY / ESCAPED SCREEN ===================== */}
      {gameState === 'victory' && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center p-6 bg-black/90 text-center">
          <div className="max-w-md p-8 bg-neutral-950 border border-emerald-500/60 rounded-xl shadow-[0_0_40px_rgba(16,185,129,0.2)] flex flex-col items-center">
            <div className="p-4 bg-emerald-950/80 rounded-full border border-emerald-500/80 mb-4 text-emerald-400">
              <Key className="w-8 h-8" />
            </div>

            <h2 className="text-3xl font-black text-white font-mono tracking-wider uppercase mb-2">
              YOU ESCAPED WARD 13
            </h2>

            <p className="text-neutral-400 text-sm leading-relaxed mb-6 font-mono">
              The heavy security gates hissed open. You made it out into the fog with all 4 classified records intact.
            </p>

            <div className="w-full bg-neutral-900 border border-neutral-800 rounded p-3 text-xs font-mono text-left mb-6 space-y-1">
              <div className="flex justify-between">
                <span className="text-neutral-400">Status:</span>
                <span className="text-emerald-400 font-bold">SURVIVED</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-400">Records Recovered:</span>
                <span className="text-neutral-200">4 / 4</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-400">Flashlight Battery:</span>
                <span className="text-yellow-400">{battery}%</span>
              </div>
            </div>

            <button
              onClick={handleRestart}
              className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-black font-mono font-bold rounded tracking-wider transition-all cursor-pointer"
            >
              <RotateCcw className="w-5 h-5" /> RESTART NIGHTMARE
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
