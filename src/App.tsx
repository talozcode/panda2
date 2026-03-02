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
  const [pandas, setPandas] = useState<Panda[]>(() =>
    Array.from({ length: INITIAL_COUNT }, (_, i) => createPanda(i + 1))
  );
  const [nextId, setNextId] = useState(INITIAL_COUNT + 1);
  const [chaosUntil, setChaosUntil] = useState(0);
  const [burstAt, setBurstAt] = useState<number | null>(null);
  const [, setAddTapCount] = useState(0)
  const [reduceMotion, setReduceMotion] = useState(false);
  const pressTimer = useRef<number | null>(null);
  const pointerMoved = useRef(false);
  const lastTap = useRef<{ id: number; at: number } | null>(null);

  const { ensure, play } = useAudio();

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduceMotion(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    const unlock = () => {
      void ensure();
      window.removeEventListener('pointerdown', unlock);
    };
    window.addEventListener('pointerdown', unlock, { once: true });
    return () => window.removeEventListener('pointerdown', unlock);
  }, [ensure]);

  const now = Date.now();
  const isChaos = chaosUntil > now;

  const spawnAtPoint = useCallback((cx: number, cy: number, giant = false) => {
    setPandas((prev) => {
      if (prev.length >= MAX_PANDAS) return prev;
      const rect = document.body.getBoundingClientRect();
      const x = (cx / rect.width) * 100;
      const y = (cy / rect.height) * 100;
      const panda = createPanda(nextId, x, y, giant ? 180 : undefined);
      panda.reaction = 'jump';
      panda.reactionUntil = Date.now() + 900;
      return [...prev, panda];
    });
    setNextId((id) => id + 1);
  }, [nextId]);

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
          const minis = Array.from({ length: Math.min(4, MAX_PANDAS - next.length) }, (_, i) =>
            createPanda(
              nextId + i,
              target.x + rand(-4, 4),
              target.y + rand(-4, 4),
              rand(30, 52)
            )
          ).map((p) => ({ ...p, reaction: 'jump' as PandaReaction, reactionUntil: stamp + 650 }));
          next = [...next, ...minis];
          setNextId((v) => v + minis.length);
        }
        return next;
      });
    },
    [nextId]
  );

  const addPandas = useCallback(() => {
    const amount = Math.floor(rand(4, 9));
    const stamp = Date.now();
    setPandas((prev) => {
      if (prev.length >= MAX_PANDAS) return prev;
      const count = Math.min(amount, MAX_PANDAS - prev.length);
      const newcomers = Array.from({ length: count }, (_, i) => createPanda(nextId + i));
      return [...prev, ...newcomers];
    });
    setNextId((id) => id + amount);
    setBurstAt(stamp);
    setAddTapCount((t) => {
      const next = t + 1;
      if (next % CHAOS_TAPS === 0) {
        setChaosUntil(Date.now() + 5500);
      }
      return next;
    });
  }, [nextId]);

  const onPandaTap = useCallback(
    (id: number) => {
      const stamp = Date.now();
      const last = lastTap.current;
      const isDouble = last && last.id === id && stamp - last.at < DOUBLE_TAP_MS;
      lastTap.current = { id, at: stamp };
      void play(isDouble ? 'ouch' : 'chirp');
      triggerReaction(id);
    },
    [play, triggerReaction]
  );

  const pointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    pointerMoved.current = false;
    pressTimer.current = window.setTimeout(() => {
      spawnAtPoint(event.clientX, event.clientY, true);
      pressTimer.current = null;
    }, LONG_PRESS_MS);
  };

  const pointerMove = () => {
    pointerMoved.current = true;
    if (pressTimer.current) {
      window.clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };

  const pointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (pressTimer.current) {
      window.clearTimeout(pressTimer.current);
      pressTimer.current = null;
      if (!pointerMoved.current && (event.target as HTMLElement).dataset.panda !== 'true') {
        spawnAtPoint(event.clientX, event.clientY);
      }
    }
  };

  const deco = useMemo(() => Array.from({ length: 16 }, (_, i) => i), []);

  return (
    <main className={`scene ${isChaos ? 'chaos' : ''}`} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp}>
      <div className="aurora" />
      <div className="sparkles" aria-hidden="true">
        {deco.map((i) => (
          <span key={i} style={{ left: `${rand(0, 100)}%`, top: `${rand(0, 100)}%`, animationDelay: `${rand(0, 8)}s` }} />
        ))}
      </div>

      {pandas.map((panda) => {
        const reacting = panda.reactionUntil > now;
        const glowing = panda.glowUntil > now;
        const mood = panda.moodUntil > now;
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

      <button className={`add-btn ${burstAt && Date.now() - burstAt < 500 ? 'burst' : ''}`} onClick={addPandas}>
        More Pandas
      </button>
      {isChaos && <div className="chaos-banner">Maximum Panda Mode!</div>}
    </main>
  );
}
