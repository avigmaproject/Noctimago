// ChatDebug.tsx
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  View, Text, KeyboardAvoidingView, Platform, StyleSheet, StatusBar, Keyboard,
  TouchableOpacity, Image, FlatList, TextInput, Alert
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import Feather from "react-native-vector-icons/Feather";
import ImagePicker from "react-native-image-crop-picker";
import { useSelector } from "react-redux";

import firestore from "@react-native-firebase/firestore";
import { firebase } from "@react-native-firebase/app";
// import NetInfo from "@react-native-community/netinfo";

import { uploaddocumnetaws } from "../../utils/Awsfile";

/* ---------- Theme ---------- */
const COLORS = {
  bg: "#0B0B12",
  card: "#15151F",
  me: "rgba(82,68,171,0.18)",
  text: "#EDEDF4",
  sub: "#9A9AA5",
  line: "rgba(255,255,255,0.08)",
  primary: "#F44336",
};
const DUMMY_AVATAR = "https://i.pravatar.cc/150?img=1";

/* ---------- Types ---------- */
type Msg = {
  _id: string;
  text?: string;
  image?: string;
  createdAt: Date;
  clientCreatedAt?: Date;
  sentBy: string;
  sentTo: string;
  user: { _id: string; name?: string; avatar?: string; userid?: number | null };
};

/* ---------- Utils ---------- */
const TS = () => new Date().toISOString().replace("T", " ").replace("Z", "");
const L = (...a: any[]) => console.log(`[${TS()}][${Platform.OS.toUpperCase()}][Chat]`, ...a);

const stripUndefined = <T extends object>(o: T): T =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;

const safeNum = (v: any) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null; // Firestore rejects NaN/undefined; null is fine
};

/* ---------- Header ---------- */
const Header = ({ title, avatar, onBack }: { title: string; avatar?: string; onBack: () => void }) => (
  <View style={styles.header}>
    <TouchableOpacity onPress={onBack} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
      <Feather name="chevron-left" size={26} color={COLORS.text} />
    </TouchableOpacity>
    <View style={styles.headerCenter}>
      <Image source={{ uri: avatar || DUMMY_AVATAR }} style={styles.headerAvatar} />
      <Text numberOfLines={1} style={styles.headerTitle}>{title}</Text>
    </View>
    <View style={{ width: 26 }} />
  </View>
);

