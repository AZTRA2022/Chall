import { View, type ViewProps } from "react-native";

import { useThemeColor } from "@/hooks/use-theme-color";

export type ThemedViewProps = ViewProps & {
  backgroundColor?: string;
};

export function ThemedView({
  style,
  backgroundColor: colorOverride,
  ...otherProps
}: ThemedViewProps) {
  const backgroundColor = useThemeColor({ dark: colorOverride }, "background");

  return <View style={[{ backgroundColor }, style]} {...otherProps} />;
}
