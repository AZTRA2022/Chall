import { Image } from "expo-image";
import { Link } from "expo-router";
import { ArrowFatUp, FilmSlate, ImageSquare, LinkSimple } from "phosphor-react-native";
import { Pressable, Text, View } from "react-native";

import { Skeleton } from "@/components/ui/skeleton";
import { CATEGORY_LABELS, type CategoryId } from "@/constants/categories";

export type ResourceListItem = {
  id: string;
  title: string;
  kind: "link" | "image" | "video" | "file";
  category: CategoryId;
  sourceDomain?: string;
  /** Couverture résolue côté serveur : fichier de l'auteur, sinon vignette du lien. */
  posterUrl?: string;
  voteCount: number;
  status: "pending" | "approved" | "rejected" | "dead";
};

/**
 * Carte de ressource.
 *
 * La couverture occupe toute la largeur en 16/9 : c'est elle qui fait
 * reconnaître une ressource d'un coup d'œil, bien avant son titre. Le format
 * est imposé pour que la colonne reste régulière quelle que soit l'image
 * fournie — une grille irrégulière se parcourt mal.
 */
export function ResourceRow({ resource }: { resource: ResourceListItem }) {
  const isPending = resource.status === "pending";

  return (
    <Link href={`/resource/${resource.id}`} asChild>
      <Pressable
        className="gap-3 px-6 py-4 active:opacity-80"
        accessibilityRole="link"
        accessibilityLabel={resource.title}
      >
        <View
          className="w-full overflow-hidden rounded-lg bg-secondary"
          style={{ aspectRatio: 16 / 9 }}
        >
          {resource.posterUrl ? (
            <Image
              source={resource.posterUrl}
              style={{ width: "100%", height: "100%" }}
              contentFit="cover"
              transition={180}
            />
          ) : (
            <PosterFallback kind={resource.kind} />
          )}

          {isPending ? (
            <View className="absolute left-3 top-3 rounded-sm bg-background/90 px-2 py-1">
              <Text className="font-mono text-meta uppercase tracking-meta text-primary-ink">
                En modération
              </Text>
            </View>
          ) : null}
        </View>

        <View className="flex-row items-start gap-4">
          <View className="flex-1 gap-1">
            <Text
              className="font-sans-semibold text-base text-foreground"
              numberOfLines={2}
            >
              {resource.title}
            </Text>
            <Text
              className="font-mono text-meta uppercase tracking-meta text-muted-foreground"
              numberOfLines={1}
            >
              {CATEGORY_LABELS[resource.category]}
              {resource.sourceDomain ? ` · ${resource.sourceDomain}` : ""}
            </Text>
          </View>

          <View className="flex-row items-center gap-1.5 pt-0.5">
            <ArrowFatUp size={14} color="#8C8C8C" weight="fill" />
            <Text className="font-mono-bold text-sm text-foreground">
              {resource.voteCount}
            </Text>
          </View>
        </View>
      </Pressable>
    </Link>
  );
}

/** Sans couverture, on affiche au moins la nature de la ressource. */
function PosterFallback({ kind }: { kind: ResourceListItem["kind"] }) {
  const Icon =
    kind === "video" ? FilmSlate : kind === "link" ? LinkSimple : ImageSquare;
  return (
    <View className="h-full w-full items-center justify-center">
      <Icon size={32} color="#8C8C8C" weight="thin" />
    </View>
  );
}

/** Même gabarit que `ResourceRow`, pour que rien ne saute au chargement. */
export function ResourceRowSkeleton() {
  return (
    <View className="gap-3 px-6 py-4">
      <View className="w-full" style={{ aspectRatio: 16 / 9 }}>
        <Skeleton className="h-full w-full rounded-lg" />
      </View>
      <View className="flex-row items-start gap-4">
        <View className="flex-1 gap-2">
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-2.5 w-1/2" />
        </View>
        <Skeleton className="h-4 w-8" />
      </View>
    </View>
  );
}
