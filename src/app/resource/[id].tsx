import { useMutation, useQuery } from "convex/react";
import { Image } from "expo-image";
import { useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { ArrowFatUp, ArrowSquareOut, BellSimple, BookmarkSimple } from "phosphor-react-native";
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { AppHeader } from "@/components/app-header";
import { EmptyState } from "@/components/empty-state";
import { ReportSheet } from "@/components/report-sheet";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CATEGORY_LABELS } from "@/constants/categories";
import { useThemeColor } from "@/hooks/use-theme-color";

export default function ResourceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const primaryInk = useThemeColor({}, "primaryInk");
  const mutedForeground = useThemeColor({}, "mutedForeground");

  const resource = useQuery(api.resources.byId, {
    id: id as Id<"resources">,
  });
  const toggleVote = useMutation(api.resources.toggleVote);
  const toggleSave = useMutation(api.social.toggleSave);
  const toggleSubscription = useMutation(api.social.toggleSubscription);
  const saved = useQuery(api.social.isSaved, {
    resourceId: id as Id<"resources">,
  });
  const [reporting, setReporting] = useState(false);

  if (resource === undefined) {
    return (
      <View className="flex-1 bg-background">
        <AppHeader back title="Ressource" action={{ label: "Signaler" }} />
        <ResourceDetailSkeleton />
      </View>
    );
  }

  if (resource === null) {
    return (
      <View className="flex-1 bg-background">
        <AppHeader back title="Ressource" />
        <EmptyState
          title="INTROUVABLE"
          description="Cette ressource n'existe pas, ou elle n'est pas encore publiée."
        />
      </View>
    );
  }

  const isPending = resource.status === "pending";
  const openTarget = resource.url ?? resource.fileUrl;

  return (
    <View className="flex-1 bg-background">
      <AppHeader
        back
        title="Ressource"
        action={{ label: "Signaler", onPress: () => setReporting(true) }}
      />

      <ScrollView contentContainerClassName="gap-6 pb-16">
        <View
          className="w-full bg-secondary"
          style={{ aspectRatio: 16 / 9 }}
        >
          {resource.posterUrl ? (
            <Image
              source={resource.posterUrl}
              style={{ width: "100%", height: "100%" }}
              contentFit="cover"
              transition={180}
            />
          ) : null}
        </View>

        <View className="gap-4 px-6">
          <View className="gap-2">
            <Text className="font-mono text-meta uppercase tracking-meta text-muted-foreground">
              {CATEGORY_LABELS[resource.category]}
              {resource.sourceDomain ? ` · ${resource.sourceDomain}` : ""}
            </Text>
            <Text className="font-display text-display-sm text-foreground">
              {resource.title.toUpperCase()}
            </Text>
          </View>

          {isPending ? (
            <View className="rounded-lg border border-border bg-card p-4">
              <Text className="font-sans text-sm leading-5 text-muted-foreground">
                Cette publication attend sa modération. Vous la voyez parce que
                vous en êtes l&apos;auteur — elle n&apos;apparaît pas encore dans
                le feed.
              </Text>
            </View>
          ) : null}

          {resource.description ? (
            <Text className="font-sans text-sm leading-6 text-muted-foreground">
              {resource.description}
            </Text>
          ) : null}

          {resource.tags.length > 0 ? (
            <View className="flex-row flex-wrap gap-2">
              {resource.tags.map((tag) => (
                <View
                  key={tag}
                  className="rounded-md border border-border bg-secondary px-2 py-1"
                >
                  <Text className="font-mono text-meta uppercase tracking-meta text-muted-foreground">
                    #{tag}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}

          {/* Ouverture dans le navigateur intégré : l'utilisateur revient d'un
              geste au lieu de quitter l'app. */}
          {openTarget ? (
            <Button
              label={resource.kind === "link" ? "Ouvrir le lien" : "Télécharger"}
              onPress={() => WebBrowser.openBrowserAsync(openTarget)}
            />
          ) : resource.scanStatus && resource.scanStatus !== "clean" ? (
            <View className="flex-row items-center gap-3 rounded-lg border border-border bg-card p-4">
              <ArrowSquareOut size={20} color={mutedForeground} />
              <Text className="flex-1 font-sans text-sm leading-5 text-muted-foreground">
                Le fichier n&apos;est pas encore téléchargeable : son analyse
                antivirus n&apos;est pas terminée.
              </Text>
            </View>
          ) : null}

          <View className="flex-row gap-3">
            <Pressable
              onPress={() =>
                toggleSave({ resourceId: resource.id as Id<"resources"> })
              }
              accessibilityRole="button"
              accessibilityLabel={
                saved ? "Retirer des sauvegardes" : "Sauvegarder"
              }
              className={`flex-1 flex-row items-center justify-center gap-2 rounded-md border px-4 py-3 ${
                saved ? "border-primary bg-primary/10" : "border-border bg-secondary"
              }`}
            >
              <BookmarkSimple
                size={16}
                color={saved ? primaryInk : mutedForeground}
                weight={saved ? "fill" : "regular"}
              />
              <Text className="font-mono text-meta uppercase tracking-meta text-foreground">
                {saved ? "Sauvegardé" : "Sauvegarder"}
              </Text>
            </Pressable>

            <Pressable
              onPress={() =>
                toggleSubscription({
                  kind: "category",
                  value: resource.category,
                })
              }
              accessibilityRole="button"
              accessibilityLabel={`Suivre la catégorie ${CATEGORY_LABELS[resource.category]}`}
              className="flex-1 flex-row items-center justify-center gap-2 rounded-md border border-border bg-secondary px-4 py-3"
            >
              <BellSimple size={16} color={mutedForeground} />
              <Text className="font-mono text-meta uppercase tracking-meta text-foreground">
                Suivre
              </Text>
            </Pressable>
          </View>

          <View className="flex-row items-center justify-between border-t border-border pt-4">
            <Pressable
              onPress={() =>
                toggleVote({ resourceId: resource.id as Id<"resources"> })
              }
              disabled={isPending}
              accessibilityRole="button"
              accessibilityLabel="Voter pour cette ressource"
              className={`flex-row items-center gap-2 rounded-md border px-4 py-2 ${
                resource.hasVoted
                  ? "border-primary bg-primary/10"
                  : "border-border bg-secondary"
              } ${isPending ? "opacity-40" : ""}`}
            >
              <ArrowFatUp
                size={16}
                color={resource.hasVoted ? primaryInk : mutedForeground}
                weight={resource.hasVoted ? "fill" : "regular"}
              />
              <Text className="font-mono-bold text-sm text-foreground">
                {resource.voteCount}
              </Text>
            </Pressable>

            {resource.author ? (
              <Text className="font-mono text-meta uppercase tracking-meta text-muted-foreground">
                Par {resource.author.displayName ?? resource.author.username}
              </Text>
            ) : null}
          </View>
        </View>
      </ScrollView>

      <ReportSheet
        resourceId={resource.id as Id<"resources">}
        visible={reporting}
        onClose={() => setReporting(false)}
      />
    </View>
  );
}

/** Reprend la structure de la fiche, pour éviter tout saut à l'arrivée des données. */
function ResourceDetailSkeleton() {
  return (
    <ScrollView contentContainerClassName="gap-6 pb-16">
      <View className="w-full" style={{ aspectRatio: 16 / 9 }}>
        <Skeleton className="h-full w-full rounded-none" />
      </View>
      <View className="gap-6 px-6">
        <View className="gap-3">
          <Skeleton className="h-2.5 w-32" />
          <Skeleton className="h-8 w-4/5" />
        </View>
        <View className="gap-2">
          <Skeleton className="h-3.5 w-full" />
          <Skeleton className="h-3.5 w-full" />
          <Skeleton className="h-3.5 w-2/3" />
        </View>
        <Skeleton className="h-12 w-full" />
      </View>
    </ScrollView>
  );
}
