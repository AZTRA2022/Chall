/**
 * L'app est en thème sombre uniquement et ne suit pas le réglage du système.
 *
 * Ce hook existe encore pour que les composants qui l'appellent n'aient pas à
 * connaître cette décision. Pour rétablir le suivi du système, il faut ici
 * réexporter `useColorScheme` de `react-native`, rétablir une variante claire
 * dans `src/constants/palette.ts` et un bloc `:root` clair dans
 * `src/global.css`, et retirer le `colorScheme.set("dark")` de `src/app/_layout.tsx`.
 */
export function useColorScheme(): "dark" {
  return "dark";
}
