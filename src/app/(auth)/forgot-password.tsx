import { useSignIn } from "@clerk/expo";
import { router } from "expo-router";
import { Envelope, Lock } from "phosphor-react-native";
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { useThemeColor } from "@/hooks/use-theme-color";
import { clerkErrorMessage } from "@/lib/clerk-errors";
import {
  fieldErrors,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "@/lib/validations/auth";

export default function ForgotPasswordScreen() {
  const mutedForeground = useThemeColor({}, "mutedForeground");

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
      setError(clerkErrorMessage(createError));
      return;
    }
    const { error: sendError } = await signIn.resetPasswordEmailCode.sendCode();
    setLoading(false);
    if (sendError) {
      setError(clerkErrorMessage(sendError));
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
      setError(clerkErrorMessage(verifyError));
      return;
    }

    const { error: submitError } =
      await signIn.resetPasswordEmailCode.submitPassword({
        password: parsed.data.password,
        signOutOfOtherSessions: true,
      });
    if (submitError) {
      setLoading(false);
      setError(clerkErrorMessage(submitError));
      return;
    }

    if (signIn.status === "complete") {
      await signIn.finalize({ navigate: () => router.replace("/(tabs)") });
    }
    setLoading(false);
  };

  return (
    <View className="flex-1 bg-background">
      <AppHeader
        back
        title={step === "email" ? "Mot de passe" : "Nouveau mot de passe"}
      />
      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-8 px-6 pb-8 pt-6"
        keyboardShouldPersistTaps="handled"
      >
        <View className="gap-2">
          <Text className="font-display text-display-sm text-foreground">
            {step === "email" ? "MOT DE PASSE OUBLIÉ" : "SAISIR LE CODE"}
          </Text>
          <Text className="font-sans text-base text-muted-foreground">
            {step === "email"
              ? "Nous vous envoyons un code par e-mail."
              : `Saisissez le code envoyé à ${email} et choisissez un nouveau mot de passe.`}
          </Text>
        </View>

        {step === "email" ? (
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
            {error ? (
              <Text className="font-sans text-sm text-destructive">
                {error}
              </Text>
            ) : null}
            <Button
              label="Envoyer le code"
              onPress={handleSendCode}
              loading={loading}
              disabled={loading}
            />
          </View>
        ) : (
          <View className="gap-4">
            <TextField
              placeholder="Code reçu"
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
              placeholder="Nouveau mot de passe"
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
              label="Réinitialiser"
              onPress={handleResetPassword}
              loading={loading}
              disabled={loading}
            />
            <Pressable onPress={() => setStep("email")}>
              <Text className="text-center font-sans-medium text-sm text-primary-ink">
                Utiliser une autre adresse
              </Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
