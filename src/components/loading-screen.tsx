import { Image } from "expo-image";
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { COLORS } from "@/lib/theme";

// Logo blanc, sur le fond sombre de l'app.
const MARK = require("../../assets/images/chall-mark-light.png");

/**
 * Écran de chargement animé au logo Chall.
 * Pulse doux (scale + opacité) pendant le chargement fonts / auth.
 */
export function LoadingScreen() {
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
    <View style={[styles.container, { backgroundColor: COLORS.background }]}>
      <Animated.View style={animatedStyle}>
        <Image
          source={MARK}
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