export default function ChatDebug({ navigation, route }: any) {
  const insets = useSafeAreaInsets();

  // Other participant (from route)
  const otherUid    = String(route.params?.userId ?? "");
  const otherName   = route.params?.name   ?? "User";
  const otherAvatar = route.params?.avatar ?? DUMMY_AVATAR;
  const otherToken  = route.params?.token ?? null;

  // Me (from Redux)
  const userprofile = useSelector((s: any) => s.authReducer?.userprofile);
  const myUid    = String(userprofile?.ID ?? userprofile?.user?.id ?? userprofile?.User_PkeyID ?? "");
  const myName   = userprofile?.display_name ?? userprofile?.username ?? "Me";
  const myAvatar = userprofile?.meta?.profile_image || userprofile?.User_Image_Path || DUMMY_AVATAR;

  /* ---------- State ---------- */
  const [messages, setMessages] = useState<Msg[]>([]);
  const [composer, setComposer] = useState("");
  const [sending, setSending]   = useState(false);
  const [kb, setKb] = useState(0);

  const listRef  = useRef<FlatList<Msg>>(null);
  const inputRef = useRef<TextInput>(null);
  const composerH = 60;

  /* ---------- Env/Config sanity ---------- */
  useEffect(() => {
    try {
      const app = firebase.app();
      L("🔥 Firebase app:", app?.name);
      L("🔥 Firebase projectId:", app?.options?.projectId);
      L("🔥 iosBundleId:", app?.options?.iosBundleId, "androidAppId:", app?.options?.appId);
    } catch (e) {
      L("❌ Firebase app NOT initialized!", e);
    }
  }, []);

//   useEffect(() => {
//     const sub = NetInfo.addEventListener((s) => {
//       L("📶 Network:", { type: s.type, isConnected: s.isConnected, isInternetReachable: s.isInternetReachable });
//     });
//     return () => sub();
//   }, []);

  /* ---------- Keyboard (Android manual offset) ---------- */
  useEffect(() => {
    if (Platform.OS !== "android") return;
    const onShow = (e: any) => { setKb(e?.endCoordinates?.height ?? 0); L("⌨️ keyboardDidShow h:", e?.endCoordinates?.height); };
    const onHide = () => { setKb(0); L("⌨️ keyboardDidHide"); };
    const s = Keyboard.addListener("keyboardDidShow", onShow);
    const h = Keyboard.addListener("keyboardDidHide", onHide);
    return () => { s.remove(); h.remove(); };
  }, []);

  /* ---------- Deterministic chat id ---------- */
  const docId = useMemo(() => {
    const id = [myUid, otherUid].filter(Boolean).sort().join("-");
    L("🆔 docId compute:", { myUid, otherUid, docId: id });
    return id;
  }, [myUid, otherUid]);

  /* ---------- Loud UID sanity ---------- */
  useEffect(() => {
    L("🚦UIDs:", { myUid, otherUid, myName, otherName });
  }, [myUid, otherUid]);

  /* ---------- Load history + live listen (safe) ---------- */
  useEffect(() => {
    if (!myUid || !otherUid) {
      L("⏭️ skip Firestore subscribe: missing IDs", { myUid, otherUid });
      return;
    }

    const chatDoc = firestore().collection("chatrooms").doc(docId);
    const col = chatDoc.collection("messages");
    const query = col.orderBy("createdAt", "desc");

    let unsubscribe: (() => void) | undefined;

    (async () => {
      try {
        L("📥 initial messages load start");
        const snap = await query.get();

        if (!snap || !Array.isArray((snap as any).docs)) {
          L("⚠️ unexpected initial snapshot shape", {
            snapType: typeof snap,
            keys: snap ? Object.keys(snap as any) : null,
            snap: snap as any,
          });
        } else {
          const rows = snap.docs.map((d) => {
            const x: any = d.data();
            const created = x?.createdAt?.toDate?.() ?? x?.clientCreatedAt ?? new Date(0);
            return { ...x, createdAt: created } as Msg;
          });
          L("📥 initial load OK. count:", rows.length);
          setMessages(rows);
        }
      } catch (e: any) {
        L("❌ initial load ERROR:", e?.code, e?.message, e);
      }

      L("🧵 live listener attach");
      unsubscribe = query.onSnapshot(
        (snap) => {
          if (!snap || !Array.isArray((snap as any).docs)) {
            L("⚠️ unexpected live snapshot shape", {
              snapType: typeof snap,
              keys: snap ? Object.keys(snap as any) : null,
              snap: snap as any,
            });
            return;
          }
          const rows = snap.docs.map((d) => {
            const x: any = d.data();
            const created = x?.createdAt?.toDate?.() ?? x?.clientCreatedAt ?? new Date(0);
            return { ...x, createdAt: created } as Msg;
          });
          L("🔔 live snapshot. count:", rows.length);
          setMessages(rows);
        },
        (err) => L("❌ live listener ERROR:", err?.code, err?.message, err)
      );
    })();

    // Parent touch (non-blocking)
    chatDoc
      .set({ send: [String(myUid), String(otherUid)], updatedAt: firestore.FieldValue.serverTimestamp() }, { merge: true })
      .then(() => L("📝 chatrooms parent touched (merge)"))
      .catch((e) => L("❌ parent touch ERROR:", e?.code, e?.message, e));

    return () => {
      L("🔌 live listener detach");
      if (unsubscribe) try { unsubscribe(); } catch {}
    };
  }, [docId, myUid, otherUid]);

  /* ---------- Auto-focus input on screen focus ---------- */
  useFocusEffect(
    useCallback(() => {
      const t = setTimeout(() => { inputRef.current?.focus(); L("🖊️ input focused"); }, 150);
      return () => clearTimeout(t);
    }, [])
  );

  /* ---------- Send helpers ---------- */
  const randomId = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

  const sendInternal = async (
    payload: { kind: "text"; text: string } | { kind: "image"; uri: string }
  ) => {
    const id  = randomId();
    const now = new Date();
    const isText = (payload as any).kind === "text";
    const lastText = isText ? (payload as any).text.trim() : "📷 Photo";

    const baseUser = {
      _id: String(myUid),
      name: myName || "",
      avatar: myAvatar || "",
      userid: safeNum(myUid),
    };

    const optimistic: Msg = isText
      ? { _id: id, text: (payload as any).text, createdAt: now, clientCreatedAt: now, sentBy: String(myUid), sentTo: String(otherUid), user: baseUser }
      : { _id: id, image: (payload as any).uri, text: "", createdAt: now, clientCreatedAt: now, sentBy: String(myUid), sentTo: String(otherUid), user: baseUser };

    // optimistic UI
    setMessages((p) => [optimistic, ...p]);

    const chatDoc = firestore().collection("chatrooms").doc(docId);
    const msgRef  = chatDoc.collection("messages").doc(id);
    const listDoc = firestore().collection("messagelist").doc(docId);

    const parentPayload = stripUndefined({
      send: [String(myUid), String(otherUid)],
      updatedAt: firestore.FieldValue.serverTimestamp(),
    });

    const msgPayload = stripUndefined({
      ...optimistic,
      createdAt: firestore.FieldValue.serverTimestamp(),
      clientCreatedAt: now,
    });

    const listPayload = stripUndefined({
      send: [String(myUid), String(otherUid)],
      sentBy: String(myUid), sentTo: String(otherUid),
      senderusename: myName || "",  reciverusename: otherName || "",
      senderavatar: myAvatar || "",  reciveravatar: otherAvatar || "",
      sendertoken: userprofile?.User_Token_Val ?? null,
      recivertoken: otherToken ?? null,
      senderuserid: safeNum(myUid),   reciveruserid: safeNum(otherUid),
      lastmsg: lastText || "",
      updatedAt: firestore.FieldValue.serverTimestamp(),
      read: false, hasMessage: true,
    });

    try {
      setSending(true);

      // ✅ Single batch for both platforms (parent → messagelist → message)
      const batch = firestore().batch();
      batch.set(chatDoc, parentPayload, { merge: true });
      batch.set(listDoc, listPayload,  { merge: true });
      batch.set(msgRef,  msgPayload);
      L('💾 batch commit…', { docId, id });
      await batch.commit();
      L('✅ batch OK');
    } catch (e: any) {
      L('⛔ Firestore write ERROR:', e?.code, e?.message, e);
      setMessages((p) => p.filter((m) => m._id !== id)); // rollback optimistic
      Alert.alert('Send failed', e?.message || 'Please try again.');
    } finally {
      setSending(false);
    }
  };

  const sendText = async () => {
    const text = composer.trim();
    L("📤 sendText tapped", { length: text.length, myUid, otherUid });
    if (!text || !myUid || !otherUid) {
      L("🚫 blocked send", { emptyText: !text, myUid, otherUid });
      return;
    }
    setComposer("");
    inputRef.current?.blur();
    Keyboard.dismiss();
    await sendInternal({ kind: "text", text });
  };

  const pickFromGallery = async () => {
    try {
      L("🖼️ pickFromGallery open");
      const res = await ImagePicker.openPicker({
        multiple: false, writeTempFile: true, includeExif: true, cropping: true, mediaType: "photo",
      });
      const file = { name: `${Date.now()}-${myUid}`, size: res.size, type: res.mime, uri: res.path };
      L("🖼️ gallery picked:", file);
      const uploaded: any = await uploaddocumnetaws(file);
      L("🖼️ gallery uploaded:", uploaded);
      if (uploaded?.location) await sendInternal({ kind: "image", uri: uploaded.location } as any);
    } catch (e) {
      L("🖼️ gallery cancelled/failed", e);
    }
  };

  const openCamera = async () => {
    try {
      L("📷 openCamera");
      const res = await ImagePicker.openCamera({
        writeTempFile: true, includeExif: true, cropping: true, mediaType: "photo",
      });
      const file = { name: `${Date.now()}-${myUid}`, size: res.size, type: res.mime, uri: res.path };
      L("📷 camera shot:", file);
      const uploaded: any = await uploaddocumnetaws(file);
      L("📷 camera uploaded:", uploaded);
      if (uploaded?.location) await sendInternal({ kind: "image", uri: uploaded.location } as any);
    } catch (e) {
      L("📷 camera cancelled/failed", e);
    }
  };

  /* ---------- Row ---------- */
  const renderItem = ({ item }: { item: Msg }) => {
    const mine = item.sentBy === String(myUid);
    const ts = new Date(item.createdAt || item.clientCreatedAt || new Date(0));
    return (
      <View style={[styles.row, { justifyContent: mine ? "flex-end" : "flex-start" }]}>
        {!mine && <Image source={{ uri: otherAvatar }} style={styles.smallAvatar} />}
        <View style={[styles.bubble, { backgroundColor: mine ? COLORS.me : COLORS.card }]}>
          {item.text ? (
            <Text style={styles.msgText}>{item.text}</Text>
          ) : (
            <Image source={{ uri: item.image }} style={styles.msgImage} />
          )}
          <Text style={styles.time}>
            {ts.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </Text>
        </View>
      </View>
    );
  };

  /* ---------- UI ---------- */
  const ready = !!myUid && !!otherUid;

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />
      <Header title={otherName} avatar={otherAvatar} onBack={() => navigation.goBack()} />

      {!ready ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: COLORS.sub, paddingHorizontal: 24, textAlign: "center" }}>
            Loading profile… Waiting for myUid/otherUid
          </Text>
        </View>
      ) : (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={Platform.OS === "ios" ? insets.top : 0}
        >
          <FlatList
            ref={listRef}
            style={{ flex: 1 }}
            contentContainerStyle={{
              paddingTop: 8,
              paddingHorizontal: 12,
              paddingBottom: composerH + insets.bottom + (Platform.OS === "android" ? kb : 0),
            }}
            data={messages}
            keyExtractor={(m) => m._id}
            renderItem={renderItem}
            inverted
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
            onContentSizeChange={() => listRef.current?.scrollToOffset?.({ offset: 0, animated: true })}
            ListEmptyComponent={
              <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 80 }}>
                <Text style={{ color: COLORS.sub }}>No messages yet. Say hi 👋</Text>
              </View>
            }
          />

          {/* Composer */}
          <View
            style={[
              styles.composerBar,
              { paddingBottom: 2 },
              Platform.OS === "android" ? { bottom: kb } : null,
            ]}
          >
            <TouchableOpacity onPress={pickFromGallery} style={styles.mediaBtn}>
              <Feather name="image" size={20} color={COLORS.primary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={openCamera} style={[styles.mediaBtn, { marginLeft: 10 }]}>
              <Feather name="camera" size={20} color={COLORS.primary} />
            </TouchableOpacity>

            <View style={styles.inputPill}>
              <TextInput
                ref={inputRef}
                value={composer}
                onChangeText={(t) => { setComposer(t); L("⌨️ typing length:", t.length); }}
                placeholder="Type a message"
                placeholderTextColor={COLORS.sub}
                style={styles.input}
                multiline
                blurOnSubmit={false}
                onFocus={() => { L("🖊️ input onFocus"); listRef.current?.scrollToOffset?.({ offset: 0, animated: true }); }}
              />
            </View>

            <TouchableOpacity onPress={sendText} style={styles.sendFab} activeOpacity={0.9} disabled={sending}>
              <Feather name="send" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

/* ---------- Styles ---------- */
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },

  header: {
    height: 56, backgroundColor: COLORS.bg, flexDirection: "row", alignItems: "center",
    paddingHorizontal: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.line,
  },
  headerCenter: { flex: 1, flexDirection: "row", alignItems: "center", marginLeft: 8 },
  headerAvatar: { width: 28, height: 28, borderRadius: 14, marginRight: 8, backgroundColor: "#222" },
  headerTitle: { color: COLORS.text, fontWeight: "700", fontSize: 16, maxWidth: "90%" },

  row: { flexDirection: "row", marginVertical: 6 },
  smallAvatar: { width: 24, height: 24, borderRadius: 12, marginRight: 6, alignSelf: "flex-end" },

  bubble: {
    maxWidth: "78%", borderRadius: 14, padding: 10,
    shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  msgText: { color: COLORS.text, fontSize: 16 },
  msgImage: { width: 220, height: 220, borderRadius: 12, backgroundColor: "#222" },
  time: { fontSize: 11, color: COLORS.sub, alignSelf: "flex-end", marginTop: 4 },

  composerBar: {
    left: 0, right: 0, bottom: 0,
    flexDirection: "row", alignItems: "flex-end",
    paddingTop: 8, paddingHorizontal: 12,
    backgroundColor: COLORS.bg,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.line,
  },
  mediaBtn: {
    height: 44, width: 44, borderRadius: 22, alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(244,67,54,0.10)",
  },
  inputPill: {
    flex: 1, backgroundColor: "#1A1B25", marginHorizontal: 12, paddingHorizontal: 14,
    paddingVertical: 10, borderRadius: 22, minHeight: 44, justifyContent: "center",
  },
  input: { color: COLORS.text, fontSize: 16, maxHeight: 120 },
  sendFab: {
    height: 48, width: 48, borderRadius: 24, backgroundColor: COLORS.primary,
    alignItems: "center", justifyContent: "center",
  },
});
