import { Checkbox } from "@/components/ui/checkbox";
import { Link } from "expo-router";
import { Pressable, Text, View } from "react-native";

import { MINIMUM_AGE } from "@/constants/legal";

/**
 * Bloc d'acceptation affiché à l'inscription.
 *
 * Deux cases distinctes et non pré-cochées. Distinctes parce que l'acceptation
 * d'un contrat et une déclaration d'âge sont deux engagements différents, et
 * qu'un consentement groupé se défend mal. Non pré-cochées parce qu'un
 * consentement doit résulter d'un acte positif.
 */
export function LegalConsent({
  acceptedTerms,
  onAcceptedTermsChange,
  confirmedAge,
  onConfirmedAgeChange,
  error,
}: {
  acceptedTerms: boolean;
  onAcceptedTermsChange: (value: boolean) => void;
  confirmedAge: boolean;
  onConfirmedAgeChange: (value: boolean) => void;
  error?: string;
}) {
  return (
    <View className="gap-3">
      <ConsentRow
        checked={acceptedTerms}
        onChange={onAcceptedTermsChange}
        accessibilityLabel="J'accepte les conditions d'utilisation et la politique de confidentialité"
      >
        <Text className="font-sans text-sm leading-5 text-muted-foreground">
          J&apos;ai lu et j&apos;accepte les{" "}
          <Link href="/legal/terms" className="font-sans-semibold text-primary-ink">
            conditions d&apos;utilisation
          </Link>{" "}
          et la{" "}
          <Link
            href="/legal/privacy"
            className="font-sans-semibold text-primary-ink"
          >
            politique de confidentialité
          </Link>
          .
        </Text>
      </ConsentRow>

      <ConsentRow
        checked={confirmedAge}
        onChange={onConfirmedAgeChange}
        accessibilityLabel={`Je déclare avoir au moins ${MINIMUM_AGE} ans`}
      >
        <Text className="font-sans text-sm leading-5 text-muted-foreground">
          Je déclare avoir au moins {MINIMUM_AGE} ans.
        </Text>
      </ConsentRow>

      {error ? (
        <Text className="font-sans text-sm text-destructive">{error}</Text>
      ) : null}
    </View>
  );
}

function ConsentRow({
  checked,
  onChange,
  accessibilityLabel,
  children,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  accessibilityLabel: string;
  children: React.ReactNode;
}) {
  return (
    <Pressable
      onPress={() => onChange(!checked)}
      className="flex-row items-start gap-3"
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={accessibilityLabel}
      hitSlop={6}
    >
      {/* `pointerEvents="none"` : sans ça, un appui pile sur la case
          déclencherait à la fois la case et le Pressable parent, donc deux
          bascules et aucun changement visible. */}
      <View className="pt-0.5" pointerEvents="none">
        <Checkbox
          className="size-5"
          checked={checked}
          onCheckedChange={onChange}
        />
      </View>
      <View className="flex-1">{children}</View>
    </Pressable>
  );
}
