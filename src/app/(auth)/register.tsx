import { useSignUp, useSSO } from "@clerk/expo";
import { useMutation } from "convex/react";
import { router } from "expo-router";
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

import { api } from "../../../convex/_generated/api";
import { AppHeader } from "@/components/app-header";
import { LegalConsent } from "@/components/legal-consent";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { PRIVACY_VERSION, TERMS_VERSION } from "@/constants/legal";
import { useThemeColor } from "@/hooks/use-theme-color";
import { clerkErrorMessage } from "@/lib/clerk-errors";
import { fieldErrors, registerSchema } from "@/lib/validations/auth";

export default function RegisterScreen() {
  const mutedForeground = useThemeColor({}, "mutedForeground");
  const foreground = useThemeColor({}, "foreground");

  const { signUp } = useSignUp();
  const { startSSOFlow } = useSSO();
  const acceptLegalTerms = useMutation(api.users.acceptLegalTerms);

  const [step, setStep] = useState<"form" | "verify">("form");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [confirmedAge, setConfirmedAge] = useState(false);
  const [code, setCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  /**
   * L'acceptation conditionne toutes les voies d'inscription, e-mail comme SSO.
   * La porter uniquement sur le bouton e-mail laisserait deux boutons sociaux
   * capables de créer un compte sans qu'aucun contrat n'ait été accepté.
   */
  const hasConsented = acceptedTerms && confirmedAge;

  const canSubmit =
    email.trim().length > 0 &&
    password.length > 0 &&
    confirmPassword.length > 0 &&
    hasConsented &&
    !loading;

  /** Enregistre l'acceptation dès que la session existe, avant d'entrer dans l'app. */
  const recordConsent = () =>
    acceptLegalTerms({
      termsVersion: TERMS_VERSION,
      privacyVersion: PRIVACY_VERSION,
    });

  const handleSocialSignUp = async (
    strategy: "oauth_google" | "oauth_github",
  ) => {
    if (!hasConsented) {
      setError(
        "Acceptez les conditions et confirmez votre âge avant de continuer.",
      );
      return;
    }
    setError(null);
    try {
      const { createdSessionId, setActive } = await startSSOFlow({ strategy });
      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId });
        await recordConsent();
        router.replace("/(tabs)");
      }
    } catch (err) {
      setError(clerkErrorMessage(err));
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
      acceptedTerms,
      confirmedAge,
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
      setError(clerkErrorMessage(signUpError));
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
      setError(clerkErrorMessage(verifyError));
      return;
    }
    if (signUp.status === "complete") {
      await signUp.finalize({
        navigate: async () => {
          await recordConsent();
          router.replace("/(tabs)");
        },
      });
    }
    setLoading(false);
  };

  return (
    <View className="flex-1 bg-background">
      <AppHeader
        back
        title={step === "form" ? "Inscription" : "Vérification"}
      />
      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-8 px-6 pb-8 pt-6"
        keyboardShouldPersistTaps="handled"
      >
        <View className="gap-2">
          <Text className="font-display text-display-sm text-foreground">
            {step === "form" ? "CRÉER UN COMPTE" : "VÉRIFIER L'E-MAIL"}
          </Text>
          <Text className="font-sans text-base text-muted-foreground">
            {step === "form"
              ? "Rejoignez la communauté pour partager et retrouver des ressources gratuites."
              : `Saisissez le code envoyé à ${email}.`}
          </Text>
        </View>

        {step === "form" ? (
          <>
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
                textContentType="newPassword"
                value={password}
                onChangeText={setPassword}
                icon={<Lock size={20} color={mutedForeground} />}
                rightAdornment={
                  <Pressable
                    onPress={() => setShowPassword((v) => !v)}
                    accessibilityRole="button"
                    accessibilityLabel={
                      showPassword
                        ? "Masquer le mot de passe"
                        : "Afficher le mot de passe"
                    }
                  >
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
                placeholder="Confirmer le mot de passe"
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
            </View>

            <LegalConsent
              acceptedTerms={acceptedTerms}
              onAcceptedTermsChange={setAcceptedTerms}
              confirmedAge={confirmedAge}
              onConfirmedAgeChange={setConfirmedAge}
              error={errors.acceptedTerms ?? errors.confirmedAge}
            />

            {error ? (
              <Text className="font-sans text-sm text-destructive">{error}</Text>
            ) : null}

            <View nativeID="clerk-captcha" />

            <Button
              label="Créer mon compte"
              onPress={handleRegister}
              loading={loading}
              disabled={!canSubmit}
            />

            <View className="flex-row items-center gap-3">
              <View className="h-px flex-1 bg-border" />
              <Text className="font-sans text-sm text-muted-foreground">
                ou s&apos;inscrire avec
              </Text>
              <View className="h-px flex-1 bg-border" />
            </View>

            <View className="flex-row justify-center gap-4">
              <SocialButton
                icon={<GoogleLogo size={22} color={foreground} />}
                label="S'inscrire avec Google"
                disabled={!hasConsented}
                onPress={() => handleSocialSignUp("oauth_google")}
              />
              <SocialButton
                icon={<GithubLogo size={22} color={foreground} />}
                label="S'inscrire avec GitHub"
                disabled={!hasConsented}
                onPress={() => handleSocialSignUp("oauth_github")}
              />
            </View>

            <View className="flex-row justify-center gap-1">
              <Text className="font-sans text-muted-foreground">
                Vous avez déjà un compte ?
              </Text>
              <Pressable onPress={() => router.replace("/(auth)/login")}>
                <Text className="font-sans-semibold text-primary-ink">
                  Se connecter
                </Text>
              </Pressable>
            </View>
          </>
        ) : (
          <View className="gap-4">
            <TextField
              placeholder="Code à 6 chiffres"
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
              label="Vérifier"
              onPress={handleVerify}
              loading={loading}
              disabled={loading || code.trim().length === 0}
            />
            <Pressable onPress={() => setStep("form")}>
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

function SocialButton({
  icon,
  label,
  disabled,
  onPress,
}: {
  icon: ReactNode;
  label: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      className={`h-14 w-14 items-center justify-center rounded-full border border-border bg-muted active:opacity-80 ${
        disabled ? "opacity-40" : ""
      }`}
    >
      {icon}
    </Pressable>
  );
}
