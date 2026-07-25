import { useAction, useMutation } from "convex/react";
import { Image } from "expo-image";
import { router } from "expo-router";
import {
  FileText,
  FilmSlate,
  ImageSquare,
  LinkSimple,
} from "phosphor-react-native";
import { useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";

import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Segmented } from "@/components/segmented";
import { TextField } from "@/components/ui/text-field";
import { CATEGORIES, type CategoryId } from "@/constants/categories";
import { useThemeColor } from "@/hooks/use-theme-color";
import {
  FALLBACK_MAX_FILE_BYTES,
  pickDocument,
  pickMedia,
  uploadMedia,
  type PickedMedia,
} from "@/lib/upload";

const MODES = [
  { id: "link", label: "Lien" },
  { id: "media", label: "Média" },
  { id: "file", label: "Fichier" },
] as const;

type Mode = (typeof MODES)[number]["id"];

export default function SubmitScreen() {
  const mutedForeground = useThemeColor({}, "mutedForeground");

  const submitLink = useMutation(api.resources.submitLink);
  const submitMedia = useMutation(api.resources.submitMedia);
  const createUpload = useMutation(api.files.createUpload);
  const finalizeUpload = useAction(api.files.finalizeUpload);

  const [mode, setMode] = useState<Mode>("link");
  const [url, setUrl] = useState("");
  const [media, setMedia] = useState<PickedMedia | null>(null);
  const [poster, setPoster] = useState<PickedMedia | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [category, setCategory] = useState<CategoryId | null>(null);
  const [ownsRights, setOwnsRights] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasSource = mode === "link" ? url.trim().length > 0 : media !== null;

  // Changer de mode remet la source à zéro : garder un PDF sélectionné en
  // passant sur « Lien » enverrait le mauvais contenu sans le montrer.
  const changeMode = (next: Mode) => {
    setMode(next);
    setMedia(null);
    setUrl("");
  };
  const canSubmit =
    hasSource &&
    title.trim().length > 0 &&
    category !== null &&
    ownsRights &&
    !busy;

  const handlePick = async () => {
    setError(null);
    try {
      const picked = mode === "file" ? await pickDocument() : await pickMedia();
      if (!picked) return;
      setMedia(picked);
      // if (title.trim().length === 0) {
      //   setTitle(picked.filename.replace(/\.[^.]+$/, ""));
      // }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sélection impossible.");
    }
  };

  const handlePickPoster = async () => {
    setError(null);
    try {
      const picked = await pickMedia({ imagesOnly: true });
      if (picked) setPoster(picked);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sélection impossible.");
    }
  };

  /** Envoie la couverture et renvoie son identifiant, ou `undefined` si aucune. */
  const uploadPoster = async (): Promise<Id<"files"> | undefined> => {
    if (!poster) return undefined;
    const target = await createUpload();
    const ref = await uploadMedia(poster, target);
    const { fileId } = await finalizeUpload({
      provider: ref.provider,
      storageId: ref.storageId as Id<"_storage"> | undefined,
      storageKey: ref.storageKey,
      filename: poster.filename,
      mimeType: poster.mimeType,
      ownsRights,
    });
    return fileId;
  };

  const handleSubmit = async () => {
    if (!canSubmit || category === null) return;
    setBusy(true);
    setError(null);

    const tagList = tags
      .split(/[,\s]+/)
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    try {
      let result: { id: Id<"resources">; duplicate: boolean };
      const posterFileId = await uploadPoster();

      if (mode === "link") {
        result = await submitLink({
          url: url.trim(),
          title: title.trim(),
          description: description.trim() || undefined,
          category,
          tags: tagList,
          posterFileId,
        });
      } else {
        if (!media) return;
        const target = await createUpload();
        const ref = await uploadMedia(media, target);
        const { fileId } = await finalizeUpload({
          provider: ref.provider,
          storageId: ref.storageId as Id<"_storage"> | undefined,
          storageKey: ref.storageKey,
          filename: media.filename,
          mimeType: media.mimeType,
          ownsRights,
        });
        result = await submitMedia({
          fileId,
          title: title.trim(),
          description: description.trim() || undefined,
          category,
          tags: tagList,
          posterFileId,
        });
      }

      if (result.duplicate) {
        Alert.alert(
          "Déjà partagé",
          "Cette ressource existe déjà. On vous y emmène — vous pouvez la voter pour la faire remonter.",
          [
            {
              text: "Voir",
              onPress: () => router.replace(`/resource/${result.id}`),
            },
          ],
        );
        return;
      }

      Alert.alert(
        "Envoyé",
        "Votre publication passe en modération. Vous serez prévenu du résultat.",
        [{ text: "OK", onPress: () => router.back() }],
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "L'envoi a échoué. Réessayez.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View className="flex-1 bg-background">
      <AppHeader back="Annuler" title="Publier" />

      <ScrollView
        contentContainerClassName="gap-6 px-6 pb-16 pt-6"
        keyboardShouldPersistTaps="handled"
      >
        <Segmented options={MODES} value={mode} onChange={changeMode} />

        {mode === "link" ? (
          <TextField
            placeholder="https://..."
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            value={url}
            onChangeText={setUrl}
            icon={<LinkSimple size={20} color={mutedForeground} />}
          />
        ) : (
          <MediaPicker
            media={media}
            mode={mode}
            iconColor={mutedForeground}
            onPress={handlePick}
          />
        )}

        <View className="gap-4">
          <TextField
            placeholder="Titre"
            value={title}
            onChangeText={setTitle}
          />
          <TextField
            placeholder="Description (facultative)"
            multiline
            value={description}
            onChangeText={setDescription}
            className="h-24 items-start py-3"
          />
          <TextField
            placeholder="Tags, séparés par des espaces"
            autoCapitalize="none"
            autoCorrect={false}
            value={tags}
            onChangeText={setTags}
          />
        </View>

        <View className="gap-3">
          <Text className="font-mono text-meta uppercase tracking-meta text-muted-foreground">
            Couverture
          </Text>
          <PosterPicker
            poster={poster}
            iconColor={mutedForeground}
            onPress={handlePickPoster}
            onClear={() => setPoster(null)}
          />
          <Text className="font-sans text-xs leading-5 text-muted-foreground">
            Facultative. C&apos;est l&apos;image qui représente la ressource
            dans le feed. Sans couverture, la vignette du lien est utilisée.
          </Text>
        </View>

        <View className="gap-3">
          <Text className="font-mono text-meta uppercase tracking-meta text-muted-foreground">
            Catégorie
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {CATEGORIES.map((item) => {
              const active = category === item.id;
              return (
                <Pressable
                  key={item.id}
                  onPress={() => setCategory(item.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  className={`rounded-md border px-3 py-2 ${
                    active
                      ? "border-primary bg-primary"
                      : "border-border bg-secondary"
                  }`}
                >
                  <Text
                    className={`font-mono text-meta uppercase tracking-meta ${
                      active
                        ? "text-primary-foreground"
                        : "text-muted-foreground"
                    }`}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Article 5 des conditions : chaque publication vaut déclaration. */}
        <Pressable
          onPress={() => setOwnsRights((v) => !v)}
          className="flex-row items-start gap-3 rounded-lg border border-border bg-card p-4"
          accessibilityRole="checkbox"
          accessibilityState={{ checked: ownsRights }}
          accessibilityLabel="Je déclare avoir le droit de partager cette ressource"
        >
          <View className="pt-0.5" pointerEvents="none">
            <Checkbox
              className="size-5"
              checked={ownsRights}
              onCheckedChange={setOwnsRights}
            />
          </View>
          <Text className="flex-1 font-sans text-sm leading-5 text-muted-foreground">
            Je déclare que cette ressource est légalement accessible et que
            j&apos;ai le droit de la partager. Les contenus piratés sont retirés
            et leur auteur exclu.
          </Text>
        </Pressable>

        {error ? (
          <Text className="font-sans text-sm text-destructive">{error}</Text>
        ) : null}

        <Button
          label={busy ? "Envoi..." : "Envoyer pour modération"}
          loading={busy}
          disabled={!canSubmit}
          onPress={handleSubmit}
        />

        <Text className="text-center font-sans text-xs leading-5 text-muted-foreground">
          Votre publication est examinée avant sa mise en ligne. Les fichiers
          passent aussi par une analyse antivirus.
        </Text>
      </ScrollView>
    </View>
  );
}

/**
 * Couverture, au format large des affiches de catalogue. Le 16/9 est imposé
 * pour que le feed reste régulier quelle que soit l'image fournie.
 */
function PosterPicker({
  poster,
  iconColor,
  onPress,
  onClear,
}: {
  poster: PickedMedia | null;
  iconColor: string;
  onPress: () => void;
  onClear: () => void;
}) {
  if (poster) {
    return (
      <View className="gap-2">
        <Image
          source={poster.uri}
          style={{ width: "100%", aspectRatio: 16 / 9, borderRadius: 10 }}
          contentFit="cover"
        />
        <Pressable onPress={onClear} accessibilityRole="button" hitSlop={8}>
          <Text className="font-mono text-meta uppercase tracking-meta text-primary-ink">
            Retirer la couverture
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Ajouter une image de couverture"
      style={{ aspectRatio: 16 / 9 }}
      className="items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-card active:opacity-70"
    >
      <ImageSquare size={28} color={iconColor} weight="thin" />
      <Text className="font-sans text-sm text-muted-foreground">
        Ajouter une couverture
      </Text>
    </Pressable>
  );
}

function MediaPicker({
  media,
  mode,
  iconColor,
  onPress,
}: {
  media: PickedMedia | null;
  mode: Mode;
  iconColor: string;
  onPress: () => void;
}) {
  const isFileMode = mode === "file";
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Choisir une image ou une vidéo"
      className="h-44 items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-card active:opacity-70"
    >
      {media ? (
        media.kind === "image" ? (
          <Image
            source={media.uri}
            style={{ width: "100%", height: "100%", borderRadius: 10 }}
            contentFit="cover"
          />
        ) : (
          <>
            {media.kind === "video" ? (
              <FilmSlate size={32} color={iconColor} weight="thin" />
            ) : (
              <FileText size={32} color={iconColor} weight="thin" />
            )}
            <Text
              className="px-6 text-center font-sans text-sm text-foreground"
              numberOfLines={1}
            >
              {media.filename}
            </Text>
          </>
        )
      ) : (
        <>
          {isFileMode ? (
            <FileText size={32} color={iconColor} weight="thin" />
          ) : (
            <ImageSquare size={32} color={iconColor} weight="thin" />
          )}
          <Text className="font-sans text-sm text-muted-foreground">
            {isFileMode ? "Choisir un PDF" : "Choisir une image ou une vidéo"}
          </Text>
          <Text className="font-mono text-meta uppercase tracking-meta text-muted-foreground">
            {Math.round(FALLBACK_MAX_FILE_BYTES / 1024 / 1024)} Mo maximum
          </Text>
        </>
      )}
    </Pressable>
  );
}
