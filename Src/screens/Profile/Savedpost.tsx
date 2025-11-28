// src/screens/Saved/SavedScreen.tsx
import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  RefreshControl,
  StatusBar,
  Alert,
  Dimensions,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useSelector } from "react-redux";
import { SafeAreaView } from "react-native-safe-area-context";

/* ----------------------------- UI consts ----------------------------- */
const COLORS = {
  bg: "#0B0C0F",
  surface: "#101217",
  card: "#12141A",
  border: "#1E2128",
  text: "#E5E7EB",
  sub: "#9CA3AF",
  accent: "#E53935",
  icon: "#C0C3CC",
};

// grid sizing (keep these in sync with FlatList styles)
const GRID_COLS = 3;
const GRID_GAP = 8;      // = columnWrapperStyle.gap
const GRID_PAD_H = 8;    // = contentContainerStyle.horizontal padding

const calcCell = (w: number) =>
  Math.floor((w - GRID_PAD_H * 2 - GRID_GAP * (GRID_COLS - 1)) / GRID_COLS);

/* ----------------------------- Types ----------------------------- */
type ApiComment = {
  ID: string | number;
  author: string;
  content: string;
  date: string;
  profile_pic?: string;
};

type ApiPost = {
  ID: number | string;
  title: string;
  author: string;
  author_id?: string | number;
  author_profile_image?: string;
  date: string;
  fields: {
    event?: string;
    tag_people?: string;
    location?: string;
    images?: string; // CSV
    video?: string;
    latitude?: string | number;
    longitude?: string | number;
    _likes?: number | string;
    _liked_users?: (number | string)[] | string;
    is_saved?: boolean | "true" | "false" | "1" | "0" | string;
    is_followed?: boolean | "true" | "false" | "1" | "0" | string;
  };
  liked_by_user?: boolean | "true" | "false" | "1" | "0" | string;
  is_saved?: boolean | "true" | "false" | "1" | "0" | string;
  is_followed?: boolean | "true" | "false" | "1" | "0" | string;
  comments?: ApiComment[];
};

type SavedCard = {
  id: string;
  image: string;
  hasVideo: boolean;
  raw: ApiPost;
};

/* ----------------------------- Helpers ----------------------------- */
const firstCsvImage = (csv?: string): string => {
  if (!csv || typeof csv !== "string") return "";
  const arr = csv
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return arr[0] || "";
};

function mapApiToSavedCard(p: ApiPost): SavedCard {
  const id = String(p.ID);
  const firstImage = firstCsvImage(p.fields?.images);
  const image =
    firstImage ||
    "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=1400&auto=format&fit=crop";
  const hasVideo = !!(p.fields?.video && p.fields.video.trim().length);
  return { id, image, hasVideo, raw: p };
}

