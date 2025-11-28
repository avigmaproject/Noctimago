// src/screens/ManageUploadsScreen.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
  RefreshControl,
  Alert,
  StatusBar,
  useWindowDimensions,
  ActivityIndicator,  
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Feather from "react-native-vector-icons/Feather";
import { useSelector } from "react-redux";
import { useFocusEffect } from "@react-navigation/native";
type TagPerson = {
  id: string | number;
  name?: string;
  username?: string;
  avatar?: string;
  // add other fields if you know them
};

type UploadItem = {
  id: string;
  uri: string;
  type: "image" | "video";
  hasVideo: boolean;
  mediaCount: number;
  title: string;
  event?: string;
  event_description?: string
  tag_people: TagPerson[];   // 👈 change here
  location?: string;
  images: string[];
  video?: string;

  authorId: string;
  isRepostedByUser: boolean;
  repostCount: number;
};

/* ----------------------------- Types ----------------------------- */


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
  deletePost: (postId: string) => `${WP_BASE}/wp-json/app/v1/delete-post/${postId}`,
  unrepost: (postId: string) => `${WP_BASE}/wp-json/app/v1/unrepost/${postId}`,
};
const PLACEHOLDER_URL =
  "https://upload.wikimedia.org/wikipedia/commons/thumb/b/bc/Unknown_person.jpg/1200px-Unknown_person.jpg";

