// src/screens/LikedPostsScreen.tsx
import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Feather from "react-native-vector-icons/Feather";
import { useNavigation } from "@react-navigation/native";
import { useSelector } from "react-redux";
import { TText } from "../../i18n/TText";

/* ---------------- Theme ---------------- */
const BG = "#0B0B12";
const CARD = "#17171F";
const OUTLINE = "rgba(255,255,255,0.12)";
const TEXT = "#EDEDF4";
const SUBTEXT = "#9A9AA5";
const ACCENT = "#F44336";

/* ---------------- Config ---------------- */
const WP_BASE = "https://noctimago.com";

/* ---------------- Types ---------------- */
type LikedGridItem = {
  id: string;              // unique tile id (e.g., "701-img-0" or "701-vid")
  postId: string;          // original post ID
  kind: "image" | "video";
  url: string;             // image url OR video url
  thumbnail?: string;      // for video poster
  date?: string;
  liked: boolean;          // always true initially from liked_posts
};

/* ---------------- Helpers ---------------- */
const isValid = (s?: string | null) =>
  !!s && typeof s === "string" && s.trim().length > 0 && !/\/null$/i.test(s.trim());

const splitImages = (s?: string | null): string[] =>
  (s || "")
    .split(",")
    .map((x) => x.trim())
    .filter(isValid);

