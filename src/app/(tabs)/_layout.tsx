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
import { Pressable, Text, View } from "react-native";
import * as NavigationBar from "expo-navigation-bar";
export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{
        headerShown: true,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => (
            <House size={size} color={color} weight="fill" />
          ),
          headerTransparent: true,
          headerTitle: "",

          headerStyle: {
            backgroundColor: "transparent",
          },
          headerShadowVisible: false,
          headerRight: () => (
            <Pressable
              className="mr-4 flex items-center justify-center rounded-full bg-zinc-100 px-4 py-2"
              onPress={() => {
                alert("Hey Guys !");
              }}
            >
              <Text className="font-mono-bold text-xl">+</Text>
            </Pressable>
          ),
        }}
      />
      <Tabs.Screen
        name="explore"

        options={{
          title: "Explore",
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <DotsNineIcon size={size} color={color} weight="fill" />
          ),
        }}
      />

      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Gear size={size} color={color} weight="fill" />
          ),
        }}
      />
    </Tabs>
  );
}
