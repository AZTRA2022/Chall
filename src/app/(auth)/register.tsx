import { useSignUp, useSSO } from "@clerk/expo";
import { router } from "expo-router";
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
import { fieldErrors, registerSchema } from "@/lib/validations/auth";

export default function RegisterScreen() {
  const mutedForeground = useThemeColor({}, "mutedForeground");
  const foreground = useThemeColor({}, "foreground");

  const { signUp } = useSignUp();
  const { startSSOFlow } = useSSO();

  const [step, setStep] = useState<"form" | "verify">("form");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [code, setCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const canSubmit =
    email.trim().length > 0 &&
    password.length > 0 &&
    confirmPassword.length > 0 &&
    !loading;

  const handleSocialSignUp = async (strategy: "oauth_google" | "oauth_github") => {
    setError(null);
    try {
      const { createdSessionId, setActive } = await startSSOFlow({ strategy });
      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId });
        router.replace("/(tabs)");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign up.");
    }
  };

  const handleRegister = async () => {
    if (!canSubmit || !signUp) return;
    setError(null);
    setErrors({});

    const parsed = registerSchema.safeParse({
      email: email.trim(),
      password,
      confirmPassword,
    });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }

    setLoading(true);
    const { error: signUpError } = await signUp.password({
      emailAddress: parsed.data.email,
      password: parsed.data.password,
    });
    if (signUpError) {
      setLoading(false);
      setError(signUpError.message ?? "Could not create your account.");
      return;
    }

    await signUp.verifications.sendEmailCode();
    setLoading(false);
    setStep("verify");
  };

  const handleVerify = async () => {
    if (!signUp || code.trim().length === 0) return;
    setError(null);
    setLoading(true);
    const { error: verifyError } = await signUp.verifications.verifyEmailCode({
      code: code.trim(),
    });
    if (verifyError) {
      setLoading(false);
      setError(verifyError.message ?? "Invalid code.");
      return;
    }
    if (signUp.status === "complete") {
      await signUp.finalize({ navigate: () => router.replace("/(tabs)") });
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
            {step === "form" ? "CREATE ACCOUNT" : "VERIFY EMAIL"}
          </Text>
          <Text className="font-sans text-base text-muted-foreground">
            {step === "form"
              ? "Set up your profile to start logging reps and joining challenges."
              : `Enter the code we sent to ${email}.`}
          </Text>
        </View>

        {step === "form" ? (
          <>
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
              {errors.password ? (
                <Text className="font-sans text-sm text-destructive">
                  {errors.password}
                </Text>
              ) : null}
              <TextField
                placeholder="Confirm password"
                secureTextEntry={!showPassword}
                textContentType="newPassword"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                icon={<Lock size={20} color={mutedForeground} />}
              />
              {errors.confirmPassword ? (
                <Text className="font-sans text-sm text-destructive">
                  {errors.confirmPassword}
                </Text>
              ) : null}
              {error ? (
                <Text className="font-sans text-sm text-destructive">
                  {error}
                </Text>
              ) : null}
            </View>

            <View nativeID="clerk-captcha" />

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
              <SocialButton
                icon={<GoogleLogo size={22} color={foreground} />}
                onPress={() => handleSocialSignUp("oauth_google")}
              />
              <SocialButton
                icon={<GithubLogo size={22} color={foreground} />}
                onPress={() => handleSocialSignUp("oauth_github")}
              />
            </View>

            <View className="flex-row justify-center gap-1">
              <Text className="font-sans text-muted-foreground">
                Already have an account?
              </Text>
              <Pressable onPress={() => router.replace("/(auth)/login")}>
                <Text className="font-sans-semibold text-primary">Log in</Text>
              </Pressable>
            </View>
          </>
        ) : (
          <View className="gap-4">
            <TextField
              placeholder="6-digit code"
              keyboardType="number-pad"
              maxLength={6}
              value={code}
              onChangeText={setCode}
            />
            {error ? (
              <Text className="font-sans text-sm text-destructive">
                {error}
              </Text>
            ) : null}
            <Button
              label="Verify"
              onPress={handleVerify}
              loading={loading}
              disabled={loading || code.trim().length === 0}
            />
            <Pressable onPress={() => setStep("form")}>
              <Text className="text-center font-sans-medium text-sm text-primary">
                Use a different email
              </Text>
            </Pressable>
          </View>
        )}
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
