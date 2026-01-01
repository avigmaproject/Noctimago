// src/screens/Chat/GroupChat.tsx
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, FlatList, Image, TouchableOpacity, TextInput, StyleSheet, StatusBar,
  Alert, KeyboardAvoidingView, Platform, ActivityIndicator, Dimensions, Animated,Keyboard
} from 'react-native';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useHeaderHeight } from '@react-navigation/elements';
import Feather from 'react-native-vector-icons/Feather';
import ImagePicker from 'react-native-image-crop-picker';
import firestore from '@react-native-firebase/firestore';
import { useSelector } from 'react-redux';
import { uploaddocumnetaws } from '../../utils/Awsfile';
import { AvoidSoftInput, AvoidSoftInputView } from 'react-native-avoid-softinput';
import Avatar from "../../utils/Avatar";
import { sendchatnotify } from '../../utils/apiconfig';
const COLORS = { bg:'#0B0B12', card:'#15151F', me:'rgba(82,68,171,0.18)', text:'#EDEDF4', sub:'#9A9AA5', line:'rgba(255,255,255,0.08)', primary:'#F44336',  border:'#1F2127' };
const DUMMY_AVATAR = 'https://i.pravatar.cc/150?img=1';
const DEFAULT_GROUP_AVATAR = 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/bc/Unknown_person.jpg/1200px-Unknown_person.jpg';

const { height: SCREEN_H } = Dimensions.get('window');
const COMPOSER_H = 60;
const EXTRA_GAP = 12;

// Toggle this if you store avatars at groups/{groupId}/membersInfo/{uid}
const SHOW_SEEN_AVATARS = true;

/* ---------- Types ---------- */
type Msg = {
  _id: string;
  text?: string;
  image?: string;
  createdAt: Date;
  clientCreatedAt?: Date;
  sentBy: string;
  user: { _id: string; name?: string; avatar?: string; userid?: number | null };
};

type GroupDoc = {
  id: string;
  name: string;
  avatar?: string;
  members: string[];
  updatedAt?: any;
  lastmsg?: string;
  lastSentBy?: string;
  reads?: Record<string, any>;
  readsMs?: Record<string, number>;
};

const stripUndefined = <T extends object>(o: T): T =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;
const safeNum = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : null);

export default function GroupChat({ navigation, route }: any) {
  const { groupId, name: initialName, avatar: initialAvatar } =
    route.params as { groupId: string; name: string; avatar?: string | null };

  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const isIOS = Platform.OS === 'ios';

  // hide bottom tabs while in chat
  const bottomPad = Math.max(insets.bottom, 20);
  const height = (Platform.OS === "ios" ? 54 : 64) + bottomPad;
  useLayoutEffect(() => {
    navigation.getParent()?.setOptions({ tabBarStyle: { display: "none" } });
    return () => {
      navigation.getParent()?.setOptions({
        tabBarStyle: {
          backgroundColor: COLORS.bg,
          borderTopColor: COLORS.border,
          borderTopWidth: 1,
          // height,
          // paddingBottom: bottomPad,
          // paddingTop: 4,
        },
      });
    };
  }, [navigation]);

  /* ---------- Soft input pin-to-bottom ---------- */
  const listRef = useRef<FlatList<Msg>>(null);
  const inputRef = useRef<TextInput>(null);
  const scrollToBottom = (animated = true) =>
    listRef.current?.scrollToOffset?.({ offset: 0, animated });

  useEffect(() => {
    if (Platform.OS === 'android') {
      const sub = AvoidSoftInput.onSoftInputShown(() => scrollToBottom(true));
      return () => sub.remove();
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS === 'android') {
        AvoidSoftInput.setEnabled(true);
        AvoidSoftInput.setShouldMimicIOSBehavior(true);
      }
      return () => {
        if (Platform.OS === 'android') AvoidSoftInput.setEnabled(false);
      };
    }, [])
  );

  /* ---- Me ---- */
  const userprofile = useSelector((s: any) => s.authReducer?.userprofile);
  const myUid = String(
    userprofile?.ID ??
    userprofile?.user?.id ??
    userprofile?.User_PkeyID ??
    userprofile?.User_Firebase_UID ??
    ''
  );

  const myName = userprofile?.display_name ?? userprofile?.username ?? 'Me';
  const myAvatar = userprofile?.meta?.profile_image || userprofile?.User_Image_Path || DUMMY_AVATAR;

  /* ---- State ---- */
  const [messages, setMessages] = useState<Msg[]>([]);
  const [composer, setComposer] = useState('');
  const [sending, setSending] = useState(false);
  const [group, setGroup] = useState<GroupDoc>({
    id: groupId,
    name: initialName || 'Group',
    avatar: initialAvatar || DEFAULT_GROUP_AVATAR,
    members: []
  });
  const [loadingFirst, setLoadingFirst] = useState(true);

  const atBottomRef = useRef(true);
  const showToBottom = useRef(new Animated.Value(0)).current;

  const db = firestore();
  const groupDoc = useMemo(() => db.collection('groups').doc(groupId), [db, groupId]);
  const msgCol = useMemo(() => groupDoc.collection('messages'), [groupDoc]);
