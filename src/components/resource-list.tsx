import type { ReactNode } from "react";
import { FlatList, View } from "react-native";

import { EmptyState } from "@/components/empty-state";
import {
  ResourceRow,
  ResourceRowSkeleton,
  type ResourceListItem,
} from "@/components/resource-row";

/**
 * Liste de ressources et ses trois états.
 *
 * `data === undefined` signifie « en cours de chargement » — c'est exactement
 * ce que renvoie `useQuery` de Convex tant que la réponse n'est pas arrivée.
 * Passer le résultat de la requête directement suffit donc à obtenir les
 * squelettes, sans drapeau de chargement à gérer dans chaque écran.
 */
export function ResourceList({
  data,
  emptyTitle,
  emptyDescription,
  emptyIcon,
  emptyAction,
  header,
  skeletonCount = 6,
}: {
  data: ResourceListItem[] | undefined;
  emptyTitle: string;
  emptyDescription: string;
  emptyIcon?: ReactNode;
  emptyAction?: ReactNode;
  header?: ReactNode;
  skeletonCount?: number;
}) {
  if (data === undefined) {
    return (
      <View className="flex-1">
        {header}
        {Array.from({ length: skeletonCount }, (_, i) => (
          <ResourceRowSkeleton key={i} />
        ))}
      </View>
    );
  }

  if (data.length === 0) {
    return (
      <View className="flex-1">
        {header}
        <EmptyState
          icon={emptyIcon}
          title={emptyTitle}
          description={emptyDescription}
          action={emptyAction}
        />
      </View>
    );
  }

  return (
    <FlatList
      data={data}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <ResourceRow resource={item} />}
      ListHeaderComponent={header ? <>{header}</> : null}
      contentContainerStyle={{ paddingBottom: 120 }}
    />
  );
}
