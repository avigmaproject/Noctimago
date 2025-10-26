// src/screens/MessageList.tsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  StyleSheet,
  StatusBar,
  Alert,
  ActivityIndicator,
} from "react-native";
import firestore from "@react-native-firebase/firestore";
import Feather from "react-native-vector-icons/Feather";
import AntDesign from "react-native-vector-icons/AntDesign";
import { useSelector } from "react-redux";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/* ---------- Theme ---------- */
const COLORS = {
  bg: "#0B0B12",
  card: "#17171F",
  outline: "rgba(255,255,255,0.12)",
  text: "#EDEDF4",
  sub: "#9A9AA5",
  red: "#F44336",
};
const DUMMY_AVATAR = "https://i.pravatar.cc/150?img=1";

/* ---------- Types ---------- */
type Thread = {
  id: string;                 // document id (sorted "my-other")
  send: string[];             // ["2455", "2631"]
  lastmsg?: string;
  createdAt?: number;
  read?: boolean;

  // both sides saved by Chat screen:
  senderusename?: string;
  reciverusename?: string;
  senderavatar?: string;
  reciveravatar?: string;
  senddertoken?: string;
  recivertoken?: string;
  senderuserid?: number | string;
  reciveruserid?: number | string;

  sentBy?: string;
  sentTo?: string;
};