// --- Read markers ---
const markRead = useCallback(() => {
  if (!myUid) return;
  const now = Date.now();
  groupDoc.set({
    [`reads.${myUid}`]: firestore.FieldValue.serverTimestamp(),
    [`readsMs.${myUid}`]: now,
    [`wm.${myUid}`]: now,
  }, { merge: true }).catch(err => console.warn("[markRead] FAIL", err?.code, err?.message));
}, [groupDoc, myUid]);

useFocusEffect(useCallback(() => {
  markRead();
  return () => {};
}, [markRead]));

// ✅ mark once more when leaving GroupChat (unmount)
useEffect(() => {
  return () => { markRead(); };
}, [markRead]);

  /* ----------------- Header (tap to settings) -------------- */
/* ----------------- Header (tap to settings) -------------- */
useEffect(() => {
  navigation.setOptions({
    headerShown: true,
    headerBackTitleVisible: false,
    headerStyle: { backgroundColor: COLORS.bg },
    headerTintColor: '#fff',

    // 👇 add this
    headerLeft: () => (
      <TouchableOpacity
        onPress={() => navigation.goBack()}
        style={{ paddingHorizontal: 12 }}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Feather name="chevron-left" size={24} color="#fff" />
      </TouchableOpacity>
    ),

    headerTitle: () => (
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => navigation.navigate('GroupSettings', { groupId })}
        style={{ flexDirection: 'row', alignItems: 'center' }}
      >
        <Avatar name={group.name} size={28} border />
        <View style={{ marginLeft: 10 }}>
          <Text
            numberOfLines={1}
            style={{
              color: '#fff',
              fontWeight: '700',
              fontSize: 16,
              maxWidth: SCREEN_H * 0.4,
            }}
          >
            {group.name}
          </Text>
          <Text style={{ color: COLORS.sub, fontSize: 11 }}>
            {group.members?.length || 1} members
          </Text>
        </View>
      </TouchableOpacity>
    ),

    headerRight: () => (
      <TouchableOpacity
        onPress={() => navigation.navigate('GroupSettings', { groupId })}
        style={{ paddingHorizontal: 12 }}
      >
        <Feather name="more-horizontal" size={20} color="#fff" />
      </TouchableOpacity>
    ),
  });
}, [navigation, group.name, group.avatar, group.members?.length, groupId]);


  /* --------------------------- Live group doc ------------------------------ */
  useEffect(() => {
    const unsub = groupDoc.onSnapshot(
      snap => {
        const data = snap.data() as any;
        if (data) {
          setGroup(g => ({
            id: snap.id,
            name: data.name ?? g.name,
            avatar: data.avatar ?? g.avatar,
            members: Array.isArray(data.members) ? data.members.map(String) : g.members,
            updatedAt: data.updatedAt,
            lastmsg: data.lastmsg,
            lastSentBy: data.lastSentBy,
            reads: data.reads || g.reads,
            readsMs: data.readsMs || g.readsMs,   // 👈 capture readsMs
          }));
        }
      },
      err => console.log('[GroupChat] group doc ERROR', err?.code, err?.message)
    );
    return () => unsub();
  }, [groupDoc]);

  /* ------------------------------ Live messages --------------------------- */
  useEffect(() => {
    const q = msgCol.orderBy('createdAt', 'desc').limit(50);
    const unsub = q.onSnapshot(
      snap => {
        const rows: Msg[] = snap.docs.map(d => {
          const x: any = d.data();
          const created = x?.createdAt?.toDate?.() || (x?.clientCreatedAt && new Date(x.clientCreatedAt)) || new Date();
          return { _id: d.id, ...x, createdAt: created } as Msg;
        });
        setMessages(rows);
        setLoadingFirst(false);
        if (atBottomRef.current) requestAnimationFrame(() => scrollToBottom(true));
      },
      err => console.log('[GroupChat] live ERROR', err?.code, err?.message)
    );
    return () => unsub();
  }, [msgCol]);

  /* ------------------------------ Read markers ---------------------------- */
 
  

  // on focus
  

  // when new messages arrive (not sent by me)
  useEffect(() => {
    if (!messages.length || !myUid) return;
    const latest = messages[0];
    if (String(latest.sentBy) !== String(myUid)) {
      markRead();
    }
  }, [messages, myUid, markRead]);

  /* ------------------------------ Send ------------------------------------ */
  const randomId = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
  const getGroupTokens = async (members: string[], myUid: string) => {
    if (!members?.length) return [];
  
    const snaps = await Promise.all(
      members
        .filter(uid => String(uid) !== String(myUid)) // ❌ no self notification
        .map(uid =>
          firestore()
            .collection("users")
            .doc(String(uid))
            .get()
        )
    );
  
    const tokens = snaps
      .map(s => s.data()?.fcmToken)
      .filter(Boolean);
  
    console.log("🔍 [getGroupTokens]", tokens.length, "tokens found");
  
    return tokens;
  };
  const sendInternal = async (payload: { kind: 'text'; text: string } | { kind: 'image'; uri: string }) => {
    if (!myUid) return;
    const id = randomId();
    const now = new Date();
    const isText = (payload as any).kind === 'text';
    const lastText = isText ? (payload as any).text.trim() : '📷 Photo';

    const baseUser = { _id: String(myUid), name: myName || '', avatar: myAvatar || '', userid: safeNum(myUid) };
    const optimistic: Msg = isText
      ? { _id: id, text: (payload as any).text, createdAt: now, clientCreatedAt: now, sentBy: String(myUid), user: baseUser }
      : { _id: id, image: (payload as any).uri, text: '', createdAt: now, clientCreatedAt: now, sentBy: String(myUid), user: baseUser };

    setMessages(p => [optimistic, ...p]);

    const msgRef = msgCol.doc(id);
    const msgPayload = stripUndefined({
      ...optimistic,
      createdAt: firestore.FieldValue.serverTimestamp(),
      clientCreatedAt: now,
    });

    try {
      setSending(true);
      const batch = db.batch();
      batch.set(msgRef, msgPayload);
      // bump group meta for unread dots
      batch.set(
        groupDoc,
        {
          updatedAt: firestore.FieldValue.serverTimestamp(),
          updatedMs: Date.now(),
          lastmsg: lastText,
          lastSentBy: String(myUid),
        },
        { merge: true }
      );
      await batch.commit();
      try {
        console.log("✅ [SEND] Firestore batch committed", { id, lastText });
      
        console.log("🔔 [GROUP_PUSH] Start", {
          groupId,
          myUid,
          membersCount: group?.members?.length || 0,
          groupName: group?.name,
        });
      
        const tokens = await getGroupTokens(group.members, myUid);
      console.log("tokens",tokens)
  
        console.log("✅ [GROUP_PUSH] Tokens fetched", {
          totalTokens: tokens.length,
          tokensPreview: tokens.map(t => String(t).slice(0, 20) + "..."),
        });
      
        if (!tokens.length) {
          console.log("⚠️ [GROUP_PUSH] No tokens found. Skip push.");
        } else {
          const notifPayload = {
            UserTokens: tokens.join(","),
            message: lastText,
            msgtitle: group.name,
            User_PkeyID: myUid,
            UserID: 0,
            NTN_C_L: 3,
          };
      
          console.log("📦 [GROUP_PUSH] notifPayload ready", {
            ...notifPayload,
            UserTokens: `(${tokens.length} tokens)`,
          });
      const res=await sendchatnotify(JSON.stringify(notifPayload))
          // const res = await fetch(
          //   "https://napi.nearbuy.space/api/NoctimagoApi/sendNotificationMultiple",
          //   {
          //     method: "POST",
          //     headers: { "Content-Type": "application/json" },
          //     body: JSON.stringify(notifPayload),
          //   }
          // );
      
          // console.log("📡 [GROUP_PUSH] HTTP Response", res,notifPayload);
      
          // const bodyText = await res.text();
          // console.log("🧾 [GROUP_PUSH] Response Body:", bodyText);
      
          // // if (res.ok) console.log("✅ [GROUP_PUSH] Push sent successfully!");
          // else console.log("❌ [GROUP_PUSH] Push failed!");
        }
      } catch (e: any) {
        console.log("💥 [GROUP_PUSH] Exception:", e?.message, e?.stack);
      }
      markRead();
    } catch (e: any) {
      setMessages(p => p.filter(m => m._id !== id));
      Alert.alert('Send failed', e?.message || 'Please try again.');
    } finally {
      setSending(false);
    }
  };
  const handlePressSend = () => {
    const text = composer.trim();
    if (!text || sending) return;
  
    if (Platform.OS === 'android') {
      // 👇 on some Samsung devices, behaving like:
      // "close keyboard, THEN send" is required
      Keyboard.dismiss();
      setTimeout(() => {
        // double-check text still non-empty
        if (composer.trim()) {
          sendText();
        }
      }, 30);
    } else {
      sendText();
    }
  };
  
  const sendText = async () => {
    Keyboard.dismiss();
    const text = composer.trim();
    if (!text) return;
    setComposer('');
   
    requestAnimationFrame(() => { inputRef.current?.focus(); scrollToBottom(true); });
    await sendInternal({ kind: 'text', text });
  };

  const sendImage = async (uri: string) => {
    try {
      const file = { name: `${Date.now()}-${myUid}`, size: 0, type: 'image/jpeg', uri } as any;
      const uploaded: any = await uploaddocumnetaws(file);
      if (uploaded?.location) await sendInternal({ kind: 'image', uri: uploaded.location });
    } catch {
      Alert.alert('Upload failed');
    }
  };
  const pickImage = async () => {
    try {
      const res = await ImagePicker.openPicker({ multiple: false, writeTempFile: true, includeExif: true, cropping: true, mediaType: 'photo' });
      await sendImage(res.path);
    } catch {}
  };
  const openCamera = async () => {
    try {
      const res = await ImagePicker.openCamera({ writeTempFile: true, includeExif: true, cropping: true, mediaType: 'photo' });
      await sendImage(res.path);
    } catch {}
  };
  const deleteMessage = async (m: Msg) => {
    try {
      if (String(m.sentBy) !== String(myUid)) {
        Alert.alert("You can delete only your messages.");
        return;
      }
      setMessages(prev => prev.filter(x => x._id !== m._id));
      await msgCol.doc(m._id).delete();

      const latestSnap = await msgCol.orderBy('createdAt', 'desc').limit(1).get();
      const latestDoc = latestSnap.docs[0];
      const latest = latestDoc?.data() as any | undefined;

      await groupDoc.set({
        updatedAt: firestore.FieldValue.serverTimestamp(),
        updatedMs: Date.now(),
        lastmsg: latest ? (latest.text?.trim?.() ? latest.text : '📷 Photo') : '',
        lastSentBy: latest ? String(latest.sentBy) : '',
      }, { merge: true });
    } catch (e: any) {
      Alert.alert('Delete failed', e?.message || 'Please try again.');
    }
  };

  /* ---------------- Seen helpers & UI ---------------- */
  // optional mini cache of member avatars for "seen by" row
  const [memberMap, setMemberMap] = useState<Record<string, { name?: string; avatar?: string }>>({});
  useEffect(() => {
    if (!SHOW_SEEN_AVATARS) return;
    const col = groupDoc.collection('membersInfo');
    const unsub = col.onSnapshot(snap => {
      const m: Record<string, { name?: string; avatar?: string }> = {};
      snap.forEach(d => (m[String(d.id)] = d.data() as any));
      setMemberMap(m);
    });
    return () => unsub();
  }, [groupDoc]);

  const computeSeenInfo = useCallback((msg: Msg) => {
    if (!group.readsMs || !Array.isArray(group.members)) {
      return { seenByUids: [] as string[], allSeen: false };
    }
    const msgTs = (msg.createdAt instanceof Date) ? +msg.createdAt : +new Date(msg.createdAt as any);
    const others = group.members.filter(uid => String(uid) !== String(myUid));
    const seenByUids = others.filter(uid => {
      const ms = group.readsMs?.[String(uid)];
      return typeof ms === 'number' && ms >= msgTs;
    });
    const allSeen = seenByUids.length === others.length && others.length > 0;
    return { seenByUids, allSeen };
  }, [group.readsMs, group.members, myUid]);

  const SeenRow = ({ msg }: { msg: Msg }) => {
    if (String(msg.sentBy) !== String(myUid)) return null;
    const { seenByUids, allSeen } = computeSeenInfo(msg);
    if (seenByUids.length === 0) return null;

    return (
      <View style={{ marginTop: 4, alignSelf: 'flex-end' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' }}>
          <Text style={{ color: COLORS.sub, fontSize: 11 }}>
            {allSeen ? 'Seen' : `Seen by ${seenByUids.length}`}
          </Text>
          <Feather
            name={allSeen ? 'check-circle' : 'check'}
            size={12}
            color={allSeen ? COLORS.primary : COLORS.sub}
            style={{ marginLeft: 6 }}
          />
        </View>
        {SHOW_SEEN_AVATARS && (
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 4 }}>
            {seenByUids.slice(0, 5).map(uid => (
              <Image
                key={uid}
                source={{ uri: memberMap?.[uid]?.avatar || DUMMY_AVATAR }}
                style={{ width: 14, height: 14, borderRadius: 7, marginLeft: 4, backgroundColor: '#222' }}
              />
            ))}
            {seenByUids.length > 5 && (
              <Text style={{ color: COLORS.sub, fontSize: 11, marginLeft: 6 }}>+{seenByUids.length - 5}</Text>
            )}
          </View>
        )}
      </View>
    );
  };

  /* -------------------------- Scroll to bottom FAB ------------------------ */
  const onScroll = (e: any) => {
    const nearBottom = e.nativeEvent.contentOffset.y <= 20; // inverted list: y~0 is bottom
    atBottomRef.current = nearBottom;
    Animated.timing(showToBottom, { toValue: nearBottom ? 0 : 1, duration: 160, useNativeDriver: true }).start();
    if (nearBottom) markRead();
  };

  const ToBottomFab = () => (
    <Animated.View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        right: 16,
        bottom: COMPOSER_H + Math.max(insets.bottom, 12) + 8,
        opacity: showToBottom,
        transform: [{ translateY: showToBottom.interpolate({ inputRange: [0,1], outputRange: [12,0] }) }],
      }}
    >
      <TouchableOpacity onPress={() => scrollToBottom(true)} style={styles.toBottomFab} activeOpacity={0.9}>
        <Feather name="arrow-down" size={18} color="#fff" />
      </TouchableOpacity>
    </Animated.View>
  );

  /* ------------------------------- BODY ----------------------------------- */
  const List = (
    <FlatList
      ref={listRef}
      style={{ flex: 1 }}
      data={messages}
      inverted
      keyExtractor={(m) => m._id}
      renderItem={({ item }) => {
        const mine = item.sentBy === String(myUid);
        const ts = item.createdAt instanceof Date ? item.createdAt : new Date(item.createdAt as any);
        const timeText = ts ? ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--';
        const sender = item?.user?.name || 'Unknown';
        const onLong = () => {
          if (!mine) return;
          Alert.alert(
            'Delete message?',
            'This will delete it for everyone in the group.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Delete', style: 'destructive', onPress: () => deleteMessage(item) },
            ]
          );
        };
        return (
          <View style={[styles.row, { justifyContent: mine ? 'flex-end' : 'flex-start' }]}>
            <TouchableOpacity
              activeOpacity={0.8}
              onLongPress={onLong}
              delayLongPress={250}
              style={[styles.bubble, { backgroundColor: mine ? COLORS.me : COLORS.card }]}
            >
              {!mine && <Text style={styles.senderName}>{sender}</Text>}
              {item.text ? (
                <Text style={styles.msgText}>{item.text}</Text>
              ) : (
                <Image source={{ uri: item.image }} style={styles.msgImage} />
              )}
              <Text style={styles.time}>{timeText}</Text>
              <SeenRow msg={item} />
            </TouchableOpacity>
          </View>
        );
      }}
      contentContainerStyle={{
        paddingTop: 8,
        paddingHorizontal: 12,
        paddingBottom: COMPOSER_H + Math.max(insets.bottom, 16) + EXTRA_GAP,
      }}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}  // 👈 swipe to close
      onScrollBeginDrag={() => Keyboard.dismiss()}                              // 👈 extra safety
      removeClippedSubviews={false}
      initialNumToRender={20}
      windowSize={10}
      maintainVisibleContentPosition={{ minIndexForVisible: 0, autoscrollToTopThreshold: 20 }}
      onScroll={onScroll}
      onContentSizeChange={() => {
        scrollToBottom(true);
        if (atBottomRef.current) markRead();
      }}
    />
  );
  

  const Composer = (
    <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, 40) }]}>
      <TouchableOpacity onPress={pickImage} style={styles.mediaBtn}>
        <Feather name="image" size={18} color={COLORS.primary} />
      </TouchableOpacity>
      <TouchableOpacity onPress={openCamera} style={[styles.mediaBtn, { marginRight: 8 }]}>
        <Feather name="camera" size={18} color={COLORS.primary} />
      </TouchableOpacity>

      <View style={styles.inputPill}>
        <TextInput
          ref={inputRef}
          value={composer}
          onChangeText={setComposer}
          placeholder="Type a message"
          placeholderTextColor={COLORS.sub}
          style={styles.input}
          multiline
          blurOnSubmit={false}
          onFocus={() => requestAnimationFrame(() => {
            scrollToBottom(true);
            markRead();
          })}
        />
      </View>

      <TouchableOpacity
        onPress={handlePressSend}
        style={[styles.sendFab, composer.trim().length === 0 && { opacity: 0.5 }]}
        disabled={sending || composer.trim().length === 0}
      >
        <Feather name="send" size={18} color="#fff" />
      </TouchableOpacity>
    </View>
  );

  const Body = (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />
      {loadingFirst ? (
        <View style={{ flex:1, alignItems:'center', justifyContent:'center' }}>
          <ActivityIndicator />
        </View>
      ) : (
        <>
          {Platform.OS === 'android' ? (
            <AvoidSoftInputView style={{ flex: 1 }} avoidOffset={EXTRA_GAP}>
              {List}
              <ToBottomFab />
              {Composer}
            </AvoidSoftInputView>
          ) : (
            <>
              {List}
              <ToBottomFab />
              {Composer}
            </>
          )}
        </>
      )}
    </SafeAreaView>
  );

  if (isIOS) {
    return (
      <View
        style={{ flex: 1 }}
        // behavior="padding"
        // keyboardVerticalOffset={headerHeight}   // height of native header
      >
        {Body}
      </View>   
    );
  }
  
  return Body;
}

/* -------------------------------- Styles --------------------------------- */
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },

  senderName: { color: COLORS.sub, fontSize: 12, marginBottom: 4 },
  row: { flexDirection: 'row', marginVertical: 6 },
  bubble: {
    maxWidth: '78%', borderRadius: 14, padding: 10,
    shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  msgText: { color: COLORS.text, fontSize: 16 },
  msgImage: { width: 220, height: 220, borderRadius: 12, backgroundColor: '#222' },
  time: { fontSize: 11, color: COLORS.sub, alignSelf: 'flex-end', marginTop: 4 },

  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingTop: 8,
    paddingHorizontal: 12,
    backgroundColor: COLORS.bg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.line,
  },
  mediaBtn: {
    height: 44, width: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(244,67,54,0.10)', marginRight: 4,
  },
  inputPill: {
    flex: 1, backgroundColor: '#1A1A25', marginRight: 12,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 22,
    minHeight: 44, justifyContent: 'center'
  },
  input: { color: COLORS.text, fontSize: 16, maxHeight: 120 },
  sendFab: {
    height: 48, width: 48, borderRadius: 24,
    backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center'
  },

  toBottomFab: {
    height: 40, width: 40, borderRadius: 20,
    backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
});
