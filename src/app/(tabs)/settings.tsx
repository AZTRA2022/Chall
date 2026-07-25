import { useQuery } from "convex/react";
import { Image, Pressable, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "../../../convex/_generated/api";
import { Text } from "react-native";
import { Bell, ChevronRight, SlidersHorizontal } from "lucide-react-native";
import { Switch } from "@/components/ui/switch";

export default function Settings() {
  const user = useQuery(api.users.getCurrentAppUser);
  return (
    <SafeAreaView className="flex-1 bg-background p-4">
      <View className="top-16 flex-1 gap-2">
        <TouchableOpacity className=" flex-row items-center justify-between gap-2 rounded-3xl bg-white p-4">
          <View className="flex flex-row items-center gap-2">
            <Image
              src={user?.avatarUrl}
              height={50}
              width={50}
              className="rounded-full"
            />
            <View>
              <Text className="font-sans-bold text-lg"> {user?.username} </Text>
              <Text className="font-sans text-gray-400">
                {" "}
                {user?.email ? user.email : "@" + user?.username}{" "}
              </Text>
            </View>
          </View>
          <View>
            <ChevronRight />
          </View>
        </TouchableOpacity>
        <View className="item-center flex flex-col gap-4 rounded-3xl bg-white p-6 ">
          <TouchableOpacity className="flex-row items-center justify-between gap-2 ">
            <View className="flex flex-row items-center gap-2">
              {" "}
              <Bell />{" "}
              <Text className="font-sans-medium text-base">
                Notifications
              </Text>{" "}
            </View>
            <View>
              {" "}
              <Switch checked={true} onCheckedChange={() => {}} />
            </View>
          </TouchableOpacity>
          <View className=" w-10/12 border border-gray-300" />
          <TouchableOpacity className="flex-row items-center justify-between gap-2 ">
            <View className="flex flex-row items-center gap-2">
              {" "}
              <SlidersHorizontal />{" "}
              <Text className="font-sans-medium text-base">
                General Settings
              </Text>{" "}
            </View>
            <View>
              {" "}
              <ChevronRight />{" "}
            </View>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}
