import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { AndroidImportance } from "expo-notifications/build/NotificationChannelManager.types";
import { Platform } from "react-native";
import { apiClient } from "@/services/api-client";

export async function registerPushDeviceToken() {
  if (Platform.OS === "web" || !Device.isDevice) return null;
  if (Constants.appOwnership === "expo") return null;

  const projectId =
    process.env.EXPO_PUBLIC_EAS_PROJECT_ID ??
    Constants.easConfig?.projectId ??
    Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) return null;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Thông báo",
      importance: AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#1C416B",
    });
  }

  const existing = await Notifications.getPermissionsAsync();
  let permission = existing;
  if (existing.status !== "granted") {
    permission = await Notifications.requestPermissionsAsync();
  }
  if (permission.status !== "granted") return null;

  try {
    const token = await Notifications.getExpoPushTokenAsync({ projectId });
    await apiClient.post("/notifications/device-tokens", {
      token: token.data,
      platform: Platform.OS,
    });
    return token.data;
  } catch {
    return null;
  }
}
