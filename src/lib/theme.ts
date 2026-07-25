import { DarkTheme, type Theme } from "@react-navigation/native";

import { PALETTE, RADIUS } from "@/constants/palette";

/**
 * Tokens sémantiques consommés par les composants `ui/` et par React Navigation.
 * Thème sombre uniquement : les valeurs viennent de `src/constants/palette.ts`,
 * et les mêmes existent en HSL dans `src/global.css` pour NativeWind.
 */
export const COLORS = {
  background: PALETTE.black,
  foreground: PALETTE.white,
  card: PALETTE.surface,
  popover: PALETTE.surface,
  primary: PALETTE.red,
  primaryInk: PALETTE.redLight,
  secondary: PALETTE.elevated,
  muted: PALETTE.elevated,
  mutedForeground: PALETTE.ash,
  accent: PALETTE.line,
  destructive: PALETTE.redDeep,
  border: PALETTE.line,
  input: PALETTE.line,
  ring: PALETTE.red,
  radius: RADIUS,
};

export const NAV_THEME: Theme = {
  ...DarkTheme,
  colors: {
    background: COLORS.background,
    border: COLORS.border,
    card: COLORS.card,
    notification: COLORS.primary,
    primary: COLORS.primary,
    text: COLORS.foreground,
  },
};
