// src/screens/FollowListScreen.tsx
import React from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Feather from "react-native-vector-icons/Feather";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { useSelector } from "react-redux";
import { TText } from "../../i18n/TText";
import Avatar from "../../utils/Avatar";

type Params = { userId: number; mode: "followers" | "following" };

const BG = "#0B0B12";
const CARD = "#17171F";
const OUTLINE = "rgba(255,255,255,0.12)";
const TEXT = "#EDEDF4";
const SUBTEXT = "#9A9AA5";
const ACCENT = "#F44336";
const WP_BASE = "https://noctimago.com";

type MiniUser = {
  id: string;
  name: string;
  avatar: string;
  isFollowing?: boolean;
};

const isValidImg = (u?: string | null) =>
  !!u && typeof u === "string" && u.trim().length > 0 && !/\/null$/i.test(u.trim());

const avatarOr = (u?: string | null) =>
  isValidImg(u) ? (u as string) : "https://i.pravatar.cc/150?img=1";

// Accept both shapes: {name, profile_image} and meta-based
function mapMiniUser(u: any, isFollowing: boolean): MiniUser {
  const meta = u?.meta ?? {};
  const fullName =
    u?.name ||
    (meta?.first_name || meta?.last_name
      ? `${meta.first_name ?? ""} ${meta.last_name ?? ""}`.trim()
      : meta?.nickname) ||
    "User";

  return {
    id: String(u?.ID ?? u?.id ?? Math.random()),
    name: fullName,
    avatar: u?.profile_image ?? meta?.profile_image,
    isFollowing,
  };
}

export default function FollowListScreen() {
  const route = useRoute<RouteProp<Record<string, Params>, string>>();
  const nav = useNavigation<any>();
  const { userId, mode } = route.params as Params;

  const token = useSelector((s: any) => s?.authReducer?.token);
  const headers = React.useMemo(
    () => ({
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }),
    [token]
  );

  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [items, setItems] = React.useState<MiniUser[]>([]);

  const title = mode === "followers" ? "Followers" : "Following";

  const load = React.useCallback(async () => {
    if (!userId) return;
    setError(null);
    try {
      setLoading(true);
      const res = await fetch(`${WP_BASE}/wp-json/app/v1/user-profile/${userId}`, {
        method: "GET",
        headers,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();

      // Arrays are under json.profile[mode] per your example payload
      const arr: any[] = Array.isArray(json?.profile?.[mode]) ? json.profile[mode] : [];

      const mapped =
        mode === "followers"
          ? arr.map((u) => mapMiniUser(u, false))
          : arr.map((u) => mapMiniUser(u, true));

      setItems(mapped);
    } catch (e: any) {
      setError(e?.message || "Failed to load list");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [userId, mode, headers]);

  React.useEffect(() => {
    load();
  }, [load]);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const renderItem = ({ item }: { item: MiniUser }) => (
    <TouchableOpacity
      activeOpacity={0.9}
      style={styles.row}
      onPress={() =>
        nav.push("ViewProfileScreen", {
          NTN_User_PkeyID: Number(item.id) || undefined,
        })
      }
    >
        <Avatar
      uri={item.avatar}
      name={item?.name}
      size={50}
      border
    />
      {/* <Image source={{ uri: item.avatar }} style={styles.avatar} /> */}
      <View style={{ flex: 1 ,marginLeft:10}}>
        <TText style={styles.name} numberOfLines={1}>
          {item.name}
        </TText>
        <Text style={styles.sub}>{item.isFollowing ? "Following" : "Follower"}</Text>
      </View>
      <Feather name="chevron-right" size={18} color={SUBTEXT} />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => nav.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Feather name="chevron-left" size={24} color={TEXT} />
        </TouchableOpacity>
        <TText style={styles.topTitle}>{title}</TText>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <View style={{ padding: 20, alignItems: "center" }}>
          <ActivityIndicator />
          <Text style={{ color: SUBTEXT, marginTop: 8 }}>
            Loading {title.toLowerCase()}…
          </Text>
        </View>
      ) : error ? (
        <View style={{ padding: 20 }}>
          <Text style={{ color: "#ff8a80", marginBottom: 8 }}>Error: {error}</Text>
          <TouchableOpacity onPress={load} style={styles.retryBtn}>
            <Text style={styles.retryTxt}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : items.length === 0 ? (
        <View style={{ padding: 20 }}>
          <Text style={{ color: SUBTEXT }}>No {title.toLowerCase()} yet.</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it) => it.id}
          renderItem={renderItem}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          refreshControl={
            <RefreshControl tintColor={TEXT} refreshing={refreshing} onRefresh={onRefresh} />
          }
          contentContainerStyle={{ paddingBottom: 24 }}
        />
      )}
    </SafeAreaView>
  );
}

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

  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: CARD,
  },
  sep: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: OUTLINE,
    marginLeft: 14 + 48 + 12, // align under text, not avatar
  },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: "#222", marginRight: 12 },
  name: { color: TEXT, fontWeight: "700" },
  sub: { color: SUBTEXT, marginTop: 2, fontSize: 12 },

  retryBtn: {
    alignSelf: "flex-start",
    backgroundColor: ACCENT,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  retryTxt: { color: "#fff", fontWeight: "700" },
});
