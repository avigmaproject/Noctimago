// utils/saveToGallery.ts
import { Platform, Alert, PermissionsAndroid } from "react-native";
import { CameraRoll } from "@react-native-camera-roll/camera-roll";
import RNFS from "react-native-fs";

const normalizeUri = (u: string) => {
  if (!u) return "";
  if (u.startsWith("/") && !u.startsWith("file://")) {
    return `file://${u}`;
  }
  return u.replace(/ /g, "%20");
};

async function requestPermission() {
  if (Platform.OS !== "android") return true;

  if (Platform.Version >= 33) {
    const r = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES
    );
    return r === PermissionsAndroid.RESULTS.GRANTED;
  }

  const r = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE
  );
  return r === PermissionsAndroid.RESULTS.GRANTED;
}

export async function saveImageToGallery(url: string) {
  try {
    const cleanUrl = normalizeUri(url);
    if (!cleanUrl) return;

    const ok = await requestPermission();
    if (!ok) {
      Alert.alert("Permission required", "Storage permission denied");
      return;
    }

    // ✅ LOCAL FILE
    if (cleanUrl.startsWith("file://")) {
      await CameraRoll.save(cleanUrl, { type: "photo" });
      Alert.alert("Saved ✅", "Image saved to gallery");
      return;
    }

    // ✅ REMOTE FILE → CACHE → SAVE
    const fileName = `post_${Date.now()}.jpg`;
    const localPath = `${RNFS.CachesDirectoryPath}/${fileName}`;

    const resp = await RNFS.downloadFile({
      fromUrl: cleanUrl,
      toFile: localPath,
    }).promise;

    if ((resp as any)?.statusCode >= 400) {
      throw new Error("Download failed");
    }

    await CameraRoll.save(`file://${localPath}`, { type: "photo" });
    RNFS.unlink(localPath).catch(() => {});

    Alert.alert("Saved ✅", "Image saved to gallery");
  } catch (e: any) {
    console.log("SAVE ERROR =>", e);
    Alert.alert("Save failed", e?.message || "Could not save image");
  }
}