/* ----------------------------- Screen ---------------------------- */
export default function ManageUploadsScreen({ navigation }: any) {
  const token = useSelector((state: any) => state.authReducer.token);
  const userprofile = useSelector((state: any) => state.authReducer.userprofile);
  const currentUserId = String(userprofile?.ID ?? "");

  // grid
  const { width } = useWindowDimensions();
  const COLS = 2;
  const SIDE = 12;
  const GAP = 8;
  const TILE = Math.floor((width - SIDE * 2 - GAP * (COLS - 1)) / COLS);

  // state
  const [items, setItems] = useState<UploadItem[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [unreposting, setUnreposting] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  const isSelecting = useMemo(() => Object.keys(selected).length > 0, [selected]);

  /* --------------------------- Helpers --------------------------- */
  const sanitizeCsv = (csv: any): string[] =>
    typeof csv === "string"
      ? csv.split(",").map((s) => s.trim()).filter(Boolean)
      : [];

      const pickMediaFromPost = (p: any): UploadItem => {
        const f = p?.fields || {};
        const images = sanitizeCsv(f.images);
        const hasVideo = !!(f.video && String(f.video).trim().length);
        const mediaCount = images.length + (hasVideo ? 1 : 0);
        const thumb = images[0] || PLACEHOLDER_URL;
        const type: "image" | "video" =
          images.length > 0 ? "image" : hasVideo ? "video" : "image";
      
        const authorId = String(p?.author_id ?? "");
        const isRepostedByUser =
          !!p?.is_reposted_by_user ||
          String(f?.reposted_by_users?.ID ?? "") === currentUserId;
      
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
          tag_people: normalizeTagPeople(f?.tag_people), 
          event_description: String(f?.event_description ?? ""),   // 👈 fixed
          location: String(f?.location ?? ""),
          images,
          video: hasVideo ? String(f.video).trim() : undefined,
          authorId,
          isRepostedByUser,
          repostCount,
        };
      };
      
  const parseTagPeople = (raw: any): string[] => {
    if (!raw) return [];
  
    // already array (e.g. ["1", "2"])
    if (Array.isArray(raw)) {
      return raw.map((x) => String(x)).filter(Boolean);
    }
  
    if (typeof raw === "string") {
      const trimmed = raw.trim();
      if (!trimmed) return [];
  
      // if backend sends '["1","2"]'
      if ((trimmed.startsWith("[") && trimmed.endsWith("]")) ||
          (trimmed.startsWith("{") && trimmed.endsWith("}"))) {
        try {
          const parsed = JSON.parse(trimmed);
          if (Array.isArray(parsed)) {
            return parsed.map((x) => String(x)).filter(Boolean);
          }
        } catch {
          // fall through to CSV handling
        }
      }
  
      // CSV: "1,2, 3"
      return trimmed
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }
  
    return [];
  };
  
  /* ------------------------- Data fetching ------------------------ */
  const fetchUserPosts = useCallback(
    async (userId: string, jwt?: string) => {
      setInitialLoading(true); // 👈 start loading for this fetch (important on first load)
      try {
        const res = await fetch(API.userPosts(userId), {
          method: "GET",
          headers: { Accept: "application/json", ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}) },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const posts: any[] = data?.posts ?? [];
        setItems(posts.map((p) => pickMediaFromPost(p)));
      } catch (err) {
        console.error("Error fetching posts:", err);
        Alert.alert("Error", "Could not load your uploads.");
        setItems([]);
      } finally {
        setInitialLoading(false); // 👈 done
      }
    },
    [currentUserId]
  );
  

  useEffect(() => {
    if (currentUserId) fetchUserPosts(currentUserId, token);
  }, [currentUserId, token, fetchUserPosts]);

  useFocusEffect(
    useCallback(() => {
      if (!currentUserId) return;
      fetchUserPosts(currentUserId, token);
    }, [currentUserId, token, fetchUserPosts])
  );

  const onRefresh = useCallback(async () => {
    if (!currentUserId) return;
    setRefreshing(true);
    try {
      await fetchUserPosts(currentUserId, token);
    } finally {
      setRefreshing(false);
    }
  }, [currentUserId, token, fetchUserPosts]);
  const normalizeTagPeople = (raw: any): TagPerson[] => {
    if (!raw) return [];
  
    // Already an array of objects or ids
    if (Array.isArray(raw)) {
      // If elements are objects, just return as TagPerson[]
      if (raw.length > 0 && typeof raw[0] === "object") {
        return raw as TagPerson[];
      }
  
      // If elements are primitive (ids or usernames)
      return raw
        .map((v) => {
          if (typeof v === "object" || v == null) return null;
          const id = String(v);
          return { id } as TagPerson;
        })
        .filter(Boolean) as TagPerson[];
    }
  
    // If backend sends JSON string of array, e.g. '[{"id":2832,"name":"John"}]'
    if (typeof raw === "string") {
      const trimmed = raw.trim();
      if (!trimmed) return [];
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          // if parsed is array of objects, use as-is
          if (parsed.length > 0 && typeof parsed[0] === "object") {
            return parsed as TagPerson[];
          }
          // if parsed is array of ids
          return parsed
            .map((v: any) => {
              if (typeof v === "object" || v == null) return null;
              const id = String(v);
              return { id } as TagPerson;
            })
            .filter(Boolean) as TagPerson[];
        }
      } catch {
        // fall through to CSV-style as last resort
      }
  
      // last fallback: CSV, e.g. "2832, 2833"
      return trimmed
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .map((id) => ({ id })) as TagPerson[];
    }
  
    return [];
  };
  
  /* ------------------------ Selection logic ----------------------- */
  const toggleSelect = (id: string) =>
    setSelected((prev) => {
      const next = { ...prev };
      if (next[id]) delete next[id];
      else next[id] = true;
      return next;
    });

  const enterSelect = (id: string) => {
    if (isSelecting) toggleSelect(id);
    else setSelected({ [id]: true });
  };

  const clearSelection = () => setSelected({});

  /* --------------------------- Delete API ------------------------- */
  const doBulkDelete = async (ids: string[]) => {
    setDeleting(true);
    try {
      const headers: Record<string, string> = { Accept: "application/json" };
      if (token) headers.Authorization = `Bearer ${token}`;

      const results = await Promise.allSettled(
        ids.map(async (id) => {
          const url = API.deletePost(id);
          let res = await fetch(url, { method: "DELETE", headers: { ...headers, "Content-Type": "application/json" } });
          if (!res.ok) {
            try { res = await fetch(url, { method: "GET", headers }); } catch {}
          }
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          try { await res.json(); } catch {}
        })
      );

      const succeeded = new Set<string>();
      const failed: string[] = [];
      results.forEach((r, i) => (r.status === "fulfilled" ? succeeded.add(ids[i]) : failed.push(ids[i])));
      if (succeeded.size) setItems((prev) => prev.filter((it) => !succeeded.has(it.id)));
      setSelected({});
      if (failed.length && succeeded.size) Alert.alert("Partial delete", `Deleted ${succeeded.size}, failed ${failed.length}.`);
      else if (failed.length) Alert.alert("Delete failed", "Unable to delete selected item(s).");
      else Alert.alert("Deleted", `Deleted ${succeeded.size} item(s).`);
    } catch (e: any) {
      console.log("[BulkDelete] error", e);
      Alert.alert("Delete failed", e?.message ?? "Unable to delete the selected item(s).");
    } finally {
      setDeleting(false);
    }
  };

  /* --------------------------- Unrepost API ----------------------- */
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
      await fetchUserPosts(currentUserId, token); // refresh after success
      Alert.alert("Unreposted", "This post has been unreposted.");
    } catch (e: any) {
      console.log("[Unrepost] error", e);
      Alert.alert("Unrepost failed", e?.message ?? "Unable to unrepost this post.");
    } finally {
      setUnreposting(false);
    }
  };

  /* ----------------------------- Edit ----------------------------- */
  const onEditOne = (item: UploadItem) => {
    console.log("item", item);
   
    navigation.navigate("EditPostScreen", {
      postId: item.id,
      initial: {
        title: item.title,
        event: item.event || "",
        tag_people: item.tag_people || [],
        event_description: item.event_description || "",   
        location: item.location || "",
        images: item.images || [],
        video: item.video || "",
        coords: null,
      },
    });
  };
  

  const openDetails = (item: UploadItem) => {
    if (isSelecting) {
      toggleSelect(item.id);
      return;
    }
    navigation.navigate("PostDetailScreen", { postId: item.id, token });
  };

  /* --------------------------- Rendering -------------------------- */
  const renderHeader = () => (
    <View style={styles.header}>
      {isSelecting ? (
        <>
          <TouchableOpacity onPress={clearSelection} hitSlop={hit}>
            <Feather name="x" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{Object.keys(selected).length} selected</Text>
          <TouchableOpacity
            onPress={() => {
              const ids = Object.keys(selected);
              if (!ids.length || deleting) return;
              Alert.alert("Delete items?", `Permanently delete ${ids.length} item(s)?`, [
                { text: "Cancel", style: "cancel" },
                { text: "Delete", style: "destructive", onPress: () => doBulkDelete(ids) },
              ]);
            }}
            hitSlop={hit}
            disabled={deleting}
            style={[styles.deleteBtn, deleting && { opacity: 0.6 }]}
          >
            <Feather name="trash-2" size={18} color="#fff" />
          </TouchableOpacity>
        </>
      ) : (
        <>
          <TouchableOpacity onPress={() => navigation?.goBack?.()} hitSlop={hit}>
            <Feather name="chevron-left" size={26} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Manage Uploads</Text>
          <View style={{ width: 24 }} />
        </>
      )}
    </View>
  );

  const renderItem = ({ item, index }: { item: UploadItem; index: number }) => {
    const sel = !!selected[item.id];
    const showMultiple = item.mediaCount >= 2;
    const isLastCol = index % COLS === COLS - 1;

    const mode: "own" | "repost" | "none" =
      item.isRepostedByUser ? "repost" : item.authorId === currentUserId ? "own" : "none";

    return (
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => openDetails(item)}
        onLongPress={() => enterSelect(item.id)}
        style={[
          styles.tileWrap,
          { width: TILE, height: TILE, marginRight: isLastCol ? 0 : GAP, marginBottom: GAP },
        ]}
      >
        <Image source={{ uri: item.uri }} style={styles.tile} resizeMode="cover" />

        {/* selection check */}
        {sel && (
          <View style={styles.check}>
            <Feather name="check" size={16} color="#fff" />
          </View>
        )}

        {/* video badge */}
        {item.hasVideo && (
          <View style={[styles.badge, { right: 6, top: 6 }]}>
            <Feather name="video" size={12} color="#fff" />
          </View>
        )}

        {/* multiple badge */}
        {showMultiple && (
          <View style={[styles.badge, { left: 6, top: 6, flexDirection: "row", gap: 4 }]}>
            <Feather name="layers" size={12} color="#fff" />
            <Text style={styles.badgeTxt}>{item.mediaCount}</Text>
          </View>
        )}

        {/* repost badge (bottom-left) */}
        {item.repostCount > 0 && (
          <View style={[styles.badge, { left: 6, bottom: 6, flexDirection: "row", gap: 6 }]}>
            <Feather name="repeat" size={12} color="#fff" />
            <Text style={styles.badgeTxt}>{item.repostCount}</Text>
          </View>
        )}

        {/* 3-dot menu */}
        <TileMenu
          mode={mode}
          onEdit={() => onEditOne(item)}
          onDelete={() => doBulkDelete([item.id])}
          onUnrepost={() => onUnrepostOne(item.id)}
          busy={deleting || unreposting}
        />
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.bg }} edges={["top", "bottom"]}>
      <StatusBar barStyle="light-content" />
      {/* {renderHeader()} */}

      <FlatList
        data={items}
        keyExtractor={(it) => it.id}
        numColumns={2}
        renderItem={renderItem}
        contentContainerStyle={{ paddingHorizontal: SIDE, paddingBottom: 40, paddingTop: 6 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />}
        ListEmptyComponent={
          initialLoading ? (
            <View style={styles.empty}>
              <ActivityIndicator size="small" color="#fff" />
              <Text style={{ color: "#7c7c8a", marginTop: 8 }}>Loading your uploads...</Text>
            </View>
          ) : (
            <View style={styles.empty}>
              <Feather name="image" size={28} color="#7c7c8a" />
              <Text style={{ color: "#7c7c8a", marginTop: 8 }}>No uploads yet</Text>
            </View>
          )
        }
      />
    </SafeAreaView>
  );
}

