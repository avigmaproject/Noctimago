// src/screens/ViewProfileScreen.tsx
import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  FlatList,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Alert,
  InteractionManager,
  Modal
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Feather from "react-native-vector-icons/Feather";
import { useRoute, useNavigation, useFocusEffect } from "@react-navigation/native";
import { useSelector } from "react-redux";
import { TText } from "../../i18n/TText";
import ImageView from "react-native-image-viewing";
import Avatar from "../../utils/Avatar";
import { sendnotify } from "../../utils/apiconfig";

/* ---------------- Types ---------------- */
type RouteParams = { NTN_User_PkeyID?: number };

type UploadItem = {
  id: string;
  postId: string;
  kind: "image" | "video";
  url: string;
  thumbnail?: string;
  title?: string;
  event?: string;
  location?: string;
  date?: string;
  likes?: number;
  likedBy?: number[];
};

/* ---------------- Theme ---------------- */
const BG = "#0B0B12";
const CARD = "#17171F";
const OUTLINE = "rgba(255,255,255,0.12)";
const TEXT = "#EDEDF4";
const SUBTEXT = "#9A9AA5";
const ACCENT = "#F44336";

/* ---------------- Config ---------------- */
const WP_BASE = "https://noctimago.com";

/* ---------------- Helpers ---------------- */
const isValidImg = (u?: string | null) =>
  !!u && typeof u === "string" && u.trim().length > 0 && !/\/null$/i.test(u.trim());

const avatarOr = (u?: string | null) =>
  isValidImg(u) ? (u as string) : "https://i.pravatar.cc/150?img=1";

const splitImages = (s?: string | null): string[] =>
  (s || "")
    .split(",")
    .map((x) => x.trim())
    .filter(isValidImg);
// --- Emoji / entity decode helpers (same as profile/comments) ---
const decodeCurlyUnicode = (s: string) =>
  s.replace(/u\{([0-9a-fA-F]+)\}/g, (_, hex) =>
    String.fromCodePoint(parseInt(hex, 16)),
  );

const decodeHtmlEntities = (s: string) =>
  s
    // &#x1F382;
    .replace(/&#x([0-9A-Fa-f]+);/g, (_, hex) =>
      String.fromCodePoint(parseInt(hex, 16)),
    )
    // &#128152;
    .replace(/&#(\d+);/g, (_, num) =>
      String.fromCodePoint(parseInt(num, 10)),
    );

// normalize truthy flags from API (true, "true", "1", 1, "yes", "on")
const toBool = (v: any): boolean => {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v === 1;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    return s === "true" || s === "1" || s === "yes" || s === "on";
  }
  return false;
};

/** Map one /user-posts post to N UploadItems (images + optional video) */
function mapPostToUploadItems(p: any): UploadItem[] {
  const pid = String(p?.ID ?? p?.id ?? "");
  const f = p?.fields ?? {};
  const imgs = splitImages(f?.images);
  const video = (f?.video || "").trim();
  const likes = Number(f?._likes ?? 0) || 0;
  const likedBy: number[] = Array.isArray(f?._liked_users)
    ? f._liked_users.map((n: any) => Number(n)).filter(Boolean)
    : [];

  const baseMeta = {
    postId: pid,
    title: p?.title ?? "",
    event: f?.event ?? "",
    location: f?.location ?? "",
    date: p?.date ?? "",
    likes,
    likedBy,
  };

  const items: UploadItem[] = [];

  imgs.forEach((url: string, i: number) => {
    items.push({
      id: `${pid}-img-${i}`,
      kind: "image",
      url,
      ...baseMeta,
    });
  });

  if (isValidImg(video)) {
    items.push({
      id: `${pid}-vid`,
      kind: "video",
      url: video,
      thumbnail: imgs[0],
      ...baseMeta,
    });
  }

  return items;
}

