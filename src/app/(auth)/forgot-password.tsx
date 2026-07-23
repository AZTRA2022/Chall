import { useSignIn } from "@clerk/expo";
import { router } from "expo-router";
import { CaretLeft, Envelope, Lock } from "phosphor-react-native";
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { useThemeColor } from "@/hooks/use-theme-color";
import {
  fieldErrors,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "@/lib/validations/auth";

export default function ForgotPasswordScreen() {
  const mutedForeground = useThemeColor({}, "mutedForeground");
  const foreground = useThemeColor({}, "foreground");

  const { signIn } = useSignIn();

  const [step, setStep] = useState<"email" | "reset">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSendCode = async () => {
    if (!signIn) return;
    setError(null);
    setErrors({});
    const parsed = forgotPasswordSchema.safeParse({ email: email.trim() });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }

    setLoading(true);
    const { error: createError } = await signIn.create({
      identifier: parsed.data.email,
    });
    if (createError) {
      setLoading(false);
      setError(createError.message ?? "Could not find that account.");
      return;
    }
    const { error: sendError } = await signIn.resetPasswordEmailCode.sendCode();
    setLoading(false);
    if (sendError) {
      setError(sendError.message ?? "Could not send the code.");
      return;
    }
    setEmail(parsed.data.email);
    setStep("reset");
  };

  const handleResetPassword = async () => {
    if (!signIn) return;
    setError(null);
    setErrors({});
    const parsed = resetPasswordSchema.safeParse({
      email: email.trim(),
      code: code.trim(),
      password,
    });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }

    setLoading(true);
    const { error: verifyError } =
      await signIn.resetPasswordEmailCode.verifyCode({ code: parsed.data.code });
    if (verifyError) {
      setLoading(false);
      setError(verifyError.message ?? "Invalid code.");
      return;
    }

    const { error: submitError } =
      await signIn.resetPasswordEmailCode.submitPassword({
        password: parsed.data.password,
        signOutOfOtherSessions: true,
      });
    if (submitError) {
      setLoading(false);
      setError(submitError.message ?? "Could not reset your password.");
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
            {step === "email" ? "RESET PASSWORD" : "ENTER CODE"}
          </Text>
          <Text className="font-sans text-base text-muted-foreground">
            {step === "email"
              ? "We'll send a code to your email."
              : `Enter the code sent to ${email} and choose a new password.`}
          </Text>
        </View>

        {step === "email" ? (
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
            {error ? (
              <Text className="font-sans text-sm text-destructive">
                {error}
              </Text>
            ) : null}
            <Button
              label="Send code"
              onPress={handleSendCode}
              loading={loading}
              disabled={loading}
            />
          </View>
        ) : (
          <View className="gap-4">
            <TextField
              placeholder="Code"
              keyboardType="number-pad"
              maxLength={8}
              value={code}
              onChangeText={setCode}
            />
            {errors.code ? (
              <Text className="font-sans text-sm text-destructive">
                {errors.code}
              </Text>
            ) : null}
            <TextField
              placeholder="New password"
              secureTextEntry
              textContentType="newPassword"
              value={password}
              onChangeText={setPassword}
              icon={<Lock size={20} color={mutedForeground} />}
            />
            {errors.password ? (
              <Text className="font-sans text-sm text-destructive">
                {errors.password}
              </Text>
            ) : null}
            {error ? (
              <Text className="font-sans text-sm text-destructive">
                {error}
              </Text>
            ) : null}
            <Button
              label="Reset password"
              onPress={handleResetPassword}
              loading={loading}
              disabled={loading}
            />
            <Pressable onPress={() => setStep("email")}>
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
