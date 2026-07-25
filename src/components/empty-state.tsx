import type { ReactNode } from "react";
import { Text, View } from "react-native";

/**
 * État vide.
 *
 * Un écran sans contenu est une invitation à agir, pas un message d'excuse :
 * il dit ce qui viendra là et, quand c'est possible, comment le faire venir.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <View className="flex-1 items-center justify-center gap-4 px-10 py-16">
      {icon ? <View className="opacity-40">{icon}</View> : null}
      <View className="gap-2">
        <Text className="text-center font-display text-2xl text-foreground">
          {title}
        </Text>
        <Text className="text-center font-sans text-sm leading-6 text-muted-foreground">
          {description}
        </Text>
      </View>
      {action}
    </View>
  );
}
