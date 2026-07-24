import { DarkTheme, DefaultTheme, type Theme } from "@react-navigation/native";

export const COLORS = {
  light: {
    background: "hsl(0 0% 100%)",
    foreground: "hsl(0 0% 3.9%)",
    card: "hsl(0 0% 100%)",
    popover: "hsl(0 0% 100%)",
    primary: "hsl(83 78% 56%)",
    secondary: "hsl(0 0% 96.1%)",
    muted: "hsl(0 0% 96.1%)",
    accent: "hsl(0 0% 96.1%)",
    destructive: "hsl(0 84.2% 60.2%)",
    border: "hsl(0 0% 89.8%)",
    input: "hsl(0 0% 89.8%)",
    ring: "hsl(83 78% 56%)",
    radius: 10,
  },
  dark: {
    background: "hsl(0 0% 3.9%)",
    foreground: "hsl(0 0% 98%)",
    card: "hsl(0 0% 6.7%)",
    popover: "hsl(0 0% 6.7%)",
    primary: "hsl(83 78% 56%)",
    secondary: "hsl(0 0% 14.9%)",
    muted: "hsl(0 0% 14.9%)",
    accent: "hsl(0 0% 14.9%)",
    destructive: "hsl(0 62.8% 30.6%)",
    border: "hsl(0 0% 14.9%)",
    input: "hsl(0 0% 14.9%)",
    ring: "hsl(83 78% 56%)",
    radius: 10,
  },
};

export const NAV_THEME: { light: Theme; dark: Theme } = {
  light: {
    ...DefaultTheme,
    colors: {
      background: COLORS.light.background,
      border: COLORS.light.border,
      card: COLORS.light.card,
      notification: COLORS.light.destructive,
      primary: COLORS.light.primary,
      text: COLORS.light.foreground,
    },
  },
  dark: {
    ...DarkTheme,
    colors: {
      background: COLORS.dark.background,
      border: COLORS.dark.border,
      card: COLORS.dark.card,
      notification: COLORS.dark.destructive,
      primary: COLORS.dark.primary,
      text: COLORS.dark.foreground,
    },
  },
};
