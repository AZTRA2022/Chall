import { Tabs } from "expo-router";
import { House, Trophy, User, VideoCamera } from "phosphor-react-native";

import { useThemeColor } from "@/hooks/use-theme-color";

export default function TabLayout() {
  const primary = useThemeColor({}, "primary");
  const mutedForeground = useThemeColor({}, "mutedForeground");

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: primary,
        tabBarInactiveTintColor: mutedForeground,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => <House size={size} color={color} weight="fill" />,
        }}
      />
      <Tabs.Screen
        name="record"
        options={{
          title: "Record",
          tabBarIcon: ({ color, size }) => (
            <VideoCamera size={size} color={color} weight="fill" />
          ),
        }}
      />
      <Tabs.Screen
        name="leaderboard"
        options={{
          title: "Leaderboard",
          tabBarIcon: ({ color, size }) => <Trophy size={size} color={color} weight="fill" />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => <User size={size} color={color} weight="fill" />,
        }}
      />
    </Tabs>
  );
}
