# Chall

Self-challenging & world-challenging tracker (e.g. bench press rep contests) with real-time on-device movement recognition and counting.

## Stack

- **React Native + Expo (SDK 54)** — Expo Router, file-based routing
- **NativeWind v4 + Tailwind v3** — styling
- **Convex** — realtime backend (challenges, leaderboards, sync)
- **react-native-vision-camera** — camera frame processors
- **react-native-fast-tflite** — on-device pose model inference (rep detection/counting)

Native modules (vision-camera, fast-tflite) require a custom **dev client** — this app cannot run in Expo Go.

## Project structure

```
src/
  app/          # Expo Router routes only — every file is a route
  screens/      # screen bodies rendered by routes (created as needed)
  components/   # reusable UI (kebab-case, one per file)
  services/     # domain logic (pose detection, rep-counting) — created as needed
  lib/          # Convex client, shared utilities — created as needed
  hooks/        # reusable hooks
  constants/    # theme, app-wide constants
convex/         # Convex backend functions (created by `npx convex dev`)
```

`app/` files must stay routes-only; screen UI and business logic live outside it. See `@/*` alias → `src/*` in `tsconfig.json`.

## Getting started

```bash
corepack enable pnpm   # if pnpm isn't on PATH
pnpm install
npx expo prebuild      # generates ios/ and android/ (gitignored)
npx expo run:ios       # or run:android — builds the dev client
pnpm start             # subsequent runs
```

### Convex

Not yet linked to a deployment. Run once, interactively:

```bash
npx convex dev
```

This logs in, creates the deployment, and scaffolds `convex/` with generated types.

## Scripts

| Script                         | Purpose              |
| ------------------------------ | -------------------- |
| `pnpm start`                   | Start Metro          |
| `pnpm ios` / `android` / `web` | Start on a platform  |
| `pnpm lint`                    | ESLint (`expo lint`) |
| `pnpm typecheck`               | `tsc --noEmit`       |
| `pnpm format`                  | Prettier write       |

## Git workflow

- **Commits**: [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `chore:`, …), enforced by commitlint on `commit-msg`.
- **Pre-commit**: husky + lint-staged run ESLint and Prettier on staged files.
- Native folders (`ios/`, `android/`) are never committed — always regenerated via `expo prebuild`.

CLERK_FRONTEND_API_URL=https://splendid-flounder-11.clerk.accounts.dev
