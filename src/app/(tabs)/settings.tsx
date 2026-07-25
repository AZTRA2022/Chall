import { useClerk, useUser } from "@clerk/expo";
import { useMutation, useQuery } from "convex/react";
import { Link, router, type Href } from "expo-router";
import { useState } from "react";
import { Alert, ScrollView, Text, View } from "react-native";

import { api } from "../../../convex/_generated/api";
import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { LEGAL_ENTITY } from "@/constants/legal";
import { registerForPushNotificationsAsync } from "@/lib/notifications";

export default function Settings() {
  const { signOut } = useClerk();
  const { user: clerkUser } = useUser();
  const appUser = useQuery(api.users.getCurrentAppUser);

  const setConsent = useMutation(api.users.setDataCollectionConsent);
  const deleteOwnAccount = useMutation(api.users.deleteOwnAccount);
  const removePushToken = useMutation(api.users.removePushToken);

  const [busy, setBusy] = useState(false);

  /** Le token doit être retiré tant que la mutation est encore authentifiée. */
  const detachDevice = async () => {
    try {
      const token = await registerForPushNotificationsAsync();
      if (token) await removePushToken({ token });
    } catch (e) {
      // Un token qui survit se nettoie de toute façon au premier envoi refusé.
      console.warn("[push] détachement du device échoué", e);
    }
  };

  const handleSignOut = async () => {
    setBusy(true);
    await detachDevice();
    await signOut();
    setBusy(false);
  };

  const confirmDelete = () => {
    Alert.alert(
      "Supprimer le compte",
      "Votre profil, vos collections, vos abonnements et vos votes seront effacés. " +
        "Les ressources que vous avez publiées restent en ligne, sans lien avec votre compte. " +
        "Cette action est définitive.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer définitivement",
          style: "destructive",
          onPress: handleDelete,
        },
      ],
    );
  };

  const handleDelete = async () => {
    if (!clerkUser) return;

    // Clerk refuse `delete()` si l'option n'est pas activée sur l'instance.
    // Sans ce garde, l'utilisateur recevrait une erreur technique sans savoir
    // que rien n'a été supprimé.
    if (clerkUser.deleteSelfEnabled === false) {
      Alert.alert(
        "Suppression indisponible",
        `La suppression de compte n'est pas activée. Écrivez à ${LEGAL_ENTITY.contactEmail} pour faire supprimer vos données.`,
      );
      return;
    }

    setBusy(true);
    try {
      // Convex d'abord, tant que la session est valide. Le webhook
      // `user.deleted` refait le même travail et sert de filet.
      await deleteOwnAccount();
      await clerkUser.delete();
      router.replace("/(auth)");
    } catch (e) {
      console.warn("[compte] suppression échouée", e);
      Alert.alert(
        "Suppression impossible",
        "Vos données n'ont pas pu être supprimées. Réessayez, ou écrivez à " +
          LEGAL_ENTITY.contactEmail,
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <View className="flex-1 bg-background">
      <AppHeader title="Paramètres" back />
      <ScrollView contentContainerClassName="gap-8 px-6 pb-32 pt-6">
        <Text className="font-display text-display-sm text-foreground">
          PARAMÈTRES
        </Text>

        <Section title="Compte">
          <LegalLink href="/profile/edit" label="Modifier mon profil" />
          <Row
            label="Adresse e-mail"
            value={clerkUser?.primaryEmailAddress?.emailAddress ?? "—"}
          />
          <Row label="Nom d'utilisateur" value={appUser?.username ?? "—"} />
          <Row
            label="Membre depuis"
            value={
              appUser
                ? new Date(appUser.createdAt).toLocaleDateString("fr-FR")
                : "—"
            }
          />
        </Section>

        <Section title="Confidentialité">
          <View className="flex-row items-center justify-between gap-4 py-2">
            <View className="flex-1 gap-1">
              <Text className="font-sans text-base text-foreground">
                Statistiques d&apos;usage
              </Text>
              <Text className="font-sans text-sm leading-5 text-muted-foreground">
                Aide à améliorer l&apos;application. Facultatif, désactivé par
                défaut, sans effet sur les fonctionnalités.
              </Text>
            </View>
            <Switch
              checked={appUser?.dataCollectionConsent ?? false}
              onCheckedChange={(consent) => setConsent({ consent })}
              disabled={appUser === undefined}
            />
          </View>
          <LegalLink href="/profile/blocked" label="Comptes bloqués" />
        </Section>

        {appUser?.role === "mod" || appUser?.role === "admin" ? (
          <Section title="Modération">
            <LegalLink href="/(mod)/queue" label="File d'attente" />
          </Section>
        ) : null}

        <Section title="Documents">
          <LegalLink href="/legal/terms" label="Conditions d'utilisation" />
          <LegalLink
            href="/legal/privacy"
            label="Politique de confidentialité"
          />
          <Row label="Contact" value={LEGAL_ENTITY.contactEmail} />
          <Row label="Signaler un contenu" value={LEGAL_ENTITY.abuseEmail} />
        </Section>

        <View className="gap-3 pt-2">
          <Button
            label="Se déconnecter"
            variant="outline"
            onPress={handleSignOut}
            disabled={busy}
          />
          <Button
            label="Supprimer mon compte"
            variant="primary"
            className="border border-destructive"
            onPress={confirmDelete}
            disabled={busy || !clerkUser}
          />
        </View>
      </ScrollView>
    </View>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View className="gap-2">
      <Text className="font-mono text-meta uppercase tracking-meta text-muted-foreground">
        {title}
      </Text>
      <View className="rounded-lg border border-border bg-card px-4">
        {children}
      </View>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between gap-4 py-3">
      <Text className="font-sans text-base text-foreground">{label}</Text>
      <Text
        className="flex-1 text-right font-sans text-sm text-muted-foreground"
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}

function LegalLink({ href, label }: { href: Href; label: string }) {
  return (
    <Link href={href} asChild>
      <Text className="py-3 font-sans text-base text-primary-ink">{label}</Text>
    </Link>
  );
}
