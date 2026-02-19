// src/screens/PostDetailScreen.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  PermissionsAndroid,
  Platform,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { UIManager, findNodeHandle } from "react-native";

import Feather from 'react-native-vector-icons/Feather';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { sendnotify } from '../../utils/apiconfig';

import Video, { OnBufferData, OnLoadData } from 'react-native-video';
import ImageView from 'react-native-image-viewing';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import CameraRoll from '@react-native-camera-roll/camera-roll';
import RNFS from 'react-native-fs';
import RNFetchBlob from 'react-native-blob-util';
import { useHeaderHeight } from '@react-navigation/elements';
import { useNavigation } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import Avatar from '../../utils/Avatar';
import { BannerAd, BannerAdSize, TestIds } from "react-native-google-mobile-ads";
import { BANNER_AD_ID } from "../../ads/ids";
const bannerAdId = BANNER_AD_ID;
// ✅ NEW: reusable comments modal
import CommentsModal from '../../components/CommentsModal';
import { TText } from '../../i18n/TText';

// ✅ (Optional best practice) If you created shared helpers:
// import { updateCommentApi, deleteCommentApi } from '../../api/comments';

const WP_BASE = 'https://noctimago.com';
const PLACEHOLDER_URL =
  'https://upload.wikimedia.org/wikipedia/commons/thumb/b/bc/Unknown_person.jpg/1200px-Unknown_person.jpg';

type MediaItem = { type: 'image' | 'video'; uri: string };

type CommentItem = {
  ID: string;
  author: string;
  content: string;
  date: string;
  author_id?: number; // <-- server-provided if available
  author_profile_image?: string;
  parent_id?: string;
};
type TagPerson = {
  ID: number;
  user_firstname?: string;
  user_lastname?: string;
  nickname?: string;
  user_nicename?: string;
  display_name?: string;
  user_avatar?: string; // HTML <img ...>
};

const COLORS = {
  bg: "#0B0C0F",
  surface: "#101217",
  card: "#12141A",
  border: "#1E2128",
  text: "#E5E7EB",
  sub: "#9CA3AF",
  accent: "#E53935",
  icon: "#C0C3CC",
  pillBg: "#0E1015",
  pillBorder: "#2A2E37",
  danger: '#E02424',
};

const { width: SCREEN_W } = Dimensions.get('window');
const hit = { top: 10, bottom: 10, left: 10, right: 10 };

/* ---- Mention: user search + resolve helpers ---- */
type UserLite = {
  id: string;
  username: string;
  name: string;
  avatar?: string;
  allowTag: boolean;
};
type ApiComment = {
  ID: string;
  content: string;
  date: string;
  parent_id: string;            // "0" for top-level
  author: string;
  user_id?: string;
  author_profile_image?: string;

  
};

function toUiComment(c: ApiComment & any): CommentItem & { is_liked?: boolean; like_count?: number } {
  return {
    ID: c.ID,
    author: c.author,
    content: c.content,
    date: c.date,
    author_id: c.user_id ? Number(c.user_id) : undefined,
    author_profile_image: c.author_profile_image,
    parent_id: c.parent_id ?? "0",
    is_liked: c.is_liked,
    like_count: c.like_count,
  } as any;
}

// ✅ Works for both top-level and reply comments
async function fetchPostComments(postId: string | number, token?: string): Promise<{ total: number; comments: ApiComment[] }> {
  const url = `https://noctimago.com/wp-json/app/v1/post_comments/${postId}`;
  const res = await fetch(`https://noctimago.com/wp-json/app/v1/post_comments/${postId}?ts=${Date.now()}`, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
    },
  });  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`comments HTTP ${res.status}: ${txt || "failed"}`);
  }
  const js = await res.json();

  const arr = Array.isArray(js?.comments) ? js.comments : [];
 // HomeScreen.tsx -> fetchPostComments() mapping
const toBool = (v: any) => {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    return s === "true" || s === "1" || s === "yes";
  }
  return false;
};

const normalized: ApiComment[] = arr.map((c: any) => ({
  ID: String(c.ID),
  content: String(c.content ?? ""),
  date: String(c.date ?? ""),
  parent_id: String(c.parent_id ?? "0"),

  author: String(c.author?.name ?? ""),
  user_id: c.author?.id ? String(c.author.id) : undefined,
  author_profile_image: c.author?.profile_image || undefined,

  is_liked: toBool(c.is_liked),                // ← robust
  like_count: Number(c.like_count ?? 0),
}));


  const total = Number(js?.total_comments ?? normalized.length) || normalized.length;
  return { total, comments: normalized };
}
async function likeCommentApi(commentId: string, token?: string) {
  const url = `${WP_BASE}/wp-json/app/v1/like_comment/${commentId}`;
  const res = await fetch(url, { method: "POST", headers: token ? { Authorization: `Bearer ${token}` } : undefined });
  const text = await res.text();
  console.log("[likeCommentApi]", { url, status: res.status, ok: res.ok, body: text?.slice(0, 400) });
  let json: any = null; try { json = JSON.parse(text); } catch {}
  if (!res.ok) {
    const err: any = new Error(json?.message || text || `HTTP ${res.status}`);
    err.status = res.status; err.body = text;
    throw err;
  }
  return json ?? { ok: true };
}

async function unlikeCommentApi(commentId: string, token?: string) {
  const url = `${WP_BASE}/wp-json/app/v1/unlike_comment/${commentId}`;
  const res = await fetch(url, { method: "POST", headers: token ? { Authorization: `Bearer ${token}` } : undefined });
  const text = await res.text();
  console.log("[unlikeCommentApi]", { url, status: res.status, ok: res.ok, body: text?.slice(0, 400) });
  let json: any = null; try { json = JSON.parse(text); } catch {}
  if (!res.ok) {
    const err: any = new Error(json?.message || text || `HTTP ${res.status}`);
    err.status = res.status; err.body = text;
    throw err;
  }
  return json ?? { ok: true };
}

async function fetchUsersPage(page: number, token?: string) {
  const url = `${WP_BASE}/wp-json/app/v1/users?page=${page}`;
  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function mapUsersPayload(json: any): UserLite[] {
  const arr = Array.isArray(json?.users) ? json.users : Array.isArray(json) ? json : [];
  return arr
    .map((u: any) => ({
      id: String(u.ID ?? ""),
      username: String(u.user_login ?? "").trim(),
      name: String(u.display_name ?? u.user_login ?? "").trim(),
      avatar: u.profile_image || "",
      allowTag: !!u.allow_tag,
    }))
    .filter((u) => u.id && u.username);
}

/** Search by keyword after "@" */
async function searchUsersApi(query: string, token?: string, meId?: string): Promise<UserLite[]> {
  const q = (query || "").trim().toLowerCase();
  if (!q) return [];
  // Try server-side search first
  try {
    const url = `${WP_BASE}/wp-json/app/v1/users?page=1&search=${encodeURIComponent(q)}`;
    const res = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (res.ok) {
      const js = await res.json();
      let list = mapUsersPayload(js).filter(
        (u) =>
          u.allowTag &&
          (!meId || u.id !== String(meId)) &&
          (u.username.toLowerCase().includes(q) || u.name.toLowerCase().includes(q))
      );
      return list.slice(0, 20);
    }
  } catch {}
  // Fallback: first 2 pages + client filter
  try {
    let all: UserLite[] = [];
    for (const p of [1, 2]) {
      const js = await fetchUsersPage(p, token);
      all = all.concat(mapUsersPayload(js));
    }
    const f = all.filter(
      (u) =>
        u.allowTag &&
        (!meId || u.id !== String(meId)) &&
        (u.username.toLowerCase().includes(q) || u.name.toLowerCase().includes(q))
    );
    return f.slice(0, 20);
  } catch {
    return [];
  }
}

/** Notify the post author when someone likes or shares */
async function notifyPostAuthor({
  post,
  action,              // 'like' | 'share'
  token,
  senderProfile,
}: {
  post: any;
  action: 'like' | 'share';
  token?: string;
  senderProfile?: any;
}) {
  try {
    const authorId = String(post?.author_id ?? post?.authorId ?? '');
    const senderId = String(senderProfile?.ID ?? '');
    if (!authorId || !token) return;
    if (authorId === senderId) return; // don’t notify self

    const isLike  = action === 'like';
    const title   = isLike ? 'New like'  : 'Post shared';
    const message = isLike
      ? `${senderProfile?.username || 'Someone'} liked your post`
      : `${senderProfile?.username || 'Someone'} shared your post`;

    // choose a code your backend understands (example: 3=like, 4=share)
    const code = isLike ? 3 : 4;

    const payload = JSON.stringify({
      UserToken: '',
      message,
      msgtitle: title,
      User_PkeyID: senderProfile?.ID,  // sender
      UserID: authorId,                 // receiver
      NTN_C_L: 1,
      NTN_Sender_Name: senderProfile?.meta?.first_name || senderProfile?.username,
      NTN_Sender_Img: senderProfile?.meta?.profile_image || senderProfile?.user_image_url,
      NTN_Reciever_Name: '',
      NTN_Reciever_Img: '',
      NTN_UP_PkeyID: Number(post?.ID ?? post?.id), // post id
      NTN_UP_Path: '',
    });

    if (senderProfile?.ID !== authorId) {
      await sendnotify(payload, token);
    }
  } catch {
    // swallow; don't block UX
  }
}

/** Notify a tagged user */
async function notifyTaggedUser({
  receiverUserId,
  postId,
  token,
  senderProfile,
}: {
  receiverUserId: string;
  postId: string | number;
  token?: string;
  senderProfile?: any;
}) {
  try {
    const payload = JSON.stringify({
      UserToken: "",
      message: `${senderProfile?.username || "Someone"} mentioned you in a comment`,
      msgtitle: "You were mentioned",
      User_PkeyID: senderProfile?.ID,
      UserID: receiverUserId,
      NTN_C_L: 1,
      NTN_Sender_Name: senderProfile?.meta?.first_name || senderProfile?.username,
      NTN_Sender_Img: senderProfile?.meta?.profile_image || senderProfile?.user_image_url,
      NTN_Reciever_Name: "",
      NTN_Reciever_Img: "",
      NTN_UP_PkeyID: Number(postId),
      NTN_UP_Path: "",
    });
    if (senderProfile?.ID !== receiverUserId) {
      await sendnotify(payload, token);
    }
  } catch {}
}

/** Resolve a user id by @username, used for clickable mentions */
const usernameIdCache: Record<string, string> = {};
async function resolveUserIdByUsername(username: string, token?: string): Promise<string | null> {
  const key = username.toLowerCase();
  if (usernameIdCache[key]) return usernameIdCache[key];
  try {
    const url = `${WP_BASE}/wp-json/app/v1/users?page=1&search=${encodeURIComponent(username)}`;
    const res = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (!res.ok) return null;
    const json = await res.json();
    const list = mapUsersPayload(json);
    const exact = list.find((u) => u.allowTag && u.username.toLowerCase() === key);
    const found = exact || list.find((u) => u.allowTag);
    if (found?.id) {
      usernameIdCache[key] = found.id;
      return found.id;
    }
  } catch {}
  return null;
}

/* ----------------------------- tiny utils ----------------------------- */
function formatCount(n: number) {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return (n / 1000).toFixed(n % 1000 ? 1 : 0).replace(/\.0$/, '') + 'K';
  return (n / 1_000_000).toFixed(n % 1_000_000 ? 1 : 0).replace(/\.0$/, '') + 'M';
}
function normalizeLikedUsers(val: any): number[] {
  if (Array.isArray(val)) return val.map((x) => Number(x)).filter(Number.isFinite);
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) return parsed.map((x) => Number(x)).filter(Number.isFinite);
    } catch {}
    return val
      .split(',')
      .map((s) => Number(String(s).trim()))
      .filter(Number.isFinite);
  }
  return [];
}
function fmt(s?: string) {
  return s ? new Date(s.replace(' ', 'T')).toLocaleString() : '';
}
// ---- NEW: share post helper ----
async function sharePostApi(postId: string, token?: string) {
  const res = await fetch(`${WP_BASE}/wp-json/app/v1/share-post`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ post_id: Number(postId) }),
  });
  let json: any = {};
  try { json = await res.json(); } catch {}
  if (!res.ok) {
    const msg = json?.message || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return json;
}

