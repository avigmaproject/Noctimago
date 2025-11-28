// src/screens/ChatDebug.tsx
// Header fixed, chat safe from overlap, WhatsApp-like ticks, delivery/read acks.

import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
  useLayoutEffect,
} from "react";
import {
  View,
  Text,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  Image,
  FlatList,
  TextInput,
  Alert,
  Dimensions,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import Feather from "react-native-vector-icons/Feather";
import ImagePicker from "react-native-image-crop-picker";
import { useSelector } from "react-redux";
import { AvoidSoftInput, AvoidSoftInputView } from "react-native-avoid-softinput";
import firestore from "@react-native-firebase/firestore";
import { firebase } from "@react-native-firebase/app";
import { uploaddocumnetaws } from "../../utils/Awsfile";
import Avatar from "../../utils/Avatar";

/* ---------------- Theme ---------------- */
const COLORS = {
  bg: "#0B0B12",
  card: "#15151F",
  me: "rgba(82,68,171,0.18)",
  text: "#EDEDF4",
  sub: "#9A9AA5",
  line: "rgba(255,255,255,0.08)",
  primary: "#F44336",
  border: "#1F2127",
};
const DUMMY_AVATAR = "";

/* ---------------- Fixed layout split ---------------- */
const { height: SCREEN_H } = Dimensions.get("window");
const HEADER_PERCENT = 0.12;
const HEADER_FIXED_H = Math.round(SCREEN_H * HEADER_PERCENT);

/* ---------------- Other constants ---------------- */
const COMPOSER_H = 60;
const EXTRA_GAP = 10;

/* ---------------- Types ---------------- */
type Msg = {
  _id: string;
  text?: string;
  image?: string;
  createdAt: Date;
  clientCreatedAt?: Date;
  sentBy: string;
  sentTo: string;
  user: { _id: string; name?: string; avatar?: string; userid?: number | null };

  deliveredTo?: string[];
  readBy?: string[];
};

/* ---------------- Utils ---------------- */
const TS = () =>
  new Date().toISOString().replace("T", " ").replace("Z", "");
const L = (...a: any[]) =>
  console.log(`[${TS()}][${Platform.OS.toUpperCase()}][Chat]`, ...a);
const stripUndefined = <T extends object>(o: T): T =>
  Object.fromEntries(
    Object.entries(o).filter(([, v]) => v !== undefined)
  ) as T;
const safeNum = (v: any) =>
  Number.isFinite(Number(v)) ? Number(v) : null;

/** ✅ Normalize any timestamp-like value into a real JS Date */
const fixDate = (val: any): Date => {
  if (!val) return new Date(0);
  if (val instanceof Date) return val;
  if (val.toDate) {
    // Firestore Timestamp
    try {
      return val.toDate();
    } catch {
      return new Date(0);
    }
  }
  if (typeof val === "string") {
    const d = new Date(val);
    return isNaN(d.getTime()) ? new Date(0) : d;
  }
  const d = new Date(val);
  return isNaN(d.getTime()) ? new Date(0) : d;
};

/* ---------------- Header ---------------- */
const Header = ({
  title,
  avatar,
  onBack,
  topInset,
}: {
  title: string;
  avatar?: string;
  onBack: () => void;
  topInset: number;
}) => (
  <View style={[styles.header, { paddingTop: topInset }]}>
    <View style={styles.headerRow}>
      <TouchableOpacity
        onPress={onBack}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      >
        <Feather name="chevron-left" size={26} color={COLORS.text} />
      </TouchableOpacity>
      <View style={styles.headerCenter}>
        <Avatar uri={avatar} name={title} size={28} border />
        <Text numberOfLines={1} style={styles.headerTitle}>
          {title}
        </Text>
      </View>
      <View style={{ width: 26 }} />
    </View>
    <View style={styles.headerDivider} />
  </View>
);

export default function ChatDebug({ navigation, route }: any) {
  const insets = useSafeAreaInsets();
  const isIOS = Platform.OS === "ios";

  /* ---- Other participant (from route) ---- */
  const otherUid = String(route.params?.userId ?? "");
  const otherName = route.params?.name ?? "User";
  const otherAvatar = route.params?.avatar ?? DUMMY_AVATAR;
  const otherToken = route.params?.token ?? null;

  /* ---- Me (from Redux) ---- */
  const userprofile = useSelector(
    (s: any) => s.authReducer?.userprofile
  );
  const myUid = String(
    userprofile?.ID ??
      userprofile?.user?.id ??
      userprofile?.User_PkeyID ??
      ""
  );
  const myName =
    userprofile?.display_name ??
    userprofile?.username ??
    "Me";
  const myAvatar =
    userprofile?.meta?.profile_image ||
    userprofile?.User_Image_Path ||
    DUMMY_AVATAR;

  /* ---- State ---- */
  const [messages, setMessages] = useState<Msg[]>([]);
  const [composer, setComposer] = useState("");
  const [sending, setSending] = useState(false);

  const listRef = useRef<FlatList<Msg>>(null);
  const inputRef = useRef<TextInput>(null);

  /* ---- Android soft input behavior ---- */
  useEffect(() => {
    if (Platform.OS !== "android") return;
    AvoidSoftInput.setEnabled(true);
    AvoidSoftInput.setShouldMimicIOSBehavior(true);
  }, []);

  /* ---- Firebase sanity ---- */
  useEffect(() => {
    try {
      const app = firebase.app();
      L("🔥 Firebase app:", app?.name);
      L("🔥 Firebase projectId:", app?.options?.projectId);
    } catch (e) {
      L("❌ Firebase app NOT initialized!", e);
    }
  }, []);

  /* ---- Hide tab bar while inside chat ---- */
  const bottomPad = Math.max(insets.bottom, 20);

  useLayoutEffect(() => {
    navigation.getParent()?.setOptions({
      tabBarStyle: { display: "none" },
    });
    return () => {
      navigation.getParent()?.setOptions({
        tabBarStyle: {
          backgroundColor: COLORS.bg,
          borderTopColor: COLORS.border,
          borderTopWidth: 1,
        },
      });
    };
  }, [navigation]);

  /* ---- Deterministic chat id ---- */
  const docId = useMemo(() => {
    const id = [myUid, otherUid]
      .filter(Boolean)
      .sort()
      .join("-");
    L("🆔 docId compute:", { myUid, otherUid, docId: id });
    return id;
  }, [myUid, otherUid]);

  /* ---- Subscribe messages + auto-ack delivered ---- */
  useEffect(() => {
    if (!myUid || !otherUid) {
      L("⏭️ skip Firestore subscribe: missing IDs", {
        myUid,
        otherUid,
      });
      return;
    }

    const chatDoc = firestore()
      .collection("chatrooms")
      .doc(docId);
    const col = chatDoc.collection("messages");
    const query = col.orderBy("createdAt", "desc");

    let unsubscribe: (() => void) | undefined;

    (async () => {
      try {
        const snap = await query.get();
        const rows = snap.docs.map((d) => {
          const x: any = d.data();
          return {
            ...x,
            // ✅ normalize createdAt
            createdAt: fixDate(
              x.createdAt ?? x.clientCreatedAt
            ),
          } as Msg;
        });
        setMessages(rows);
      } catch (e: any) {
        L(
          "❌ initial load ERROR:",
          e?.code,
          e?.message,
          e
        );
      }

      unsubscribe = query.onSnapshot(
        async (snap) => {
          const rows = snap.docs.map((d) => {
            const x: any = d.data();
            return {
              ...x,
              // ✅ normalize createdAt in realtime updates too
              createdAt: fixDate(
                x.createdAt ?? x.clientCreatedAt
              ),
            } as Msg;
          });
          setMessages(rows);

          // mark delivered for messages from the other user
          try {
            const batch = firestore().batch();
            let pending = 0;

            snap.docs.forEach((d) => {
              const m = d.data() as any;
              const mine =
                m.sentBy === String(myUid);
              if (!mine) {
                const delivered: string[] =
                  Array.isArray(m.deliveredTo)
                    ? m.deliveredTo
                    : [];
                if (
                  !delivered.includes(
                    String(myUid)
                  )
                ) {
                  batch.update(d.ref, {
                    deliveredTo:
                      firestore.FieldValue.arrayUnion(
                        String(myUid)
                      ),
                  });
                  pending++;
                }
              }
            });

            if (pending) await batch.commit();
          } catch {}
        },
        (err) =>
          L(
            "❌ live listener ERROR:",
            err?.code,
            err?.message,
            err
          )
      );
    })();

    // ensure chat parent doc exists
    chatDoc
      .set(
        {
          send: [
            String(myUid),
            String(otherUid),
          ],
          updatedAt:
            firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      )
      .catch(() => {});

    return () => {
      if (unsubscribe)
        try {
          unsubscribe();
        } catch {}
    };
  }, [docId, myUid, otherUid]);

  /* ---- Mark read (focus + on update) ---- */
  const markThreadRead = useCallback(async () => {
    if (!myUid || !otherUid) return;
    try {
      const chatDoc = firestore()
        .collection("chatrooms")
        .doc(docId);
      const listDoc = firestore()
        .collection("messagelist")
        .doc(docId);

      // ✅ no where() → no composite index needed
      const snap = await chatDoc
        .collection("messages")
        .orderBy("createdAt", "desc")
        .limit(200)
        .get();

      const batch = firestore().batch();

      snap.forEach((d) => {
        const m = d.data() as any;
        const fromOther =
          m.sentBy === String(otherUid);
        const alreadyRead =
          Array.isArray(m.readBy) &&
          m.readBy.includes(String(myUid));

        if (fromOther && !alreadyRead) {
          batch.update(d.ref, {
            readBy:
              firestore.FieldValue.arrayUnion(
                String(myUid)
              ),
          });
        }
      });

      batch.set(
        listDoc,
        {
          read: true,
          [`lastRead.${myUid}`]:
            firestore.FieldValue.serverTimestamp(),
          [`readMap.${myUid}`]: true,
        },
        { merge: true }
      );

      // ✅ always commit
      await batch.commit();
    } catch (e: any) {
      console.warn(
        "markThreadRead error:",
        e?.code,
        e?.message
      );
    }
  }, [docId, myUid, otherUid]);

  // state for messagelist meta
  const [peerLastRead, setPeerLastRead] =
    useState<Date | null>(null);

  useEffect(() => {
    if (!myUid || !otherUid) return;
    const listDocRef = firestore()
      .collection("messagelist")
      .doc(docId);
    const unsub = listDocRef.onSnapshot((snap) => {
      const data: any = snap.data();
      const ts = data?.lastRead?.[otherUid];
      const d =
        ts?.toDate?.() instanceof Date
          ? (ts.toDate() as Date)
          : typeof ts === "number"
          ? new Date(ts)
          : null;
      setPeerLastRead(d || null);
    });
    return unsub;
  }, [docId, myUid, otherUid]);

  useFocusEffect(
    useCallback(() => {
      const t = setTimeout(() => {
        inputRef.current?.focus();
      }, 150);
      markThreadRead();
      return () => clearTimeout(t);
    }, [markThreadRead])
  );

  useEffect(() => {
    markThreadRead();
  }, [messages, markThreadRead]);

  /* ---- Delete message ---- */
  const deleteMessage = async (msg: Msg) => {
    const chatDoc = firestore()
      .collection("chatrooms")
      .doc(docId);
    const msgRef = chatDoc
      .collection("messages")
      .doc(msg._id);
    const listDoc = firestore()
      .collection("messagelist")
      .doc(docId);

    const wasNewest =
      messages.length &&
      messages[0]._id === msg._id;

    // optimistic
    setMessages((prev) =>
      prev.filter((m) => m._id !== msg._id)
    );

    try {
      await msgRef.delete();

      if (wasNewest) {
        const nextSnap = await chatDoc
          .collection("messages")
          .orderBy("createdAt", "desc")
          .limit(1)
          .get();

        const nextMsg = nextSnap.docs[0]
          ?.data() as any | undefined;
        const nextLast = nextMsg?.text?.trim?.()
          ? nextMsg.text.trim()
          : nextMsg?.image
          ? "📷 Photo"
          : "";

        await listDoc.set(
          {
            lastmsg: nextLast,
            updatedAt:
              firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      }
    } catch (e: any) {
      // rollback
      setMessages((prev) => {
        const exists = prev.some(
          (m) => m._id === msg._id
        );
        return exists ? prev : [msg, ...prev];
      });
      Alert.alert(
        "Delete failed",
        e?.message || "Please try again."
      );
    }
  };

  const confirmDelete = (msg: Msg) => {
    const mine = msg.sentBy === String(myUid);
    if (!mine) return;
    Alert.alert(
      "Delete message?",
      "This removes the message for everyone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => deleteMessage(msg),
        },
      ]
    );
  };

  /* ---- Sending helpers ---- */
  const randomId = () =>
    Math.random().toString(36).slice(2) +
    Date.now().toString(36);

  const sendInternal = async (
    payload:
      | { kind: "text"; text: string }
      | { kind: "image"; uri: string }
  ) => {
    const id = randomId();
    const now = new Date();
    const isText =
      (payload as any).kind === "text";
    const lastText = isText
      ? (payload as any).text.trim()
      : "📷 Photo";

    const baseUser = {
      _id: String(myUid),
      name: myName || "",
      avatar: myAvatar || "",
      userid: safeNum(myUid),
    };

    const optimistic: Msg = isText
      ? {
          _id: id,
          text: (payload as any).text,
          createdAt: now, // local date
          clientCreatedAt: now,
          sentBy: String(myUid),
          sentTo: String(otherUid),
          user: baseUser,
          deliveredTo: [],
          readBy: [],
        }
      : {
          _id: id,
          image: (payload as any).uri,
          text: "",
          createdAt: now,
          clientCreatedAt: now,
          sentBy: String(myUid),
          sentTo: String(otherUid),
          user: baseUser,
          deliveredTo: [],
          readBy: [],
        };

    // optimistic UI
    setMessages((p) => [optimistic, ...p]);

    const chatDoc = firestore()
      .collection("chatrooms")
      .doc(docId);
    const msgRef = chatDoc
      .collection("messages")
      .doc(id);
    const listDoc = firestore()
      .collection("messagelist")
      .doc(docId);

    const parentPayload = stripUndefined({
      send: [
        String(myUid),
        String(otherUid),
      ],
      updatedAt:
        firestore.FieldValue.serverTimestamp(),
    });

    const msgPayload = stripUndefined({
      ...optimistic,
      createdAt:
        firestore.FieldValue.serverTimestamp(),
      clientCreatedAt: now,
    });

    const listPayload = stripUndefined({
      send: [
        String(myUid),
        String(otherUid),
      ],
      sentBy: String(myUid),
      sentTo: String(otherUid),
      senderusename: myName || "",
      reciverusename: otherName || "",
      senderavatar: myAvatar || "",
      reciveravatar: otherAvatar || "",
      sendertoken:
        userprofile?.User_Token_Val ?? null,
      recivertoken: otherToken ?? null,
      senderuserid: safeNum(myUid),
      reciveruserid: safeNum(otherUid),
      lastmsg: lastText || "",
      updatedAt:
        firestore.FieldValue.serverTimestamp(),

      hasMessage: true,
      read: false, // mark thread as unread for receiver
      [`readMap.${myUid}`]: true,
      [`readMap.${otherUid}`]: false,
    });

    try {
      setSending(true);
      const batch = firestore().batch();
      batch.set(chatDoc, parentPayload, {
        merge: true,
      });
      batch.set(listDoc, listPayload, {
        merge: true,
      });
      batch.set(msgRef, msgPayload);
      await batch.commit();
    } catch (e: any) {
      // rollback optimistic
      setMessages((p) =>
        p.filter((m) => m._id !== id)
      );
      Alert.alert(
        "Send failed",
        e?.message || "Please try again."
      );
    } finally {
      setSending(false);
    }
  };

  const sendText = async () => {
    const text = composer.trim();
    if (!text || !myUid || !otherUid) return;
    setComposer(""); // keep focus
    await sendInternal({ kind: "text", text });
  };

  const pickFromGallery = async () => {
    try {
      const res = await ImagePicker.openPicker({
        multiple: false,
        writeTempFile: true,
        includeExif: true,
        cropping: true,
        mediaType: "photo",
      });
      const file = {
        name: `${Date.now()}-${myUid}`,
        size: res.size,
        type: res.mime,
        uri: res.path,
      } as any;
      const uploaded: any =
        await uploaddocumnetaws(file);
      if (uploaded?.location)
        await sendInternal({
          kind: "image",
          uri: uploaded.location,
        } as any);
    } catch {}
  };

  const openCamera = async () => {
    try {
      const res = await ImagePicker.openCamera({
        writeTempFile: true,
        includeExif: true,
        cropping: true,
        mediaType: "photo",
      });
      const file = {
        name: `${Date.now()}-${myUid}`,
        size: res.size,
        type: res.mime,
        uri: res.path,
      } as any;
      const uploaded: any =
        await uploaddocumnetaws(file);
      if (uploaded?.location)
        await sendInternal({
          kind: "image",
          uri: uploaded.location,
        } as any);
    } catch {}
  };

  const getTickState = (m: Msg) => {
    const mine = m.sentBy === String(myUid);
    const delivered =
      Array.isArray(m.deliveredTo) &&
      m.deliveredTo.includes(String(otherUid));
    const read =
      Array.isArray(m.readBy) &&
      m.readBy.includes(String(otherUid));

    if (read) return "read";

    // Fallback: if the other user’s lastRead timestamp is after this message's time,
    // we treat it as read (even if per-message readBy hasn't synced yet)
    if (
      mine &&
      peerLastRead &&
      (m.createdAt || m.clientCreatedAt)
    ) {
      const msgTime = (
        m.createdAt || m.clientCreatedAt
      ).getTime();
      if (peerLastRead.getTime() >= msgTime)
        return "read";
    }

    return delivered ? "delivered" : "sent";
  };

  const Tick = ({
    state,
  }: {
    state: "sent" | "delivered" | "read";
  }) => {
    const color =
      state === "read"
        ? "#50B0FF"
        : "#A6A7B1";
    // single ✔ for "sent", double ✔✔ for "delivered/read"
    return (
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 1,
          marginLeft: 6,
        }}
      >
        <Feather
          name="check"
          size={14}
          color={color}
        />
        {state !== "sent" && (
          <Feather
            name="check"
            size={14}
            color={color}
            style={{ marginLeft: -6 }}
          />
        )}
      </View>
    );
  };

  /* ---- Render row ---- */
  const renderItem = ({ item }: { item: Msg }) => {
    const mine =
      item.sentBy === String(myUid);
    const ts = fixDate(
      item.createdAt || item.clientCreatedAt
    ); // ✅ always valid
    const tickState = mine
      ? getTickState(item)
      : null;

    return (
      <View
        style={[
          styles.row,
          {
            justifyContent: mine
              ? "flex-end"
              : "flex-start",
          },
        ]}
      >
        {!mine && (
          <Image
            source={{ uri: otherAvatar }}
            style={styles.smallAvatar}
          />
        )}

        <TouchableOpacity
          style={[
            styles.bubble,
            {
              backgroundColor: mine
                ? COLORS.me
                : COLORS.card,
            },
          ]}
          onLongPress={() =>
            confirmDelete(item)
          }
          delayLongPress={300}
          activeOpacity={0.8}
        >
          {item.text ? (
            <Text style={styles.msgText}>
              {item.text}
            </Text>
          ) : (
            <Image
              source={{ uri: item.image }}
              style={styles.msgImage}
            />
          )}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              alignSelf: "flex-end",
            }}
          >
            <Text style={styles.time}>
              {ts.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </Text>
            {tickState && (
              <Tick state={tickState} />
            )}
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  /* ---- UI ---- */
  const ready = !!myUid && !!otherUid;
  const listBottomPad =
    COMPOSER_H +
    Math.max(insets.bottom, 16) +
    EXTRA_GAP;

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={COLORS.bg}
      />

      {/* fixed header */}
      <View style={{ height: HEADER_FIXED_H }}>
        <Header
          title={otherName}
          avatar={otherAvatar}
          onBack={() => navigation.goBack()}
          topInset={insets.top}
        />
      </View>

      {/* chat area */}
      <View
        style={{
          height: "95%",
          overflow: "hidden",
        }}
      >
        {ready ? (
          isIOS ? (
            <KeyboardAvoidingView
              style={{ flex: 1 }}
              behavior="padding"
              keyboardVerticalOffset={
                HEADER_FIXED_H
              }
            >
              <FlatList
                ref={listRef}
                style={{ flex: 1 }}
                contentContainerStyle={{
                  paddingTop: 8,
                  paddingHorizontal: 12,
                  paddingBottom:
                    listBottomPad,
                }}
                data={messages}
                keyExtractor={(m) => m._id}
                renderItem={renderItem}
                inverted
                keyboardShouldPersistTaps="always"
                keyboardDismissMode="interactive"
                onContentSizeChange={() =>
                  listRef.current?.scrollToOffset?.({
                    offset: 0,
                    animated: true,
                  })
                }
                ListEmptyComponent={
                  <View
                    style={{
                      alignItems: "center",
                      paddingTop: 80,
                    }}
                  >
                    <Text
                      style={{
                        color: COLORS.sub,
                      }}
                    >
                      No messages yet. Say hi 👋
                    </Text>
                  </View>
                }
              />

              {/* Composer */}
              <View
                style={[
                  styles.composerBar,
                  {
                    paddingBottom:
                      Math.max(
                        insets.bottom,
                        8
                      ),
                  },
                ]}
              >
                <TouchableOpacity
                  onPress={pickFromGallery}
                  style={styles.mediaBtn}
                >
                  <Feather
                    name="image"
                    size={20}
                    color={COLORS.primary}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={openCamera}
                  style={[
                    styles.mediaBtn,
                    { marginLeft: 10 },
                  ]}
                >
                  <Feather
                    name="camera"
                    size={20}
                    color={COLORS.primary}
                  />
                </TouchableOpacity>

                <View style={styles.inputPill}>
                  <TextInput
                    ref={inputRef}
                    value={composer}
                    onChangeText={setComposer}
                    placeholder="Type a message"
                    placeholderTextColor={
                      COLORS.sub
                    }
                    style={styles.input}
                    multiline
                    blurOnSubmit={false}
                    onFocus={() =>
                      listRef.current?.scrollToOffset?.(
                        {
                          offset: 0,
                          animated: true,
                        }
                      )
                    }
                  />
                </View>

                <TouchableOpacity
                  onPress={sendText}
                  style={styles.sendFab}
                  activeOpacity={0.9}
                  disabled={sending}
                >
                  <Feather
                    name="send"
                    size={20}
                    color="#fff"
                  />
                </TouchableOpacity>
              </View>
            </KeyboardAvoidingView>
          ) : (
            <AvoidSoftInputView
              style={{ flex: 1 }}
              avoidOffset={EXTRA_GAP}
            >
              <FlatList
                ref={listRef}
                style={{ flex: 1 }}
                contentContainerStyle={{
                  paddingTop: 8,
                  paddingHorizontal: 12,
                  paddingBottom:
                    listBottomPad,
                }}
                data={messages}
                keyExtractor={(m) => m._id}
                renderItem={renderItem}
                inverted
                keyboardShouldPersistTaps="always"
                keyboardDismissMode="on-drag"
                onContentSizeChange={() =>
                  listRef.current?.scrollToOffset?.({
                    offset: 0,
                    animated: true,
                  })
                }
                ListEmptyComponent={
                  <View
                    style={{
                      alignItems: "center",
                      paddingTop: 80,
                    }}
                  >
                    <Text
                      style={{
                        color: COLORS.sub,
                      }}
                    >
                      No messages yet. Say hi 👋
                    </Text>
                  </View>
                }
              />

              <View
                style={[
                  styles.composerBar,
                  {
                    paddingBottom: Math.max(
                      insets.bottom +
                        EXTRA_GAP,
                      14
                    ),
                  },
                ]}
              >
                <TouchableOpacity
                  onPress={pickFromGallery}
                  style={styles.mediaBtn}
                >
                  <Feather
                    name="image"
                    size={20}
                    color={COLORS.primary}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={openCamera}
                  style={[
                    styles.mediaBtn,
                    { marginLeft: 10 },
                  ]}
                >
                  <Feather
                    name="camera"
                    size={20}
                    color={COLORS.primary}
                  />
                </TouchableOpacity>

                <View style={styles.inputPill}>
                  <TextInput
                    ref={inputRef}
                    value={composer}
                    onChangeText={setComposer}
                    placeholder="Type a message"
                    placeholderTextColor={
                      COLORS.sub
                    }
                    style={styles.input}
                    multiline
                    blurOnSubmit={false}
                    onFocus={() =>
                      listRef.current?.scrollToOffset?.(
                        {
                          offset: 0,
                          animated: true,
                        }
                      )
                    }
                    onSubmitEditing={sendText}
                    returnKeyType="send"
                  />
                </View>

                <TouchableOpacity
                  onPress={sendText}
                  style={styles.sendFab}
                  activeOpacity={0.9}
                  disabled={sending}
                >
                  <Feather
                    name="send"
                    size={20}
                    color="#fff"
                  />
                </TouchableOpacity>
              </View>
            </AvoidSoftInputView>
          )
        ) : (
          <View
            style={{
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text
              style={{
                color: COLORS.sub,
                paddingHorizontal: 24,
                textAlign: "center",
              }}
            >
              Loading profile… Waiting for
              myUid/otherUid
            </Text>
          </View>
        )}
        <View style={{ height: 10 }} />
      </View>
    </SafeAreaView>
  );
}

/* ---------------- Styles ---------------- */
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },

  header: { backgroundColor: COLORS.bg },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    height: 56,
  },
  headerCenter: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 8,
  },
  headerTitle: {
    color: COLORS.text,
    fontWeight: "700",
    fontSize: 16,
    maxWidth: "90%",
    marginLeft: 10,
  },
  headerDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: COLORS.line,
  },

  row: {
    flexDirection: "row",
    marginVertical: 6,
  },
  smallAvatar: {
    width: 24,
    height: 24,
    marginRight: 6,
    alignSelf: "flex-end",
    borderRadius: 12,
    backgroundColor: "#222",
    borderColor: "white",
    borderWidth: 1,
  },

  bubble: {
    maxWidth: "78%",
    borderRadius: 14,
    padding: 10,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  msgText: { color: COLORS.text, fontSize: 16 },
  msgImage: {
    width: 220,
    height: 220,
    backgroundColor: "#222",
    borderColor: "white",
    borderWidth: 1,
    borderRadius: 10,
  },
  time: {
    fontSize: 11,
    color: COLORS.sub,
    alignSelf: "flex-end",
    marginTop: 4,
  },

  composerBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingTop: 8,
    marginBottom: 10,
    paddingHorizontal: 12,
    backgroundColor: COLORS.bg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.line,
  },
  mediaBtn: {
    height: 44,
    width: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(244,67,54,0.10)",
  },
  inputPill: {
    flex: 1,
    backgroundColor: "#1A1B25",
    marginHorizontal: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 22,
    minHeight: 44,
    justifyContent: "center",
  },
  input: {
    color: COLORS.text,
    fontSize: 16,
    maxHeight: 120,
  },
  sendFab: {
    height: 48,
    width: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
});
