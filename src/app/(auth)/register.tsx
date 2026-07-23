import { Link, router } from "expo-router";
import {
  AppleLogo,
  CaretLeft,
  Envelope,
  Eye,
  EyeSlash,
  FacebookLogo,
  GoogleLogo,
  Lock,
  User,
} from "phosphor-react-native";
import { useState, type ReactNode } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { useThemeColor } from "@/hooks/use-theme-color";
import { authClient } from "@/lib/auth-client";

export default function RegisterScreen() {
  const mutedForeground = useThemeColor({}, "mutedForeground");
  const foreground = useThemeColor({}, "foreground");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const passwordsMatch = password.length > 0 && password === confirmPassword;
  const canSubmit =
    name.trim().length > 0 &&
    email.trim().length > 0 &&
    password.length >= 8 &&
    passwordsMatch &&
    !loading;

  const handleRegister = async () => {
    if (!canSubmit) return;
    setError(null);
    setLoading(true);
    const { error: signUpError } = await authClient.signUp.email({
      email: email.trim(),
      password,
      name: name.trim(),
    });
    setLoading(false);
    if (signUpError) {
      setError(signUpError.message ?? "Could not create your account.");
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
            CREATE ACCOUNT
          </Text>
          <Text className="font-sans text-base text-muted-foreground">
            Set up your profile to start logging reps and joining challenges.
          </Text>
        </View>

        <View className="gap-4">
          <TextField
            placeholder="User name"
            autoCapitalize="words"
            textContentType="name"
            value={name}
            onChangeText={setName}
            icon={<User size={20} color={mutedForeground} />}
          />
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
            textContentType="newPassword"
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
          <TextField
            placeholder="Confirm password"
            secureTextEntry={!showPassword}
            textContentType="newPassword"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            icon={<Lock size={20} color={mutedForeground} />}
          />
          {error ? (
            <Text className="font-sans text-sm text-destructive">{error}</Text>
          ) : null}
        </View>

        <Button
          label="Create Account"
          onPress={handleRegister}
          loading={loading}
          disabled={!canSubmit}
        />

        <View className="flex-row items-center gap-3">
          <View className="h-px flex-1 bg-border" />
          <Text className="font-sans text-sm text-muted-foreground">
            or sign up with
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
            Already have an account?
          </Text>
          <Link href="/(auth)/login">
            <Text className="font-sans-semibold text-primary">Log in</Text>
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