/* ----------------------------- API helpers ----------------------------- */
async function likePostApi(postId: string, token?: string) {
  await fetch(`${WP_BASE}/wp-json/app/v1/like_post/${postId}`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
}
async function unlikePostApi(postId: string, token?: string) {
  await fetch(`${WP_BASE}/wp-json/app/v1/unlike_post/${postId}`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
}

// Create comment (fixed: always send post id in comment_post_id; set parent if provided)
async function commentPostApi(
  postId: string,
  text: string,
  token?: string,
  meId?: string | number,
  parentId?: string | number
) {
  console.log("posttttttid:", postId);
  console.log("text:", text);
  console.log("meId:", meId);
  console.log("parentId:", parentId);

  const url = `https://noctimago.com/wp-json/app/v1/create_comment/${postId}`;

  let body: any;

  if (parentId) {
    body = {
      comment_post_id: Number(parentId),
      comment: text,
      user_id: meId ? Number(meId) : undefined,
    };
  } else {
    body = {
      comment: text,
      // user_id: meId ? Number(meId) : undefined,
    };
  }

  console.log("body sent to API:", body);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });

  const responseText = await res.text(); // read raw response
  console.log("Raw API Response:", responseText); // 👈 log the full response

  if (!res.ok) {
    throw new Error(`create_comment HTTP ${res.status}: ${responseText || "failed"}`);
  }

  // Try to parse JSON safely
  let json;
  try {
    json = JSON.parse(responseText);
  } catch (err) {
    console.error("Failed to parse JSON:", err);
    json = {};
  }

  console.log("Parsed API Response:", json); // 👈 log the parsed JSON
  return json;
}

