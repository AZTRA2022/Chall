import { useQuery } from "convex/react";
import { MagnifyingGlass } from "phosphor-react-native";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { api } from "../../../convex/_generated/api";
import { AppHeader } from "@/components/app-header";
import { ResourceList } from "@/components/resource-list";
import { TextField } from "@/components/ui/text-field";
import { useThemeColor } from "@/hooks/use-theme-color";
import { router } from "expo-router";
const SUGGESTED_TAGS = [
  "python",
  "capcut",
  "figma",
  "montage",
  "ia",
  "android",
  "design",
  "gratuit",
];

export default function SearchScreen() {
  const mutedForeground = useThemeColor({}, "mutedForeground");
  const [query, setQuery] = useState("");

  const hasQuery = query.trim().length > 0;

  const feed = useQuery(api.resources.feed, { sort: "new", limit: 60 });
  const results = hasQuery
    ? feed?.filter((r) =>
        `${r.title} ${r.tags.join(" ")} ${r.sourceDomain ?? ""}`
          .toLowerCase()
          .includes(query.trim().toLowerCase()),
      )
    : [];

  return (
    <View className="flex-1 bg-background">
      <AppHeader
        title="Recherche"
        action={{ label: "+ Publier", onPress: () => router.push("/submit") }}
      />

      <View className="px-6 py-4">
        <TextField
          placeholder="Chercher un logiciel, film..."
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          value={query}
          onChangeText={setQuery}
          icon={<MagnifyingGlass size={20} color={mutedForeground} />}
        />
      </View>

      {hasQuery ? (
        <ResourceList
          data={results}
          emptyTitle="AUCUN RÉSULTAT"
          emptyDescription={`Rien ne correspond à « ${query.trim()} ». Essayez un autre mot ou parcourez les catégories.`}
        />
      ) : (
        <View className="gap-3 px-6">
          <Text className="font-mono text-meta uppercase tracking-meta text-muted-foreground">
            Recherches fréquentes
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {SUGGESTED_TAGS.map((tag) => (
              <Pressable
                key={tag}
                onPress={() => setQuery(tag)}
                accessibilityRole="button"
                accessibilityLabel={`Chercher ${tag}`}
                className="rounded-md border border-border bg-secondary px-3 py-2 active:opacity-70"
              >
                <Text className="font-mono text-meta uppercase tracking-meta text-muted-foreground">
                  #{tag}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}
