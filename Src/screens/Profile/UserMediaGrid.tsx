// src/components/profile/UserMediaGrid.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList, Image,
  RefreshControl, Alert, useWindowDimensions
} from "react-native";
import Feather from "react-native-vector-icons/Feather";
import { useSelector } from "react-redux";
import { useFocusEffect } from "@react-navigation/native";

type Mode = "posts" | "likes" | "saved";

type UploadItem = {
  id: string;
  uri: string;
  type: "image" | "video";
  hasVideo: boolean;
  mediaCount: number;
  title: string;
  event?: string;
  tag_people?: string;
  location?: string;
  images: string[];
  video?: string;

  authorId: string;
  isRepostedByUser: boolean;
  repostCount: number;
};

const COLORS = {
  bg: "#0B0B12",
  card: "#151521",
  text: "#EDEDF4",
  border: "rgba(255,255,255,0.15)",
  primary: "#201A83",
  overlay: "rgba(0,0,0,0.35)",
  danger: "#EF4444",
};

const WP_BASE = "https://noctimago.com";
const API = {
  userPosts: (userId: string) => `${WP_BASE}/wp-json/app/v1/user-posts/${userId}`,
  likedPosts: (userId: string) => `${WP_BASE}/wp-json/app/v1/liked-posts/${userId}`, // ← adjust if your route differs
  savedPosts: (userId: string) => `${WP_BASE}/wp-json/app/v1/saved-posts/${userId}`, // ← adjust if your route differs
  deletePost: (postId: string) => `${WP_BASE}/wp-json/app/v1/delete-post/${postId}`,
  unrepost: (postId: string) => `${WP_BASE}/wp-json/app/v1/unrepost/${postId}`,
};
const PLACEHOLDER_URL =
  "https://upload.wikimedia.org/wikipedia/commons/thumb/b/bc/Unknown_person.jpg/1200px-Unknown_person.jpg";