// Update & delete helpers (kept local; you can move to ../../api/comments and import)
async function updateCommentApi(commentId: string, text: string, token?: string) {
  const res = await fetch(`${WP_BASE}/wp-json/app/v1/edit_comment/${commentId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ comment: text }),
  });
  if (!res.ok) {
    let msg = 'HTTP ' + res.status;
    try { const j = await res.json(); msg = j?.message || msg; } catch {}
    throw new Error(msg);
  }
  return res.json().catch(() => ({}));
}
async function deleteCommentApi(commentId: string, token?: string) {
  const res = await fetch(`${WP_BASE}/wp-json/app/v1/delete_comment/${commentId}`, {
    method: 'DELETE',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!res.ok) {
    let msg = 'HTTP ' + res.status;
    try { const j = await res.json(); msg = j?.message || msg; } catch {}
    throw new Error(msg);
  }
  return res.json().catch(() => ({}));
}

/* ---------------- Thread UI (for in-page preview) ---------------- */
function Thread(props: any) {
  const {
    list, childrenMap, level, currentUserId,
    onEditComment, onDeleteComment, busyCommentId,
    onReply, token, navigation,
    repliesLimit, onExpandReplies, onCollapseReplies,
  } = props;

  return (
    <>
      {list.map((c: CommentItem) => {
        const mine = c.author_id != null && currentUserId != null && Number(c.author_id) === Number(currentUserId)
        const kids = childrenMap[c.ID] || [];
        const limit = Math.max(1, Number(repliesLimit?.[c.ID] ?? 1) || 1);
        const shownKids = kids.slice(0, limit);

        return (
          <View key={c.ID} style={{ marginTop: level ? 10 : 0 }}>
            {level > 0 && <View style={[styles.threadGuide, { marginLeft: level * 18 - 10 }]} />}

            <CommentRow
              c={c} mine={mine}
              onEditComment={onEditComment}
              onDeleteComment={onDeleteComment}
              busyCommentId={busyCommentId}
              onReply={onReply}
              token={token}
              navigation={navigation}
            />

            {shownKids.length > 0 && (
              <View style={{ marginLeft: 18 }}>
                <Thread {...props} list={shownKids} level={level + 1} />
              </View>
            )}

            {/* {kids.length > 0 && (
              <TouchableOpacity
                onPress={() =>
                  limit >= kids.length
                    ? onCollapseReplies?.(c.ID)
                    : onExpandReplies?.(c.ID, kids.length)
                }
                style={{ marginLeft: 18, paddingVertical: 4 }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              > */}
                {/* <Text style={styles.viewReplies}>
                  {limit >= kids.length
                    ? 'Hide replies'
                    : `View ${kids.length - limit} more replies`}
                </Text> */}
              {/* </TouchableOpacity>
            )} */}
          </View>
        );
      })}
    </>
  );
}
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
function CommentRow({
  c,
  mine,
  onEditComment,
  onDeleteComment,
  onReply,
  busyCommentId,
  token,
  navigation,
}: any) {
  return (
    <View style={styles.cRowWrap}>
      <TouchableOpacity
        onPress={() => navigation.navigate('ViewProfileScreen', { NTN_User_PkeyID: c?.author_id })}
        activeOpacity={0.9}
      >
        <Avatar uri={normalizeAvatarUri(c?.author_profile_image) } name={c.author} size={20} border />
      </TouchableOpacity>

      <View style={styles.cRight}>
        <View style={[styles.cBubble, mine && styles.cBubbleMine]}>
          <Text style={styles.cHeader}>
            <Text style={styles.cAuthor} onPress={() => navigation.navigate('ViewProfileScreen', { NTN_User_PkeyID: c?.author_id })}>
              {c.author}
            </Text>
            <Text style={styles.cDot}> · </Text>
            <Text style={styles.cTime}>{fmt(c.date)}</Text>
          </Text>

          <RenderMentionsClickable
            text={normalizeEmoji(String(c.content || ""))}
            onPressUsername={async (uname) => {
              const uid = await resolveUserIdByUsername(uname, token);
              if (uid) navigation.navigate('ViewProfileScreen', { NTN_User_PkeyID: uid });
              else Alert.alert('Profile not found', `Couldn't open @${uname}'s profile.`);
            }}
            mentionStyle={styles.mentionChip}
            normalStyle={styles.cText}
          />
        </View>

        {/* <View style={styles.cActions}>
          // {/* <TouchableOpacity onPress={() => onReply(c)} hitSlop={hit}><Text style={styles.cAct}>Reply</Text></TouchableOpacity> */}
          {/* // {mine && ( */}
          {/* //   <>
          //     <Text style={styles.cSep}>•</Text>
          //     <TouchableOpacity onPress={() => onEditComment(c)} hitSlop={hit}><Text style={styles.cAct}>Edit</Text></TouchableOpacity>
          //     <Text style={styles.cSep}>•</Text>
          //     <TouchableOpacity onPress={() => onDeleteComment(c)} hitSlop={hit} disabled={busyCommentId===c.ID}>
          //       <Text style={[styles.cActDel, busyCommentId===c.ID && {opacity:0.6}]}>Delete</Text>
          //     </TouchableOpacity>
          //   </> */}
          {/* // )} */}
        {/* </View>  */}
      </View>
    </View>
  );
}

/* ----------------------------- Meta (no composer here) ----------------------------- */
/* ----------------------------- Meta (no composer here) ----------------------------- */
const MetaBlock = React.memo(function MetaBlock({
  post,
  visibleCount,
  setVisibleCount,
  liked,
  likeCount,
  onToggleLike,
  sendingLike,
  currentUserId,
  onEditComment,
  onDeleteComment,
  busyCommentId,
  onReply,
  rootComments = [],
  childrenMap = {},
  totalComments = 0,
  repliesLimit,
  onExpandReplies,
  onCollapseReplies,
  onOpenAllComments,              // 👈 NEW
}: {
  post: any;
  visibleCount: number;
  setVisibleCount: (n: number) => void;
  liked: boolean;
  likeCount: number;
  onToggleLike: () => void;
  sendingLike: boolean;
  currentUserId?: number;
  onEditComment: (c: CommentItem) => void;
  onDeleteComment: (c: CommentItem) => void;
  busyCommentId?: string | null;
  onReply: (c: CommentItem) => void;
  totalComments?: number;
  rootComments?: CommentItem[];
  childrenMap?: Record<string, CommentItem[]>;
  repliesLimit?: Record<string, number>;
  onExpandReplies?: (parentId: string, to: number) => void;
  onCollapseReplies?: (parentId: string) => void;
  onOpenAllComments: () => void;   // 👈 NEW
}) {
  const token = useSelector((state: any) => state.authReducer.token);
  const authorName = post?.author ?? 'Unknown';
  const when = fmt(post?.date) || '';
  // const caption = (post?.event_description && String(post.event_description)) || ' ';
  const commentCount = totalComments;
  const navigation = useNavigation<any>();
  const tagPeople: TagPerson[] = Array.isArray(post?.fields?.tag_people)
  ? post.fields.tag_people
  : [];
  // ✅ Get caption from fields.event_description and decode emojis/entities
const rawCaption =
(post?.fields?.event_description && String(post.fields.event_description)) ||
(post?.event_description && String(post.event_description)) ||
'';

const decodedCaption = normalizeEmoji(rawCaption); // uses your helper below

// ✅ "See more" handling based on length
const [captionExpanded, setCaptionExpanded] = useState(false);
const CAPTION_CHAR_LIMIT = 160;

const hasLongCaption = decodedCaption.length > CAPTION_CHAR_LIMIT;
const captionToShow =
captionExpanded || !hasLongCaption
  ? decodedCaption
  : decodedCaption.slice(0, CAPTION_CHAR_LIMIT) + '…';

const renderCaption = (text: string) => (
<TText style={styles.captionTxt}>
  {text.split(/\s+/).map((w, i) =>
    w.startsWith('#') ? (
      <Text key={i} style={styles.linkWord}>{w + ' '}</Text>
    ) : (
      w + ' '
    )
  )}
</TText>
);



console.log("post?.event_description",post?.event_description)
  // Show just a tiny preview on the post:
  const PREVIEW_ROOTS = 2;      // 👈 change to 3 if you want 3 roots
  const PREVIEW_CHILDREN = 1;   // replies per root in preview

  const previewRepliesLimit = useMemo(() => {
    const map: Record<string, number> = {};
    rootComments.slice(0, PREVIEW_ROOTS).forEach(rc => { map[rc.ID] = PREVIEW_CHILDREN; });
    return map;
  }, [rootComments]);


  const [composerFocused, setComposerFocused] = useState(false);
  return (
    <View style={styles.detailsWrap}>
      {/* Actions row (likes/comments count) */}
      <View style={styles.actionsRow}>
        <View style={styles.actionLeft}>
          <TouchableOpacity onPress={onToggleLike} disabled={sendingLike} style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name={liked ? 'heart' : 'heart-outline'} size={22} color={liked ? COLORS.danger : COLORS.icon} />
            <Text style={styles.actionNum}>{formatCount(likeCount)}</Text>
          </TouchableOpacity>

          <TouchableOpacity
  style={{ flexDirection: "row", alignItems: "center", marginLeft: 18 }}
  onPress={onOpenAllComments} 
>
  <Feather name="message-circle" size={20} color={COLORS.icon} />
  <Text style={styles.actionNum}>{formatCount(commentCount)}</Text>
</TouchableOpacity>

        </View>
      </View>

      {/* {!!post?.fields?.location && (
        <View style={{ top: 10, marginBottom:10, marginRight:10, borderRadius: 13, alignItems: 'center', flexDirection: 'row' }}>
          <Feather name="map-pin" size={12} color="#fff" />
          <Text style={{color: '#fff', fontSize: 14,marginLeft:10}}>
            {post.fields.location}
          </Text>
        </View>
      )} */}

      {/* Author */}
    

      {!!decodedCaption.trim() && (
  <View style={{ marginTop: 6 }}>
    {renderCaption(captionToShow)}

    {hasLongCaption && (
      <TouchableOpacity
        onPress={() => setCaptionExpanded((x) => !x)}
        style={{ marginTop: 4 }}
        hitSlop={hit}
      >
        <TText style={styles.linkWord}>
          {captionExpanded ? 'See less' : 'See more'}
        </TText>
      </TouchableOpacity>
    )}
  </View>
)}

      {tagPeople.length > 0 && (
  <View style={styles.tagRow}>
    <TouchableOpacity style={{flexDirection:'row',justifyContent:'center',alignItems:'center'}} disabled>
    <Feather name="tag" size={12} color={COLORS.sub} />
    <TText style={{color:COLORS.sub,fontSize:12}}>Tagged:</TText>
    </TouchableOpacity>
   

    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingLeft: 4 }}
    >
      {tagPeople.map((u) => {
        // Choose best display name
        const label =
          u.user_nicename ||
          u.nickname ||
          u.display_name ||
          `User ${u.ID}`;

        return (
          <TouchableOpacity
            key={u.ID}
            style={styles.tagChip}
            activeOpacity={0.8}
            onPress={() =>
              navigation.navigate('ViewProfileScreen', { NTN_User_PkeyID: u.ID })
            }
          >
            <Text style={styles.tagChipTxt}>@{label}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  </View>
)}

      {/* 🔹 Tiny preview: 2 roots (or 3 if you change PREVIEW_ROOTS) and 1 reply each */}
      <View style={{ marginTop: 14, gap: 12 }}>
        <Thread
          list={rootComments.slice(0, PREVIEW_ROOTS)}
          childrenMap={childrenMap}
          level={0}
          currentUserId={currentUserId}
          onEditComment={onEditComment}
          onDeleteComment={onDeleteComment}
          busyCommentId={busyCommentId}
          onReply={onReply}
          token={token}
          navigation={navigation}
          repliesLimit={previewRepliesLimit}
          onExpandReplies={() => {}}
          onCollapseReplies={() => {}}
        />

        {totalComments === 0 && (
          <TText style={{ color: COLORS.sub }}>Be the first to comment.</TText>
        )}

        {totalComments > PREVIEW_ROOTS && (
          <TouchableOpacity onPress={onOpenAllComments} style={{ marginTop: 6 }}>
            <TText style={styles.linkWord}>View all {totalComments} comments</TText>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
});


/* ----------------------------- Fixed bottom composer (in-page) ----------------------------- */
function CommentBar({
  value,
  onChangeText,
  onSend,
  disabled,
  onFocus,
  onBlur,
  sendLabel = 'Send',
}: {
  value: string;
  onChangeText: (t: string) => void;
  onSend: () => void;
  disabled?: boolean;
  onFocus?: () => void;
  onBlur?: () => void;
  sendLabel?: string;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        paddingHorizontal: 14,
        paddingBottom: 40,
        backgroundColor: COLORS.bg,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: COLORS.border,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center',marginTop:10 }}>
        <TextInput
          style={styles.commentInput}
          placeholder="Add a comment..."
          placeholderTextColor={COLORS.sub}
          value={value}
          onChangeText={onChangeText}
          returnKeyType="send"
          blurOnSubmit={false}
          onSubmitEditing={onSend}
          onFocus={onFocus}
          onBlur={onBlur}
        />
        <TouchableOpacity
          onPress={onSend}
          disabled={disabled || !value.trim()}
          style={[styles.sendBtn, (disabled || !value.trim()) && { opacity: 0.5 }]}
        >
          <Text style={styles.sendTxt}>{sendLabel}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export const encodeToHtmlEntities = (s: string) =>
  Array.from(s).map(ch => {
    const cp = ch.codePointAt(0)!;
    return cp > 0x7F ? `&#x${cp.toString(16).toUpperCase()};` : ch;
  }).join("");
const decodeCurlyUnicode = (s: string) =>
  s.replace(/u\{([0-9a-fA-F]+)\}/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)));
const decodeHtmlEntities = (s: string) =>
  s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)));
const COLON_EMOJI: Record<string, string> = {};
const decodeColonShortcodes = (s: string) =>
  s.replace(/:[a-z0-9_+\-]+:/gi, m => COLON_EMOJI[m.toLowerCase()] ?? m);
