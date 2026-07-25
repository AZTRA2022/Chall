import { useQuery } from "convex/react";
import { router } from "expo-router";
import { Stack } from "phosphor-react-native";
import { useState } from "react";
import { View } from "react-native";

import { api } from "../../../convex/_generated/api";
import { AppHeader } from "@/components/app-header";
import { CategoryFilter } from "@/components/category-filter";
import { ResourceList } from "@/components/resource-list";
import { Segmented } from "@/components/segmented";
import {
  FEED_SORTS,
  type CategoryId,
  type FeedSort,
} from "@/constants/categories";
import { useThemeColor } from "@/hooks/use-theme-color";

export default function FeedScreen() {
  const mutedForeground = useThemeColor({}, "mutedForeground");
  const [sort, setSort] = useState<FeedSort>("hot");
  const [category, setCategory] = useState<CategoryId | null>(null);

  const resources = useQuery(api.resources.feed, {
    sort,
    category: category ?? undefined,
  });

  return (
    <View className="flex-1 bg-background">
      <AppHeader
        title="Accueil"
        action={{ label: "+ Publier", onPress: () => router.push("/submit") }}
      />

      <ResourceList
        data={resources}
        header={
          <>
            <Segmented options={FEED_SORTS} value={sort} onChange={setSort} />
            <CategoryFilter value={category} onChange={setCategory} />
          </>
        }
        emptyIcon={<Stack size={48} color={mutedForeground} weight="thin" />}
        emptyTitle="RIEN ICI POUR L'INSTANT"
        emptyDescription="Les ressources partagées par la communauté apparaîtront ici. Publiez la première."
      />
    </View>
  );
}
