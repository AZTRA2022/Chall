import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Fonts } from "@/constants/theme";
import { useThemeColor } from "@/hooks/use-theme-color";

export function FloatingTabBar({
  state,
  descriptors,
  navigation,
}: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const tabBar = useThemeColor({}, "tabBar");
  const tabChip = useThemeColor({}, "tabChip");
  const tabChipForeground = useThemeColor({}, "tabChipForeground");
  const mutedForeground = useThemeColor({}, "mutedForeground");
  const border = useThemeColor({}, "border");

  return (
    <View pointerEvents="box-none" style={{}}>
      <View
        style={[styles.bar, { backgroundColor: tabBar, borderColor: border }]}
      >
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const focused = state.index === index;
          const label =
            typeof options.tabBarLabel === "string"
              ? options.tabBarLabel
              : (options.title ?? route.name);
          const color = focused ? tabChipForeground : mutedForeground;

          const onPress = () => {
            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });

            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          const onLongPress = () => {
            navigation.emit({ type: "tabLongPress", target: route.key });
          };

          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
              onPress={onPress}
              onLongPress={onLongPress}
              className="flex items-center "
              style={({ pressed }) => [
                styles.item,
                focused && { backgroundColor: tabChip },
                pressed && { opacity: 0.6 },
              ]}
            >
              {options.tabBarIcon?.({ focused, color, size: 22 })}
              <Text numberOfLines={1} style={[styles.label, { color }]}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    left: 16,
    right: 16,
  },
  bar: {
    flexDirection: "row",
    alignItems: "center",

    alignSelf: "stretch",
    justifyContent: "space-between",

    padding: 18,
    borderRadius: 0,
    borderWidth: StyleSheet.hairlineWidth,

    boxShadow: "0px 8px 24px rgba(0, 0, 0, 0.5)",
  },
  item: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 999,
  },
  label: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 10,
    textAlign: "center",
  },
});
