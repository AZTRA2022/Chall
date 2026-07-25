import { useMutation, useQuery } from "convex/react";
import { BellSimple, BookmarkSimple, UploadSimple } from "phosphor-react-native";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { api } from "../../../convex/_generated/api";
import { AppHeader } from "@/components/app-header";
import { EmptyState } from "@/components/empty-state";
import { ResourceList } from "@/components/resource-list";
import { Segmented } from "@/components/segmented";
import { Skeleton } from "@/components/ui/skeleton";
import { CATEGORY_LABELS, type CategoryId } from "@/constants/categories";
import { useThemeColor } from "@/hooks/use-theme-color";

const TABS = [
  { id: "saved", label: "Sauvegardés" },
  { id: "mine", label: "Mes posts" },
  { id: "subscriptions", label: "Abonnements" },
] as const;

type LibraryTab = (typeof TABS)[number]["id"];

type Subscription = { id: string; kind: "category" | "tag"; value: string };

export default function LibraryScreen() {
  const mutedForeground = useThemeColor({}, "mutedForeground");
  const [tab, setTab] = useState<LibraryTab>("saved");

  const saved = useQuery(api.social.mySaves);
  const mine = useQuery(api.resources.mine);
  const subscriptions = useQuery(api.social.mySubscriptions);
  const toggleSubscription = useMutation(api.social.toggleSubscription);

  return (
    <View className="flex-1 bg-background">
      <AppHeader title="Bibliothèque" />
      <Segmented options={TABS} value={tab} onChange={setTab} />

      {tab === "saved" ? (
        <ResourceList
          data={saved}
          emptyIcon={
            <BookmarkSimple size={48} color={mutedForeground} weight="thin" />
          }
          emptyTitle="RIEN DE SAUVEGARDÉ"
          emptyDescription="Les ressources que vous sauvegardez depuis une fiche se retrouvent ici."
        />
      ) : tab === "mine" ? (
        <ResourceList
          data={mine}
          emptyIcon={
            <UploadSimple size={48} color={mutedForeground} weight="thin" />
          }
          emptyTitle="AUCUNE PUBLICATION"
          emptyDescription="Vos partages apparaîtront ici, avec leur statut de modération."
        />
      ) : (
        <SubscriptionList
          data={subscriptions}
          iconColor={mutedForeground}
          onRemove={(kind, value) => toggleSubscription({ kind, value })}
        />
      )}
    </View>
  );
}

function SubscriptionList({
  data,
  iconColor,
  onRemove,
}: {
  data: Subscription[] | undefined;
  iconColor: string;
  onRemove: (kind: "category" | "tag", value: string) => void;
}) {
  if (data === undefined) {
    return (
      <View className="gap-3 px-6 py-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </View>
    );
  }

  if (data.length === 0) {
    return (
      <EmptyState
        icon={<BellSimple size={48} color={iconColor} weight="thin" />}
        title="AUCUN ABONNEMENT"
        description="Suivez une catégorie depuis une fiche pour être prévenu des nouveautés. Un récapitulatif par jour, jamais une notification par ressource."
      />
    );
  }

  return (
    <View className="gap-2 px-6 py-4">
      {data.map((subscription) => (
        <View
          key={subscription.id}
          className="flex-row items-center justify-between rounded-lg border border-border bg-card px-4 py-3"
        >
          <View className="gap-0.5">
            <Text className="font-sans text-base text-foreground">
              {subscription.kind === "tag"
                ? `#${subscription.value}`
                : (CATEGORY_LABELS[subscription.value as CategoryId] ??
                  subscription.value)}
            </Text>
            <Text className="font-mono text-meta uppercase tracking-meta text-muted-foreground">
              {subscription.kind === "tag" ? "Tag" : "Catégorie"}
            </Text>
          </View>
          <Pressable
            onPress={() => onRemove(subscription.kind, subscription.value)}
            accessibilityRole="button"
            accessibilityLabel={`Ne plus suivre ${subscription.value}`}
            hitSlop={8}
          >
            <Text className="font-mono text-meta uppercase tracking-meta text-primary-ink">
              Retirer
            </Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}
