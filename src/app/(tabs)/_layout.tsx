import { Tabs } from "expo-router";
import {
  BookmarkSimple,
  Gear,
  House,
  MagnifyingGlass,
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
          title: "Accueil",

          tabBarIcon: ({ color, size, focused }) => (
            <House
              size={size}
              color={color}
              weight={focused ? "fill" : "bold"}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: "Recherche",
          tabBarIcon: ({ color, size, focused }) => (
            <MagnifyingGlass
              size={size}
              color={color}
              weight={focused ? "fill" : "bold"}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          title: "Bibliothèque",
          tabBarIcon: ({ color, size, focused }) => (
            <BookmarkSimple
              size={size}
              color={color}
              weight={focused ? "fill" : "bold"}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Paramètres",
          tabBarIcon: ({ color, size, focused }) => (
            <Gear
              size={size}
              color={color}
              weight={focused ? "fill" : "bold"}
            />
          ),
        }}
      />
    </Tabs>
  );
}
