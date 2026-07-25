import type { ReactNode } from "react";
import { ScrollView, Text, View } from "react-native";

import { AppHeader } from "@/components/app-header";

/**
 * Gabarit commun aux documents contractuels (CGU, confidentialité).
 *
 * Les documents sont rendus dans l'app plutôt que dans un navigateur : ils
 * doivent rester consultables avant la création du compte, hors ligne, et sans
 * dépendre d'un site web qui n'existe pas encore.
 */
export function LegalDocument({
  title,
  headerTitle,
  version,
  children,
}: {
  title: string;
  /** Libellé court affiché dans la barre haute, où la place est comptée. */
  headerTitle: string;
  version: string;
  children: ReactNode;
}) {
  return (
    <View className="flex-1 bg-background">
      <AppHeader back title={headerTitle} />
      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-6 px-6 pb-16 pt-6"
      >
        <View className="gap-2">
          <Text className="font-display text-display-sm text-foreground">
            {title}
          </Text>
          <Text className="font-mono text-meta uppercase tracking-meta text-muted-foreground">
            Version {version}
          </Text>
        </View>

        <View className="gap-6">{children}</View>
      </ScrollView>
    </View>
  );
}

export function LegalSection({
  heading,
  children,
}: {
  heading: string;
  children: ReactNode;
}) {
  return (
    <View className="gap-2">
      <Text className="font-sans-semibold text-base text-foreground">
        {heading}
      </Text>
      {children}
    </View>
  );
}

export function LegalText({ children }: { children: ReactNode }) {
  return (
    <Text className="font-sans text-sm leading-6 text-muted-foreground">
      {children}
    </Text>
  );
}