export const normalizeEmoji = (s?: string) =>
  decodeColonShortcodes(decodeHtmlEntities(decodeCurlyUnicode(String(s ?? ""))));

function RenderMentionsClickable({
  text,
  onPressUsername,
  mentionStyle,
  normalStyle,
}: {
  text: string;
  onPressUsername: (username: string) => void;
  mentionStyle: any;
  normalStyle: any;
}) {
  const parts = String(text || "").split(/(\B@[a-zA-Z0-9._-]+)/g);
  return (
    <Text>
      {parts.map((part, idx) => {
        const m = part.match(/^\B@([a-zA-Z0-9._-]+)$/);
        if (m) {
          const username = m[1];
          return (
            <Text
              key={idx}
              style={mentionStyle}
              suppressHighlighting
              onPress={() => onPressUsername(username)}
            >
              @{username}
            </Text>
          );
        }
        return (
          <TText key={idx} style={normalStyle}>
            {part}
          </TText>
        );
      })}
    </Text>
  );
}

/* ----------------------------- Screen ----------------------------- */
export default function PostDetailScreen({ route, navigation }: any) {
  const insets = useSafeAreaInsets();
  const postId = String(route?.params?.postId ?? '');
  const headerHeight = useHeaderHeight();
  const token: string | undefined = route?.params?.token;

  // replies expand/collapse per parent
  const [repliesLimit, setRepliesLimit] = useState<Record<string, number>>({});
  const onExpandReplies = useCallback((parentId: string, to: number) => {
    setRepliesLimit(prev => ({ ...prev, [parentId]: Math.max(2, to) }));
  }, []);
  const onCollapseReplies = useCallback((parentId: string) => {
    setRepliesLimit(prev => ({ ...prev, [parentId]: 2 }));
  }, []);

  const currentUserId: number | undefined = route?.params?.userId;
  const currentUserName: string | undefined = route?.params?.userName;
  const userprofile = useSelector((state: any) => state.authReducer.userprofile);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [post, setPost] = useState<any>(null);

  // likes/comments state
  const [liked, setLiked] = useState<boolean>(false);
  const [likeCount, setLikeCount] = useState<number>(0);

  const [sendingLike, setSendingLike] = useState(false);

  // composer + modal
  const [commentText, setCommentText] = useState('');
  const [sendingComment, setSendingComment] = useState(false);
  const [composerFocused, setComposerFocused] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false); // <-- controls CommentsModal
  const [replyTarget, setReplyTarget] = useState<CommentItem | null>(null);

  // EDIT/DELETE (for in-page thread list)
  const [editingTarget, setEditingTarget] = useState<CommentItem | null>(null);
  const [busyCommentId, setBusyCommentId] = useState<string | null>(null);
  const [likeBusyId, setLikeBusyId] = useState<string | null>(null);

 


  const [commentLikeBusy, setCommentLikeBusy] = useState<Set<string>>(new Set());

  const toggleCommentLike = useCallback(
    async (commentId: string) => {
      if (!token) {
        Alert.alert("Sign in required", "You need to log in to like comments.");
        return false;
      }
      if (likeBusyId) return false; // avoid double taps globally
      setLikeBusyId(commentId);
  
      // find comment BEFORE optimistic flip for notification
      const target = commentsFlat.find(
        (c) => String(c.ID) === String(commentId)
      );
  
      // optimistic UI toggle
      setCommentsFlat((prev) =>
        prev.map((c) => {
          if (String(c.ID) !== String(commentId)) return c as any;
          const was = !!(c as any).is_liked;
          const cnt = Number((c as any).like_count ?? 0);
          return {
            ...c,
            is_liked: !was,
            like_count: was ? Math.max(0, cnt - 1) : cnt + 1,
          } as any;
        })
      );
  
      try {
        const wasLikedBefore = !!(
          commentsFlat.find((c) => String(c.ID) === String(commentId)) as any
        )?.is_liked;
  
        const shouldUnlike = wasLikedBefore;
  
        if (shouldUnlike) {
          // user is unliking
          await unlikeCommentApi(commentId, token);
        } else {
          // user is liking now
          await likeCommentApi(commentId, token);
  
          // 🔔 send notification to comment author
          if (target) {
            await notifyCommentAuthorLike({
              comment: target,
              postId,
              token,
              senderProfile: userprofile,
            });
          }
        }
  
        // sync from server (keeps modal + preview in sync)
        // await loadComments();
        return true;
      } catch (err: any) {
        // rollback UI
        setCommentsFlat((prev) =>
          prev.map((c) => {
            if (String(c.ID) !== String(commentId)) return c as any;
            const now = !!(c as any).is_liked;
            const cnt = Number((c as any).like_count ?? 0);
            return {
              ...c,
              is_liked: !now,
              like_count: now ? Math.max(0, cnt - 1) : cnt + 1,
            } as any;
          })
        );
        Alert.alert(
          "Oops",
          err?.message || "Could not update like on comment. Please try again."
        );
        return false;
      } finally {
        setLikeBusyId(null);
      }
    },
    [token, commentsFlat, loadComments, likeBusyId, postId, userprofile]
  );
  
  
  
  
  
  // comments data
  type ThreadIndex = {
    roots: CommentItem[];
    childrenMap: Record<string, CommentItem[]>;
  };
  function buildThreadIndex(items: CommentItem[]): ThreadIndex {
    const childrenMap: Record<string, CommentItem[]> = {};
    const roots: CommentItem[] = [];
    for (const c of items) {
      const pid = c.parent_id || "0";
      if (!childrenMap[pid]) childrenMap[pid] = [];
      childrenMap[pid].push(c);
    }
    (childrenMap["0"] || []).forEach((c) => roots.push(c));
    for (const key of Object.keys(childrenMap)) {
      childrenMap[key].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }
    return { roots, childrenMap };
  }
  const [loadingComments, setLoadingComments] = useState(false);
  const [totalComments, setTotalComments] = useState(0);
  const [commentsFlat, setCommentsFlat] = useState<CommentItem[]>([]);
  const { roots: rootComments, childrenMap } = useMemo(
    () => buildThreadIndex(commentsFlat),
    [commentsFlat]
  );

  const loadComments = useCallback(async () => {
    if (!postId) return;
    try {
      setLoadingComments(true);
      const { total, comments } = await fetchPostComments(postId, token);
      const ui = comments.map(toUiComment);
      ui.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      setCommentsFlat(ui);
      setTotalComments(total || ui.length);
    } catch (e) {
      console.log("Failed to fetch comments", e);
    } finally {
      setLoadingComments(false);
    }
  }, [postId, token]);

  useEffect(() => { loadComments(); }, [loadComments]);

  const meIdStr = userprofile?.ID ? String(userprofile.ID) : (currentUserId ? String(currentUserId) : undefined);

  // mention-aware search for modal will be passed via prop (using searchUsersApi above)

  // Activity gating
  const [hasShared, setHasShared] = useState(false);
  const [hasCommented, setHasCommented] = useState(false);
  const [isTagged, setIsTagged] = useState(false);
  const [unlockVisible, setUnlockVisible] = useState(false);
  const ACTIVITY_THRESHOLD = 3;

  // detect tagged
  useEffect(() => {
    const list: TagPerson[] = Array.isArray(post?.fields?.tag_people)
      ? post.fields.tag_people
      : [];
  
    if (!list.length) {
      setIsTagged(false);
      return;
    }
  
    const meIdNum = Number(currentUserId ?? userprofile?.ID ?? NaN);
    const myNameLower = currentUserName?.trim().toLowerCase();
  
    const taggedById = Number.isFinite(meIdNum)
      ? list.some(p => Number(p.ID) === meIdNum)
      : false;
  
    const taggedByName = myNameLower
      ? list.some(p =>
          (p.user_nicename || p.nickname || p.display_name || '')
            .trim()
            .toLowerCase() === myNameLower
        )
      : false;
  
    setIsTagged(taggedById || taggedByName);
  }, [post, currentUserId, currentUserName, userprofile?.ID]);
  

  // detect user commented
  useEffect(() => {
    if (!currentUserName && !userprofile?.ID) return;
    const anyMine = commentsFlat.some(
      (c) => (userprofile?.ID != null && c.author_id === Number(userprofile.ID)) ||
             (currentUserName && String(c.author || '').trim().toLowerCase() === currentUserName.trim().toLowerCase())
    );
    if (anyMine) setHasCommented(true);
  }, [commentsFlat, currentUserName, userprofile?.ID]);

  const activitiesCount = useMemo(() => {
    let count = 0;
    if (liked) count += 1;
    if (hasCommented) count += 1;
    if (isTagged) count += 1;
    if (hasShared) count += 1;
    return count;
  }, [liked, hasCommented, isTagged, hasShared]);

  const isOwner = useMemo(() => {
    const uid = Number((currentUserId ?? userprofile?.ID) ?? NaN);
    const pid = Number((post?.author_id ?? post?.authorId) ?? NaN);
    return Number.isFinite(uid) && Number.isFinite(pid) && uid === pid;
  }, [currentUserId, userprofile?.ID, post]);
  const canDownload = isOwner || activitiesCount >= ACTIVITY_THRESHOLD;

  // keyboard scroll
  useEffect(() => {
    const eventName = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const sub = Keyboard.addListener(eventName, () => {
      if (composerFocused) {
        setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 60);
      }
    });
    return () => sub.remove();
  }, [composerFocused]);

  // fetch post
  const sanitizeCsv = (csv: any): string[] =>
    typeof csv === 'string' ? csv.split(',').map((s) => s.trim()).filter(Boolean) : [];
  const fetchPost = useCallback(async () => {
    if (!postId) return;
  
    console.log("postid", postId);
    setLoading(true);
    setErr(null);
  
    try {
      const res = await fetch(`https://noctimago.com/wp-json/app/v1/get_post/${postId}`, {
        headers: {
          // same as Postman: Bearer token only (plus Accept for safety)
          Accept: "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
  
      const raw = await res.text();
      console.log("[get_post] status:", res.status);
      console.log("[get_post] body:", raw);
  
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
  
      const data = JSON.parse(raw);
      const p = data?.post ?? null;
      setPost(p);
  
      // --- keep your like / share logic, but using the fresh `p` ---
      const rawLikes = Number(p?.fields?._likes ?? 0);
      setLikeCount(Number.isFinite(rawLikes) ? rawLikes : 0);
  
      const uid = currentUserId != null ? Number(currentUserId) : undefined;
      const list = normalizeLikedUsers(p?._liked_users);
      const isLiked = p?.liked_by_user === true || (uid != null && list.includes(uid));
      setLiked(isLiked);
  
      const serverIsShared =
        p?.is_shared === true || p?.is_shared === 1 || p?.is_shared === "1";
      setHasShared(!!serverIsShared);
    } catch (e) {
      console.log("fetchPost error:", e);
      setErr("Could not load the post.");
    } finally {
      setLoading(false);
    }
  }, [postId, token, currentUserId]);
  
  useEffect(() => {
    fetchPost();
  }, [fetchPost]);
  
  useEffect(() => { fetchPost(); }, [fetchPost]);
// replace sanitizeCsv with this:
// Normalise any field (CSV string / JSON string / array) into a string[]
const toArray = (val: any): string[] => {
  if (!val) return [];
  if (Array.isArray(val)) return val.map(String);
  const s = String(val).trim();
  if (!s) return [];
  if (s.startsWith('[') && s.endsWith(']')) {
    try {
      const parsed = JSON.parse(s);
      if (Array.isArray(parsed)) return parsed.map((x: any) => String(x ?? ''));
    } catch {}
  }
  return s.split(',').map((x) => String(x ?? ''));
};

const isImageUrl = (u: string) => {
  const url = u.split('?')[0].toLowerCase().trim();
  if (!url || !/^https?:\/\//.test(url)) return false;
  return /\.(png|jpe?g|webp|gif|bmp|heic|heif)$/.test(url);
};

// 🔧 UPDATED: be forgiving for your S3 URLs
const isVideoUrl = (u: string) => {
  const url = u.split('?')[0].toLowerCase().trim();
  if (!url || !/^https?:\/\//.test(url)) return false;

  // normal video extensions
  if (/\.(mp4|mov|m4v|webm|mkv|3gp)$/.test(url)) return true;

  // special-case: your bucket — if it's *not* an image, treat as video
  if (
    url.includes('noctimago.s3.amazonaws.com/noctimago/') &&
    !isImageUrl(u)
  ) {
    return true;
  }

  return false;
};

const media: MediaItem[] = useMemo(() => {
  const f = post?.fields || {};

  const rawUrls = [
    ...toArray(f.images),
    ...toArray(f.video),
    ...toArray(f.videos),
    ...toArray(f.video_urls),
    ...toArray(f.video_url),
  ];

  const images: string[] = [];
  const videos: string[] = [];

  for (const raw of rawUrls) {
    const u = String(raw || '').trim();
    if (!u) continue;

    if (isVideoUrl(u)) {
      videos.push(u);        // ✅ no Set, keep duplicates
    } else if (isImageUrl(u)) {
      images.push(u);        // ✅ keep duplicates
    }
  }

  const items: MediaItem[] = [
    ...images.map((uri) => ({ type: 'image' as const, uri })),
    ...videos.map((uri) => ({ type: 'video' as const, uri })),
  ];

  console.log('[media]', items);
  return items.length ? items : [{ type: 'image', uri: PLACEHOLDER_URL }];
}, [post]);




const imageSources = useMemo(
  () => media.filter((m) => m.type === 'image').map((m) => ({ uri: m.uri })),
  [media]
);


  const openViewerAt = (uri: string) => {
    const idx = imageSources.findIndex((it) => it.uri === uri);
    setViewerIndex(idx >= 0 ? idx : 0);
    setViewerVisible(true);
  };

  // scroll/media state
  const [index, setIndex] = useState(0);
  const [playingIdx, setPlayingIdx] = useState<number>(-1);
  const [buffering, setBuffering] = useState<boolean>(false);
  const listRef = useRef<ScrollView>(null);
  const scroller = useRef<ScrollView>(null);

  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const currentViewerUri = imageSources[viewerIndex]?.uri;

  const onScrollH = (e: any) => {
    const x = e.nativeEvent.contentOffset.x;
    const idx = Math.round(x / SCREEN_W);
    if (idx !== index) {
      setIndex(idx);
      if (playingIdx !== -1 && playingIdx !== idx) setPlayingIdx(-1);
    }
  };

  const onShare = useCallback(async () => {
    try {
      const title = post?.title || 'Post';
      const permalink = post?.permalink || `${WP_BASE}/?p=${postId}`;
      const current = media?.[index];
      const mediaUrl = current?.uri;

      const lines = [
        title,
        post?.fields?.event && `Event: ${post.fields.event}`,
        post?.fields?.location && `Location: ${post.fields.location}`,
        permalink && `Link: ${permalink}`,
        mediaUrl && `Media: ${mediaUrl}`,
      ].filter(Boolean) as string[];

      const message = lines.join('\n');

      const payload =
        Platform.select({
          ios: { title, message, url: mediaUrl || permalink },
          android: { title, message },
          default: { title, message },
        }) || { title, message };

      await Share.share(payload, { dialogTitle: 'Share post' });

      setHasShared(true);

      if (token) {
        try {
          await sharePostApi(postId, token);
          await notifyPostAuthor({
            post,
            action: 'share',
            token,
            senderProfile: userprofile,
          });
        } catch (e) {
          console.log('sharePostApi failed:', e);
        }
      }
    } catch {
      Alert.alert('Share failed', 'Unable to share this post.');
    }
  }, [post, media, index, postId, token]);
  const [viewerMenuOpen, setViewerMenuOpen] = useState(false);

  const confirmAndReport = useCallback(() => {
    const uri = currentViewerUri;
    if (!uri) return;
    if (!token) {
      Alert.alert('Sign in required', 'You need to log in to report images.');
      return;
    }
    if (reportedByMe[uri]) return;

    Alert.alert('Report image', 'Are you sure you want to report this image?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Report',
        style: 'destructive',
        onPress: async () => {
          setReportingUri(uri);
          setReportedByMe((prev) => ({ ...prev, [uri]: true }));
          setReportedReason((prev) => ({ ...prev, [uri]: '' }));
          try {
            const resp = await reportImageApi(postId, uri, '', token);
            setReportedReason((prev) => ({ ...prev, [uri]: resp?.reason || '' }));
          } catch {
            setReportedByMe((prev) => ({ ...prev, [uri]: false }));
            setReportedReason((prev) => ({ ...prev, [uri]: undefined }));
            Alert.alert('Error', 'Could not report this image. Please try again.');
          } finally {
            setReportingUri(null);
          }
        },
      },
    ]);
  }, [currentViewerUri, token, postId]);

  const onToggleLike = async () => {
    if (!postId || sendingLike) return;
    if (!token) {
      Alert.alert('Sign in required', 'You need to log in to like posts.');
      return;
    }
    setSendingLike(true);
    const prevLiked = liked;
    const prevCount = likeCount;
    setLiked(!prevLiked);
    setLikeCount(prevLiked ? Math.max(0, prevCount - 1) : prevCount + 1);
    try {
      if (prevLiked) await unlikePostApi(postId, token);
      else await likePostApi(postId, token);
      await notifyPostAuthor({
        post,
        action: 'like',
        token,
        senderProfile: userprofile,
      });
    } catch {
      setLiked(prevLiked);
      setLikeCount(prevCount);
      Alert.alert('Error', 'Could not update like. Please try again.');
    } finally {
      setSendingLike(false);
    }
  };

  const requestLegacyWriteIfNeeded = async () => {
    if (Platform.OS !== 'android') return true;
    if (Platform.Version <= 28) {
      const r = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE
      );
      return r === PermissionsAndroid.RESULTS.GRANTED;
    }
    return true;
  };

  const [reportedByMe, setReportedByMe] = useState<Record<string, boolean>>({});
  const [reportedReason, setReportedReason] = useState<Record<string, string | undefined>>({});
  const [reportingUri, setReportingUri] = useState<string | null>(null);
  const [savingUri, setSavingUri] = useState<string | null>(null);

  const saveImage = useCallback(async (uri: string) => {
    try {
      if (!uri || savingUri) return;

      setSavingUri(uri);
      const encoded = uri.startsWith('http') ? encodeURI(uri) : uri;

      if (Platform.OS === 'android') {
        const ok = await requestLegacyWriteIfNeeded();
        if (!ok) {
          Alert.alert('Permission required', 'Storage permission is needed to save images.');
          return;
        }

        const { fs } = RNFetchBlob;
        const folder = `${fs.dirs.PictureDir}/Noctimago`;
        await fs.mkdir(folder).catch(() => {});

        const name = `post_${postId}_${Date.now()}${
          (encoded.toLowerCase().includes('.png') && '.png') || '.jpg'
        }`;

        await RNFetchBlob.config({
          addAndroidDownloads: {
            useDownloadManager: true,
            notification: true,
            mediaScannable: true,
            title: name,
            description: 'Downloading image',
            mime: encoded.includes('.png') ? 'image/png' : 'image/jpeg',
            path: `${folder}/${name}`,
          },
        }).fetch('GET', encoded);

        Alert.alert('Saved', 'Image saved to your gallery');
        return;
      }

      if (!CameraRoll || typeof (CameraRoll as any).save !== 'function') {
        throw new Error('CameraRoll native module not linked. Run `npx pod-install` and rebuild.');
      }

      const ext = (() => {
        const raw = encoded.split('?')[0].split('.').pop() || 'jpg';
        return raw.length > 5 ? 'jpg' : raw.toLowerCase();
      })();
      const fname = `post_${postId}_${Date.now()}.${ext}`;

      const iosTmpBase = RNFS.TemporaryDirectoryPath.endsWith('/')
        ? RNFS.TemporaryDirectoryPath
        : `${RNFS.TemporaryDirectoryPath}/`;
      const toFile = `${iosTmpBase}${fname}`;

      const resp = await RNFS.downloadFile({ fromUrl: encoded, toFile }).promise;
      if ((resp.statusCode ?? 200) >= 400) throw new Error(`Download failed (${resp.statusCode})`);

      const localUri = toFile.startsWith('file://') ? toFile : `file://${toFile}`;
      await CameraRoll.save(localUri, { type: 'photo' });
      RNFS.unlink(toFile).catch(() => {});
      Alert.alert('Saved', 'Image saved to your Photos.');
    } catch (e: any) {
      console.log('saveImage error =>', e?.message ?? e);
      Alert.alert('Save failed', e?.message ? String(e.message) : 'Could not save the image.');
    } finally {
      setSavingUri(null);
    }
  }, [postId, savingUri]);

  const gatedSaveImage = useCallback(
    (uri: string) => {
      if (!uri) return;
      if (canDownload) {
        saveImage(uri);
      } else {
        setUnlockVisible(true);
      }
    },
    [canDownload, saveImage]
  );

  // In-page send (kept; it just opens modal on focus anyway)
  const handleSendComment = async () => {
    if (!commentText.trim()) return;
    // This path is rarely used now, since we open the modal. You could remove it if you want.
    setComposerOpen(true);
  };

  // Start edit/delete for in-page preview (open modal for editing UX)
  const startEditComment = (c: CommentItem) => {
    setEditingTarget(c);
    setComposerOpen(true);
    // The modal handles editing internally; we just open it.
  };

  const confirmDeleteComment = (c: CommentItem) => {
    if (!token) {
      Alert.alert('Sign in required', 'You need to log in to delete comments.');
      return;
    }
    Alert.alert('Delete comment', 'Are you sure you want to delete this comment?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            setBusyCommentId(c.ID);
            await deleteCommentApi(c.ID, token);
            await loadComments();
          } catch (e) {
            Alert.alert('Delete failed', 'Could not delete the comment.');
          } finally {
            setBusyCommentId(null);
          }
        },
      },
    ]);
  };

  // “Reply” from in-page thread -> open modal (the modal will show a reply chip)
  const startReply = async (c: CommentItem) => {
    setReplyTarget(c);
    setComposerOpen(true);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 60);
  };

  const Header = (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => navigation?.goBack?.()} hitSlop={hit}>
        <Feather name="chevron-left" size={24} color={COLORS.text} />
      </TouchableOpacity>

      <TText style={styles.headerTitle}>Post</TText>

      <TouchableOpacity onPress={onShare} hitSlop={hit}>
        <Ionicons name="share-social-outline" size={18} color={COLORS.text} />
      </TouchableOpacity>
    </View>
  );

  /* ----------------- Adapters for CommentsModal ----------------- */

  // Convert our UI list to the flat API shape the modal expects
  const commentsForModal = useMemo(() => {
    return (commentsFlat || []).map(c => ({
      ID: c.ID,
      content: c.content,
      date: c.date,
      parent_id: c.parent_id ?? "0",
      author: c.author,
      user_id: c.author_id != null ? String(c.author_id) : undefined,
      author_profile_image: c.author_profile_image,
      is_liked: !!c.is_liked,
      like_count: Number(c.like_count ?? 0),
    }));
  }, [commentsFlat]);

  const ensureCommentsLoaded = useCallback(() => loadComments(), [loadComments]);
