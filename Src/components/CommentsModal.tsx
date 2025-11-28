// components/CommentsModal.tsx
// Full-screen comments with latest-first roots, inline replies,
// clickable @mentions, robust keyboard handling, and a 2-snap bottom sheet (80% / 50%).

import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  Platform,
  ActivityIndicator,
  Dimensions,
  Animated,
  PanResponder,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "react-native-vector-icons/Ionicons";
import { AvoidSoftInputView, AvoidSoftInput } from "react-native-avoid-softinput";
import Avatar from "../utils/Avatar";
import { updateCommentApi, deleteCommentApi } from "./comments";
import { useSelector } from "react-redux";
import { TText } from "../i18n/TText";
/* ---------------- Emoji helpers ---------------- */
const decodeCurlyUnicode = (s: string) =>
  s.replace(/u\{([0-9a-fA-F]+)\}/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)));

const decodeHtmlEntities = (s: string) =>
  s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)));

const COLON_EMOJI: Record<string, string> = {
  ":thumbsup:": "👍",
  ":sunglasses:": "😎",
  ":heart:": "❤️",
  ":fire:": "🔥",
  ":clap:": "👏",
};
const decodeColonShortcodes = (s: string) =>
  s.replace(/:[a-z0-9_+\-]+:/gi, (m) => COLON_EMOJI[m.toLowerCase()] ?? m);

const normalizeEmoji = (s?: string) =>
  decodeColonShortcodes(decodeHtmlEntities(decodeCurlyUnicode(String(s ?? ""))));

/* -------------------------------- Types -------------------------------- */
export type ApiComment = {
  ID: string | number;
  content: string;
  date: string;
  parent_id?: string | number;
  author?: string;
  user_id?: string | number;
  author_profile_image?: string;
  is_liked?: boolean;      // ✅ add
  like_count?: number;  
};
export type CommentNode = ApiComment & { children: CommentNode[] };

type UserLite = { id: string; username: string; name: string; avatar?: string; allowTag: boolean };

type Props = {
  open: boolean;
  onClose: () => void;
  postId: string;
  totalFromApi: number;
  comments: ApiComment[];
  loading: boolean;
  ensureLoaded: () => void;
  onSend: (args: {
    text: string;
    tagged: { id: string; username: string }[];
    parentId?: string;
  }) => Promise<boolean>;
  searchUsersApi: (q: string) => Promise<any[]>;
  onPressProfile: (userId?: string, usernameFallback?: string) => void;
  COLORS: any;
  meId: string;
  token?: string;
  onToggleCommentLike: (commentId: string) => void;
  isCommentLikeBusy?: (commentId: string) => boolean;

};

/* ---------------- Utilities ---------------- */
const getParentId = (c: ApiComment): string | null => {
  const s = String(c.parent_id ?? "").trim().toLowerCase();
  return !s || s === "0" || s === "null" || s === "undefined" || s === "nan" ? null : s;
};

const parseDate = (s?: string) => (s ? new Date(s) : new Date(0));

function threadifyLatestFirst(list: ApiComment[]): CommentNode[] {
  const byId = new Map<string, CommentNode>();
  list.forEach((c) => byId.set(String(c.ID), { ...c, children: [] }));

  const roots: CommentNode[] = [];
  list.forEach((c) => {
    const pid = getParentId(c);
    const node = byId.get(String(c.ID))!;
    if (pid && byId.has(pid)) byId.get(pid)!.children.push(node);
    else roots.push(node);
  });

  const sortAsc = (a: CommentNode, b: CommentNode) => parseDate(a.date).getTime() - parseDate(b.date).getTime();
  const sortDesc = (a: CommentNode, b: CommentNode) => parseDate(b.date).getTime() - parseDate(a.date).getTime();

  roots.sort(sortDesc);
  roots.forEach((n) => n.children.sort(sortAsc));
  return roots;
}

// Encode non-ASCII to HTML entities (mirrors create/edit payload encoding)
const encodeToHtmlEntities = (s: string) =>
  Array.from(s)
    .map((ch) => {
      const cp = ch.codePointAt(0)!;
      return cp > 0x7f ? `&#x${cp.toString(16).toUpperCase()};` : ch;
    })
    .join("");