export default function UserMediaGrid({
  navigation,
  mode,
  showManageActions = false, // true only for Posts tab or ManageUploads screen
}: {
  navigation: any;
  mode: Mode;
  showManageActions?: boolean;
}) {
  const token = useSelector((s: any) => s.authReducer.token);
  const userprofile = useSelector((s: any) => s.authReducer.userprofile);
  const currentUserId = String(userprofile?.ID ?? "");

  // grid sizing
  const { width } = useWindowDimensions();
  const COLS = 3;
  const SIDE = 10;
  const GAP = 6;
  const TILE = Math.floor((width - SIDE * 2 - GAP * (COLS - 1)) / COLS);

  const [items, setItems] = useState<UploadItem[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [unreposting, setUnreposting] = useState(false);

  const isSelecting = useMemo(() => Object.keys(selected).length > 0, [selected]);

  const sanitizeCsv = (csv: any): string[] =>
    typeof csv === "string" ? csv.split(",").map((s) => s.trim()).filter(Boolean) : [];

  const pickMediaFromPost = (p: any): UploadItem => {
    const f = p?.fields || {};
    const images = sanitizeCsv(f.images);
    const hasVideo = !!(f.video && String(f.video).trim().length);
    const mediaCount = images.length + (hasVideo ? 1 : 0);
    const thumb = images[0] || p?.thumb_url || PLACEHOLDER_URL;
    const type: "image" | "video" = images.length > 0 ? "image" : hasVideo ? "video" : "image";

    const authorId = String(p?.author_id ?? "");
    const isRepostedByUser =
      !!p?.is_reposted_by_user || String(f?.reposted_by_users?.ID ?? "") === currentUserId;

    const repostCount =
      typeof p?.repost_count === "number"
        ? p.repost_count
        : Number(f?.repost_count ?? 0) || 0;

    return {
      id: String(p?.ID ?? p?.id ?? Math.random()),
      uri: thumb,
      type,
      hasVideo,
      mediaCount,
      title: String(p?.title ?? ""),
      event: String(f?.event ?? ""),
      tag_people: String(f?.tag_people ?? ""),
      location: String(f?.location ?? ""),
      images,
      video: hasVideo ? String(f.video).trim() : undefined,
      authorId,
      isRepostedByUser,
      repostCount,
    };
  };

  const fetchData = useCallback(async () => {
    if (!currentUserId) return;
    const hdr: Record<string, string> = { Accept: "application/json" };
    if (token) hdr.Authorization = `Bearer ${token}`;

    const url =
      mode === "posts"
        ? API.userPosts(currentUserId)
        : mode === "likes"
        ? API.likedPosts(currentUserId)
        : API.savedPosts(currentUserId);

    try {
      const res = await fetch(url, { headers: hdr });
      const data = res.ok ? await res.json() : null;
      const list: any[] =
        data?.posts || data?.liked || data?.saved || data?.items || [];
      setItems(list.map(pickMediaFromPost));
    } catch (e) {
      setItems([]);
    }
  }, [currentUserId, token, mode]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchData();
    } finally {
      setRefreshing(false);
    }
  }, [fetchData]);

  const toggleSelect = (id: string) =>
    setSelected((prev) => {
      const next = { ...prev };
      if (next[id]) delete next[id];
      else next[id] = true;
      return next;
    });

  const enterSelect = (id: string) => {
    if (!showManageActions) return; // disable long-press select when not managing
    if (isSelecting) toggleSelect(id);
    else setSelected({ [id]: true });
  };

  const clearSelection = () => setSelected({});

  const doBulkDelete = async (ids: string[]) => {
    setDeleting(true);
    try {
      const headers: Record<string, string> = { Accept: "application/json" };
      if (token) headers.Authorization = `Bearer ${token}`;

      const results = await Promise.allSettled(
        ids.map(async (id) => {
          const url = API.deletePost(id);
          let res = await fetch(url, {
            method: "DELETE",
            headers: { ...headers, "Content-Type": "application/json" },
          });
          if (!res.ok) {
            try {
              res = await fetch(url, { method: "GET", headers });
            } catch {}
          }
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          try {
            await res.json();
          } catch {}
        })
      );

      const succeeded = new Set<string>();
      const failed: string[] = [];
      results.forEach((r, i) =>
        r.status === "fulfilled" ? succeeded.add(ids[i]) : failed.push(ids[i])
      );
      if (succeeded.size)
        setItems((prev) => prev.filter((it) => !succeeded.has(it.id)));
      setSelected({});
      if (failed.length && succeeded.size)
        Alert.alert("Partial delete", `Deleted ${succeeded.size}, failed ${failed.length}.`);
      else if (failed.length) Alert.alert("Delete failed", "Unable to delete selected item(s).");
      else Alert.alert("Deleted", `Deleted ${succeeded.size} item(s).`);
    } catch (e: any) {
      Alert.alert("Delete failed", e?.message ?? "Unable to delete the selected item(s).");
    } finally {
      setDeleting(false);
    }
  };

  const onUnrepostOne = async (id: string) => {
    setUnreposting(true);
    try {
      const res = await fetch(API.unrepost(id), {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      try { await res.json(); } catch {}
      await fetchData();
      Alert.alert("Unreposted", "This post has been unreposted.");
    } catch (e: any) {
      Alert.alert("Unrepost failed", e?.message ?? "Unable to unrepost this post.");
    } finally {
      setUnreposting(false);
    }
  };

  const openDetails = (item: UploadItem) => {
    if (isSelecting) {
      toggleSelect(item.id);
      return;
    }
    navigation.navigate("PostDetailScreen", { postId: item.id, token });
  };

  const renderItem = ({ item, index }: { item: UploadItem; index: number }) => {
    const sel = !!selected[item.id];
    const showMultiple = item.mediaCount >= 2;
    const isLastCol = index % COLS === COLS - 1;

    // in Likes/Saved we don’t show per-item menus
    const showMenus = showManageActions;

    return (
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => openDetails(item)}
        onLongPress={() => enterSelect(item.id)}
        style={[
          styles.tileWrap,
          {
            width: TILE,
            height: TILE,
            marginRight: isLastCol ? 0 : GAP,
            marginBottom: GAP,
          },
        ]}
      >
        <Image source={{ uri: item.uri }} style={styles.tile} resizeMode="cover" />

        {sel && (
          <View style={styles.check}>
            <Feather name="check" size={16} color="#fff" />
          </View>
        )}

        {item.hasVideo && (
          <View style={[styles.badge, { right: 6, top: 6 }]}>
            <Feather name="video" size={12} color="#fff" />
          </View>
        )}

        {showMultiple && (
          <View style={[styles.badge, { left: 6, top: 6, flexDirection: "row", gap: 4 }]}>
            <Feather name="layers" size={12} color="#fff" />
            <Text style={styles.badgeTxt}>{item.mediaCount}</Text>
          </View>
        )}

        {/* Minimal three-dot menu only when managing user's own posts */}
        {showMenus && (
          <TileMenu
            onDelete={() => doBulkDelete([item.id])}
            onUnrepost={() => onUnrepostOne(item.id)}
            busy={deleting || unreposting}
            isOwn // keep same options you had before
          />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <FlatList
      data={items}
      keyExtractor={(it) => it.id}
      numColumns={3}
      renderItem={renderItem}
      contentContainerStyle={{ paddingHorizontal: SIDE, paddingBottom: 40, paddingTop: 6 }}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />
      }
      ListEmptyComponent={
        <View style={styles.empty}>
          <Feather name="image" size={28} color="#7c7c8a" />
          <Text style={{ color: "#7c7c8a", marginTop: 8 }}>
            {mode === "posts" ? "No posts yet" : mode === "likes" ? "No likes yet" : "No saved posts yet"}
          </Text>
        </View>
      }
    />
  );
}

function TileMenu({
  onDelete,
  onUnrepost,
  busy,
  isOwn,
}: {
  onDelete: () => void;
  onUnrepost: () => void;
  busy: boolean;
  isOwn?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View style={{ position: "absolute", top: 6, right: 6, zIndex: 20 }}>
      <TouchableOpacity
        onPress={() => setOpen((s) => !s)}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        style={styles.menuBtn}
        disabled={busy}
      >
        <Feather name="more-vertical" size={16} color="#fff" />
      </TouchableOpacity>

      {open && (
        <>
          <TouchableOpacity
            onPress={() => setOpen(false)}
            style={StyleSheet.absoluteFillObject}
            activeOpacity={1}
          />
          <View style={styles.menu}>
            {isOwn ? (
              <TouchableOpacity
                onPress={() => {
                  setOpen(false);
                  onDelete();
                }}
                style={styles.menuRow}
                activeOpacity={0.9}
                disabled={busy}
              >
                <Feather name="trash-2" size={16} color="#EF4444" />
                <Text style={[styles.menuTxt, { color: "#EF4444" }]}>Delete</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={() => {
                  setOpen(false);
                  onUnrepost();
                }}
                style={styles.menuRow}
                activeOpacity={0.9}
                disabled={busy}
              >
                <Feather name="repeat" size={16} color="#fff" />
                <Text style={styles.menuTxt}>Unrepost</Text>
              </TouchableOpacity>
            )}
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tileWrap: {
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: COLORS.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    position: "relative",
  },
  tile: { width: "100%", height: "100%" },

  badge: {
    position: "absolute",
    backgroundColor: COLORS.overlay,
    paddingHorizontal: 6,
    height: 22,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeTxt: { color: "#fff", fontSize: 11, fontWeight: "700" },

  check: {
    position: "absolute",
    right: 6,
    bottom: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },

  empty: { alignItems: "center", marginTop: 64 },

  menuBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  menu: {
    position: "absolute",
    top: 32,
    right: 0,
    minWidth: 140,
    backgroundColor: "#141520",
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.15)",
    overflow: "hidden",
    elevation: 12,
    zIndex: 30,
  },
  menuRow: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  menuTxt: { color: "#fff", fontWeight: "700" },
});