/** Notify the author when someone likes their comment */
/** Notify the author when someone replies to their comment */
async function notifyCommentAuthorReply({
  comment,
  postId,
  token,
  senderProfile,
}: {
  comment: CommentItem | (ApiComment & any);
  postId: string;
  token?: string;
  senderProfile?: any;
}) {
  try {
    const receiverId =
      comment.author_id != null
        ? String((comment as any).author_id)
        : comment.user_id
        ? String((comment as any).user_id)
        : "";

    const senderId = senderProfile?.ID ? String(senderProfile.ID) : "";

    if (!receiverId || !token) return;
    if (receiverId === senderId) return; // don't notify self

    const payload = JSON.stringify({
      UserToken: "",
      message: `${senderProfile?.username || "Someone"} replied to your comment`,
      msgtitle: "New reply to your comment",
      User_PkeyID: senderProfile?.ID, // sender
      UserID: receiverId,             // receiver (comment author)
      NTN_C_L: 1,                     // same code you're using for other comment notifs
      NTN_Sender_Name:
        senderProfile?.meta?.first_name || senderProfile?.username,
      NTN_Sender_Img:
        senderProfile?.meta?.profile_image || senderProfile?.user_image_url,
      NTN_Reciever_Name: "",
      NTN_Reciever_Img: "",
      NTN_UP_PkeyID: Number(postId),  // post id
      NTN_UP_Path: "",
    });

    if (senderId !== receiverId) {
      await sendnotify(payload, token);
    }
  } catch (e) {
    console.log("notifyCommentAuthorReply error:", e);
  }
}

