import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export type HeaderAction = {
  label: string;
  value?: string | number;
  onPress?: () => void;
};

export function AppHeader({
  back,
  title,
  action,
}: {
  back?: boolean | string;
  title?: string;
  action?: HeaderAction;
}) {
  const insets = useSafeAreaInsets();
  const backLabel = typeof back === "string" ? back : "RETOUR";

  return (
    <View
      style={{ paddingTop: insets.top }}
      className="border-b border-border bg-background"
    >
      <View className="h-11 flex-row items-center justify-between px-4">
        <View className="min-w-20 items-start">
          {back ? (
            <HeaderButton
              label={`←  ${backLabel}`}
              accessibilityLabel={backLabel}
              onPress={() => router.back()}
            />
          ) : null}
        </View>

        <View className="min-w-20 items-end">
          {action ? (
            <HeaderButton
              label={
                action.value === undefined
                  ? action.label
                  : `${action.label} ${action.value}`
              }
              accessibilityLabel={action.label}
              onPress={action.onPress}
            />
          ) : null}
        </View>

        {title ? (
          <View
            pointerEvents="none"
            className="absolute inset-0 items-center justify-center"
          >
            <Text className="font-mono text-meta uppercase tracking-meta text-muted-foreground">
              {title}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function HeaderButton({
  label,
  accessibilityLabel,
  onPress,
}: {
  label: string;
  accessibilityLabel: string;
  onPress?: () => void;
}) {
  // Le texte fait 11px : sans hitSlop la cible serait bien en dessous des 44pt
  // recommandés, alors que le rendu doit rester fin.
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      hitSlop={{ top: 14, bottom: 14, left: 12, right: 12 }}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      className="active:opacity-60"
    >
      <Text className="font-mono text-meta uppercase tracking-meta text-muted-foreground">
        {label}
      </Text>
    </Pressable>
  );
}
