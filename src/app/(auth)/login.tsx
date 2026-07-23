import { Link, router } from "expo-router";
import {
  AppleLogo,
  CaretLeft,
  Check,
  Envelope,
  Eye,
  EyeSlash,
  FacebookLogo,
  GoogleLogo,
  Lock,
} from "phosphor-react-native";
import { useState, type ReactNode } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { useThemeColor } from "@/hooks/use-theme-color";
import { authClient } from "@/lib/auth-client";

export default function LoginScreen() {
  const mutedForeground = useThemeColor({}, "mutedForeground");
  const foreground = useThemeColor({}, "foreground");
  const primaryForeground = useThemeColor({}, "primaryForeground");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = email.trim().length > 0 && password.length > 0 && !loading;

  const handleLogin = async () => {
    if (!canSubmit) return;
    setError(null);
    setLoading(true);
    const { error: signInError } = await authClient.signIn.email({
      email: email.trim(),
      password,
      rememberMe,
    });
    setLoading(false);
    if (signInError) {
      setError(signInError.message ?? "Could not sign you in.");
      return;
    }
    router.replace("/(tabs)");
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
          {error ? (
            <Text className="font-sans text-sm text-destructive">{error}</Text>
          ) : null}
        </View>

        <View className="flex-row items-center justify-between">
          <Pressable
            onPress={() => setRememberMe((v) => !v)}
            className="flex-row items-center gap-2"
          >
            <View
              className={`h-5 w-5 items-center justify-center rounded-md border ${
                rememberMe ? "border-primary bg-primary" : "border-border"
              }`}
            >
              {rememberMe ? (
                <Check size={14} color={primaryForeground} weight="bold" />
              ) : null}
            </View>
            <Text className="font-sans text-sm text-muted-foreground">
              Remember me
            </Text>
          </Pressable>
          <Pressable>
            <Text className="font-sans-medium text-sm text-primary">
              Forgot password?
            </Text>
          </Pressable>
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
          <SocialButton icon={<GoogleLogo size={22} color={foreground} />} />
          <SocialButton icon={<AppleLogo size={22} color={foreground} />} />
          <SocialButton icon={<FacebookLogo size={22} color={foreground} />} />
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

function SocialButton({ icon }: { icon: ReactNode }) {
  return (
    <Pressable className="h-14 w-14 items-center justify-center rounded-full border border-border bg-muted active:opacity-80">
      {icon}
    </Pressable>
  );
}