export default function MessageList({ navigation }: any) {
  const insets = useSafeAreaInsets();

  // ---- my id from Redux (same derivation you used in Chat) ----
  const userprofile = useSelector((s: any) => s.authReducer.userprofile);
  const myUid = String(
    userprofile?.ID ??
      userprofile?.user?.id ??
      userprofile?.User_PkeyID ??
      userprofile?.User_Firebase_UID ??
      ""
  );

  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);

  const db = firestore();

  // helper: compute the OTHER id in a thread
  const getOtherId = useCallback(
    (t: Thread) => {
      const arr = (t.send || []).map(String);
      return arr.find((x) => x !== myUid) || "";
    },
    [myUid]
  );

  // live subscription to my conversations
  useEffect(() => {
    if (!myUid) return;

    const q = db
      .collection("messagelist")
      .where("send", "array-contains", myUid);

    const unsub = q.onSnapshot(
      (snap) => {
        const rows: Thread[] =
          snap?.docs?.map((d) => ({ id: d.id, ...(d.data() as any) })) ?? [];
        // sort client-side by createdAt desc (array-contains + orderBy needs index)
        rows.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        setThreads(rows);
        setLoading(false);
      },
      (err) => {
        console.log("[threads] ERROR:", err?.code, err?.message);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [db, myUid]);

  // open chat with “other” participant
  const startChat = useCallback(
    async (t: Thread) => {
      const otherId = getOtherId(t);
      const sortedId = [myUid, otherId].sort().join("-");

      // mark as read
      await db.collection("messagelist").doc(sortedId).set({ read: true }, { merge: true });

      // which side is the other?
      const otherIsSender = String(t.senderuserid) === otherId;
      const otherName = otherIsSender ? t.senderusename || "User" : t.reciverusename || "User";
      const otherAvatar = otherIsSender ? t.senderavatar || DUMMY_AVATAR : t.reciveravatar || DUMMY_AVATAR;
      const otherToken = otherIsSender ? t.senddertoken : t.recivertoken;
      const otherWPId = otherIsSender ? t.senderuserid : t.reciveruserid;

      navigation.navigate("Chat", {
        userId: otherId,
        name: otherName,
        avatar: otherAvatar,
        token: otherToken,
        userid: otherWPId,
      });
    },
    [db, getOtherId, myUid, navigation]
  );

  // delete conversation (messages + thread doc)
  const deleteThread = useCallback(
    (t: Thread) => {
      const otherId = getOtherId(t);
      const sortedId = [myUid, otherId].sort().join("-");

      Alert.alert("Delete chat?", "This will remove the entire conversation.", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              // delete all messages in chatrooms/<id>/messages
              const msgsSnap = await db
                .collection("chatrooms")
                .doc(sortedId)
                .collection("messages")
                .get();

              const batch = db.batch();
              msgsSnap.docs.forEach((d) => batch.delete(d.ref));
              batch.delete(db.collection("chatrooms").doc(sortedId));
              batch.delete(db.collection("messagelist").doc(sortedId));
              await batch.commit();
            } catch (e) {
              console.log("[delete] ERROR:", e);
            }
          },
        },
      ]);
    },
    [db, getOtherId, myUid]
  );

  // time ago (tiny helper)
  const timeAgo = (ms?: number) => {
    if (!ms) return "";
    const diff = Date.now() - ms;
    const m = Math.floor(diff / 60000);
    if (m < 1) return "a few seconds ago";
    if (m < 60) return `${m} minute${m > 1 ? "s" : ""} ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h} hour${h > 1 ? "s" : ""} ago`;
    const d = Math.floor(h / 24);
    return `${d} day${d > 1 ? "s" : ""} ago`;
  };

  const renderItem = ({ item }: { item: Thread }) => {
    const otherId = getOtherId(item);
    const otherIsSender = String(item.senderuserid) === otherId;

    const otherName =
      otherIsSender ? item.senderusename || "User" : item.reciverusename || "User";
    const otherAvatar =
      otherIsSender ? item.senderavatar || DUMMY_AVATAR : item.reciveravatar || DUMMY_AVATAR;

// inside renderItem
const preview =
  item.lastmsg && item.lastmsg.trim().length
    ? item.lastmsg
    : "";

// Unread if the last message was sent by the other person, and the doc says not read
const isUnread = item.read === false && String(item.sentBy) !== myUid;


    return (
      <TouchableOpacity
        activeOpacity={0.9}
        style={styles.card}
        onPress={() => startChat(item)}
      >
        <Image source={{ uri: otherAvatar }} style={styles.avatar} />
        <View style={{ flex: 1 }}>
  <View style={styles.rowTop}>
    <Text
      numberOfLines={1}
      style={[
        styles.name,
        isUnread && { fontWeight: "900" }   // bold name when unread
      ]}
    >
      {otherName}
    </Text>
    <Text style={styles.time}>{timeAgo(item.createdAt)}</Text>
  </View>

  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
    {isUnread && <View style={styles.unreadDot} />}   {/* little dot on unread */}
    <Text
      numberOfLines={1}
      style={[
        styles.preview,
        isUnread && { color: COLORS.text, fontWeight: "700" } // brighter/bold on unread
      ]}
    >
      {preview}
    </Text>
  </View>
</View>


        <TouchableOpacity onPress={() => deleteThread(item)} style={{ padding: 6 }}>
          <AntDesign name="delete" size={20} color={COLORS.red} />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />

      {/* Top bar */}
      <View style={styles.topBar}>
        <Text style={styles.topTitle}>Messages</Text>
        <Feather name="message-circle" size={18} color={COLORS.onDark} />
      </View>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator />
          <Text style={{ color: COLORS.sub, marginTop: 8 }}>Loading…</Text>
        </View>
      ) : threads.length === 0 ? (
        <View style={styles.empty}>
          <Text style={{ color: COLORS.sub }}>No conversations yet.</Text>
        </View>
      ) : (
        <FlatList
          data={threads}
          keyExtractor={(t) => t.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 12, paddingBottom: 20 }}
        />
      )}
    </View>
  );
}

/* ---------- Styles ---------- */
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  topBar: {
    height: 48,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.outline,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  topTitle: { color: COLORS.text, fontWeight: "700", fontSize: 16 },

  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  empty: { flex: 1, alignItems: "center", justifyContent: "center" },

  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.outline,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  avatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: "#222" },
  rowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  name: { color: COLORS.text, fontSize: 18, fontWeight: "800", marginRight: 10, flex: 1 },
  time: { color: COLORS.sub, fontSize: 12 },
  preview: { color: COLORS.text, marginTop: 4 },
});
