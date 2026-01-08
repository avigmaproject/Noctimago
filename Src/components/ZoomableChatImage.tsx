// ZoomableChatImage.tsx
import React from "react";
import {
  View,
  Image,
  TouchableOpacity,
  Alert,
  Platform,
  PermissionsAndroid,
  ActivityIndicator,
  Text,
  StyleSheet,
} from "react-native";
import ImageView from "react-native-image-viewing";
import { CameraRoll } from '@react-native-camera-roll/camera-roll';// ✅ IMPORTANT (NOT {CameraRoll})
import RNFS from "react-native-fs";
import Feather from 'react-native-vector-icons/Feather';

type Props = {
  uri?: string | null;
  style?: any;
  borderRadius?: number;
};

const normalizeUri = (u?: any) => {
  if (typeof u !== "string") return "";
  const s = u.trim();
  if (!s) return "";

  // local absolute path -> add file://
  if (s.startsWith("/") && !s.startsWith("file://")) {
    return `file://${s}`;
  }

  // don't encode whole URL (can break signed urls) — only fix spaces
  return s.replace(/ /g, "%20");
};

async function requestSavePermission() {
  if (Platform.OS !== "android") return true;

  // Android 13+
  if (Platform.Version >= 33) {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  }

  // Android 12 and below
  const granted = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE
  );
  return granted === PermissionsAndroid.RESULTS.GRANTED;
}

async function saveImageToGallery(url: string) {
  const cleanUrl = normalizeUri(url);
  if (!cleanUrl) return;

  const ok = await requestSavePermission();
  if (!ok) {
    Alert.alert("Permission required", "Please allow storage/photos permission.");
    return;
  }

  try {
    // ✅ if it's already a local file, save directly
    if (cleanUrl.startsWith("file://")) {
      await CameraRoll.save(cleanUrl, { type: "photo" });
      Alert.alert("Saved ✅", "Image saved to gallery.");
      return;
    }

    // ✅ download remote -> temp cache -> save
    const fileName = `chat_${Date.now()}.jpg`;
    const localPath = `${RNFS.CachesDirectoryPath}/${fileName}`;

    const resp = await RNFS.downloadFile({
      fromUrl: cleanUrl,
      toFile: localPath,
    }).promise;

    // Some RNFS versions return statusCode (iOS)
    if ((resp as any)?.statusCode && (resp as any).statusCode >= 400) {
      throw new Error(`Download failed (${(resp as any).statusCode})`);
    }

    // CameraRoll.save on iOS prefers file://
    const localUri = localPath.startsWith("file://")
      ? localPath
      : `file://${localPath}`;

    await CameraRoll.save(localUri, { type: "photo" });

    // optional cleanup
    RNFS.unlink(localPath).catch(() => {});
    Alert.alert("Saved ✅", "Image saved to gallery.");
  } catch (e: any) {
    console.log("SAVE IMAGE ERROR =>", e?.message ?? e, e);
    Alert.alert("Save failed", e?.message || "Could not save the image.");
  }
}

export default function ZoomableChatImage({
  uri,
  style,
  borderRadius = 10,
}: Props) {
  const [visible, setVisible] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [failed, setFailed] = React.useState(false);

  const finalUri = normalizeUri(uri);

  // ✅ never return null (so UI doesn't disappear)
  if (!finalUri) {
    return (
      <View
        style={[
          style,
          {
            borderRadius,
            backgroundColor: "#222",
            alignItems: "center",
            justifyContent: "center",
          },
        ]}
      >
        <Text style={{ color: "#aaa", fontSize: 12 }}>No image</Text>
      </View>
    );
  }

  const confirmSave = () => {
    Alert.alert("Download", "Save this image to gallery?", [
      { text: "Cancel", style: "cancel" },
      { text: "Save", onPress: () => saveImageToGallery(finalUri) },
    ]);
  };

  return (
    <>
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => setVisible(true)}
        onLongPress={confirmSave}
      >
        <View style={{ position: "relative" }}>
          <Image
            source={{ uri: finalUri }}
            style={[{ borderRadius }, style]}
            resizeMode="cover"
            onLoadStart={() => {
              setLoading(true);
              setFailed(false);
            }}
            onLoadEnd={() => setLoading(false)}
            onError={(e) => {
              setLoading(false);
              setFailed(true);
              console.log("IMG LOAD ERROR =>", finalUri, e?.nativeEvent);
            }}
          />

          {loading && (
            <View
              style={[
                style,
                {
                  position: "absolute",
                  left: 0,
                  top: 0,
                  right: 0,
                  bottom: 0,
                  alignItems: "center",
                  justifyContent: "center",
                },
              ]}
            >
              <ActivityIndicator />
            </View>
          )}

          {failed && (
            <View
              style={[
                style,
                {
                  position: "absolute",
                  left: 0,
                  top: 0,
                  right: 0,
                  bottom: 0,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "#222",
                  borderRadius,
                },
              ]}
            >
              <Text style={{ color: "#ff8a80", fontSize: 12 }}>
                Failed to load
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>

      {/* ✅ Fullscreen viewer + icons: Download + X */}
      <ImageView
        images={[{ uri: finalUri }]}
        imageIndex={0}
        visible={visible}
        onRequestClose={() => setVisible(false)}
        swipeToCloseEnabled
        doubleTapToZoomEnabled
        onLongPress={confirmSave}
        HeaderComponent={() => (
          <View style={styles.viewerHeader}>
            {/* Download icon (X ke aage) */}
            <TouchableOpacity
              onPress={confirmSave}
              activeOpacity={0.85}
              style={styles.headerBtn}
            >
          <Feather name="arrow-down-circle" size={24} color={"white"} />
            </TouchableOpacity>

            {/* Close X */}
            <TouchableOpacity
              onPress={() => setVisible(false)}
              activeOpacity={0.85}
              style={styles.headerBtn}
            >
              <Text style={styles.headerBtnText}>✕</Text>
            </TouchableOpacity>
          </View>
        )}
      />
    </>
  );
}

const styles = StyleSheet.create({
  viewerHeader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 16,
    paddingHorizontal: 12,
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 10,
  },
  headerBtn: {
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 18,
  },
  headerBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
});
