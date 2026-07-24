# Floating tab bar — design

Date: 2026-07-24

## Goal

Replace the default Expo Router tab bar with a floating pill bar matching the
reference screenshot: rounded container detached from the screen edge, icon over
a small label, and a tinted chip behind the active tab.

## Decisions

| Topic | Decision |
| --- | --- |
| Shape | Floating pill, `borderRadius: 999`, 16pt side margins, 16pt above the safe-area inset |
| Active state | Peach chip `#fff0e6` with `#f97316` icon and label (light); `rgba(249,115,22,0.15)` chip with `#fb923c` (dark) |
| Inactive state | No chip, `mutedForeground` icon and label |
| Sizing | Icon 22, label 11/600, chip radius 14, padding 8 vertical / 12 horizontal |
| Overlap | Bar is absolutely positioned above screen content |
| Dark mode | Bar background `#171717`, versus `#ffffff` in light |

The active-tab colors intentionally diverge from the app's lime `primary`; they
come from the reference design.

## Components

- `src/components/floating-tab-bar.tsx` — renders the bar from `BottomTabBarProps`.
  Owns layout and colors only; icons and titles stay declared in the tabs layout.
  Emits `tabPress` / `tabLongPress` so navigation behavior matches the default bar.
- `src/constants/theme.ts` — adds `tabBar`, `tabChip`, `tabChipForeground` tokens
  for both schemes, so the component reads colors through `useThemeColor` like the
  rest of the app.
- `src/app/(tabs)/_layout.tsx` — passes `tabBar={...}`, drops the now-unused tint
  options.

## Width constraint

Four tabs with 11pt labels overflow the pill on a 390pt screen when the third
label reads "Leaderboard" (~392pt needed for ~358pt available). The label is
shortened to "Ranking"; items also use `flexShrink: 1` and the bar caps at
`maxWidth: 100%` so a longer future label degrades by shrinking instead of
clipping.

## Screen padding

Screens are currently empty. Once any of them gets scrollable content, its
container needs `paddingBottom` of roughly 96 so the last item clears the
floating bar.

## Out of scope

- Press animations (no Reanimated involvement).
- Badges, blur background, per-tab custom colors.
