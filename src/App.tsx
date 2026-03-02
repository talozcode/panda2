import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type PandaReaction =
  | 'wiggle'
  | 'jump'
  | 'spin'
  | 'roll'
  | 'blink-fast'
  | 'surprised'
  | 'heart-pop'
  | 'split';

type Panda = {
  id: number;
  x: number;
  y: number;
  size: number;
  drift: number;
  sway: number;
  phase: number;
  speed: number;
  vx: number;
  vy: number;
  hue: number;
  glowUntil: number;
  moodUntil: number;
  reaction: PandaReaction | null;
  reactionUntil: number;
};

const INITIAL_COUNT = 22;
const MAX_PANDAS = 160;
const DOUBLE_TAP_MS = 320;
const LONG_PRESS_MS = 450;
const CHAOS_TAPS = 7;

const REACTIONS: PandaReaction[] = [
  'wiggle',
  'jump',
  'spin',
  'roll',
  'blink-fast',
  'surprised',
  'heart-pop',
  'split'
];

const rand = (min: number, max: number) => Math.random() * (max - min) + min;
const pick = <T,>(values: T[]) => values[Math.floor(Math.random() * values.length)];

function createPanda(id: number, x?: number, y?: number, sizeOverride?: number): Panda {
  return {
    id,
    x: x ?? rand(-8, 108),
    y: y ?? rand(5, 94),
    size: sizeOverride ?? rand(52, 124),
    drift: rand(-8, 8),
    sway: rand(4, 16),
    phase: rand(0, Math.PI * 2),
    speed: rand(3.5, 8),
    vx: rand(-0.22, 0.22) || 0.12,
    vy: rand(-0.22, 0.22) || -0.12,
    hue: rand(-6, 10),
    glowUntil: 0,
    moodUntil: 0,
    reaction: null,
    reactionUntil: 0
  };
}

function useAudio() {
  const ctxRef = useRef<AudioContext | null>(null);

  const ensure = useCallback(async () => {
    if (!ctxRef.current) {
      ctxRef.current = new AudioContext();
    }
    if (ctxRef.current.state === 'suspended') {
      await ctxRef.current.resume();
    }
    return ctxRef.current;
  }, []);

  const play = useCallback(
    async (kind: 'chirp' | 'ouch') => {
      const ctx = await ensure();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      const start = ctx.currentTime;

      if (kind === 'chirp') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(620, start);
        osc.frequency.exponentialRampToValueAtTime(980, start + 0.08);
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(0.1, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.16);
      } else {
        osc.type = 'square';
        osc.frequency.setValueAtTime(420, start);
        osc.frequency.exponentialRampToValueAtTime(180, start + 0.12);
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(0.09, start + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.19);
      }

      osc.start(start);
      osc.stop(start + 0.2);
    },
    [ensure]
  );

  return { ensure, play };
}

