import { Tabs } from "expo-router";
import {
  DotsNineIcon,
  Gear,
  House,
  Trophy,
  User,
  VideoCamera,
} from "phosphor-react-native";

import { FloatingTabBar } from "@/components/floating-tab-bar";

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => (
            <House size={size} color={color} weight="fill" />
          ),
        }}
      />
      <Tabs.Screen
        name="explore"

        options={{
          title: "Explore",

          tabBarIcon: ({ color, size }) => (
            <DotsNineIcon size={size} color={color} weight="fill" />
          ),
        }}
      />

      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color, size }) => (
            <Gear size={size} color={color} weight="fill" />
          ),
        }}
      />
    </Tabs>
  );
}
