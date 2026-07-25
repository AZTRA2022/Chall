import { useSignIn, useSSO } from "@clerk/expo";
import { Link, router } from "expo-router";
import {
  Envelope,
  Eye,
  EyeSlash,
  GithubLogo,
  GoogleLogo,
  Lock,
} from "phosphor-react-native";
import { useState, type ReactNode } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { useThemeColor } from "@/hooks/use-theme-color";
import { clerkErrorMessage } from "@/lib/clerk-errors";
import { fieldErrors, loginSchema } from "@/lib/validations/auth";

export default function LoginScreen() {
  const mutedForeground = useThemeColor({}, "mutedForeground");
  const foreground = useThemeColor({}, "foreground");

  const { signIn } = useSignIn();
  const { startSSOFlow } = useSSO();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const canSubmit = email.trim().length > 0 && password.length > 0 && !loading;

  const handleSocialLogin = async (strategy: "oauth_google" | "oauth_github") => {
    setError(null);
    try {
      const { createdSessionId, setActive } = await startSSOFlow({ strategy });
      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId });
        router.replace("/(tabs)");
      }
    } catch (err) {
      setError(clerkErrorMessage(err));
    }
  };

  const handleLogin = async () => {
    if (!canSubmit || !signIn) return;
    setError(null);
    setErrors({});

    const parsed = loginSchema.safeParse({ email: email.trim(), password });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }

    setLoading(true);
    const { error: signInError } = await signIn.password({
      emailAddress: parsed.data.email,
      password: parsed.data.password,
    });
    if (signInError) {
      setLoading(false);
      setError(clerkErrorMessage(signInError));
      return;
    }

    if (signIn.status === "complete") {
      await signIn.finalize({ navigate: () => router.replace("/(tabs)") });
    }
    setLoading(false);
  };

  return (
    <View className="flex-1 bg-background">
      <AppHeader back title="Connexion" />
      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-8 px-6 pb-8 pt-6"
        keyboardShouldPersistTaps="handled"
      >
        <View className="gap-2">
          <Text className="font-display text-display-sm text-foreground">
            CONTENT DE VOUS REVOIR
          </Text>
          <Text className="font-sans text-base text-muted-foreground">
            Connectez-vous pour retrouver vos ressources et vos collections.
          </Text>
        </View>

        <View className="gap-4">
          <TextField
            placeholder="Adresse e-mail"
            autoCapitalize="none"
            keyboardType="email-address"
            textContentType="emailAddress"
            value={email}
            onChangeText={setEmail}
            icon={<Envelope size={20} color={mutedForeground} />}
          />
          {errors.email ? (
            <Text className="font-sans text-sm text-destructive">
              {errors.email}
            </Text>
          ) : null}
          <TextField
            placeholder="Mot de passe"
            secureTextEntry={!showPassword}
            textContentType="password"
            value={password}
            onChangeText={setPassword}
            icon={<Lock size={20} color={mutedForeground} />}
            rightAdornment={
              <Pressable onPress={() => setShowPassword((v) => !v)}>
                {showPassword ? (
                  <EyeSlash size={20} color={mutedForeground} />
                ) : (
                  <Eye size={20} color={mutedForeground} />
                )}
              </Pressable>
            }
          />
          {errors.password ? (
            <Text className="font-sans text-sm text-destructive">
              {errors.password}
            </Text>
          ) : null}
          {error ? (
            <Text className="font-sans text-sm text-destructive">{error}</Text>
          ) : null}
        </View>

        <View className="flex-row items-center justify-end">
          <Link href="/(auth)/forgot-password">
            <Text className="font-sans-medium text-sm text-primary-ink">
              Mot de passe oublié ?
            </Text>
          </Link>
        </View>

        <Button
          label="Se connecter"
          onPress={handleLogin}
          loading={loading}
          disabled={!canSubmit}
        />

        <View className="flex-row items-center gap-3">
          <View className="h-px flex-1 bg-border" />
          <Text className="font-sans text-sm text-muted-foreground">
            ou se connecter avec
          </Text>
          <View className="h-px flex-1 bg-border" />
        </View>

        <View className="flex-row justify-center gap-4">
          <SocialButton
            icon={<GoogleLogo size={22} color={foreground} />}
            onPress={() => handleSocialLogin("oauth_google")}
          />
          <SocialButton
            icon={<GithubLogo size={22} color={foreground} />}
            onPress={() => handleSocialLogin("oauth_github")}
          />
        </View>

        <View className="flex-row justify-center gap-1">
          <Text className="font-sans text-muted-foreground">
            Vous n&apos;avez pas de compte ?
          </Text>
          <Link href="/(auth)/register">
            <Text className="font-sans-semibold text-primary-ink">Créer un compte</Text>
          </Link>
        </View>
      </ScrollView>
    </View>
  );
}

function SocialButton({
  icon,
  onPress,
}: {
  icon: ReactNode;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="h-14 w-14 items-center justify-center rounded-full border border-border bg-muted active:opacity-80"
    >
      {icon}
    </Pressable>
  );
}