/* ----------------------------- API ----------------------------- */
async function fetchSavedApi(token?: string) {
  const res = await fetch("https://noctimago.com/wp-json/app/v1/saved_posts", {
    method: "GET",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  return Array.isArray(json) ? (json as ApiPost[]) : (json?.posts ?? []);
}

async function unsavePostApi(postId: string, token?: string) {
  const res = await fetch(`https://noctimago.com/wp-json/app/v1/unsave_post/${postId}`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!res.ok) throw new Error(`Unsave HTTP ${res.status}`);
}

/* ----------------------------- Screen ----------------------------- */
export default function SavedScreen({ navigation }: any) {
  const token = useSelector((state: any) => state.authReducer.token);

  const [saved, setSaved] = useState<SavedCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [unsavingIds, setUnsavingIds] = useState<Set<string>>(new Set());

  // grid sizing
  const [screenW, setScreenW] = useState(Dimensions.get("window").width);
  const [cellSize, setCellSize] = useState(calcCell(screenW));

  const load = useCallback(async () => {
    try {
      setErr(null);
      setLoading(true);
      const apiPosts = await fetchSavedApi(token);
      setSaved(apiPosts.map(mapApiToSavedCard));
    } catch {
      setErr("Could not load saved posts.");
      setSaved([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const openPost = (id: string) => {
    navigation.navigate("PostDetailScreen", { postId: id, token });
  };

  const confirmUnsave = (id: string) => {
    Alert.alert("Unsave post?", "This will remove it from your Saved.", [
      { text: "Cancel", style: "cancel" },
      { text: "Unsave", style: "destructive", onPress: () => doUnsave(id) },
    ]);
  };

  const doUnsave = async (id: string) => {
    if (unsavingIds.has(id)) return;
    const inFlight = new Set(unsavingIds);
    inFlight.add(id);
    setUnsavingIds(inFlight);

    // optimistic remove
    const prev = saved;
    const next = prev.filter((p) => p.id !== id);
    setSaved(next);

    try {
      await unsavePostApi(id, token);
    } catch {
      setSaved(prev); // rollback
      Alert.alert("Oops", "Could not unsave. Please try again.");
    } finally {
      const s = new Set(inFlight);
      s.delete(id);
      setUnsavingIds(s);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.surface} />

      {/* Header
      <View style={styles.topbar}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.backBtn}
        >
          <Ionicons name="chevron-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.heading}>Saved Post</Text>
        <View style={{ width: 22 }} />
      </View> */}

      {/* Grid */}
      <FlatList
        data={saved}
        key={"grid"}
        keyExtractor={(item) => item.id}
        numColumns={GRID_COLS}
        contentContainerStyle={{ paddingHorizontal: GRID_PAD_H, paddingTop: 8, paddingBottom: 24 }}
        columnWrapperStyle={{ gap: GRID_GAP }}
        ItemSeparatorComponent={() => <View style={{ height: GRID_GAP }} />}
        refreshControl={
          <RefreshControl tintColor={COLORS.sub} refreshing={refreshing} onRefresh={onRefresh} />
        }
        onLayout={(e) => {
          const w = e.nativeEvent.layout.width || Dimensions.get("window").width;
          if (w !== screenW) {
            setScreenW(w);
            setCellSize(calcCell(w));
          }
        }}
        ListEmptyComponent={
          <View style={{ alignItems: "center", marginTop: 48, paddingHorizontal: 16 }}>
            <Text style={{ color: COLORS.sub }}>
              {loading ? "Loading saved…" : err || "No saved posts yet"}
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const unsaving = unsavingIds.has(item.id);
          return (
            <View style={[styles.cell, { width: cellSize, height: cellSize }]}>
              <TouchableOpacity style={{ flex: 1 }} activeOpacity={0.9} onPress={() => openPost(item.id)}>
                <Image source={{ uri: item.image }} style={styles.thumb} />
                {item.hasVideo ? (
                  <View style={[styles.badge, { top: 6, right: 6 }]}>
                    <Ionicons name="videocam-outline" size={14} color="#fff" />
                  </View>
                ) : null}
              </TouchableOpacity>

              {/* bottom-right: Unsave */}
              <TouchableOpacity
                onPress={() => confirmUnsave(item.id)}
                disabled={unsaving}
                activeOpacity={0.85}
                style={[styles.saveFabSmall, unsaving ? { opacity: 0.6 } : null]}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="bookmark" size={16} color="#fff" />
              </TouchableOpacity>
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}

/* ----------------------------- Styles ----------------------------- */
const styles = StyleSheet.create({
  topbar: {
    paddingHorizontal: 8,
    paddingVertical: 10,
    backgroundColor: COLORS.surface,
    borderBottomColor: COLORS.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backBtn: {
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 8,
  },
  heading: { color: COLORS.text, fontSize: 16, fontWeight: "700" },

  cell: {
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "#0A0B0E",
    borderColor: COLORS.border,
    borderWidth: StyleSheet.hairlineWidth,
    position: "relative",
  },
  thumb: { width: "100%", height: "100%" },

  badge: {
    position: "absolute",
    backgroundColor: "rgba(0,0,0,0.45)",
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },

  saveFabSmall: {
    position: "absolute",
    right: 6,
    bottom: 6,
    backgroundColor: COLORS.accent,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderColor: "rgba(255,255,255,0.15)",
    borderWidth: StyleSheet.hairlineWidth,
  },
});
