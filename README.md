# Panda Flood

A single-screen, mobile-first interactive panda toy built with React + Vite + TypeScript.

## Features

- Instant panda-filled scene on load
- Panda tap reactions + synthesized sound effects (chirp / ouch on fast double-tap)
- Glow feedback for clicked pandas
- Tap empty space to spawn panda at touch point
- Long-press to drop in a giant panda
- "More Pandas" chaos button with periodic Maximum Panda Mode
- Reduced-motion support
- Production-ready static build + lightweight Node server (`/health`, `/healthz`)

## Local development

```bash
npm install
npm run dev
```

Open `http://localhost:5173`.

## Production build + local prod run

```bash
npm run build
PORT=8080 npm run start
```

## Fly.io deploy

```bash
fly launch --no-deploy
fly deploy
```

The app includes `Dockerfile` + `fly.toml` with HTTP health checks against `/healthz`.

## Troubleshooting

- **No sound at first load**: audio contexts require user interaction. Tap once to unlock audio.
- **No `dist` folder in production**: run `npm run build` before `npm run start`.
- **Performance issues on older devices**: pandas are capped and reduced-motion is respected; enable reduced-motion in OS accessibility settings for lighter effects.