// Map backend user -> UserLite (handles many field names)
const adaptUser = (u: any): UserLite => ({
  id: String(u?.id ?? u?.user_id ?? u?.userId ?? u?.ID ?? ""),
  username: String(
    u?.username ?? u?.user_login ?? u?.user_nicename ?? u?.userName ?? u?.name ?? ""
  )
    .trim()
    .replace(/\s+/g, ""),
  name: String(u?.name ?? u?.display_name ?? u?.displayName ?? u?.username ?? u?.user_login ?? ""),
  avatar: u?.avatar ?? u?.profile_image ?? u?.author_profile_image ?? u?.photo ?? undefined,
  allowTag: Boolean(u?.allowTag ?? true),
});

/* ------ MentionsText (clickable @mentions) ------ */
function MentionsText({
  text,
  onPressUsername,
  normalStyle,
  mentionStyle,
}: {
  text: string;
  onPressUsername: (username: string) => void;
  normalStyle?: any;
  mentionStyle?: any;
}) {
  const msg = text ?? "";
  const parts: React.ReactNode[] = [];
  let last = 0;
  for (const m of msg.matchAll(/@([A-Za-z0-9._-]{1,30})/g)) {
    const idx = m.index ?? 0;
    const uname = m[1];
    if (idx > last) parts.push(<Text key={`t-${idx}`} style={normalStyle}>{msg.slice(last, idx)}</Text>);
    parts.push(
      <Text
        key={`m-${idx}`}
        style={[normalStyle, mentionStyle || { color: "#7EA1FF" }]}
        allowFontScaling={false}
        suppressHighlighting
        onPress={() => onPressUsername(uname)}
      >
        @{uname}
      </Text>
    );
    last = idx + m[0].length;
  }
  if (last < msg.length) parts.push(<Text key="t-end" style={normalStyle}>{msg.slice(last)}</Text>);
  return <Text>{parts}</Text>;
}

