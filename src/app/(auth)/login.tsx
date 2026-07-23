import { useSignIn, useSSO } from "@clerk/expo";
import { Link, router } from "expo-router";
import {
  CaretLeft,
  Envelope,
  Eye,
  EyeSlash,
  GithubLogo,
  GoogleLogo,
  Lock,
} from "phosphor-react-native";
import { useState, type ReactNode } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { useThemeColor } from "@/hooks/use-theme-color";
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
      setError(err instanceof Error ? err.message : "Could not sign in.");
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
      setError(signInError.message ?? "Could not sign you in.");
      return;
    }

    if (signIn.status === "complete") {
      await signIn.finalize({ navigate: () => router.replace("/(tabs)") });
    }
    setLoading(false);
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-8 px-6 pb-8 pt-2"
        keyboardShouldPersistTaps="handled"
      >
        <Pressable
          onPress={() => router.back()}
          className="h-11 w-11 items-center justify-center rounded-full bg-muted"
        >
          <CaretLeft size={20} color={foreground} weight="bold" />
        </Pressable>

        <View className="gap-2">
          <Text className="font-display text-display-sm text-foreground">
            WELCOME BACK
          </Text>
          <Text className="font-sans text-base text-muted-foreground">
            Log in to keep your streak going and jump back into your challenges.
          </Text>
        </View>

        <View className="gap-4">
          <TextField
            placeholder="Email"
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
            placeholder="Password"
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
            <Text className="font-sans-medium text-sm text-primary">
              Forgot password?
            </Text>
          </Link>
        </View>

        <Button
          label="Log In"
          onPress={handleLogin}
          loading={loading}
          disabled={!canSubmit}
        />

        <View className="flex-row items-center gap-3">
          <View className="h-px flex-1 bg-border" />
          <Text className="font-sans text-sm text-muted-foreground">
            or log in with
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
            Don&apos;t have an account?
          </Text>
          <Link href="/(auth)/register">
            <Text className="font-sans-semibold text-primary">Sign up</Text>
          </Link>
        </View>
      </ScrollView>
    </SafeAreaView>
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