/* ---------------- Screen ---------------- */
export default function ViewProfileScreen() {
  const route = useRoute<any>();
  const nav = useNavigation<any>();
  const params = (route?.params || {}) as RouteParams;

  const userprofile = useSelector((state: any) => state.authReducer.userprofile);
  const token = useSelector((s: any) => s?.authReducer?.token);
  const myUserId = useSelector((s: any) => s?.authReducer?.user?.id); // not directly used but kept for context

  const userId = params?.NTN_User_PkeyID;
  const [bioModalVisible, setBioModalVisible] = React.useState(false);

  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // profile VM (batched updates → fewer renders)
  const [profileVM, setProfileVM] = React.useState({
    profileName: "",
    username: "",
    bio: "",
    avatar: "",
    isPublicProfile: false,
    followersCount: 0,
    followingCount: 0,
    isFollowing: false,
  });
  const {
    profileName,
    username,
    bio,
    avatar,
    isPublicProfile,
    followersCount,
    followingCount,
    isFollowing,
  } = profileVM;

  // action guards
  const [busy, setBusy] = React.useState<boolean>(false);
  const [blocking, setBlocking] = React.useState(false);

  // uploads
  const [uploads, setUploads] = React.useState<UploadItem[]>([]);

  // avatar preview
  const [avatarOpen, setAvatarOpen] = React.useState(false);
  const avatarImages = avatar ? [{ uri: avatar }] : [];

  // headers with auth if present
  const headers = React.useMemo(
    () => ({
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }),
    [token]
  );

  /** visibility = public OR following OR viewing self */
  const isSelf = React.useMemo(
    () => !!userprofile?.ID && !!userId && Number(userprofile?.ID) === Number(userId),
    [userprofile?.ID, userId]
  );
  const canSee = React.useMemo(
    () => isSelf || isPublicProfile || isFollowing,
    [isSelf, isPublicProfile, isFollowing]
  );

  // ----- fetch helpers with batching -----
  const fetchProfile = React.useCallback(async () => {
    if (!userId) return { public: false, following: false };
    setError(null);
    try {
      const res = await fetch(`${WP_BASE}/wp-json/app/v1/user-profile/${userId}`, {
        method: "GET",
        headers,
      });
      if (!res.ok) throw new Error(`Profile HTTP ${res.status}`);
      const json = await res.json();

      const p = json?.profile;
      const meta = p?.meta ?? {};
      const name =
        (meta?.first_name || meta?.last_name
          ? `${meta.first_name ?? ""} ${meta.last_name ?? ""}`.trim()
          : p?.name || meta?.nickname) || "User";
console.log("p",json?.profile)
      const unameBase = (meta?.nickname || p?.name || "user").toString();
      const uname = unameBase.replace(/\s+/g, "");
      const rawBio = String(p?.bio ?? "");
      const newVM = {
        profileName: name,
        username: uname,
        bio: decodeHtmlEntities(decodeCurlyUnicode(rawBio)),
        avatar: meta?.profile_image,
        isPublicProfile: toBool(meta?.public_profile),
        followersCount: Number(json?.profile?.followers_count ?? 0),
        followingCount: Number(json?.profile?.following_count ?? 0),
        isFollowing: Boolean(json?.profile?.is_following),
      };
      setProfileVM(newVM);

      return { public: newVM.isPublicProfile, following: newVM.isFollowing };
    } catch (e: any) {
      setError(e?.message || "Failed to load profile");
      return { public: false, following: false };
    }
  }, [userId, headers]);

  const fetchUploadsForUser = React.useCallback(async () => {
    if (!userId) return;
    try {
      const res = await fetch(`${WP_BASE}/wp-json/app/v1/user-posts/${userId}`, {
        method: "GET",
        headers,
      });
      if (!res.ok) throw new Error(`Uploads HTTP ${res.status}`);
      const json = await res.json();

      const posts: any[] = json?.posts ?? [];
      const mapped: UploadItem[] = posts.flatMap(mapPostToUploadItems);

      // newest first by post date
      mapped.sort(
        (a, b) => (new Date(b.date || 0).getTime() || 0) - (new Date(a.date || 0).getTime() || 0)
      );

      setUploads(mapped);
    } catch {
      setUploads([]);
    }
  }, [userId, headers]);

  // ----- guarded load (once per userId) + defer after interactions -----
  const inFlightRef = React.useRef(false);
  const loadedForRef = React.useRef<number | null>(null);

  const loadAll = React.useCallback(async () => {
    if (!userId) return;
    if (inFlightRef.current) return;
    if (loadedForRef.current === userId) return; // already loaded for this userId

    inFlightRef.current = true;
    setLoading(true);
    try {
      const pf = await fetchProfile();
      const visible = isSelf || pf.public || pf.following;
      if (visible) {
        await fetchUploadsForUser();
      } else {
        setUploads([]);
      }
      loadedForRef.current = userId;
    } finally {
      setLoading(false);
      inFlightRef.current = false;
    }
  }, [userId, fetchProfile, fetchUploadsForUser, isSelf]);
  const SendNotification = async (
    message: string,
    title: string,
    receiverId?: string,
    type?: number,

  ) => {
    try {
      const me = String(userprofile?.ID ?? "");
      const rc = String(receiverId ?? "");
      if (!rc || me === rc) {
        return;
      }
      const payload = JSON.stringify({
  
        message,
        msgtitle: title,
        User_PkeyID: userprofile?.ID,
        UserID: rc,
        NTN_C_L: 1,
        NTN_Sender_Name: userprofile?.meta?.first_name,
        NTN_Sender_Img: userprofile?.meta?.profile_image,
        NTN_Reciever_Name: "",
        NTN_Reciever_Img: "",
  
        NTN_UP_Path: "",
      });

      await sendnotify(payload, token);
      console.log("payload",payload)
    } catch (err) {
    }
  };
  useFocusEffect(
    React.useCallback(() => {
      let cancelled = false;
      loadedForRef.current = null; // ensure a fresh load for a different userId
      const task = InteractionManager.runAfterInteractions(() => {
        if (!cancelled) loadAll();
      });
      return () => {
        cancelled = true;
        task.cancel();
      };
    }, [userId, loadAll])
  );

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    // force reload ignoring the once-per-userId guard
    loadedForRef.current = null;
    await loadAll();
    setRefreshing(false);
  }, [loadAll]);

  /** -------- Follow / Unfollow with optimistic update -------- */
  const toggleFollow = React.useCallback(async () => {
    if (!userId) return;
    if (!token) {
      Alert.alert("Sign in required", "Please log in to follow users.");
      return;
    }
    if (busy) return;

    setBusy(true);
    const wasFollowing = isFollowing;

    // Optimistic: flip follow + adjust follower count
    setProfileVM((vm) => ({
      ...vm,
      isFollowing: !wasFollowing,
      followersCount: Math.max(0, vm.followersCount + (wasFollowing ? -1 : 1)),
    }));

    try {
      const url = wasFollowing
        ? `${WP_BASE}/wp-json/app/v1/unfollow_user/${userId}`
        : `${WP_BASE}/wp-json/app/v1/follow_user/${userId}`;

      const res = await fetch(url, {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) throw new Error(`${wasFollowing ? "Unfollow" : "Follow"} HTTP ${res.status}`);
console.log("res",res)
      // Re-sync from server
      const pf = await fetchProfile();

      // If following now, we may be able to see uploads → fetch them
      if (!wasFollowing && (isSelf || pf.public || pf.following)) {
        await fetchUploadsForUser();
        if (!wasFollowing) {
          const followerName =
            userprofile?.meta?.first_name ||
            userprofile?.meta?.nickname ||
            "Someone";
    
          const msgTitle = "New follower";
          const msgBody = `${followerName} started following you.`;
    
          // fire-and-forget, no need to await
          SendNotification(msgBody, msgTitle, String(userId));
        }
      }
    } catch (e: any) {
      // Rollback
      setProfileVM((vm) => ({
        ...vm,
        isFollowing: wasFollowing,
        followersCount: Math.max(0, vm.followersCount + (wasFollowing ? 1 : -1)),
      }));
      Alert.alert("Oops", e?.message ?? "Could not update follow status");
    } finally {
      setBusy(false);
    }
  }, [userId, token, isFollowing, busy, fetchProfile, fetchUploadsForUser, isSelf]);

  /** -------- Block user (header-right) -------- */
  const confirmBlock = React.useCallback(() => {
    if (!userId) return;
    if (!token) {
      Alert.alert("Sign in required", "Please log in to block users.");
      return;
    }
    if (isSelf) {
      Alert.alert("Not allowed", "You can’t block your own account.");
      return;
    }

    Alert.alert(
      "Block user",
      `Block ${profileName || "this user"}? They won’t be able to interact with you.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Block",
          style: "destructive",
          onPress: async () => {
            try {
              setBlocking(true);
              const res = await fetch(`${WP_BASE}/wp-json/app/v1/block_user/${userId}`, {
                method: "POST",
                headers: {
                  Accept: "application/json",
                  Authorization: `Bearer ${token}`,
                },
              });
              let payload: any = null;
              try {
                payload = await res.json();
              } catch {}
              if (!res.ok) throw new Error(payload?.message || `Block HTTP ${res.status}`);

              Alert.alert("Blocked", `${profileName || "User"} has been blocked.`);
              nav.goBack(); // or: nav.navigate("BlockListScreen");
            } catch (e: any) {
              Alert.alert("Couldn’t block", e?.message || "Please try again.");
            } finally {
              setBlocking(false);
            }
          },
        },
      ]
    );
  }, [userId, token, isSelf, profileName, nav]);

  /* -------- Renderers -------- */
  const renderUpload = ({ item }: { item: UploadItem }) => (
    <TouchableOpacity
      activeOpacity={0.9}
      style={styles.gridCell}
      onPress={() => {
        nav.navigate("PostDetailScreen", { postId: item.postId, token });
      }}
    >
      <Image
        source={{ uri: item.kind === "video" ? item.thumbnail || item.url : item.url }}
        style={styles.gridImg}
        resizeMode="cover"
      />
      {item.kind === "video" && (
        <View style={{ position: "absolute", right: 6, bottom: 6 }}>
          <Feather name="play-circle" size={16} color="#fff" />
        </View>
      )}
    </TouchableOpacity>
  );

  /* -------- UI -------- */
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => nav.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Feather name="chevron-left" size={24} color={TEXT} />
        </TouchableOpacity>

        <TText style={styles.topTitle}>Profile</TText>

        {/* RIGHT: Block action (hidden for self) */}
        {!isSelf ? (
          <TouchableOpacity
            onPress={confirmBlock}
            disabled={blocking}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={{ opacity: blocking ? 0.6 : 1 }}
          >
            <Feather name="slash" size={20} color={TEXT} />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 24 }} />
        )}
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={<RefreshControl tintColor={TEXT} refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Loading / Error */}
        {loading ? (
          <View style={{ padding: 20, alignItems: "center" }}>
            <ActivityIndicator />
            <Text style={{ color: SUBTEXT, marginTop: 8 }}>Loading profile…</Text>
          </View>
        ) : error ? (
          <View style={{ padding: 20 }}>
            <Text style={{ color: "#ff8a80", marginBottom: 8 }}>Error: {error}</Text>
            <TouchableOpacity onPress={loadAll} style={[styles.followBtn, { alignSelf: "flex-start" }]}>
              <Text style={styles.followTxt}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Profile Card */}
            <View style={styles.card}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={() => avatar && setAvatarOpen(true)}
                  style={{ overflow: "hidden" }}
                >
                  <Avatar uri={avatar} name={profileName} size={60} border />
                </TouchableOpacity>

                <View style={{ marginLeft: 12, flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <TText style={styles.name}>{profileName || "User"}</TText>
                    {!isPublicProfile && !isSelf && !isFollowing && (
                      <Feather name="lock" size={16} color={SUBTEXT} style={{ marginLeft: 6 }} />
                    )}
                  </View>

                  {canSee && !!bio && (
  <TouchableOpacity
    activeOpacity={0.7}
    onPress={() => setBioModalVisible(true)}
  >
    <Text
      style={styles.bio}
      numberOfLines={2}
      ellipsizeMode="tail"
    >
      {bio}
    </Text>
    <Text style={styles.moreLink}>... more</Text>
  </TouchableOpacity>
)}

                </View>
              </View>

              {/* Stats + Follow button */}
              <View style={styles.statsRow}>
                <View style={styles.statBox}>
                  <TText style={styles.statValue}>{uploads.length}</TText>
                  <Text style={styles.statLabel}>Posts</Text>
                </View>

                <TouchableOpacity
                  style={styles.statBox}
                  activeOpacity={0.9}
                  onPress={() => {
                    if (!canSee) return Alert.alert("Private account", "Follow to see followers.");
                    nav.navigate("FollowListScreen", { userId, mode: "followers" });
                  }}
                >
                  <TText style={styles.statValue}>{followersCount}</TText>
                  <Text style={styles.statLabel}>Followers</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.statBox}
                  activeOpacity={0.9}
                  onPress={() => {
                    if (!canSee) return Alert.alert("Private account", "Follow to see following.");
                    nav.navigate("FollowListScreen", { userId, mode: "following" });
                  }}
                >
                  <TText style={styles.statValue}>{followingCount}</TText>
                  <Text style={styles.statLabel}>Following</Text>
                </TouchableOpacity>
              </View>

              {!isSelf && (
                <View style={styles.actionsRow}>
                  <TouchableOpacity
                    onPress={toggleFollow}
                    activeOpacity={0.9}
                    disabled={busy}
                    style={[styles.followBtn, (isFollowing || busy) && styles.followingBtn]}
                  >
                    <Text style={[styles.followTxt, (isFollowing || busy) && styles.followingTxt]}>
                      {busy ? (isFollowing ? "Following…" : "Following…") : isFollowing ? "Following" : "Follow"}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    activeOpacity={0.9}
                    style={styles.messageBtn}
                    onPress={() => {
                      nav.navigate("Chat", {
                        userId, // other user's WP ID
                        name: profileName,
                        avatar,
                      });
                    }}
                  >
                    <Feather name="message-circle" size={18} color={TEXT} />
                    <Text style={styles.messageTxt}>Message</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Uploads / Private state */}
            <View style={[styles.card, { padding: 0 }]}>
              <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 }}>
                <TText style={styles.sectionTitle}>Uploads</TText>
              </View>

              {!canSee ? (
                <View style={styles.privateWrap}>
                  <Feather name="lock" size={28} color={SUBTEXT} />
                  <Text style={styles.privateText}>This account is private</Text>
                  <Text style={styles.privateSub}>Follow to see their photos and videos.</Text>
                </View>
              ) : uploads.length === 0 ? (
                <Text style={{ color: SUBTEXT, marginTop: -4, paddingHorizontal: 16, paddingBottom: 12 }}>
                  No uploads yet.
                </Text>
              ) : (
                <FlatList
                  data={uploads}
                  keyExtractor={(it) => it.id}
                  renderItem={renderUpload}
                  numColumns={3}
                  scrollEnabled={false}
                  columnWrapperStyle={{ gap: 2 }}
                  contentContainerStyle={{ gap: 2 }}
                  initialNumToRender={12}
                  windowSize={7}
                  maxToRenderPerBatch={12}
                  updateCellsBatchingPeriod={50}
                  removeClippedSubviews
                />
              )}
            </View>
          </>
        )}

        {/* Avatar Lightbox */}
        <ImageView
          images={avatarImages}
          imageIndex={0}
          visible={avatarOpen}
          onRequestClose={() => setAvatarOpen(false)}
          swipeToCloseEnabled
          doubleTapToZoomEnabled
          HeaderComponent={() => null}
        />
        <Modal
  visible={bioModalVisible}
  transparent
  animationType="slide"
  onRequestClose={() => setBioModalVisible(false)}
>
  <View style={styles.bioModalBackdrop}>
    <View style={styles.bioModalCard}>
      <View style={styles.bioModalHeader}>
        <Text style={styles.bioModalTitle}>Bio</Text>
        <TouchableOpacity onPress={() => setBioModalVisible(false)}>
          <Feather name="x" size={20} color={TEXT} />
        </TouchableOpacity>
      </View>

      <ScrollView >
        <Text style={styles.bioModalText}>{bio}</Text>
      </ScrollView>
    </View>
  </View>
</Modal>

      </ScrollView>
    </SafeAreaView>
  );
}

/* ---------------- Styles ---------------- */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  bioModalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  bioModalCard: {
    width: "88%",
    maxHeight: "75%",
    backgroundColor: CARD,
    borderRadius: 18,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: OUTLINE,
  },
  bioModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  bioModalTitle: {
    color: TEXT,
    fontSize: 16,
    fontWeight: "700",
  },
  bioModalText: {
    color: TEXT,
    fontSize: 14,
    lineHeight: 20,
  },
  moreLink: {
    color: ACCENT,
    fontSize: 12,
    marginTop: 4,
  },

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

  card: {
    backgroundColor: CARD,
    margin: 10,
    padding: 16,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: OUTLINE,
  },

  name: { color: TEXT, fontSize: 18, fontWeight: "700" },
  username: { color: SUBTEXT, marginTop: 2 },
  bio: { color: TEXT, marginTop: 8, lineHeight: 20 },

  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 14,
  },
  statBox: { alignItems: "center", flex: 1 },
  statValue: { color: TEXT, fontWeight: "800", fontSize: 16 },
  statLabel: { color: SUBTEXT, marginTop: 4, fontSize: 12 },

  actionsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },
  followBtn: {
    flex: 1,
    height: 40,
    backgroundColor: ACCENT,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  followingBtn: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "rgba(244,67,54,0.6)",
  },
  followTxt: { color: "#fff", fontWeight: "700" },
  followingTxt: { color: ACCENT, fontWeight: "700" },

  messageBtn: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderColor: OUTLINE,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  messageTxt: { color: TEXT, fontWeight: "700" },

  sectionTitle: { color: TEXT, fontSize: 16, fontWeight: "700" },

  gridCell: {
    flex: 1 / 3,
    aspectRatio: 1,
    backgroundColor: "#0f0f16",
  },
  gridImg: {
    width: "100%",
    height: "100%",
  },

  privateWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 32,
    gap: 8,
  },
  privateText: { color: TEXT, fontWeight: "700", marginTop: 6 },
  privateSub: { color: SUBTEXT, fontSize: 12 },
});