async function notifyCommentAuthorLike({
  comment,
  postId,
  token,
  senderProfile,
}: {
  comment: CommentItem | (ApiComment & any);
  postId: string;
  token?: string;
  senderProfile?: any;
}) {
  try {
    // Try both shapes (CommentItem uses author_id, API uses user_id)
    const receiverId =
      comment.author_id != null
        ? String((comment as any).author_id)
        : comment.user_id
        ? String((comment as any).user_id)
        : "";

    const senderId = senderProfile?.ID ? String(senderProfile.ID) : "";

    if (!receiverId || !token) return;
    if (receiverId === senderId) return; // don't notify self

    const payload = JSON.stringify({
      UserToken: "",
      message: `${senderProfile?.username || "Someone"} liked your comment`,
      msgtitle: "New like on your comment",
      User_PkeyID: senderProfile?.ID, // sender
      UserID: receiverId,              // receiver (comment author)
      NTN_C_L: 1,                      // 👈 pick a code your backend reserves for "comment like"
      NTN_Sender_Name:
        senderProfile?.meta?.first_name || senderProfile?.username,
      NTN_Sender_Img:
        senderProfile?.meta?.profile_image || senderProfile?.user_image_url,
      NTN_Reciever_Name: "",
      NTN_Reciever_Img: "",
      NTN_UP_PkeyID: Number(postId),   // post id
      NTN_UP_Path: "",
    });

    if (senderId !== receiverId) {
      await sendnotify(payload, token);
    }
  } catch (e) {
    console.log("notifyCommentAuthorLike error:", e);
  }
}

