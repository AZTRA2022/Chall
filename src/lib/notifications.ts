import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

/**
 * Sons de notification (.wav PCM, ≤ 3 s → compatibles iOS + Android).
 * Fichiers bundlés via le plugin `expo-notifications` (voir app.json > plugins > sounds).
 * On les référence par nom de fichier uniquement.
 */
export const SOUNDS = {
  notif1: "notif_1.wav",
  notif2: "notif_2.wav",
  notif3: "notif_3.wav",
  success: "succes_ot_notif.wav",
  money: "money_cash.wav",
  error: "error.wav",
} as const;

export type SoundId = keyof typeof SOUNDS;

/**
 * Canaux Android. Sur Android le son custom est porté par le CANAL, pas par la
 * notif : il faut donc un canal par son. Sur iOS ces canaux sont ignorés.
 */
const ANDROID_CHANNELS: Record<SoundId, string> = {
  notif1: "default",
  notif2: "notif2",
  notif3: "notif3",
  success: "success",
  money: "money",
  error: "error",
};

// Handler global : décide comment afficher une notif reçue app ouverte.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/** Crée les canaux Android (idempotent). No-op sur iOS/web. */
export async function setupAndroidChannels(): Promise<void> {
  if (Platform.OS !== "android") return;
  await Promise.all(
    (Object.keys(SOUNDS) as SoundId[]).map((id) =>
      Notifications.setNotificationChannelAsync(ANDROID_CHANNELS[id], {
        name: `Chall — ${id}`,
        importance: Notifications.AndroidImportance.HIGH,
        sound: SOUNDS[id],
        vibrationPattern: [0, 250, 250, 250],
      }),
    ),
  );
}

/** Demande la permission notifs. Retourne true si accordée. */
export async function requestNotificationPermissions(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  let status = existing;
  if (existing !== "granted") {
    const res = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: true, allowSound: true },
    });
    status = res.status;
  }
  return status === "granted";
}

/**
 * Enregistre l'appareil pour les push notifications Expo.
 * Retourne le token Expo (ou null si refus / simulateur).
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  await setupAndroidChannels();

  if (!Device.isDevice) {
    // Les push ne marchent pas sur simulateur/émulateur.
    console.warn("[push] simulateur détecté : pas de token push.");
    return null;
  }

  const granted = await requestNotificationPermissions();
  if (!granted) {
    console.warn("[push] permission refusée par l'utilisateur.");
    return null;
  }

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId;
  if (!projectId) {
    console.warn("[push] projectId EAS introuvable (extra.eas.projectId).");
    return null;
  }

  try {
    const token = await Notifications.getExpoPushTokenAsync({ projectId });
    return token.data;
  } catch (e) {
    // Cas typique sur Android : credentials FCM V1 absentes côté EAS.
    // Sans ce log l'échec est invisible et aucun token n'arrive en base.
    console.error("[push] getExpoPushTokenAsync a échoué", e);
    throw e;
  }
}

/** Programme une notif locale avec un son. `seconds` = 0 → immédiate. */
export async function scheduleLocalNotification(opts: {
  title: string;
  body?: string;
  sound?: SoundId;
  seconds?: number;
  data?: Record<string, unknown>;
}): Promise<string> {
  const { title, body, sound = "notif1", seconds = 0, data } = opts;

  return Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data,
      sound: SOUNDS[sound],
    },
    trigger:
      seconds > 0
        ? {
            type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
            seconds,
          }
        : null,
  });
}

/** Raccourci : notif "succès" (challenge réussi, etc.). */
export const notifySuccess = (title: string, body?: string) =>
  scheduleLocalNotification({ title, body, sound: "success" });

/** Raccourci : notif "erreur". */
export const notifyError = (title: string, body?: string) =>
  scheduleLocalNotification({ title, body, sound: "error" });
