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
          tabBarIcon: ({ color, size, focused }) => (
            <House
              size={size}
              color={color}
              weight={focused ? "fill" : "bold"}
            />
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
          tabBarIcon: ({ color, size, focused }) => (
            <DotsNineIcon
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
          title: "Settings",
          headerShown: true,
          headerShadowVisible: false,
          headerTitleAlign: "center",
          headerTransparent: true,
          headerStyle: {
            backgroundColor: "transparent",
          },
          headerTitleStyle: {
            fontFamily: "sans",
            fontWeight: "bold",
          },
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