/* --------------------------- Tile Menu --------------------------- */
function TileMenu({
  mode, // "own" | "repost" | "none"
  onEdit,
  onDelete,
  onUnrepost,
  busy,
}: {
  mode: "own" | "repost" | "none";
  onEdit: () => void;
  onDelete: () => void;
  onUnrepost: () => void;
  busy: boolean;
}) {
  const [open, setOpen] = useState(false);
  if (mode === "none") return null;

  return (
    <View style={{ position: "absolute", top: 6, right: 6, zIndex: 20 }}>
      <TouchableOpacity
        onPress={() => setOpen((s) => !s)}
        hitSlop={hit}
        style={styles.menuBtn}
        disabled={busy}
      >
        <Feather name="more-vertical" size={16} color="#fff" />
      </TouchableOpacity>

      {open && (
        <>
          {/* click-away (covers the tile only) */}
          <TouchableOpacity
            onPress={() => setOpen(false)}
            style={StyleSheet.absoluteFillObject}
            activeOpacity={1}
          />
          <View style={styles.menu}>
            {/* Edit always present */}
            <TouchableOpacity
              onPress={() => { setOpen(false); onEdit(); }}
              style={styles.menuRow}
              activeOpacity={0.9}
              disabled={busy}
            >
              <Feather name="edit-3" size={16} color="#fff" />
              <Text style={styles.menuTxt}>Edit</Text>
            </TouchableOpacity>

            <View style={styles.menuDivider} />

            {mode === "own" ? (
              <TouchableOpacity
                onPress={() => { setOpen(false); onDelete(); }}
                style={styles.menuRow}
                activeOpacity={0.9}
                disabled={busy}
              >
                <Feather name="trash-2" size={16} color="#EF4444" />
                <Text style={[styles.menuTxt, { color: "#EF4444" }]}>Delete</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={() => { setOpen(false); onUnrepost(); }}
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

const hit = { top: 10, bottom: 10, left: 10, right: 10 };

/* ----------------------------- Styles ---------------------------- */
const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 14,
    paddingTop: 6,
    paddingBottom: 10,
    borderBottomColor: COLORS.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: { color: COLORS.text, fontSize: 18, fontWeight: "700" },

  deleteBtn: {
    backgroundColor: COLORS.danger,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },

  tileWrap: {
    borderRadius: 12,
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

  // menu
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
  menuDivider: { height: StyleSheet.hairlineWidth, backgroundColor: "rgba(255,255,255,0.12)" },
});
