import { forwardRef, type ComponentRef } from "react";
import {
  ActivityIndicator,
  Pressable,
  Text,
  type PressableProps,
} from "react-native";

import { useThemeColor } from "@/hooks/use-theme-color";
import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "outline" | "ghost";

type ButtonProps = PressableProps & {
  label: string;
  variant?: ButtonVariant;
  loading?: boolean;
};

const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-primary active:opacity-90",
  outline: "border border-border active:bg-muted",
  ghost: "active:bg-muted",
};

const labelClasses: Record<ButtonVariant, string> = {
  primary: "text-primary-foreground",
  outline: "text-foreground",
  ghost: "text-foreground",
};

export const Button = forwardRef<ComponentRef<typeof Pressable>, ButtonProps>(
  (
    { label, variant = "primary", loading, disabled, className, ...rest },
    ref,
  ) => {
    const primaryForeground = useThemeColor({}, "primaryForeground");
    const foreground = useThemeColor({}, "foreground");
    const indicatorColor =
      variant === "primary" ? primaryForeground : foreground;

    return (
      <Pressable
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          "flex-row items-center justify-center rounded-md p-4",
          variantClasses[variant],
          (disabled || loading) && "opacity-50",
          className,
        )}
        {...rest}
      >
        {loading ? (
          <ActivityIndicator color={indicatorColor} />
        ) : (
          <Text
            className={cn(
              "font-sans-semibold text-base",
              labelClasses[variant],
            )}
          >
            {label}
          </Text>
        )}
      </Pressable>
    );
  },
);
Button.displayName = "Button";
