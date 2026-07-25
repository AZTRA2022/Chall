import { useMutation, useQuery } from "convex/react";
import { Image } from "expo-image";
import { Prohibit, UserCircle } from "phosphor-react-native";
import { Pressable, ScrollView, Text, View } from "react-native";

import { api } from "../../../convex/_generated/api";
import { AppHeader } from "@/components/app-header";
import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useThemeColor } from "@/hooks/use-theme-color";

/** Comptes bloqués (exigence Apple 1.2). Le blocage se pose depuis un profil. */
export default function BlockedAccountsScreen() {
  const mutedForeground = useThemeColor({}, "mutedForeground");
  const blocks = useQuery(api.social.myBlocks);
  const toggleBlock = useMutation(api.social.toggleBlock);

  if (blocks === undefined) {
    return (
      <View className="flex-1 bg-background">
        <AppHeader back title="Comptes bloqués" />
        <View className="gap-3 px-6 py-6">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <AppHeader back title="Comptes bloqués" />

      {blocks.length === 0 ? (
        <EmptyState
          icon={<Prohibit size={48} color={mutedForeground} weight="thin" />}
          title="AUCUN COMPTE BLOQUÉ"
          description="Les publications d'un compte bloqué disparaissent de votre feed. Le blocage se pose depuis le profil de la personne."
        />
      ) : (
        <ScrollView contentContainerClassName="gap-2 px-6 py-6 pb-32">
          {blocks.map((block) => (
            <View
              key={block.id}
              className="flex-row items-center gap-3 rounded-lg border border-border bg-card px-4 py-3"
            >
              <View className="size-10 overflow-hidden rounded-full bg-secondary">
                {block.avatarUrl ? (
                  <Image
                    source={block.avatarUrl}
                    style={{ width: "100%", height: "100%" }}
                    contentFit="cover"
                  />
                ) : (
                  <View className="h-full w-full items-center justify-center">
                    <UserCircle size={22} color={mutedForeground} weight="thin" />
                  </View>
                )}
              </View>

              <View className="flex-1">
                <Text className="font-sans text-base text-foreground">
                  {block.displayName ?? block.username}
                </Text>
                <Text className="font-mono text-meta uppercase tracking-meta text-muted-foreground">
                  @{block.username}
                </Text>
              </View>

              <Pressable
                onPress={() => toggleBlock({ username: block.username })}
                accessibilityRole="button"
                accessibilityLabel={`Débloquer ${block.username}`}
                hitSlop={8}
              >
                <Text className="font-mono text-meta uppercase tracking-meta text-primary-ink">
                  Débloquer
                </Text>
              </Pressable>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