const onSendFromModal = useCallback(
  async ({
    text,
    tagged,
    parentId,
  }: {
    text: string;
    tagged: { id: string; username: string }[];
    parentId?: string;
  }) => {
    if (!token) {
      Alert.alert("Sign in required", "You need to log in to comment.");
      return false;
    }
    try {
      const safe = encodeToHtmlEntities(text);
      await commentPostApi(
        postId,
        safe,
        token,
        userprofile?.ID ?? currentUserId,
        parentId
      );

      // 🔔 If this is a reply, notify the parent comment author
      if (parentId) {
        const parent = commentsFlat.find(
          (c) => String(c.ID) === String(parentId)
        );
        if (parent) {
          await notifyCommentAuthorReply({
            comment: parent,
            postId,
            token,
            senderProfile: userprofile,
          });
        }
      }

      // 🔔 notify tagged users
      for (const tu of tagged) {
        await notifyTaggedUser({
          receiverUserId: tu.id,
          postId,
          token,
          senderProfile: userprofile,
        });
      }

      // 🔔 notify post author about a new comment/reply
      if (
        post?.author_id &&
        userprofile?.ID &&
        Number(post.author_id) !== Number(userprofile.ID)
      ) {
        try {
          const payload = JSON.stringify({
            UserToken: "",
            message: `${
              userprofile?.username || "Someone"
            } commented on your post`,
            msgtitle: "New comment",
            User_PkeyID: userprofile?.ID,
            UserID: post?.author_id,
            NTN_C_L: 1,
            NTN_Sender_Name:
              userprofile?.meta?.first_name || userprofile?.username,
            NTN_Sender_Img:
              userprofile?.meta?.profile_image || userprofile?.user_image_url,
            NTN_Reciever_Name: "",
            NTN_Reciever_Img: "",
            NTN_UP_PkeyID: Number(post?.ID ?? post?.id),
            NTN_UP_Path: "",
          });
          if (userprofile?.ID !== post?.author_id) {
            await sendnotify(payload, token);
          }
        } catch {}
      }

      await loadComments();
      setHasCommented(true);
      return true;
    } catch (e) {
      Alert.alert("Error", "Could not post comment. Please try again.");
      return false;
    }
  },
  [
    token,
    postId,
    userprofile,
    currentUserId,
    post,
    loadComments,
    commentsFlat,   // 👈 added so parent lookup stays fresh
  ]
);
const authorName = post?.author ?? 'Unknown';
const when = fmt(post?.date) || '';
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />
      {Header}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#fff" />
        </View>
      ) : err ? (
        <View style={styles.center}>
          <Text style={{ color: '#fff', marginBottom: 12 }}>{err}</Text>
          <TouchableOpacity style={styles.retry} onPress={fetchPost}>
            <Feather name="refresh-ccw" size={16} color="#fff" />
            <Text style={styles.retryTxt}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={headerHeight}
        >
          <ScrollView
            ref={listRef}
            style={{ flex: 1 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
              <TouchableOpacity style={styles.authorRow} onPress={() => navigation.navigate('ViewProfileScreen', { NTN_User_PkeyID:post?.author_id })}>
        <Avatar uri={normalizeAvatarUri(post?.author_profile_image) } name={authorName} size={30} border />
        <View style={{ marginLeft: 10, flex: 1 }}>
          <Text style={styles.authorName}>{authorName}</Text>
          {!!when && <Text style={styles.timeTxt}>{when}</Text>}
        </View>
      </TouchableOpacity>
            {/* Media area */}
            <View style={styles.carouselWrap}>
              <ScrollView
                ref={scroller}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onScroll={onScrollH}
                scrollEventThrottle={16}
              >
                {media.map((m, i) => {
                  const isCurrent = index === i;
                  const isPlaying = playingIdx === i;
                  return (
                    <View key={`${m.type}-${i}`} style={{ width: SCREEN_W }}>
                      {m.type === 'image' ? (
                        <TouchableOpacity
                          activeOpacity={0.95}
                          onPress={() => openViewerAt(m.uri)}
                          onLongPress={() => gatedSaveImage(m.uri)}
                          delayLongPress={300}
                        >
                          <Image source={{ uri: m.uri }} style={styles.media} resizeMode="cover" />
                        </TouchableOpacity>
                      ) : (
                        <View style={styles.media}>
                          <Video
                            source={{ uri: m.uri }}
                            style={StyleSheet.absoluteFillObject}
                            resizeMode="cover"
                            controls
                            paused={!isCurrent || !isPlaying}
                            onBuffer={(d: OnBufferData) => setBuffering(!!d.isBuffering)}
                            onError={() => {
                              Alert.alert('Video error', 'Unable to play this video.');
                              setPlayingIdx(-1);
                            }}
                            onLoad={(d: OnLoadData) => setBuffering(false)}
                            playInBackground={false}
                            playWhenInactive={false}
                            ignoreSilentSwitch="ignore"
                            poster={PLACEHOLDER_URL}
                            posterResizeMode="cover"
                          />

                          {isCurrent && isPlaying && buffering && (
                            <View style={styles.bufferOverlay}>
                              <ActivityIndicator size="large" color="#fff" />
                            </View>
                          )}

                          {(!isPlaying || !isCurrent) && (
                            <TouchableOpacity
                              style={styles.playBadge}
                              onPress={() => setPlayingIdx(i)}
                              activeOpacity={0.85}
                            >
                              <Feather name="play" size={20} color="#fff" />
                              <TText style={styles.playTxt}>Play</TText>
                            </TouchableOpacity>
                          )}
                        </View>
                      )}

                      {!canDownload &&  (
                        <View style={[styles.locChip, { top: 44 }]}>
                          <Feather name="lock" size={12} color="#fff" />
                          <TText style={styles.locTxt} numberOfLines={1}>
                            {activitiesCount}/{ACTIVITY_THRESHOLD} to unlock save
                          </TText>
                        </View>
                      )}
                    </View>
                  );
                })}
              </ScrollView>

              {/* Dots */}
              <View style={styles.dots}>
                {media.map((_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.dot,
                      i === index ? { opacity: 1, transform: [{ scale: 1.1 }] } : { opacity: 0.4 },
                    ]}
                  />
                ))}
              </View>
            </View>

            {/* Details + in-page comments preview */}
            <MetaBlock
  post={post}
  rootComments={rootComments}
  childrenMap={childrenMap}
  visibleCount={2}
  setVisibleCount={() => {}}
  liked={liked}
  likeCount={likeCount}
  onToggleLike={onToggleLike}
  sendingLike={sendingLike}
  currentUserId={Number(userprofile?.ID) || currentUserId}
  onEditComment={startEditComment}
  onDeleteComment={confirmDeleteComment}
  busyCommentId={busyCommentId}
  onReply={startReply}
  totalComments={totalComments}
  repliesLimit={repliesLimit}
  onExpandReplies={onExpandReplies}
  onCollapseReplies={onCollapseReplies}
  onOpenAllComments={() => setComposerOpen(true)}   // 👈 NEW
/>


            {/* Inline “replying to …” (optional, you can remove this since modal shows a chip too) */}
            {replyTarget && (
              <View style={{ flexDirection:'row', alignItems:'center', marginHorizontal:14, marginTop:8, marginBottom:6 }}>
                <TText style={{ color: COLORS.sub, marginRight:8 }}>
                  Replying to <Text style={{ color: COLORS.text, fontWeight:'700' }}>{replyTarget.author}</Text>
                </TText>
                <TouchableOpacity onPress={() => setReplyTarget(null)} hitSlop={hit}>
                  <Feather name="x" size={16} color={COLORS.sub} />
                </TouchableOpacity>
              </View>
            )}

            {/* Inline bar opens modal on focus */}
            {!composerOpen && (
              <CommentBar
                value={commentText}
                onChangeText={setCommentText}
                onSend={handleSendComment}
                disabled={sendingComment}
                onFocus={() => {
                  setComposerFocused(true);
                  setComposerOpen(true);
                  setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 60);
                }}
                onBlur={() => setComposerFocused(false)}
              />
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      )}

      {/* Unlock Free Download modal */}
      <Modal
        visible={unlockVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setUnlockVisible(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.5)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <View
            style={{
              width: '86%',
              borderRadius: 16,
              padding: 16,
              backgroundColor: COLORS.card,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: COLORS.border,
            }}
          >
            <TText style={{ color: COLORS.text, fontSize: 16, fontWeight: '700' }}>
              Unlock free downloads
            </TText>

            <TText style={{ color: COLORS.sub, marginTop: 8 }}>
              Complete any {ACTIVITY_THRESHOLD} activities to save photos for free:
              {'\n'}• Like the post
              {'\n'}• Add a comment
              {'\n'}• Be tagged in the post
              {'\n'}• Share the post
            </TText>

            <View style={{ marginTop: 14, backgroundColor: '#11121a', borderRadius: 999, overflow: 'hidden' }}>
              <View style={{ height: 10, width: '100%' }}>
                <View
                  style={{
                    height: '100%',
                    width: `${Math.min(100, (activitiesCount / ACTIVITY_THRESHOLD) * 100)}%`,
                    backgroundColor: COLORS.accent,
                  }}
                />
              </View>
            </View>
            <TText style={{ color: COLORS.text, marginTop: 6, fontWeight: '600' }}>
              {activitiesCount}/{ACTIVITY_THRESHOLD} completed
            </TText>

            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 16 }}>
              <TouchableOpacity
                onPress={() => setUnlockVisible(false)}
                style={{ paddingHorizontal: 14, paddingVertical: 10 }}
              >
                <TText style={{ color: COLORS.sub, fontWeight: '600' }}>Maybe later</TText>
              </TouchableOpacity>

              {!liked && (
                <TouchableOpacity
                  onPress={() => {
                    setUnlockVisible(false);
                    onToggleLike();
                  }}
                  style={[styles.sendBtn, { marginLeft: 8 }]}
                >
                  <TText style={styles.sendTxt}>Like now</TText>
                </TouchableOpacity>
              )}
              {liked && !hasCommented && (
                <TouchableOpacity
                  onPress={() => {
                    setUnlockVisible(false);
                    setComposerOpen(true);
                    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 60);
                  }}
                  style={[styles.sendBtn, { marginLeft: 8 }]}
                >
                  <TText style={styles.sendTxt}>Comment</TText>
                </TouchableOpacity>
              )}
              {liked && hasCommented && !hasShared && (
                <TouchableOpacity
                  onPress={() => {
                    setUnlockVisible(false);
                    onShare();
                  }}
                  style={[styles.sendBtn, { marginLeft: 8 }]}
                >
                  <TText style={styles.sendTxt}>Share</TText>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* Fullscreen viewer with report/save */}
      {imageSources.length > 0 && (
        <ImageView
          images={imageSources}
          imageIndex={viewerIndex}
          visible={viewerVisible}
          onRequestClose={() => setViewerVisible(false)}
          swipeToCloseEnabled
          doubleTapToZoomEnabled
          onImageIndexChange={(i) => setViewerIndex(i)}
          HeaderComponent={() => {
            const uri = imageSources[viewerIndex]?.uri;
          
            return (
              <View
                style={[
                  styles.viewerHeader,
                  {
                    paddingTop: insets.top + 8,
                    paddingLeft: insets.left + 12,
                    paddingRight: insets.right + 12,
                  },
                ]}
              >
                {/* LEFT: Save button same as before */}
                <TouchableOpacity
                  onPress={() => uri && gatedSaveImage(uri)}
                  disabled={!uri || !!savingUri}
                  activeOpacity={0.85}
                  hitSlop={hit}
                  style={[
                    styles.reportBtn,
                    { backgroundColor: COLORS.primary, opacity: savingUri ? 0.6 : 1 },
                  ]}
                >
                  <Feather name="download" size={16} color="#fff" />
                  <TText style={styles.reportTxt}>Save</TText>
                </TouchableOpacity>
          
                {/* RIGHT: menu + close */}
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  {/* 3-dot menu button */}
                  <TouchableOpacity
                    onPress={() => setViewerMenuOpen((v) => !v)}
                    hitSlop={hit}
                    style={{
                      backgroundColor: "rgba(0,0,0,0.45)",
                      paddingHorizontal: 10,
                      paddingVertical: 8,
                      borderRadius: 18,
                    }}
                  >
                    <Feather name="more-vertical" size={18} color="#fff" />
                  </TouchableOpacity>
          
                  {/* Close button */}
                  <TouchableOpacity
                    onPress={() => setViewerVisible(false)}
                    hitSlop={hit}
                    style={styles.closeBtn}
                  >
                    <Feather name="x" size={18} color="#fff" />
                  </TouchableOpacity>
                </View>
          
                {/* MENU OVERLAY */}
                {viewerMenuOpen && (
                  <>
                    {/* backdrop – tap to close */}
                    <TouchableOpacity
                      style={styles.menuBackdrop}
                      onPress={() => setViewerMenuOpen(false)}
                      activeOpacity={1}
                    />
          
                    {/* actual menu */}
                    <View
                      style={[
                        styles.menu,
                        {
                          top: insets.top + 50,
                          right: insets.right + 12,
                        },
                      ]}
                    >
                      <TouchableOpacity
                        style={styles.menuItem}
                        onPress={() => {
                          setViewerMenuOpen(false);
                          onShare(); // 🔹 share post
                        }}
                      >
                        <Feather name="share-2" size={18} color="#fff" />
                        <Text style={styles.menuText}>Share</Text>
                      </TouchableOpacity>
          
                      <TouchableOpacity
                        style={styles.menuItem}
                        onPress={() => {
                          setViewerMenuOpen(false);
                          confirmAndReport(); // 🔹 yahi se image report hogi (reportImageApi use karega)
                        }}
                      >
                        <Feather name="flag" size={18} color="#ff4d4d" />
                        <Text style={[styles.menuText, { color: "#ff4d4d" }]}>
                          Report image
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </View>
            );
          }}
          
          FooterComponent={({ imageIndex }) => (
            <View style={[styles.viewerFooter, { marginBottom: insets.bottom + 12 }]}>
              <TText style={styles.viewerFooterTxt}>
                {imageIndex + 1} / {imageSources.length}
              </TText>
            </View>
          )}
        />
      )}

      {/* ✅ Reusable Comments Modal (replaces the old inline Modal) */}
      <CommentsModal
  open={composerOpen}
  onClose={() => {
    Keyboard.dismiss();
    setComposerOpen(false);
    setEditingTarget(null);
    setCommentText("");
    setReplyTarget(null);
  }}
  postId={postId}
  totalFromApi={totalComments}
  comments={commentsForModal}
  loading={loadingComments}
  ensureLoaded={ensureCommentsLoaded}
  onSend={onSendFromModal}
  searchUsersApi={(q) => searchUsersApi(q, token, meIdStr)}
  onPressProfile={(uid?: string) => {
    if (uid) navigation.navigate("ViewProfileScreen", { NTN_User_PkeyID: uid });
  }}
  COLORS={COLORS}
  meId={String(userprofile?.ID ?? currentUserId ?? "")}
  token={token}
  onToggleCommentLike={(commentId: string) => toggleCommentLike(commentId)}
  isCommentLikeBusy={(commentId: string) => likeBusyId === commentId} // ✅ busy hook for hearts
/>

    </SafeAreaView>
  );
}

/* ----------------------------- styles ----------------------------- */
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  menuBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  menu: {
    position: "absolute",
    backgroundColor: "rgba(0,0,0,0.9)",
    borderRadius: 12,
    paddingVertical: 6,
    minWidth: 170,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  menuText: {
    color: "#fff",
    marginLeft: 8,
    fontSize: 14,
    fontWeight: "500",
  },

  header: {
    paddingHorizontal: 12,
    paddingTop: 16,
    paddingBottom: 10,
    borderBottomColor: COLORS.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: { color: COLORS.text, fontSize: 16, fontWeight: '700' },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  /* media */
  carouselWrap: { width: '100%', height: SCREEN_W, backgroundColor: COLORS.card },
  media: { width: '100%', height: '100%' },

  locChip: {
    position: 'absolute',
    left: 10,
    top: 10,
    backgroundColor: COLORS.chip,
    paddingHorizontal: 10,
    height: 20,
    borderRadius: 13,
    alignItems: 'center',
    flexDirection: 'row',
  },
  locTxt: { color: '#fff', fontSize: 12, maxWidth: SCREEN_W * 0.6 },

  dots: {
    position: 'absolute',
    bottom: 10,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },

  bufferOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  playBadge: {
    position: 'absolute',
    width: 88,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(0,0,0,0.55)',
    bottom: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  playTxt: { color: '#fff', fontSize: 12.5, fontWeight: '700' },

  /* details */
  detailsWrap: {
    paddingHorizontal: 14,
    paddingTop: 10,
    backgroundColor: COLORS.bg,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
    marginBottom: 8,
  },
  actionLeft: { flexDirection: 'row', alignItems: 'center' },
  actionNum: { color: COLORS.text, marginLeft: 6, fontWeight: '600' },

  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    paddingVertical: 8,
    marginLeft:5
  },
  avatar: { width: 36, height: 36,  backgroundColor: COLORS.card },
  authorName: { color: COLORS.text, fontWeight: '700', textDecorationLine: 'underline' },
  timeTxt: { color: COLORS.sub, fontSize: 12, marginTop: 2 },
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    // marginBottom: 4,
  },
  tagLabel: {
    // paddingHorizontal: 10,
    // paddingVertical: 4,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.pillBorder || COLORS.border,
    backgroundColor: COLORS.pillBg || '#0E1015',
    marginRight: 6,
    color:COLORS.text
    
    
  },
  tagChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.pillBorder || COLORS.border,
    backgroundColor: COLORS.pillBg || '#0E1015',
    marginRight: 6,
  },
  tagChipTxt: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '600',
  },

  captionTxt: { color: COLORS.text, lineHeight: 20 },
  linkWord: { color: COLORS.accent, fontWeight: '700' },

  cRowWrap: { flexDirection:'row', alignItems:'flex-start', paddingVertical: 6 },
  cAvatar2: { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.card, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  cRight: { flex: 1, marginLeft: 10 },

  cBubble: {
    backgroundColor: '#121320',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  cBubbleMine: {
    backgroundColor: '#171933',
    borderColor: 'rgba(126,161,255,0.35)',
  },

  cHeader: { marginBottom: 4 },
  cAuthor: { color: COLORS.text, fontWeight: '700' },
  cDot: { color: COLORS.sub },
  cTime: { color: COLORS.sub, fontSize: 12 },
  cText: { color: COLORS.text, lineHeight: 20, fontSize: 14.5 },

  cActions: { flexDirection:'row', alignItems:'center', gap: 10, marginTop: 6, marginLeft: 6 },
  cAct: { color: COLORS.accent, fontWeight: '700' },
  cActDel: { color: COLORS.danger, fontWeight: '700' },
  cSep: { color: COLORS.sub },

  mentionChip: {
    color: COLORS.text,
    fontWeight: '700',
    backgroundColor: 'rgba(126,161,255,0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },

  threadGuide: {
    position: 'absolute',
    left: 8,
    top: 18,
    bottom: 0,
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },

  viewReplies: { color: COLORS.accent, fontWeight: '700', paddingHorizontal: 6 },

  commentInput: {
    flex: 1,
    height: 42,
    borderRadius: 10,
    backgroundColor:"black",
    paddingHorizontal: 12,
    color: COLORS.text,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
  },
  sendBtn: {
    height: 42,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendTxt: { color: '#fff', fontWeight: '700' },

  retry: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: COLORS.primary,
    borderRadius: 10,
  },
  retryTxt: { color: '#fff', fontWeight: '700' },

  viewerHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  reportBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.danger,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  reportBtnDisabled: { opacity: 0.6 },
  reportTxt: { color: '#fff', fontWeight: '700', fontSize: 13, marginLeft: 8 },
  closeBtn: { backgroundColor: 'rgba(0,0,0,0.45)', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 18 },

  viewerFooter: {
    position: 'absolute',
    bottom: 24,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  viewerFooterTxt: { color: '#fff', fontWeight: '700' },
});

// report image helper
async function reportImageApi(postId: string, imageUrl: string, reason: string, token?: string) {
  const res = await fetch(`${WP_BASE}/wp-json/app/v1/report_image`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ post_id: Number(postId), image_url: imageUrl, reason }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.message || `HTTP ${res.status}`);
  return json;
}