/* ---------------- API ---------------- */
async function unlikePostApi(postId: string, token?: string) {
  try {
    const res = await fetch(`${WP_BASE}/wp-json/app/v1/unlike_post/${postId}`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    return res.ok;
  } catch (error) {
    console.log("[unliked] error =", error);
    return false;
  }
}

export default function LikedPostsScreen() {
  const nav = useNavigation<any>();
  const token = useSelector((s: any) => s?.authReducer?.token);

  const [items, setItems] = React.useState<LikedGridItem[]>([]);
  const [page, setPage] = React.useState<number>(1);
  const [totalPages, setTotalPages] = React.useState<number>(1);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [refreshing, setRefreshing] = React.useState<boolean>(false);
  const [loadingMore, setLoadingMore] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | null>(null);

  const headers = React.useMemo(
    () => ({ Accept: "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }),
    [token]
  );

  const mapPostToTiles = React.useCallback((p: any): LikedGridItem[] => {
    const pid = String(p?.ID ?? p?.id ?? "");
    const f = p?.fields ?? {};
    const imgs = splitImages(f?.images);
    const video = (f?.video || "").trim();

    const tiles: LikedGridItem[] = [];

    // one tile per image
    imgs.forEach((url: string, i: number) => {
      tiles.push({
        id: `${pid}-img-${i}`,
        postId: pid,
        kind: "image",
        url,
        liked: true,
        date: p?.date,
      });
    });

    // optional video tile
    if (isValid(video)) {
      tiles.push({
        id: `${pid}-vid`,
        postId: pid,
        kind: "video",
        url: video,
        thumbnail: imgs[0],
        liked: true,
        date: p?.date,
      });
    }

    // posts with no media get skipped
    return tiles;
  }, []);

  const loadPage = React.useCallback(
    async (pageToLoad = 1, append = false) => {
      setError(null);
      if (append) setLoadingMore(true);
      else setLoading(true);

      try {
        const res = await fetch(`${WP_BASE}/wp-json/app/v1/liked_posts?page=${pageToLoad}`, {
          method: "GET",
          headers,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();

        const posts: any[] = json?.posts ?? [];
        const tiles = posts.flatMap(mapPostToTiles);

        // (Optional) keep order as received; or sort newest first:
        // tiles.sort((a, b) => (new Date(b.date||0).getTime()||0) - (new Date(a.date||0).getTime()||0));

        setTotalPages(Number(json?.totalPages ?? 1));

        setItems((prev) => {
          if (!append) return tiles;
          // merge without duplicates
          const seen = new Set(prev.map((t) => t.id));
          const merged = prev.slice();
          for (const t of tiles) if (!seen.has(t.id)) merged.push(t);
          return merged;
        });

        setPage(pageToLoad);
      } catch (e: any) {
        setError(e?.message || "Failed to load liked posts");
        if (!append) setItems([]);
      } finally {
        if (append) setLoadingMore(false);
        else setLoading(false);
      }
    },
    [headers, mapPostToTiles]
  );

  React.useEffect(() => {
    loadPage(1, false);
  }, [loadPage]);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await loadPage(1, false);
    setRefreshing(false);
  }, [loadPage]);

  const onEndReached = React.useCallback(() => {
    if (loadingMore || loading) return;
    if (page >= totalPages) return;
    loadPage(page + 1, true);
  }, [loadingMore, loading, page, totalPages, loadPage]);

  const handleUnlike = React.useCallback(
    async (postId: string) => {
      // Optimistically remove all tiles for this post
      const prev = items;
      const filtered = prev.filter((t) => t.postId !== postId);
      setItems(filtered);

      const ok = await unlikePostApi(postId, token);
      if (!ok) {
        setItems(prev); // rollback
        Alert.alert("Failed", "Could not unlike this post right now.");
      }
    },
    [items, token]
  );

  const renderItem = ({ item }: { item: LikedGridItem }) => (
    <TouchableOpacity
      activeOpacity={0.9}
      style={styles.gridCell}
      onPress={() => nav.navigate("PostDetailScreen", { postId: item.postId, token })}
    >
      <Image
        source={{ uri: item.kind === "video" ? item.thumbnail || item.url : item.url }}
        style={styles.gridImg}
        resizeMode="cover"
      />

      {/* red heart highlight (liked) + tap to unlike */}
      <TouchableOpacity
        onPress={() => handleUnlike(item.postId)}
        activeOpacity={0.8}
        style={styles.heartBtn}
      >
        <Feather name="heart" size={16} color="#fff" />
        <View style={styles.heartDot} />
      </TouchableOpacity>

      {item.kind === "video" && (
        <View style={styles.playBadge}>
          <Feather name="play-circle" size={16} color="#fff" />
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      {/* Header
      <View className="flex-row" style={styles.topBar}>
        <TouchableOpacity onPress={() => nav.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Feather name="chevron-left" size={24} color={TEXT} />
        </TouchableOpacity>
        <TText style={styles.topTitle}>Liked Post</TText>
        <View style={{ width: 24 }} />
      </View> */}

      {loading && !refreshing ? (
        <View style={{ padding: 20, alignItems: "center" }}>
          <ActivityIndicator />
          <Text style={{ color: SUBTEXT, marginTop: 8 }}>Loading liked posts…</Text>
        </View>
      ) : error ? (
        <View style={{ padding: 20 }}>
          <Text style={{ color: "#ff8a80", marginBottom: 8 }}>Error: {error}</Text>
          <TouchableOpacity onPress={() => loadPage(1, false)} style={styles.retryBtn}>
            <Text style={styles.retryTxt}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : items.length === 0 ? (
        <View style={{ padding: 20 }}>
          <Text style={{ color: SUBTEXT }}>No liked posts yet.</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it) => it.id}
          renderItem={renderItem}
          numColumns={3}
          columnWrapperStyle={{ gap: 2 }}
          contentContainerStyle={{ gap: 2, paddingBottom: 24 }}
          onEndReachedThreshold={0.3}
          onEndReached={onEndReached}
          refreshControl={
            <RefreshControl tintColor={TEXT} refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListFooterComponent={
            loadingMore ? (
              <View style={{ paddingVertical: 14 }}>
                <ActivityIndicator />
              </View>
            ) : null
          }
        />
      )}
    </SafeAreaView>
  );
}

/* ---------------- Styles ---------------- */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  topBar: {
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    justifyContent: "space-between",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: OUTLINE,
  },
  topTitle: { color: TEXT, fontSize: 16, fontWeight: "700" },

  gridCell: {
    flex: 1 / 3,
    aspectRatio: 1,
    backgroundColor: "#0f0f16",
    position: "relative",
  },
  gridImg: { width: "100%", height: "100%" },

  // red-highlight heart button (top-right)
  heartBtn: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: ACCENT,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.25)",
  },
  // small white dot accent to make it pop
  heartDot: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#fff",
    opacity: 0.9,
  },

  // video badge (bottom-right)
  playBadge: {
    position: "absolute",
    right: 6,
    bottom: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.45)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.25)",
  },

  retryBtn: {
    alignSelf: "flex-start",
    backgroundColor: ACCENT,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  retryTxt: { color: "#fff", fontWeight: "700" },
});
