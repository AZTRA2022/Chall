import { Link } from "expo-router";
import { Barbell } from "phosphor-react-native";
import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/button";
import { useThemeColor } from "@/hooks/use-theme-color";

export default function OnboardingScreen() {
  const primary = useThemeColor({}, "primary");

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 items-center justify-center">
        <View className="h-56 w-56 items-center justify-center rounded-full bg-primary/10">
          <View className="h-40 w-40 items-center justify-center rounded-full bg-primary/20">
            <Barbell size={72} color={primary} weight="fill" />
          </View>
        </View>
      </View>

      <View className="gap-8 px-6 pb-8">
        <View className="gap-3">
          <Text className="font-display text-display-lg text-foreground">
            CHALLENGE{"\n"}YOURSELF.{"\n"}CHALLENGE THE{"\n"}WORLD.
          </Text>
          <Text className="font-sans text-base leading-6 text-muted-foreground">
            Real-time rep counting powered by on-device motion tracking. Beat
            your record, then beat everyone else&apos;s.
          </Text>
        </View>

        <View className="gap-3">
          <Link href="/(auth)/register" asChild>
            <Button label="Get Started" variant="primary" />
          </Link>
          <Link href="/(auth)/login" asChild>
            <Button label="I already have an account" variant="outline" />
          </Link>
        </View>
      </View>
    </SafeAreaView>
  );
}
