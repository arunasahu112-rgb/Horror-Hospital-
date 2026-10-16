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
  FileText,
  Skull,
  ShieldAlert
} from 'lucide-react';

type GameState = 'title' | 'playing' | 'victory' | 'gameover';

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<HospitalGame | null>(null);

  // Game UI States
  const [gameState, setGameState] = useState<GameState>('title');
  const [recordsCount, setRecordsCount] = useState<number>(0);
  const [totalRecords, setTotalRecords] = useState<number>(4);
  const [recentRecordName, setRecentRecordName] = useState<string | null>(null);
  const [interactPrompt, setInteractPrompt] = useState<string | null>(null);
  const [battery, setBattery] = useState<number>(100);
  const [sanity, setSanity] = useState<number>(100);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isSprinting, setIsSprinting] = useState<boolean>(false);

  // Mobile Joystick
  const joystickTouchId = useRef<number | null>(null);
  const joystickCenter = useRef({ x: 0, y: 0 });
  const [stickPos, setStickPos] = useState({ x: 0, y: 0 });

  // Mobile Camera Look
  const lookTouchId = useRef<number | null>(null);
  const lastLookPos = useRef({ x: 0, y: 0 });

  // Reset mobile controls
  const resetMobileControls = useCallback(() => {
    joystickTouchId.current = null;
    lookTouchId.current = null;
    setStickPos({ x: 0, y: 0 });
    setIsSprinting(false);

    if (gameRef.current) {
      gameRef.current.setJoystickInput(0, 0);
      gameRef.current.setSprint(false);
    }
  }, []);

  // Initialize Game Engine
  useEffect(() => {
    if (!containerRef.current) return;

    const game = new HospitalGame(containerRef.current, {
      onCollectRecord: (id, name, count, total) => {
        setRecordsCount(count);
        setTotalRecords(total);
        setRecentRecordName(name);

        window.setTimeout(() => {
          setRecentRecordName(null);
        }, 4000);
      },

      onInteractPrompt: (prompt) => {
        setInteractPrompt(prompt);
      },

      onVictory: () => {
        resetMobileControls();
        setInteractPrompt(null);
        setGameState('victory');
      },

      // Monster catches the player
      onGameOver: () => {
        resetMobileControls();
        setInteractPrompt(null);
        setGameState('gameover');
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
  }, [resetMobileControls]);

  // Start Game
  const handleStart = () => {
    if (gameRef.current) {
      gameRef.current.startGame();
    }

    setRecordsCount(0);
    setTotalRecords(4);
    setBattery(100);
    setSanity(100);
    setInteractPrompt(null);
    setRecentRecordName(null);
    setIsSprinting(false);
    setStickPos({ x: 0, y: 0 });
    setGameState('playing');
  };

  // Restart Game
  const handleRestart = () => {
    resetMobileControls();

    if (gameRef.current) {
      gameRef.current.restartGame();
    }

    setRecordsCount(0);
    setTotalRecords(4);
    setBattery(100);
    setSanity(100);
    setInteractPrompt(null);
    setRecentRecordName(null);
    setIsSprinting(false);
    setGameState('playing');
  };

  // Audio
  const toggleMute = () => {
    const muted = horrorAudio.toggleMute();
    setIsMuted(muted);
  };

  // Flashlight
  const toggleFlashlight = () => {
    if (gameRef.current && gameState === 'playing') {
      gameRef.current.toggleFlashlight();
    }
  };

  // Interaction
  const handleInteract = () => {
    if (gameRef.current && gameState === 'playing') {
      gameRef.current.interact();
    }
  };

  // Sprint
  const toggleSprint = () => {
    if (gameState !== 'playing') return;

    const next = !isSprinting;
    setIsSprinting(next);

    if (gameRef.current) {
      gameRef.current.setSprint(next);
    }
  };

  // JOYSTICK START
  const handleJoystickTouchStart = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      if (joystickTouchId.current !== null) return;

      const touch = e.changedTouches[0];
      joystickTouchId.current = touch.identifier;

      const rect = e.currentTarget.getBoundingClientRect();

      joystickCenter.current = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      };

      updateJoystick(touch.clientX, touch.clientY);
    },
    []
  );

  // JOYSTICK MOVEMENT
  const updateJoystick = (clientX: number, clientY: number) => {
    const dx = clientX - joystickCenter.current.x;
    const dy = clientY - joystickCenter.current.y;
    const maxRadius = 45;
    const distance = Math.hypot(dx, dy);

    let normX = dx;
    let normY = dy;

    if (distance > maxRadius) {
      normX = (dx / distance) * maxRadius;
      normY = (dy / distance) * maxRadius;
    }

    setStickPos({ x: normX, y: normY });

    if (gameRef.current) {
      gameRef.current.setJoystickInput(
        normX / maxRadius,
        normY / maxRadius
      );
    }
  };

  // JOYSTICK DRAG
  const handleJoystickTouchMove = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];

        if (touch.identifier === joystickTouchId.current) {
          updateJoystick(touch.clientX, touch.clientY);
          break;
        }
      }
    },
    []
  );

  // JOYSTICK RELEASE
  const handleJoystickTouchEnd = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (
          e.changedTouches[i].identifier === joystickTouchId.current
        ) {
          joystickTouchId.current = null;
          setStickPos({ x: 0, y: 0 });

          if (gameRef.current) {
            gameRef.current.setJoystickInput(0, 0);
          }

          break;
        }
      }
    },
    []
  );

  // CAMERA LOOK START
  const handleLookTouchStart = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      if (lookTouchId.current !== null) return;

      const touch = e.changedTouches[0];

      lookTouchId.current = touch.identifier;

      lastLookPos.current = {
        x: touch.clientX,
        y: touch.clientY,
      };
    },
    []
  );

  // CAMERA LOOK MOVEMENT
  const handleLookTouchMove = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];

        if (touch.identifier === lookTouchId.current) {
          const deltaX = touch.clientX - lastLookPos.current.x;
          const deltaY = touch.clientY - lastLookPos.current.y;

          lastLookPos.current = {
            x: touch.clientX,
            y: touch.clientY,
          };

          if (gameRef.current) {
            gameRef.current.addTouchLook(deltaX, deltaY);
          }

          break;
        }
      }
    },
    []
  );

  // CAMERA LOOK RELEASE
  const handleLookTouchEnd = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === lookTouchId.current) {
          lookTouchId.current = null;
          break;
        }
      }
    },
    []
  );

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black select-none font-sans text-neutral-200">

      {/* 3D GAME */}
      <div
        ref={containerRef}
        className="absolute inset-0 w-full h-full z-0 pointer-events-auto"
      />

      {/* DARK HORROR VIGNETTE */}
      <div className="absolute inset-0 pointer-events-none z-10 bg-[radial-gradient(circle_at_center,transparent_40%,rgba(0,0,0,0.85)_100%)]" />

      {/* ================= TITLE SCREEN ================= */}
      {gameState === 'title' && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-between p-6 sm:p-10 bg-black/85 text-center">

          <div className="w-full flex justify-end">
            <button
              onClick={toggleMute}
              className="p-3 bg-neutral-900/80 border border-neutral-700/60 rounded-full text-neutral-300"
              title="Toggle Audio"
            >
              {isMuted
                ? <VolumeX className="w-5 h-5" />
                : <Volume2 className="w-5 h-5 text-emerald-400" />}
            </button>
          </div>

          <div className="max-w-xl flex flex-col items-center my-auto">

            <div className="inline-flex items-center gap-2 px-3 py-1 mb-4 rounded-full border border-red-900/60 bg-red-950/40 text-red-400 text-xs tracking-widest uppercase font-mono">
              <AlertTriangle className="w-3.5 h-3.5" />
              Biohazard Quarantine Sector
            </div>

            <h1 className="text-4xl sm:text-6xl font-black tracking-wider text-neutral-100 font-mono mb-2 uppercase drop-shadow-[0_4px_12px_rgba(255,0,0,0.25)]">
              ABANDONED: <span className="text-emerald-500">HOSPITAL 13</span>
            </h1>

            <p className="text-neutral-400 text-sm sm:text-base leading-relaxed mb-8 max-w-md">
              You awoke trapped in the subterranean wards of Hospital 13.
              Search the decaying rooms for the{' '}
              <span className="text-emerald-400 font-semibold">
                4 Medical Access Records
              </span>{' '}
              to override the North Emergency Gate before your battery runs dry.
              Something is hunting you in the darkness.
            </p>

            <button
              onClick={handleStart}
              className="flex items-center gap-3 px-8 py-4 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-black font-mono font-bold text-lg rounded tracking-wider shadow-[0_0_25px_rgba(16,185,129,0.35)] transition-all"
            >
              <Play className="w-6 h-6 fill-current" />
              ENTER WARD 13
            </button>
          </div>

          <div className="max-w-xl w-full bg-neutral-950/80 border border-neutral-800 rounded-lg p-4 text-xs text-neutral-400 font-mono flex flex-col sm:flex-row justify-around gap-4 text-left">

            <div>
              <p className="text-emerald-400 font-semibold mb-1 uppercase">Desktop Controls</p>
              <p>WASD / Arrows · Walk</p>
              <p>Mouse · Look around</p>
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

      {/* ================= IN-GAME HUD ================= */}
      {gameState === 'playing' && (
        <div className="absolute inset-0 z-20 pointer-events-none flex flex-col justify-between p-4 sm:p-6">

          {/* TOP STATUS BAR */}
          <header className="flex justify-between items-start gap-3 w-full">

            <div className="flex flex-col gap-1">

              <div className="flex items-center gap-2 bg-neutral-900/90 border border-neutral-700/80 px-3 py-1.5 rounded text-xs font-mono text-neutral-300">
                <Compass className="w-3.5 h-3.5 text-emerald-400" />
                <span>WARD 13 · SUB-LEVEL 2</span>
              </div>

              <div className="flex items-center gap-2 bg-neutral-900/90 border border-neutral-700/80 px-3 py-1 rounded text-xs font-mono">
                <Heart className={`w-3.5 h-3.5 ${sanity < 40 ? 'text-red-500 animate-pulse' : 'text-emerald-400'}`} />
                <span className="text-neutral-300">PULSE:</span>
                <span className={`tabular-nums font-semibold ${sanity < 40 ? 'text-red-400' : 'text-emerald-400'}`}>
                  {Math.round(75 + (100 - sanity) * 0.8)} BPM
                </span>
              </div>

            </div>

            <div className="flex items-center gap-3">

              <div className="flex items-center gap-2 bg-neutral-900/90 border border-neutral-700/80 px-3 py-1.5 rounded text-xs font-mono">
                <Flashlight className={`w-3.5 h-3.5 ${battery < 25 ? 'text-amber-500' : 'text-yellow-300'}`} />
                <span className="text-neutral-400">BATTERY:</span>
                <span className={`tabular-nums font-bold ${battery < 20 ? 'text-red-400' : 'text-neutral-200'}`}>
                  {battery}%
                </span>
              </div>

              <div className="flex items-center gap-2 bg-neutral-900/90 border border-neutral-700/80 px-3 py-1.5 rounded text-xs font-mono">
                <Key className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-neutral-400">RECORDS:</span>
                <span className="text-emerald-400 font-bold tabular-nums">
                  {recordsCount} / {totalRecords}
                </span>
              </div>

              <button
                onClick={toggleMute}
                className="pointer-events-auto p-2 bg-neutral-900/90 border border-neutral-700/80 rounded text-neutral-300"
                title="Mute Audio"
              >
                {isMuted
                  ? <VolumeX className="w-4 h-4" />
                  : <Volume2 className="w-4 h-4 text-emerald-400" />}
              </button>

            </div>
          </header>

          {/* CENTER CROSSHAIR */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">

            <div className="w-1.5 h-1.5 rounded-full bg-neutral-400/60 ring-4 ring-neutral-900/40" />

            {interactPrompt && (
              <div
                onClick={handleInteract}
                className="mt-6 pointer-events-auto px-4 py-2 bg-emerald-950/90 border border-emerald-500/80 rounded shadow-lg text-emerald-200 text-xs sm:text-sm font-mono tracking-wide flex items-center gap-2 cursor-pointer active:scale-95"
              >
                <Hand className="w-4 h-4 text-emerald-400" />
                <span>{interactPrompt}</span>
              </div>
            )}

            {recentRecordName && (
              <div className="mt-4 px-4 py-2 bg-neutral-900/90 border border-emerald-500/50 rounded text-xs font-mono text-emerald-300 flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-400" />
                <span>ACQUIRED: {recentRecordName}</span>
              </div>
            )}

          </div>

          {/* MOBILE CAMERA LOOK AREA */}
          <div
            className="absolute top-20 right-0 bottom-24 w-1/2 pointer-events-auto z-10 touch-none"
            onTouchStart={handleLookTouchStart}
            onTouchMove={handleLookTouchMove}
            onTouchEnd={handleLookTouchEnd}
            onTouchCancel={handleLookTouchEnd}
          />

          {/* BOTTOM CONTROLS */}
          <footer className="flex justify-between items-end w-full pb-2 z-20">

            {/* JOYSTICK */}
            <div
              className="pointer-events-auto relative w-32 h-32 rounded-full border-2 border-neutral-700/60 bg-neutral-900/60 flex items-center justify-center touch-none select-none"
              onTouchStart={handleJoystickTouchStart}
              onTouchMove={handleJoystickTouchMove}
              onTouchEnd={handleJoystickTouchEnd}
              onTouchCancel={handleJoystickTouchEnd}
            >
              <div
                className="w-12 h-12 rounded-full bg-emerald-500/80 border border-emerald-300 shadow-md"
                style={{
                  transform: `translate(${stickPos.x}px, ${stickPos.y}px)`,
                  transition:
                    stickPos.x === 0 && stickPos.y === 0
                      ? 'transform 0.15s ease-out'
                      : 'none',
                }}
              />

              <span className="absolute bottom-1 text-[9px] font-mono text-neutral-400 uppercase">
                MOVE
              </span>
            </div>

            {/* ACTION BUTTONS */}
            <div className="pointer-events-auto flex items-center gap-3">

              <button
                onClick={toggleSprint}
                className={`p-3.5 rounded-full border ${
                  isSprinting
                    ? 'bg-emerald-600 border-emerald-400 text-black'
                    : 'bg-neutral-900/90 border-neutral-700 text-neutral-300'
                } active:scale-90 transition-transform`}
                title="Sprint"
              >
                <Footprints className="w-5 h-5" />
              </button>

              <button
                onClick={toggleFlashlight}
                className="p-3.5 rounded-full bg-neutral-900/90 border border-neutral-700 text-neutral-300 active:scale-90"
                title="Toggle Flashlight"
              >
                <Flashlight className="w-5 h-5 text-yellow-300" />
              </button>

              <button
                onClick={handleInteract}
                className="p-4 rounded-full bg-emerald-700 border border-emerald-400 text-white font-bold active:scale-90"
                title="Interact / Collect"
              >
                <Hand className="w-6 h-6" />
              </button>

            </div>
          </footer>
        </div>
      )}

      {/* ================= GAME OVER SCREEN ================= */}
      {gameState === 'gameover' && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center p-6 bg-black/95 text-center">

          <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,rgba(127,0,0,0.22),transparent_65%)]" />

          <div className="relative max-w-md w-full p-8 bg-neutral-950 border border-red-800/80 rounded-xl shadow-[0_0_50px_rgba(220,38,38,0.18)] flex flex-col items-center">

            <div className="p-4 bg-red-950/70 rounded-full border border-red-700/80 mb-5 text-red-500">
              <Skull className="w-12 h-12" />
            </div>

            <div className="flex items-center gap-2 text-red-500 text-xs font-mono tracking-[0.3em] mb-3">
              <ShieldAlert className="w-4 h-4" />
              CONTAINMENT FAILURE
            </div>

            <h2 className="text-3xl sm:text-4xl font-black text-red-500 font-mono tracking-wider uppercase mb-3">
              YOU WERE CAUGHT
            </h2>

            <p className="text-neutral-400 text-sm leading-relaxed mb-6 font-mono">
              The creature found you in the darkness. Hospital 13 has claimed another victim.
              Your mission has failed.
            </p>

            <div className="w-full bg-neutral-900 border border-neutral-800 rounded p-4 text-xs font-mono text-left mb-6 space-y-3">

              <div className="flex justify-between gap-4">
                <span className="text-neutral-500">MISSION STATUS</span>
                <span className="text-red-400 font-bold">FAILED</span>
              </div>

              <div className="flex justify-between gap-4">
                <span className="text-neutral-500">RECORDS FOUND</span>
                <span className="text-neutral-200">{recordsCount} / {totalRecords}</span>
              </div>

              <div className="flex justify-between gap-4">
                <span className="text-neutral-500">FLASHLIGHT BATTERY</span>
                <span className="text-yellow-400">{Math.round(battery)}%</span>
              </div>

            </div>

            <button
              onClick={handleRestart}
              className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-red-700 hover:bg-red-600 active:scale-95 text-white font-mono font-bold rounded tracking-wider transition-all"
            >
              <RotateCcw className="w-5 h-5" />
              TRY AGAIN
            </button>

            <button
              onClick={() => {
                resetMobileControls();
                setGameState('title');
              }}
              className="mt-3 w-full flex items-center justify-center gap-2 px-6 py-3 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-300 font-mono rounded transition-all"
            >
              RETURN TO TITLE
            </button>

          </div>
        </div>
      )}

      {/* ================= VICTORY SCREEN ================= */}
      {gameState === 'victory' && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center p-6 bg-black/90 text-center">

          <div className="max-w-md w-full p-8 bg-neutral-950 border border-emerald-500/60 rounded-xl shadow-[0_0_40px_rgba(16,185,129,0.2)] flex flex-col items-center">

            <div className="p-4 bg-emerald-950/80 rounded-full border border-emerald-500/80 mb-4 text-emerald-400">
              <Key className="w-8 h-8" />
            </div>

            <h2 className="text-3xl font-black text-white font-mono tracking-wider uppercase mb-2">
              YOU ESCAPED WARD 13
            </h2>

            <p className="text-neutral-400 text-sm leading-relaxed mb-6 font-mono">
              The heavy security gates hissed open. You made it out into the fog with all 4 classified records intact.
            </p>

            <div className="w-full bg-neutral-900 border border-neutral-800 rounded p-3 text-xs font-mono text-left mb-6 space-y-2">

              <div className="flex justify-between">
                <span className="text-neutral-400">Status:</span>
                <span className="text-emerald-400 font-bold">SURVIVED</span>
              </div>

              <div className="flex justify-between">
                <span className="text-neutral-400">Records Recovered:</span>
                <span className="text-neutral-200">{recordsCount} / {totalRecords}</span>
              </div>

              <div className="flex justify-between">
                <span className="text-neutral-400">Flashlight Battery:</span>
                <span className="text-yellow-400">{Math.round(battery)}%</span>
              </div>

            </div>

            <button
              onClick={handleRestart}
              className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-black font-mono font-bold rounded tracking-wider transition-all"
            >
              <RotateCcw className="w-5 h-5" />
              RESTART NIGHTMARE
            </button>

            <button
              onClick={() => {
                resetMobileControls();
                setGameState('title');
              }}
              className="mt-3 w-full flex items-center justify-center gap-2 px-6 py-3 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-300 font-mono rounded transition-all"
            >
              RETURN TO TITLE
            </button>

          </div>
        </div>
      )}

    </div>
  );
}