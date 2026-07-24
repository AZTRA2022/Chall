import { notifySuccess } from "@/lib/notifications";
import { useEffect } from "react";
import { SafeAreaView } from "react-native-safe-area-context";

export default function HomeScreen() {
  useEffect(() => {
    notifySuccess("yo", "dfsdf ddd");
  }, []);
  return <SafeAreaView className="flex-1 bg-background"></SafeAreaView>;
}
