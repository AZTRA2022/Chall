import { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { cn } from "@/lib/utils";

/**
 * Bloc de chargement.
 *
 * Pulsation d'opacité plutôt que balayage lumineux : sur un fond presque noir,
 * un gradient qui traverse se voit à peine et coûte une couche de rendu par
 * élément. La pulsation lit mieux et tient sur un simple `View`.
 *
 * `useReducedMotion` coupe l'animation quand le système le demande — le bloc
 * reste alors visible, simplement fixe.
 */
export function Skeleton({ className }: { className?: string }) {
  const reducedMotion = useReducedMotion();
  const progress = useSharedValue(0);

  useEffect(() => {
    if (reducedMotion) return;
    progress.value = withRepeat(
      withTiming(1, { duration: 850, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [progress, reducedMotion]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: 0.4 + progress.value * 0.35,
  }));

  return (
    <Animated.View
      style={animatedStyle}
      className={cn("rounded-md bg-secondary", className)}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
}

/** Groupe de blocs, pour composer un gabarit sans répéter les marges. */
export function SkeletonGroup({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <View className={cn("gap-2", className)}>{children}</View>;
}
