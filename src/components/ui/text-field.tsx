import { forwardRef, type ComponentRef, type ReactNode } from "react";
import { TextInput, View, type TextInputProps } from "react-native";

import { useThemeColor } from "@/hooks/use-theme-color";
import { cn } from "@/lib/utils";

type TextFieldProps = TextInputProps & {
  icon?: ReactNode;
  rightAdornment?: ReactNode;
};

export const TextField = forwardRef<
  ComponentRef<typeof TextInput>,
  TextFieldProps
>(({ icon, rightAdornment, className, ...rest }, ref) => {
  const placeholderColor = useThemeColor({}, "mutedForeground");

  return (
    <View
      className={cn(
        "h-14 flex-row items-center gap-3 rounded-md border border-border bg-muted px-4",
        className,
      )}
    >
      {icon}
      <TextInput
        ref={ref}
        className="flex-1 font-sans text-base text-foreground"
        placeholderTextColor={placeholderColor}
        {...rest}
      />
      {rightAdornment}
    </View>
  );
});
TextField.displayName = "TextField";