/* -------------------------------- Component -------------------------------- */
export default function CommentsModal(props: Props) {
  const {
    open,
    onClose,
    totalFromApi,
    comments,
    loading,
    ensureLoaded,
    onSend,
    searchUsersApi,
    onPressProfile,
    COLORS,
    meId,
    token,
    onToggleCommentLike,
    isCommentLikeBusy,
  } = props;

  const insets = useSafeAreaInsets();
  const { height: SCREEN_H } = Dimensions.get("window");
  // Snap heights
  const SNAP_MAX = Math.round(SCREEN_H * 0.8); // 80%
  const SNAP_MID = Math.round(SCREEN_H * 0.5); // 50% (default)

  // current snap state
  const [isMax, setIsMax] = useState(false); // start at 50% (mid)
  const sheetH = useRef(new Animated.Value(SNAP_MID)).current;
// Treat SVG / generic placeholder avatars as "no avatar"
const normalizeAvatarUri = (raw?: string | null): string | undefined => {
  if (!raw) return undefined;
  const u = String(raw).trim();

  // Block obvious SVG cases
  if (
    u.endsWith(".svg") ||
    u.includes("data:image/svg+xml") ||
    u.includes("image/svg+xml")
  ) {
    return undefined;
  }

  // If your backend uses a known placeholder URL, block it here too:
  if (
    u.includes("gravatar.com/avatar") && u.includes("d=mm") // WP mystery-man
  ) {
    return undefined;
  }

  return u;
};

  // Open/close effects
  useEffect(() => {
    if (open) {
      ensureLoaded?.();
      AvoidSoftInput.setEnabled(true);
      Animated.timing(sheetH, { toValue: isMax ? SNAP_MAX : SNAP_MID, duration: 220, useNativeDriver: false }).start();
    } else {
      AvoidSoftInput.setEnabled(false);
    }
    return () => {
      AvoidSoftInput.setEnabled(false);
    };
  }, [open]); // eslint-disable-line

  const snapTo = (toMax: boolean) => {
    setIsMax(toMax);
    Animated.timing(sheetH, { toValue: toMax ? SNAP_MAX : SNAP_MID, duration: 220, useNativeDriver: false }).start();
  };

  const toggleSize = () => snapTo(!isMax);

  // Pan to drag between mid and max
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 6,
      onPanResponderMove: (_, g) => {
        const base = isMax ? SNAP_MAX : SNAP_MID;
        const next = base - g.dy; // drag up increases height
        const clamped = Math.max(SNAP_MID, Math.min(SNAP_MAX, next));
        sheetH.setValue(clamped);
      },
      onPanResponderRelease: (_, g) => {
        // snap based on velocity and where we stopped
        const current = (sheetH as any)._value ?? (isMax ? SNAP_MAX : SNAP_MID);
        const midPoint = (SNAP_MAX + SNAP_MID) / 2;
        const goMax = g.vy < -0.5 || current > midPoint; // flick up or beyond mid -> max
        snapTo(goMax);
      },
    })
  ).current;

  const threaded = useMemo(() => threadifyLatestFirst(comments || []), [comments]);
  const token1 = useSelector((state: any) => state.authReducer.token);

  /* ------------ Reply / Draft / Mentions ------------ */
  const [replyTo, setReplyTo] = useState<ApiComment | null>(null);
  const [draft, setDraft] = useState("");
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionList, setMentionList] = useState<UserLite[]>([]);
  const [mentionLoading, setMentionLoading] = useState(false);
  const [tagged, setTagged] = useState<{ id: string; username: string }[]>([]);
  const mentionRegex = /(^|\s)@([\w.\-]{0,30})$/i;
  const debTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<TextInput>(null);

  const runUserSearch = useCallback(
    (q: string) => {
      if (debTimer.current) clearTimeout(debTimer.current);
      debTimer.current = setTimeout(async () => {
        setMentionLoading(true);
        try {
          const clean = q.replace(/^@+/, "").trim();
          const raw = await searchUsersApi(clean);
          const mapped = Array.isArray(raw) ? raw.map(adaptUser).filter(u => u.id && u.username) : [];
          setMentionList(mapped);
        } finally {
          setMentionLoading(false);
        }
      }, 220);
    },
    [searchUsersApi]
  );

  const onChangeDraft = (t: string) => {
    setDraft(t);
    const m = t.match(mentionRegex);
    if (m) {
      const q = m[2];
      setMentionQuery(q);
      setMentionOpen(true);
      runUserSearch(q);
    } else {
      setMentionOpen(false);
    }
  };

  const insertMention = (u: UserLite) => {
    const next = draft.replace(mentionRegex, (all, lead) => `${lead}@${u.username} `);
    setDraft(next);
    setTagged((prev) => (prev.some((x) => x.id === u.id) ? prev : [...prev, { id: u.id, username: u.username }]));
    setMentionOpen(false);
  };

  const handleReply = (c: ApiComment) => {
    setReplyTo(c);
    const at = `@${(c.author || "").replace(/\s+/g, "")} `;
    if (!draft.startsWith(at)) setDraft(`${at}${draft}`);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  /* ------------ Edit/Delete state ------------ */
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const isMine = (c: ApiComment) => String(c.user_id || "") === String(meId);

  const startEdit = (c: ApiComment) => {
    setReplyTo(null);
    setEditingId(String(c.ID));
    setDraft(normalizeEmoji(c.content || ""));
    setMentionOpen(false);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft("");
  };

  const confirmDelete = async (commentId: string) => {
    setBusyId(commentId);
    try {
      await deleteCommentApi(commentId, token);
      if (editingId === commentId) cancelEdit();
      await ensureLoaded();
    } finally {
      setBusyId(null);
    }
  };

  /* ------------ Send (create or update) ------------ */
  const [isSending, setIsSending] = useState(false);
  const sendingRef = useRef(false);

  const handleSend = async () => {
    const text = draft.trim();
    if (!text || isSending || sendingRef.current) return;

    setIsSending(true);
    sendingRef.current = true;
    try {
      if (editingId) {
        const safe = encodeToHtmlEntities(text);
        await updateCommentApi(editingId, safe, token);
        cancelEdit();
        await ensureLoaded();
        return;
      }
      const ok = await onSend({ text, tagged, parentId: replyTo ? String(replyTo.ID) : undefined });
      if (ok) {
        setDraft("");
        setReplyTo(null);
        setTagged([]);
        setMentionOpen(false);
      }
    } finally {
      setIsSending(false);
      sendingRef.current = false;
    }
  };

  /* ------------ Mentions: resolve + navigation ------------ */
  const [mentionCache, setMentionCache] = useState<Record<string, string>>({});

  const resolveUserId = async (username: string) => {
    const key = username.replace(/^@+/, "").trim().toLowerCase();
    if (mentionCache[key]) return mentionCache[key];

    const hit = mentionList.find((u) => (u.username || "").toLowerCase() === key);
    if (hit?.id) {
      setMentionCache((c) => ({ ...c, [key]: hit.id }));
      return hit.id;
    }

    try {
      const raw = await searchUsersApi(key);
      const mapped = Array.isArray(raw) ? raw.map(adaptUser) : [];
      const exact = mapped.find((u) => (u.username || "").toLowerCase() === key) ?? mapped[0];
      if (exact?.id) {
        setMentionCache((c) => ({ ...c, [key]: exact.id }));
        return exact.id;
      }
    } catch {}
    return "";
  };

  const goProfile = (uid?: string, uname?: string) => {
    onClose?.();
    requestAnimationFrame(() => setTimeout(() => onPressProfile?.(uid, uname), 60));
  };

  const onPressMention = async (username: string) => {
    const uid = await resolveUserId(username);
    if (uid) goProfile(uid, username);
  };

  /* ------------ Renderers ------------ */
  
  const renderChild = (child: CommentNode) => {
    const busyChild = isCommentLikeBusy?.(String(child.ID));
    const childAvatar = normalizeAvatarUri(child.author_profile_image);
    return(
    
    
    <View key={String(child.ID)} style={styles(COLORS).childWrap}>
      <TouchableOpacity onPress={() => onPressProfile(String(child.user_id))} style={{ marginRight: 8, marginTop: 2 }}>
        <Avatar uri={childAvatar} name={child.author} size={20} border />
      </TouchableOpacity>

      <View style={{ flex: 1 }}>
        {editingId === String(child.ID) ? (
          <Text style={styles(COLORS).commentLine} allowFontScaling={false}>{child.author}</Text>
        ) : (
          <Text style={styles(COLORS).commentLine} allowFontScaling={false}>
            <Text style={styles(COLORS).commentAuthor} allowFontScaling={false}>{child.author}</Text>
            <TText style={styles(COLORS).commentText} allowFontScaling={false}> </TText>
            <MentionsText
              text={normalizeEmoji(String(child.content || ""))}
              onPressUsername={onPressMention}
              normalStyle={styles(COLORS).commentText}
            />
          </Text>
        )}

        <View style={{ flexDirection: "row", alignItems: "center", columnGap: 16, marginTop: 6 }}>
          {isMine(child) && editingId !== String(child.ID) && (
            <>
              <TouchableOpacity disabled={busyId === String(child.ID)} onPress={() => startEdit(child)} style={styles(COLORS).chipBtn}>
                <TText style={styles(COLORS).replyTxt} allowFontScaling={false}>Edit</TText>
              </TouchableOpacity>
              <TouchableOpacity disabled={busyId === String(child.ID)} onPress={() => confirmDelete(String(child.ID))} style={styles(COLORS).chipBtn}>
                <TText
                  style={[styles(COLORS).replyTxt, { color: "#EF2C2C", opacity: busyId === String(child.ID) ? 0.6 : 1 }]}
                  allowFontScaling={false}
                >
                  {busyId === String(child.ID) ? "Deleting…" : "Delete"}
                </TText>
              </TouchableOpacity>
            </>
          )}
        </View>
        <TouchableOpacity
        onPress={() => !busyChild && onToggleCommentLike?.(String(child.ID))}
        disabled={!!busyChild}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        style={{
          flexDirection: "row",
          alignItems: "center",
          marginRight: 12,
          opacity: busyChild ? 0.5 : 1,
        }}
      >
        <Ionicons
          name={child.is_liked ? "heart" : "heart-outline"}
          size={16}
          color={child.is_liked ? COLORS.accent : COLORS.icon}
        />
        <Text style={{ color: COLORS.text, marginLeft: 6, fontSize: 12 }}>
          {Number(child.like_count || 0)}
        </Text>
      </TouchableOpacity>



      </View>
    </View>
  )
}

  const renderRoot = ({ item }: { item: CommentNode }) => {
    console.log("avtarrrrrrrrchilddd====", item);
    const busyRoot = isCommentLikeBusy?.(String(item.ID));
    const rootAvatar = normalizeAvatarUri(item.author_profile_image);
  
    return (
    <View style={{ paddingVertical: 10, paddingHorizontal: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
        <TouchableOpacity onPress={() => onPressProfile(String(item.user_id))} style={{ marginRight: 10, marginTop: 2 }}>
          <Avatar
            uri={rootAvatar }
            name={item.author}
            size={20}
            border
          />
        </TouchableOpacity>

        <View style={{ flex: 1 }}>
          {editingId === String(item.ID) ? (
            <View style={{ gap: 8 }}>
              <Text style={styles(COLORS).commentLine} allowFontScaling={false}>{item.author}</Text>
            </View>
          ) : (
            <Text style={styles(COLORS).commentLine} allowFontScaling={false}>
              <Text style={styles(COLORS).commentAuthor} allowFontScaling={false}>{item.author}</Text>
              <TText style={styles(COLORS).commentText} allowFontScaling={false}> </TText>
              <MentionsText
                text={normalizeEmoji(String(item.content || ""))}
                onPressUsername={onPressMention}
                normalStyle={styles(COLORS).commentText}
              />
            </Text>
          )}

          <View style={{ flexDirection: "row", alignItems: "center", columnGap: 16 }}>
            <TouchableOpacity onPress={() => handleReply(item)} style={styles(COLORS).chipBtn}>
              <TText style={styles(COLORS).replyTxt} allowFontScaling={false}>Reply</TText>
            </TouchableOpacity>

            {isMine(item) && editingId !== String(item.ID) && (
              <>
                <TouchableOpacity disabled={busyId === String(item.ID)} onPress={() => startEdit(item)} style={styles(COLORS).chipBtn}>
                  <TText style={styles(COLORS).replyTxt} allowFontScaling={false}>Edit</TText>
                </TouchableOpacity>
                <TouchableOpacity disabled={busyId === String(item.ID)} onPress={() => confirmDelete(String(item.ID))} style={styles(COLORS).chipBtn}>
                  <TText style={[styles(COLORS).replyTxt, { color: "#EF2C2C" }]} allowFontScaling={false}>
                    {busyId === String(item.ID) ? "Deleting…" : "Delete"}
                  </TText>
                </TouchableOpacity>
              </>
            )}
          </View>

          {item.children?.length ? (
            <View style={{ marginTop: 8, marginLeft: 26 }}>{item.children.map(renderChild)}</View>
          ) : null}
        </View>
        <TouchableOpacity
        onPress={() => !busyRoot && onToggleCommentLike(String(item.ID))}
        disabled={!!busyRoot}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        style={{ flexDirection: "row", alignItems: "center", marginRight: 12, opacity: busyRoot ? 0.5 : 1 }}
      >
        <Ionicons
          name={item.is_liked ? "heart" : "heart-outline"}
          size={16}
          color={item.is_liked ? COLORS.accent : COLORS.icon}
        />
        <Text style={{ color: COLORS.text, marginLeft: 6, fontSize: 12 }}>
          {Number(item.like_count || 0)}
        </Text>
      </TouchableOpacity>
    </View>

      </View>
  
  );
}

  /* ------------ UI ------------ */
  return (
    <Modal
      animationType="fade"
      visible={open}
      transparent
      onRequestClose={onClose}
    >
      {/* Backdrop */}
      <TouchableOpacity
        activeOpacity={1}
        onPress={onClose}
        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)" }}
      />

      {/* Bottom-sheet container */}
      <Animated.View
        style={{
          position: "absolute",
          left: 0, right: 0, bottom: 0,
          height: sheetH,
          backgroundColor: COLORS.bg,
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          overflow: "hidden",
        }}
      >
        {/* Drag handle */}
        <View
          {...panResponder.panHandlers}
          style={{
            paddingTop: 8, paddingBottom: 4, alignItems: "center",
            backgroundColor: "transparent",
          }}
        >
          <View
            style={{
              width: 44, height: 4, borderRadius: 2,
              backgroundColor: COLORS.border,
            }}
          />
        </View>

        <SafeAreaView style={[styles(COLORS).modalRoot]}>
          {/* Header */}
          <View style={styles(COLORS).header}>
            <TouchableOpacity onPress={onClose} style={{ padding: 6 }}>
              <Ionicons name="chevron-down" size={22} color={COLORS.text} />
            </TouchableOpacity>

            <Text style={styles(COLORS).headerTitle} allowFontScaling={false}>Comments</Text>

            <View style={{ flexDirection: "row", alignItems: "center" }}>
              {/* 50% / 80% toggle */}
              <TouchableOpacity onPress={toggleSize} style={{ padding: 6, marginRight: 4 }}>
                <Ionicons
                  // fallback icons if expand/contract are unavailable
                  name={isMax ? ("contract-outline" as any) : ("expand-outline" as any)}
                  size={20}
                  color={COLORS.text}
                />
              </TouchableOpacity>

              <TouchableOpacity onPress={onClose} style={{ padding: 6 }}>
                <Ionicons name="close" size={22} color={COLORS.text} />
              </TouchableOpacity>
            </View>
          </View>

          <Text style={styles(COLORS).headerCount} allowFontScaling={false}>Total Comments: {totalFromApi}</Text>

          {/* List */}
          <FlatList
            data={threaded}
            extraData={comments}   
            keyExtractor={(n) => String(n.ID)}
            renderItem={renderRoot}
            ListFooterComponent={<View style={{ height: Math.max(88, insets.bottom + 40) }} />}
            keyboardShouldPersistTaps="always"
            contentContainerStyle={{ paddingBottom: 4 }}
          />

          {/* Composer */}
          <AvoidSoftInputView>
            {replyTo ? (
              <View style={styles(COLORS).replyChip}>
                <Text style={styles(COLORS).replyChipTxt} numberOfLines={1} allowFontScaling={false}>
                  Replying to {replyTo.author}
                </Text>
                <TouchableOpacity onPress={() => setReplyTo(null)}>
                  <Ionicons name="close" size={14} color={COLORS.sub} />
                </TouchableOpacity>
              </View>
            ) : null}

            {editingId ? (
              <View style={styles(COLORS).replyChip}>
                <Text style={styles(COLORS).replyChipTxt} allowFontScaling={false}>Editing comment</Text>
                <TouchableOpacity onPress={cancelEdit}>
                  <Ionicons name="close" size={14} color={COLORS.sub} />
                </TouchableOpacity>
              </View>
            ) : null}

            <View style={[styles(COLORS).composerWrap, { paddingBottom: 10}]}>
              <View style={styles(COLORS).inputRow}>
                <TextInput
                  ref={inputRef}
                  value={draft}
                  onChangeText={onChangeDraft}
                  placeholder="Add a comment..."
                  placeholderTextColor={COLORS.sub}
                  style={styles(COLORS).input}
                  multiline
                  numberOfLines={1}
                  returnKeyType="default"
                  blurOnSubmit={false}
                  onSubmitEditing={() => {}}
                  editable={!isSending}
                  allowFontScaling={false}
                  textAlignVertical={Platform.OS === "android" ? "center" : "auto"}
                  // Optionally expand to 80% on focus:
                  // onFocus={() => { if (!isMax) snapTo(true); }}
                />

                <TouchableOpacity
                  onPress={handleSend}
                  disabled={isSending || !draft.trim()}
                  style={styles(COLORS).sendBtn}
                >
                  {isSending ? (
                    <ActivityIndicator size="small" />
                  ) : (
                    <Ionicons name="send" size={18} color={draft.trim() ? COLORS.text : COLORS.sub} />
                  )}
                </TouchableOpacity>
              </View>

              {mentionOpen && (
                <View style={styles(COLORS).mentionBox}>
                  {mentionLoading ? (
                    <Text style={styles(COLORS).mentionHint} allowFontScaling={false}>Searching…</Text>
                  ) : mentionList.length === 0 ? (
                    <Text style={styles(COLORS).mentionHint} allowFontScaling={false}>
                      {mentionQuery ? `No users for “${mentionQuery}”` : "Type after @ to search"}
                    </Text>
                  ) : (
                    <FlatList
                      keyboardShouldPersistTaps="always"
                      data={mentionList}
                      keyExtractor={(u) => u.id}
                      renderItem={({ item }) => (
                        <TouchableOpacity style={styles(COLORS).mentionRow} onPress={() => insertMention(item)}>
                          <Avatar uri={item.avatar} name={item.username || item.name} size={22} border />
                          <View style={{ flex: 1 }}>
                            <Text style={styles(COLORS).mentionName} allowFontScaling={false}>{item.name}</Text>
                            <Text style={styles(COLORS).mentionUser} allowFontScaling={false}>@{item.username}</Text>
                          </View>
                        </TouchableOpacity>
                      )}
                      style={{ maxHeight: 200 }}
                    />
                  )}
                </View>
              )}
            </View>
          </AvoidSoftInputView>
        </SafeAreaView>
      </Animated.View>
    </Modal>
  );
}

/* -------------------------------- Styles -------------------------------- */
const styles = (COLORS: any) =>
  StyleSheet.create({
    modalRoot: { flex: 1, backgroundColor: COLORS.bg },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: COLORS.border,
      backgroundColor: COLORS.surface,
    },
    headerTitle: { color: COLORS.text, fontWeight: "700", fontSize: 16 },
    headerCount: { color: COLORS.sub, fontSize: 14, fontWeight: "700", marginLeft: 10 },

    // Comments
    commentLine: { color: COLORS.text, fontSize: 14, lineHeight: 18 },
    commentAuthor: { color: COLORS.text, fontWeight: "700" },
    commentText: { color: COLORS.text },

    childWrap: {
      flexDirection: "row",
      alignItems: "flex-start",
      borderLeftWidth: 1,
      borderLeftColor: COLORS.border,
      paddingLeft: 12,
    },

    // action text (Reply/Edit/Delete)
    chipBtn: { paddingVertical: 6, paddingHorizontal: 4, borderRadius: 6 },
   replyTxt: {
  color: "#7EA1FF",
  fontSize: 12,
  lineHeight: Platform.OS === "android" ? 18 : 16, // add a bit more vertical room on Android
  paddingBottom: Platform.OS === "android" ? 1.5 : 2,
  paddingTop: Platform.OS === "android" ? 1 : 0,
  includeFontPadding: true as any, // ✅ fixes MIUI clipping issue
  textAlignVertical: "center",
  ...(Platform.OS === "android" ? { fontFamily: "sans-serif" } : {}), // use default system font for stable metrics
},


    // Composer
    composerWrap: { paddingHorizontal: 10 },
    inputRow: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: "#0E1015",
      borderColor: COLORS.border,
      borderWidth: StyleSheet.hairlineWidth,
      borderRadius: 10,
      paddingRight: 4,
    },
    input: {
      flex: 1,
      minHeight: 48,
      color: COLORS.text,
      fontSize: 14,
      lineHeight: 18,
      paddingLeft: 12,
      paddingRight: 8,
      paddingVertical: Platform.OS === "android" ? 10 : 8,
      includeFontPadding: true as any,
    },
    sendBtn: { paddingHorizontal: 10, paddingVertical: 8, justifyContent: "center", alignItems: "center" },

    // Mentions popup
    mentionBox: {
      position: "absolute",
      left: 10,
      right: 10,
      bottom: 56,
      backgroundColor: "#0E1015",
      borderColor: COLORS.border,
      borderWidth: StyleSheet.hairlineWidth,
      borderRadius: 10,
      paddingVertical: 6,
      shadowColor: "#000",
      shadowOpacity: 0.2,
      shadowRadius: 6,
      elevation: 8,
    },
    mentionRow: {
      flexDirection: "row",
      alignItems: "center",
      columnGap: 10,
      paddingHorizontal: 10,
      paddingVertical: 10,
      borderRadius: 8,
    },
    replyChip: {
      flexDirection: "row",
      alignItems: "center",
      alignSelf: "flex-start",
      marginHorizontal: 12,
      marginBottom: 8,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 16,
      backgroundColor: "rgba(255,255,255,0.08)",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: "rgba(255,255,255,0.15)",
      maxWidth: "92%",
    },
    replyChipTxt: {
      color: "#E5E7EB",
      fontSize: 13,
      flexShrink: 1,
      marginRight: 6,
      includeFontPadding: false as any,
      textAlignVertical: "center",
    },

    mentionName: { color: COLORS.text, fontSize: 13, fontWeight: "700" },
    mentionUser: { color: COLORS.sub, fontSize: 12, marginTop: 2 },
    mentionHint: { color: COLORS.sub, fontSize: 12, padding: 10, textAlign: "center" },
  });