export default function App() {
  const nextIdRef = useRef(INITIAL_COUNT + 1);
  const allocId = useCallback(() => {
    const id = nextIdRef.current;
    nextIdRef.current += 1;
    return id;
  }, []);

  const [pandas, setPandas] = useState<Panda[]>(() =>
    Array.from({ length: INITIAL_COUNT }, (_, i) => createPanda(i + 1))
  );
  const [chaosUntil, setChaosUntil] = useState(0);
  const [burstAt, setBurstAt] = useState<number | null>(null);
  const [, setAddTapCount] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [clock, setClock] = useState(() => Date.now());
  const pressTimer = useRef<number | null>(null);
  const pointerMoved = useRef(false);
  const lastTap = useRef<{ id: number; at: number } | null>(null);
  const sparkles = useMemo(
    () =>
      Array.from({ length: 16 }, (_, i) => ({
        id: i,
        left: rand(0, 100),
        top: rand(0, 100),
        delay: rand(0, 8)
      })),
    []
  );

  const { ensure, play } = useAudio();

  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 120);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduceMotion(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);


  useEffect(() => {
    if (reduceMotion) return;

    const timer = window.setInterval(() => {
      const width = Math.max(window.innerWidth, 1);
      const height = Math.max(window.innerHeight, 1);
      const chaosBoost = chaosUntil > Date.now() ? 1.45 : 1;

      setPandas((prev) =>
        prev.map((p) => {
          const edgeX = Math.min(8, (p.size / width) * 50 + 0.4);
          const edgeY = Math.min(9, (p.size / height) * 50 + 0.4);

          const minX = edgeX;
          const maxX = 100 - edgeX;
          const minY = edgeY;
          const maxY = 100 - edgeY;

          let nextX = p.x + p.vx * chaosBoost;
          let nextY = p.y + p.vy * chaosBoost;
          let nextVx = p.vx;
          let nextVy = p.vy;

          if (nextX <= minX || nextX >= maxX) {
            nextVx = -nextVx;
            nextX = Math.min(maxX, Math.max(minX, nextX));
          }

          if (nextY <= minY || nextY >= maxY) {
            nextVy = -nextVy;
            nextY = Math.min(maxY, Math.max(minY, nextY));
          }

          return {
            ...p,
            x: nextX,
            y: nextY,
            vx: nextVx,
            vy: nextVy
          };
        })
      );
    }, 34);

    return () => window.clearInterval(timer);
  }, [chaosUntil, reduceMotion]);

  useEffect(() => {
    const unlock = () => {
      void ensure();
      window.removeEventListener('pointerdown', unlock);
    };
    window.addEventListener('pointerdown', unlock, { once: true });
    return () => window.removeEventListener('pointerdown', unlock);
  }, [ensure]);

  const spawnAtPoint = useCallback(
    (cx: number, cy: number, giant = false) => {
      setPandas((prev) => {
        if (prev.length >= MAX_PANDAS) return prev;
        const rect = document.body.getBoundingClientRect();
        const x = (cx / rect.width) * 100;
        const y = (cy / rect.height) * 100;
        const panda = createPanda(allocId(), x, y, giant ? 180 : undefined);
        panda.reaction = 'jump';
        panda.reactionUntil = Date.now() + 900;
        return [...prev, panda];
      });
    },
    [allocId]
  );

  const triggerReaction = useCallback(
    (id: number) => {
      setPandas((prev) => {
        const target = prev.find((p) => p.id === id);
        if (!target) return prev;
        const reaction = pick(REACTIONS);
        const stamp = Date.now();

        let next = prev.map((p) =>
          p.id === id
            ? {
                ...p,
                glowUntil: stamp + 1000,
                moodUntil: stamp + 650,
                reaction,
                reactionUntil: stamp + 900
              }
            : p
        );

        if (reaction === 'split' && next.length < MAX_PANDAS) {
          const count = Math.min(4, MAX_PANDAS - next.length);
          const minis = Array.from({ length: count }, () =>
            createPanda(allocId(), target.x + rand(-4, 4), target.y + rand(-4, 4), rand(30, 52))
          ).map((p) => ({ ...p, reaction: 'jump' as PandaReaction, reactionUntil: stamp + 650 }));
          next = [...next, ...minis];
        }

        return next;
      });
    },
    [allocId]
  );

  const addPandas = useCallback(() => {
    const amount = Math.floor(rand(4, 9));
    const stamp = Date.now();

    setPandas((prev) => {
      if (prev.length >= MAX_PANDAS) return prev;
      const count = Math.min(amount, MAX_PANDAS - prev.length);
      const newcomers = Array.from({ length: count }, () => createPanda(allocId()));
      return [...prev, ...newcomers];
    });

    setBurstAt(stamp);
    setAddTapCount((t) => {
      const next = t + 1;
      if (next % CHAOS_TAPS === 0) {
        setChaosUntil(Date.now() + 5500);
      }
      return next;
    });
  }, [allocId]);

  const onPandaTap = useCallback(
    (id: number) => {
      const stamp = Date.now();
      const last = lastTap.current;
      const isDouble = Boolean(last && last.id === id && stamp - last.at < DOUBLE_TAP_MS);
      lastTap.current = { id, at: stamp };
      void play(isDouble ? 'ouch' : 'chirp');
      triggerReaction(id);
    },
    [play, triggerReaction]
  );

  const clearLongPress = () => {
    if (pressTimer.current) {
      window.clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };

  const pointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    pointerMoved.current = false;
    pressTimer.current = window.setTimeout(() => {
      spawnAtPoint(event.clientX, event.clientY, true);
      pressTimer.current = null;
    }, LONG_PRESS_MS);
  };

  const pointerMove = () => {
    pointerMoved.current = true;
    clearLongPress();
  };

  const pointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!pressTimer.current) return;
    clearLongPress();
    if (!pointerMoved.current && (event.target as HTMLElement).dataset.panda !== 'true') {
      spawnAtPoint(event.clientX, event.clientY);
    }
  };

  const isChaos = chaosUntil > clock;

  return (
    <main
      className={`scene ${isChaos ? 'chaos' : ''}`}
      onPointerDown={pointerDown}
      onPointerMove={pointerMove}
      onPointerUp={pointerUp}
      onPointerCancel={clearLongPress}
      onPointerLeave={clearLongPress}
    >
      <div className="aurora" />
      <div className="sparkles" aria-hidden="true">
        {sparkles.map((s) => (
          <span key={s.id} style={{ left: `${s.left}%`, top: `${s.top}%`, animationDelay: `${s.delay}s` }} />
        ))}
      </div>

      {pandas.map((panda) => {
        const reacting = panda.reactionUntil > clock;
        const glowing = panda.glowUntil > clock;
        const mood = panda.moodUntil > clock;

        return (
          <button
            key={panda.id}
            data-panda="true"
            className={`panda ${glowing ? 'glow' : ''} ${reacting ? `react-${panda.reaction}` : ''} ${reduceMotion ? 'reduced' : ''} ${mood ? 'mood' : ''}`}
            style={
              {
                '--x': `${panda.x}%`,
                '--y': `${panda.y}%`,
                '--size': `${panda.size}px`,
                '--phase': `${panda.phase}s`,
                '--speed': `${panda.speed}s`,
                '--drift': `${panda.drift}px`,
                '--sway': `${panda.sway}px`,
                '--hue': `${panda.hue}deg`
              } as React.CSSProperties
            }
            onClick={(event) => {
              event.stopPropagation();
              onPandaTap(panda.id);
            }}
            aria-label="Tap panda"
          >
            <span className="ears" />
            <span className="face" />
            <span className="eye left" />
            <span className="eye right" />
            <span className="nose" />
            <span className="blush left" />
            <span className="blush right" />
            <span className="heart" aria-hidden="true">
              💖
            </span>
          </button>
        );
      })}

      <button className={`add-btn ${burstAt && clock - burstAt < 500 ? 'burst' : ''}`} onClick={addPandas}>
        More Pandas
      </button>
      {isChaos && <div className="chaos-banner">Maximum Panda Mode!</div>}
    </main>
  );
}
