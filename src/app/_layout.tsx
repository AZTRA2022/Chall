import { ClerkProvider, useAuth } from "@clerk/expo";
import { tokenCache } from "@clerk/expo/token-cache";
import { BebasNeue_400Regular } from "@expo-google-fonts/bebas-neue";
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";
import {
  JetBrainsMono_400Regular,
  JetBrainsMono_700Bold,
} from "@expo-google-fonts/jetbrains-mono";
import { ThemeProvider } from "@react-navigation/native";
import { PortalHost } from "@rn-primitives/portal";
import { useConvexAuth, useMutation } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { api } from "../../convex/_generated/api";
import { useFonts } from "expo-font";
import * as NavigationBar from "expo-navigation-bar";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { colorScheme } from "nativewind";
import { useEffect } from "react";
import { Platform } from "react-native";
import "react-native-reanimated";
import "../global.css";

import { LoadingScreen } from "@/components/loading-screen";
import { convex } from "@/lib/convex";
import {
  registerForPushNotificationsAsync,
  setupAndroidChannels,
} from "@/lib/notifications";
import { NAV_THEME } from "@/lib/theme";

SplashScreen.preventAutoHideAsync();
SplashScreen.setOptions({ duration: 300, fade: true });

// L'app est en thème sombre uniquement. Les variantes `dark:` de NativeWind
// dépendent de cette classe, pas du réglage système : sans cet appel, elles ne
// s'appliqueraient jamais. Hors composant, pour être posé avant le premier rendu.
colorScheme.set("dark");

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
if (!publishableKey) {
  throw new Error("Add EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY to your .env.local");
}

function RootNavigator() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const savePushToken = useMutation(api.users.savePushToken);

  // Masque la barre de navigation système Android ; elle réapparaît le temps
  // d'un swipe puis se recache, sans décaler le contenu.
  useEffect(() => {
    if (Platform.OS !== "android") return;
    NavigationBar.setVisibilityAsync("hidden")
      .then(() => NavigationBar.setBehaviorAsync("overlay-swipe"))
      .catch((e) => {
        console.warn("[ui] masquage de la barre de navigation échoué", e);
      });
  }, []);

  // Canaux Android dès le démarrage (aucun prompt).
  useEffect(() => {
    setupAndroidChannels().catch((e) => {
      console.warn("[push] création des canaux Android échouée", e);
    });
  }, []);

  // Enregistre le device + sauve le token push une fois connecté (prompt permission).
  useEffect(() => {
    if (!isAuthenticated) return;
    registerForPushNotificationsAsync()
      .then((token) => {
        // null = simulateur, permission refusée ou projectId manquant : déjà loggé.
        if (token) return savePushToken({ token });
      })
      .catch((e) => {
        console.warn("[push] enregistrement du device échoué", e);
      });
  }, [isAuthenticated, savePushToken]);

  NavigationBar.setVisibilityAsync("hidden");
  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <ThemeProvider value={NAV_THEME}>
      <Stack>
        <Stack.Protected guard={!isAuthenticated}>
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        </Stack.Protected>
        <Stack.Protected guard={isAuthenticated}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="resource/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="profile/edit" options={{ headerShown: false }} />
          <Stack.Screen name="profile/blocked" options={{ headerShown: false }} />
          <Stack.Screen name="(mod)/queue" options={{ headerShown: false }} />
          <Stack.Screen
            name="submit"
            options={{ headerShown: false, presentation: "formSheet" }}
          />
        </Stack.Protected>
        {/* Hors des gardes : les documents contractuels doivent être
            consultables avant même la création du compte. */}
        <Stack.Screen name="legal/terms" options={{ headerShown: false }} />
        <Stack.Screen name="legal/privacy" options={{ headerShown: false }} />
      </Stack>
      {/* Contenu clair : le fond est toujours sombre. */}
      <StatusBar style="light" />

      <PortalHost />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    BebasNeue_400Regular,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    JetBrainsMono_400Regular,
    JetBrainsMono_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return <LoadingScreen />;
  }
  NavigationBar.setBehaviorAsync("overlay-swipe");

  return (
    <ClerkProvider publishableKey={publishableKey!} tokenCache={tokenCache}>
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        <RootNavigator />
      </ConvexProviderWithClerk>
    </ClerkProvider>
  );
}
