import { Pressable, Text, View } from "react-native";

/**
 * Sélecteur de tri, calqué sur les onglets de la référence : libellés `meta`,
 * soulignement plein sous l'actif, aucun fond ni pastille.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
}) {
  return (
    <View className="flex-row border-b border-border">
      {options.map((option) => {
        const active = option.id === value;
        return (
          <Pressable
            key={option.id}
            onPress={() => onChange(option.id)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            className="flex-1 items-center py-3"
          >
            <Text
              className={`font-mono text-meta uppercase tracking-meta ${
                active ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              {option.label}
            </Text>
            {/* Trait toujours rendu, transparent quand inactif : sinon la
                hauteur de la ligne changerait au changement d'onglet. */}
            <View
              className={`mt-3 h-0.5 w-full ${
                active ? "bg-foreground" : "bg-transparent"
              }`}
            />
          </Pressable>
        );
      })}
    </View>
  );
}
