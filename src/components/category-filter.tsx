import { Pressable, ScrollView, Text } from "react-native";

import { CATEGORIES, type CategoryId } from "@/constants/categories";

export function CategoryFilter({
  value,
  onChange,
}: {
  value: CategoryId | null;
  onChange: (id: CategoryId | null) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerClassName="gap-2 px-6 py-3 h-14 "
    >
      <Chip
        label="Tout"
        active={value === null}
        onPress={() => onChange(null)}
      />
      {CATEGORIES.map((category) => (
        <Chip
          key={category.id}
          label={category.label}
          active={value === category.id}
          onPress={() => onChange(category.id)}
        />
      ))}
    </ScrollView>
  );
}

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      className={`rounded-md border px-3 py-2 ${
        active ? "border-primary bg-primary" : "border-border bg-secondary"
      }`}
    >
      <Text
        className={`font-mono text-meta uppercase tracking-meta ${
          active ? "text-primary-foreground" : "text-muted-foreground"
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );
}
