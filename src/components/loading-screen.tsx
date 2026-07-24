import { Image } from "expo-image";
import { useEffect } from "react";
import { StyleSheet, View, useColorScheme } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { COLORS } from "@/lib/theme";

const MARK_DARK = require("../../assets/images/chall-mark-dark.png"); // logo noir → fond clair
const MARK_LIGHT = require("../../assets/images/chall-mark-light.png"); // logo blanc → fond sombre

/**
 * Écran de chargement animé au logo Chall.
 * Pulse doux (scale + opacité) pendant le chargement fonts / auth.
 */
export function LoadingScreen() {
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  const bg = isDark ? COLORS.dark.background : COLORS.light.background;
  const mark = isDark ? MARK_LIGHT : MARK_DARK;

  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 900, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 900, easing: Easing.in(Easing.quad) }),
      ),
      -1,
      false,
    );
  }, [progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: 0.55 + progress.value * 0.45,
    transform: [{ scale: 0.94 + progress.value * 0.06 }],
  }));

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <Animated.View style={animatedStyle}>
        <Image
          source={mark}
          style={styles.logo}
          contentFit="contain"
          transition={200}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  logo: {
    width: 160,
    height: 160,
  },
});
