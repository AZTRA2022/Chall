import { useMutation, useQuery } from "convex/react";
import { Image } from "expo-image";
import { router } from "expo-router";
import { UserCircle } from "phosphor-react-native";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TextField } from "@/components/ui/text-field";
import { useThemeColor } from "@/hooks/use-theme-color";
import { pickMedia, uploadMedia } from "@/lib/upload";

export default function EditProfileScreen() {
  const mutedForeground = useThemeColor({}, "mutedForeground");

  const user = useQuery(api.users.getCurrentAppUser);
  const updateProfile = useMutation(api.users.updateProfile);
  const createAvatarUpload = useMutation(api.users.createAvatarUpload);
  const updateAvatar = useMutation(api.users.updateAvatar);

  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Les champs sont initialisés une fois la requête arrivée, sans écraser une
  // saisie déjà commencée si le document est mis à jour entre-temps.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    if (!user || hydrated) return;
    setUsername(user.username);
    setDisplayName(user.displayName ?? "");
    setBio(user.bio ?? "");
    setHydrated(true);
  }, [user, hydrated]);

  const handleAvatar = async () => {
    setError(null);
    try {
      const picked = await pickMedia({ imagesOnly: true });
      if (!picked) return;
      setBusy(true);
      const target = await createAvatarUpload();
      const ref = await uploadMedia(picked, target);
      await updateAvatar({
        provider: ref.provider,
        storageId: ref.storageId as Id<"_storage"> | undefined,
        storageKey: ref.storageKey,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Envoi de la photo impossible.");
    } finally {
      setBusy(false);
    }
  };

  const handleSave = async () => {
    setBusy(true);
    setError(null);
    try {
      await updateProfile({ username, displayName, bio });
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Enregistrement impossible.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View className="flex-1 bg-background">
      <AppHeader back="Annuler" title="Profil" />

      <ScrollView
        contentContainerClassName="gap-6 px-6 pb-16 pt-6"
        keyboardShouldPersistTaps="handled"
      >
        <View className="items-center gap-3">
          <Pressable
            onPress={handleAvatar}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="Changer la photo de profil"
            className="size-24 items-center justify-center overflow-hidden rounded-full bg-secondary active:opacity-70"
          >
            {user === undefined ? (
              <Skeleton className="h-full w-full rounded-full" />
            ) : user?.avatarUrl ? (
              <Image
                source={user.avatarUrl}
                style={{ width: "100%", height: "100%" }}
                contentFit="cover"
                transition={150}
              />
            ) : (
              <UserCircle size={44} color={mutedForeground} weight="thin" />
            )}
          </Pressable>
          <Text className="font-mono text-meta uppercase tracking-meta text-primary-ink">
            Changer la photo
          </Text>
        </View>

        <View className="gap-4">
          <Field label="Nom d'utilisateur">
            <TextField
              placeholder="pseudo"
              autoCapitalize="none"
              autoCorrect={false}
              value={username}
              onChangeText={setUsername}
            />
            <Hint>
              Identifiant public, unique. Minuscules, chiffres et tirets bas, 3
              à 24 caractères.
            </Hint>
          </Field>

          <Field label="Nom affiché">
            <TextField
              placeholder="Comment on vous appelle"
              value={displayName}
              onChangeText={setDisplayName}
            />
          </Field>

          <Field label="Bio">
            <TextField
              placeholder="Deux lignes sur vous"
              multiline
              value={bio}
              onChangeText={setBio}
              className="h-24 items-start py-3"
            />
            <Hint>{280 - bio.length} caractères restants</Hint>
          </Field>
        </View>

        {user ? (
          <View className="rounded-lg border border-border bg-card px-4 py-3">
            <Text className="font-mono text-meta uppercase tracking-meta text-muted-foreground">
              Membre depuis
            </Text>
            <Text className="font-sans text-base text-foreground">
              {new Date(user.createdAt).toLocaleDateString("fr-FR", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </Text>
          </View>
        ) : null}

        {error ? (
          <Text className="font-sans text-sm text-destructive">{error}</Text>
        ) : null}

        <Button
          label="Enregistrer"
          loading={busy}
          disabled={busy || user === undefined}
          onPress={handleSave}
        />
      </ScrollView>
    </View>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <View className="gap-2">
      <Text className="font-mono text-meta uppercase tracking-meta text-muted-foreground">
        {label}
      </Text>
      {children}
    </View>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return (
    <Text className="font-sans text-xs leading-5 text-muted-foreground">
      {children}
    </Text>
  );
}
