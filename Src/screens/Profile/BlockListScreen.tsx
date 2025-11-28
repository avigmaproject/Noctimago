// src/screens/Blocks/BlockListScreen.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Platform,
  Alert,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import Feather from "react-native-vector-icons/Feather";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useSelector } from "react-redux";
import Avatar from "../../utils/Avatar";

const COLORS = {
  bg: "#0E0E12",
  card: "#16161C",
  cardElev: "#1A1A22",
  text: "#FFFFFF",
  subtext: "#9CA3AF",
  accent: "#F43F5E",
  border: "rgba(255,255,255,0.12)",
  inputBg: "#0F1117",
  inputBorder: "rgba(255,255,255,0.10)",
  inputPlaceholder: "#7C8493",
};

type BlockedUser = {
  id: number;
  name: string;
  email: string;
  profile_image?: string;
};

const ENDPOINT = "https://noctimago.com/wp-json/app/v1/blocked_users";
const UNBLOCK_ENDPOINT = "https://noctimago.com/wp-json/app/v1/unblock_user"; // /:id

export default function BlockListScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const token = useSelector((s: any) => s?.authReducer?.token);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [list, setList] = useState<BlockedUser[]>([]);
  const [q, setQ] = useState("");
  const [unblockingIds, setUnblockingIds] = useState<Set<number>>(new Set());

  const headers: Record<string, string> = useMemo(() => {
    const h: Record<string, string> = { Accept: "application/json" };
    if (token) h.Authorization = `Bearer ${token}`;
    return h;
  }, [token]);

  const load = useCallback(async () => {
    try {
      setError(null);
      setLoading(true);
      const res = await fetch(ENDPOINT, { headers });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to load blocked users.");
      const arr: BlockedUser[] = Array.isArray(data?.blocked_users) ? data.blocked_users : [];
      setList(arr);
    } catch (e: any) {
      setError(e?.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }, [headers]);

  const refresh = useCallback(async () => {
    try {
      setRefreshing(true);
      const res = await fetch(ENDPOINT, { headers });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to refresh.");
      const arr: BlockedUser[] = Array.isArray(data?.blocked_users) ? data.blocked_users : [];
      setList(arr);
    } catch (e: any) {
      setError(e?.message || "Something went wrong.");
    } finally {
      setRefreshing(false);
    }
  }, [headers]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return list;
    return list.filter(
      (u) =>
        u.name?.toLowerCase().includes(s) ||
        u.email?.toLowerCase().includes(s) ||
        String(u.id).includes(s)
    );
  }, [q, list]);

  const doUnblock = useCallback(
    async (id: number, name?: string) => {
      if (!token) {
        Alert.alert("Sign in required", "Please log in to unblock users.");
        return;
      }
      // Confirm first
      Alert.alert(
        "Unblock user",
        `Unblock ${name || "this user"}? They will be able to interact with you again.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Unblock",
            style: "destructive",
            onPress: async () => {
              setUnblockingIds((s) => new Set(s).add(id));
              try {
                const res = await fetch(`${UNBLOCK_ENDPOINT}/${id}`, {
                  method: "POST",
                  headers,
                });
                let payload: any = null;
                try {
                  payload = await res.json();
                } catch {}
                if (!res.ok) throw new Error(payload?.message || `Unblock HTTP ${res.status}`);

                // Optimistically remove from list
                setList((prev) => prev.filter((u) => u.id !== id));
              } catch (e: any) {
                Alert.alert("Couldn’t unblock", e?.message || "Please try again.");
              } finally {
                setUnblockingIds((s) => {
                  const next = new Set(s);
                  next.delete(id);
                  return next;
                });
              }
            },
          },
        ]
      );
    },
    [headers, token]
  );

  const renderItem = ({ item }: { item: BlockedUser }) => {
    const isUnblocking = unblockingIds.has(item.id);

    return (
      <View style={styles.row}>
        {/* Avatar component as requested */}
        <Avatar uri={item.profile_image} name={item.name} size={20} border />

        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.name} numberOfLines={1}>
            {item.name || "Unknown"}
          </Text>
          <Text style={styles.email} numberOfLines={1}>
            {item.email || "-"}
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: "#2563EB", borderColor: "rgba(255,255,255,0.15)" }]}
          activeOpacity={0.85}
          onPress={() => doUnblock(item.id, item.name)}
          disabled={isUnblocking}
        >
          {isUnblocking ? (
            <>
              <ActivityIndicator size="small" />
              <Text style={[styles.actionTxt, { marginLeft: 8 }]}>Unblocking…</Text>
            </>
          ) : (
            <>
              <Feather name="unlock" size={16} color="#fff" />
              <Text style={[styles.actionTxt, { marginLeft: 6 }]}>Unblock</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Optional chevron if you later want to open their profile */}
        {/* <Feather name="chevron-right" size={20} color={COLORS.subtext} /> */}
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.safe, { paddingBottom: insets.bottom }]}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.headerBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Feather name="chevron-left" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Blocked users</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Search */}
      <View style={styles.searchBox}>
        <Ionicons name="search-outline" size={18} color={COLORS.subtext} />
        <TextInput
          placeholder="Search name, email, or ID…"
          placeholderTextColor={COLORS.inputPlaceholder}
          value={q}
          onChangeText={setQ}
          style={styles.searchInput}
          returnKeyType="search"
        />
        {!!q && (
          <TouchableOpacity onPress={() => setQ("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Feather name="x" size={16} color={COLORS.subtext} />
          </TouchableOpacity>
        )}
      </View>

      {/* Body */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator />
          <Text style={styles.hint}>Loading blocked users…</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorTxt}>{error}</Text>
          <TouchableOpacity onPress={load} style={styles.retryBtn} activeOpacity={0.9}>
            <Text style={styles.retryTxt}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.center}>
          <Feather name="user-x" size={28} color={COLORS.subtext} />
          <Text style={styles.hint}>No blocked users</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(it) => String(it.id)}
          renderItem={renderItem}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 12 }}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor="#fff" />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },

  header: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.bg,
  },
  headerTitle: { color: "#fff", fontSize: 18, fontWeight: "700" },
  headerBtn: { padding: 4 },

  searchBox: {
    marginTop: 12,
    marginHorizontal: 16,
    height: 44,
    borderRadius: 12,
    backgroundColor: COLORS.inputBg,
    borderWidth: 1,
    borderColor: COLORS.inputBorder,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    columnGap: 8,
  },
  searchInput: {
    flex: 1,
    color: COLORS.text,
    fontSize: 14,
    ...(Platform.OS === "android"
      ? { height: 44, paddingVertical: 0, textAlignVertical: "center" }
      : { height: 44, paddingVertical: 10 }),
  },

  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 },
  hint: { color: COLORS.subtext, marginTop: 8 },
  errorTxt: { color: "#FCA5A5", textAlign: "center" },

  sep: { height: StyleSheet.hairlineWidth, backgroundColor: COLORS.border, marginHorizontal: 16 },

  row: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: COLORS.cardElev,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    flexDirection: "row",
    alignItems: "center",
  },

  name: { color: COLORS.text, fontSize: 15, fontWeight: "700" },
  email: { color: COLORS.subtext, fontSize: 12, marginTop: 2 },

  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2A2F3A",
    borderWidth: 1,
    borderColor: COLORS.border,
    height: 34,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginRight: 10,
  },
  actionTxt: { color: "#fff", fontSize: 12 },
  retryBtn: {
    marginTop: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  retryTxt: { color: "#fff", fontWeight: "700" },
});
