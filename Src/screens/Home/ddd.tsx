// src/screens/Home/HomeScreen.tsx
import React, { useEffect, useMemo, useRef, useState,useCallback } from "react";
import { useIsFocused, useFocusEffect, useNavigation } from "@react-navigation/native";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  StatusBar,
  LayoutChangeEvent,
  Animated,
  Alert,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  PermissionsAndroid,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Share,
  ActivityIndicator,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { UIManager, findNodeHandle } from "react-native";
import { AvoidSoftInput, AvoidSoftInputView } from "react-native-avoid-softinput";
import {
  getallpost,
  profile,
  getFcmToken,
  requestUserPermission,
  un_friend,
  add_friend,
  sendnotify,
  getnotify,
} from "../../utils/apiconfig";
import { UserProfile } from "../../store/action/auth/action";
import { useSelector, useDispatch } from "react-redux";
import { TText } from "../../i18n/TText";
import DateTimePickerModal from "react-native-modal-datetime-picker";
import { SafeAreaView } from "react-native-safe-area-context";
import Geolocation from "react-native-geolocation-service";
import Video from "react-native-video";
import type { ViewToken } from "react-native";
import Avatar from "../../utils/Avatar";
import mobileAds from 'react-native-google-mobile-ads';
import { BannerAd, BannerAdSize, TestIds } from 'react-native-google-mobile-ads';
/* ----------------------------- UI consts ----------------------------- */
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
};

const AVATAR_PLACEHOLDER =
  "https://upload.wikimedia.org/wikipedia/commons/thumb/b/bc/Unknown_person.jpg/1200px-Unknown_person.jpg";

const FILTERS = [
  { key: "all", label: "All", icon: "ellipsis-horizontal" },
  { key: "location", label: "By Location", icon: "navigate-outline" },
  { key: "date", label: "By Date/Event", icon: "calendar" },
  { key: "video", label: "Video Only", icon: "videocam-outline" },
] as const;

/* -------------------- API Types & Card Model -------------------- */

type ApiComment = {
  ID: string | number;
  content: string;
  date: string;
  isPending?: boolean

  // the new API gives this:
  parent_id?: string | number;

  // normalized author fields (from { author: { id, name, profile_image } })
  author?: string;                    // display name ("priya")
  user_id?: string | number;          // "2628"
  author_profile_image?: string;      // avatar url
};

type ApiPost = {
  ID: number | string;
  title: string;
  author: string;
  author_id?: string | number;
  author_profile_image?: string;
  date: string;
  fields: {
    event?: string;
    tag_people?: string;
    location?: string;
    images?: string; // CSV
    video?: string;
    custom_post_type?: string;
    _likes?: number | string;
    _liked_users?: number[] | string;
    are_friends?: boolean;
    is_following?: boolean | "true" | "false" | "1" | "0" | string;
    is_saved?: boolean | "true" | "false" | "1" | "0" | string;
    is_followed?: boolean | "true" | "false" | "1" | "0" | string;
    reposted_by_users?: { ID?: string | number } | false;
    repost_count?: number | string;
    isPending: true,

  };
  is_reposted_by_user?: boolean | "true" | "false" | 1 | 0;
  repost_count?: number | string;
  are_friends?: boolean;
  is_following?: boolean | "true" | "false" | "1" | "0" | string;
  liked_by_user?: boolean | "true" | "false" | "1" | "0" | string;
  is_saved?: boolean | "true" | "false" | "1" | "0" | string;
  comments?: ApiComment[];
  
};

type PostCardModel = {
  id: string;
  author: string;
  authorId?: string;
  areFriends?: boolean;
  following?: boolean;
  avatar: string;
  title: string;
  timeAgo: string;
  image: string;      // first image (fallback/poster)
  images: string[];   // ALL images for the carousel
  likes: number;
  comments: number;
  commentsList: ApiComment[];
  hasVideo: boolean;
  videoUrl?: string;
  imagesCount: number;
  event?: string;
  location?: string;
  rawDate?: string;
  liked?: boolean;
  saved?: boolean;
  tags?: string[]; 
  repostCount: number;
  isRepostedByMe: boolean;
   isRepostCard: boolean;           // show the "X reposted" banner
  repostedById?: string;
  repostedByName?: string;
  repostedByAvatar?: string;       // optional, if you want to show their avatar
  repostedAt?: string;     
};

/* --------------------------- Helpers ---------------------------- */
const getParentId = (c: ApiComment): string | null => {
  const s = String(c.parent_id ?? "").trim().toLowerCase();
  return !s || s === "0" || s === "null" || s === "undefined" || s === "nan" ? null : s;
};




const norm = (s?: string) =>
  (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

function parseCsvImages(csv?: string): string[] {
  if (!csv || typeof csv !== "string") return [];
  return csv
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Parse "YYYY-MM-DD HH:mm:ss" coming from server as UTC */
function parseSqlAsUTC(sql?: string): Date | null {
  if (!sql) return null;
  const hasTZ = /[zZ]|[+-]\d{2}:?\d{2}$/.test(sql);
  if (hasTZ) return new Date(sql.replace(" ", "T"));
  const m = sql.match(
    /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/
  );
  if (!m) return null;
  const [, y, mo, d, h, mi, s] = m;
  return new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +(s || 0)));
}

function toTimeAgo(sql?: string): string {
  const dt = parseSqlAsUTC(sql);
  if (!dt) return "0m";
  const diffMs = Date.now() - dt.getTime();
  const minutes = Math.max(0, Math.floor(diffMs / 60000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

function dateOnly(sql?: string) {
  const dt = parseSqlAsUTC(sql);
  if (!dt) return null;
  return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
}

function abbreviate(n: number) {
  if (n < 1000) return String(n);
  if (n < 10000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "K";
  if (n < 1_000_000) return Math.round(n / 1000) + "K";
  return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
}

const parseLikes = (v: unknown): number => {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = parseInt(v, 10);
    return isNaN(n) ? 0 : n;
  }
  return 0;
};

const parseDate = (s: string) => {
  const t = s.replace(/\//g, "-");
  const d = new Date(t);
  return isNaN(d.getTime())
    ? null
    : new Date(d.getFullYear(), d.getMonth(), d.getDate());
};

type QueryTokens = {
  title: string[];
  event: string[];
  location: string[];
  text: string[];
  on?: Date | null;
  before?: Date | null;
  after?: Date | null;
};

const parseQuery = (q: string): QueryTokens => {
  const tokens = q.split(/\s+/).filter(Boolean);
  const out: QueryTokens = { title: [], event: [], location: [], text: [] };
  tokens.forEach((tok) => {
    const [k, ...rest] = tok.split(":");
    const v = rest.join(":");
    switch (k.toLowerCase()) {
      case "title":
        out.title.push(norm(v));
        break;
      case "event":
        out.event.push(norm(v));
        break;
      case "location":
        out.location.push(norm(v));
        break;
      case "on":
        out.on = parseDate(v);
        break;
      case "before":
        out.before = parseDate(v);
        break;
      case "after":
        out.after = parseDate(v);
        break;
      default:
        out.text.push(norm(tok));
        break;
    }
  });
  return out;
};

const matchesTokens = (p: ApiPost, tokens: QueryTokens) => {
  const tTitle = norm(p.title);
  const tEvent = norm(p.fields?.event || "");
  const tLoc = norm(p.fields?.location || "");
  const d = dateOnly(p.date);

  const textOk = tokens.text.every((tok) => tEvent.includes(tok));
  const titleOk = tokens.title.every((tok) => tTitle.includes(tok));
  const eventOk = tokens.event.every((tok) => tEvent.includes(tok));
  const locOk = tokens.location.every((tok) => tLoc.includes(tok));

  const onOk = tokens.on ? d && d.getTime() === tokens.on.getTime() : true;
  const beforeOk = tokens.before ? d && d.getTime() < tokens.before.getTime() : true;
  const afterOk = tokens.after ? d && d.getTime() > tokens.after.getTime() : true;

  return textOk && titleOk && eventOk && locOk && onOk && beforeOk && afterOk;
};

function isTrueish(v: any): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    return s === "true" || s === "1";
  }
  if (typeof v === "number") return v === 1;
  return false;
}
function normalizeLikedUsers(val: any): string[] {
  if (Array.isArray(val)) return val.map((x) => String(x));
  if (typeof val === "string") {
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) return parsed.map((x) => String(x));
    } catch {}
    return val
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}
// cache to avoid refetching the same username repeatedly during a session
const usernameIdCache: Record<string, string> = {};

/** Look up a user id by @username. Returns user id string or null. */
async function resolveUserIdByUsername(
  username: string,
  token?: string
): Promise<string | null> {
  const key = username.toLowerCase();
  if (usernameIdCache[key]) return usernameIdCache[key];

  try {
    // try server-side search (page 1 is enough for exact lookups)
    const url = `https://noctimago.com/wp-json/app/v1/users?page=1&search=${encodeURIComponent(
      username
    )}`;
    const res = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (!res.ok) return null;
    const json = await res.json();
    const list = mapUsersPayload(json); // from earlier step
    // prefer exact username match, else first partial
    const exact = list.find(
      (u) => u.username.toLowerCase() === key && u.allowTag
    );
    const found = exact || list.find((u) => u.allowTag);
    if (found?.id) {
      usernameIdCache[key] = found.id;
      return found.id;
    }
  } catch {}
  return null;
}

/* --------------------------- API helpers ------------------------ */
// NEW: fetch comments for a post + normalize them into ApiComment[]
async function fetchPostComments(postId: string | number, token?: string): Promise<{ total: number; comments: ApiComment[] }> {
  const url = `https://noctimago.com/wp-json/app/v1/post_comments/${postId}`;
  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`comments HTTP ${res.status}: ${txt || "failed"}`);
  }

  const js = await res.json();

  const arr = Array.isArray(js?.comments) ? js.comments : [];
  const normalized: ApiComment[] = arr.map((c: any) => ({
    ID: String(c.ID),
    content: String(c.content ?? ""),
    date: String(c.date ?? ""),
    parent_id: String(c.parent_id ?? "0"),
    author: String(c.author?.name ?? ""),
    user_id: c.author?.id ? String(c.author.id) : undefined,
    author_profile_image: c.author?.profile_image || undefined,
  }));

  const total = Number(js?.total_comments ?? normalized.length) || normalized.length;
  return { total, comments: normalized };
}

async function unrepostApi(postId: string, token?: string) {
  const url = `https://noctimago.com/wp-json/app/v1/unrepost/${postId}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Unrepost HTTP ${res.status}: ${text || "failed"}`);
  }
  return res.json().catch(() => ({}));
}

async function repostApi(originalPostId: string, token?: string) {
  const url = "https://noctimago.com/wp-json/app/v1/repost";
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ original_post_id: Number(originalPostId) }),
   
  });
  console.log("resss",originalPostId)
  console.log("resss",res)
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Repost HTTP ${res.status}: ${text || "failed"}`);
  }
  return res.json().catch(() => ({}));
}


async function likePostApi(postId: string, token?: string) {
  try {
    await fetch(`https://noctimago.com/wp-json/app/v1/like_post/${postId}`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
  } catch (error) {
    console.log("[liked] error =", error);
  }
}

async function unlikePostApi(postId: string, token?: string) {
  try {
    await fetch(`https://noctimago.com/wp-json/app/v1/unlike_post/${postId}`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
  } catch (error) {
    console.log("[unliked] error =", error);
  }
}
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





/* --- Follow / Unfollow API helpers --- */
async function followUserApi(userId: string, token?: string) {
  const url = `https://noctimago.com/wp-json/app/v1/follow_user/${userId}`;
  const res = await fetch(url, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!res.ok) throw new Error(`Follow HTTP ${res.status}`);
}
async function unfollowUserApi(userId: string, token?: string) {
  const url = `https://noctimago.com/wp-json/app/v1/unfollow_user/${userId}`;
  const res = await fetch(url, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!res.ok) throw new Error(`Unfollow HTTP ${res.status}`);
}
async function savePostApi(postId: string, token?: string) {
  try {
    const res = await fetch(`https://noctimago.com/wp-json/app/v1/save_post/${postId}`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    console.log("fetch", res.status);
  } catch (error) {
    console.log("[save] error =", error);
    throw error;
  }
}
async function unsavePostApi(postId: string, token?: string) {
  try {
    await fetch(`https://noctimago.com/wp-json/app/v1/unsave_post/${postId}`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
  } catch (error) {
    console.log("[unsave] error =", error);
    throw error;
  }
}
/* --- Mention: Search Users API --- */
type UserLite = {
  id: string;
  username: string;
  name: string;
  avatar?: string;
  allowTag: boolean;
};

async function fetchUsersPage(page: number, token?: string) {
  const url = `https://noctimago.com/wp-json/app/v1/users?page=${page}`;
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

async function searchUsersApi(query: string, token?: string, meId?: string): Promise<UserLite[]> {
  const q = (query || "").trim().toLowerCase();
  if (!q) return [];
  try {
    const url = `https://noctimago.com/wp-json/app/v1/users?page=1&search=${encodeURIComponent(q)}`;
    const res = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (res.ok) {
      const js = await res.json();
      let list = mapUsersPayload(js);
      // filter
      list = list.filter(
        (u) =>
          u.allowTag &&
          (!meId || u.id !== String(meId)) &&
          (u.username.toLowerCase().includes(q) || u.name.toLowerCase().includes(q))
      );
      return list.slice(0, 20);
    }
  } catch {
    // fallback: first 2 pages
  }

  try {
    const pages = [1, 2];
    let all: UserLite[] = [];
    for (const p of pages) {
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
async function deletePostApi(postId: string | number, token?: string) {
  const url = `https://noctimago.com/wp-json/app/v1/delete-post/${postId}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Delete HTTP ${res.status}: ${text || "failed"}`);
  }
  return res.json().catch(() => ({}));
}
type CommentNode = ApiComment & { children: CommentNode[] };

function threadifyComments(list: ApiComment[]): CommentNode[] {
  const byId = new Map<string, CommentNode>();
  const roots: CommentNode[] = [];

  // seed
  list.forEach((c) => {
    byId.set(String(c.ID), { ...c, children: [] });
  });

  // link
  list.forEach((c) => {
    const pid = getParentId(c);
    const node = byId.get(String(c.ID))!;
    if (pid && byId.has(pid)) {
      byId.get(pid)!.children.push(node);
    } else {
      roots.push(node);
    }
  });

  // optional: sort by date (oldest → newest)
  const sortTree = (arr: CommentNode[]) => {
    arr.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    arr.forEach((n) => sortTree(n.children));
  };
  sortTree(roots);

  return roots;
}

/* --------------------------- Component -------------------------- */
export default function HomeScreen({ navigation }: any) {
  const dispatch = useDispatch();
  const token = useSelector((state: any) => state.authReducer.token);
  const userprofile = useSelector((state: any) => state.authReducer.userprofile);
  const isFocused = useIsFocused();
  const feedRef = useRef<FlatList<PostCardModel>>(null);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionList, setMentionList] = useState<UserLite[]>([]);
  const [mentionLoading, setMentionLoading] = useState(false);
  const [tagged, setTagged] = useState<TaggedUser[]>([]);
  const mentionRegex = /(^|\s)@([\w.\-]{0,30})$/i;
  const debTimer = useRef<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const feedNodeRef = useRef<number | null>(null);

  useEffect(() => {
    // capture the native node handle once the list mounts
    // (re-run if feedRef changes)
    feedNodeRef.current = findNodeHandle(feedRef.current) as number | null;
  }, [feedRef.current]);
  useEffect(() => {
    // Initialize AdMob
    mobileAds()
      .initialize()
      .then(adapterStatuses => {
        console.log('✅ AdMob initialized', adapterStatuses);
      })
      .catch(err => console.warn('❌ AdMob init failed', err));
  }, []);
  
  // helper the child can call with an absolute Y (relative to the FlatList)
  const scrollListToY = useCallback((absY: number) => {
    // keep a little cushion so the input sits above the keyboard
    const cushion = Platform.select({ ios: 90, android: 110 })!;
    const offset = Math.max(0, absY - cushion);
    feedRef.current?.scrollToOffset({ offset, animated: true });
  }, []);
  const [active, setActive] = useState<(typeof FILTERS)[number]["key"]>("all");
  const [posts, setPosts] = useState<PostCardModel[]>([]);
  const [rawPosts, setRawPosts] = useState<ApiPost[]>([]);

  // Nearby state (By Location)
  const [nearbyPosts, setNearbyPosts] = useState<PostCardModel[]>([]);
  const [rawNearby, setRawNearby] = useState<ApiPost[]>([]);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [nearbyErr, setNearbyErr] = useState<string | null>(null);
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());

  // local comment text per post
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  // Tabs underline
  const indicatorX = useRef(new Animated.Value(0)).current;
  const [tabsWidth, setTabsWidth] = useState(0);
  const tabWidth = tabsWidth > 0 ? tabsWidth / FILTERS.length : 0;
  const activeIndex = FILTERS.findIndex((f) => f.key === active);
  const bannerAdId = __DEV__ ? TestIds.BANNER : 'ca-app-pub-2847186072494111~8751364810';
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [fcmToken, setFcmToken] = useState("");
  const runUserSearch = (q: string) => {
    if (debTimer.current) clearTimeout(debTimer.current);
    debTimer.current = setTimeout(async () => {
      setMentionLoading(true);
      const res = await searchUsersApi(q, token, meId);
      setMentionList(res);
      setMentionLoading(false);
    }, 200);
  };
  // under other useStates in HomeScreen
const [commentsByPost, setCommentsByPost] = useState<Record<string, { total: number; list: ApiComment[] }>>({});
const [commentsLoading, setCommentsLoading] = useState<Record<string, boolean>>({});

// helper to fetch & cache
const loadCommentsForPost = useCallback(async (postId: string) => {
  if (commentsLoading[postId]) return;
  setCommentsLoading((m) => ({ ...m, [postId]: true }));
  try {
    const { total, comments } = await fetchPostComments(postId, token);
    setCommentsByPost((m) => ({ ...m, [postId]: { total, list: comments } }));
  } catch (e) {
    console.warn("loadCommentsForPost error:", e);
    setCommentsByPost((m) => ({ ...m, [postId]: { total: 0, list: [] } }));
  } finally {
    setCommentsLoading((m) => ({ ...m, [postId]: false }));
  }
}, [token, commentsLoading]);

  useEffect(() => {
    const parent = navigation.getParent?.(); // the tab navigator
    if (!parent) return;
  
    const unsub = parent.addListener('tabPress', (e: any) => {
      // Only when Home is already focused
      if (navigation.isFocused()) {
        // scroll to top
        feedRef.current?.scrollToOffset({ offset: 0, animated: true });
        // (optional) fetch newest posts after a short delay
        setTimeout(() => {
          // choose one:
           GetAllPost();            // only “All”
          refresh();                  // your existing pull-to-refresh (keeps current tab logic)
        }, 150);
      }
    });
  
    return unsub;
  }, [navigation, refresh]);
  useEffect(() => {
    if (!posts.length) return;
    // optional: only load for the first N or visible ones
    posts.forEach((p) => loadCommentsForPost(p.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posts, token]);
  
  const handleDraftChange = (t: string) => {
    onChangeDraft(t);
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
    const current = commentDraft || "";
    const newText = current.replace(mentionRegex, (all, lead) => `${lead}@${u.username} `);
    onChangeDraft(newText);
    setTagged((prev) =>
      prev.some((x) => x.id === u.id) ? prev : [...prev, { id: u.id, username: u.username }]
    );
    setMentionOpen(false);
    setTimeout(() => inputRef.current?.focus(), 0);
  };
  
  // 🔔 FCM init
  useEffect(() => {
    (async () => {
      const authStatus = await requestUserPermission();
      if (authStatus) {
        const fcmtoken = await getFcmToken();
        if (!fcmtoken) {
          Alert.alert("Please enable notifications to receive time-critical updates");
        } else {
          setFcmToken(fcmtoken);
        }
      }
    })();
  }, []);
  function extractUnreadCount(payload: any): number {
    const pick = (obj: any): number => {
      if (!obj || typeof obj !== "object") return 0;
  
      // Normalize keys once
      const entries = Object.entries(obj).map(([k, v]) => [k.toLowerCase(), v] as const);
  
      // Known variants first (exact-ish)
      const knownKeys = [
        "wothout_seen_notification_count",   // current
        "wothout_seent_notification_count",  // previous
        "without_seen_notification_count",   // if backend fixes typo
        "unseen_notification_count",         // possible future
        "unread_notification_count",         // possible future
      ];
  
      for (const key of knownKeys) {
        const hit = entries.find(([k]) => k === key);
        if (hit) return Number(hit[1] ?? 0) || 0;
      }
  
      // Fuzzy fallback: look for a key containing both "seen" and "count"
      const fuzzy = entries.find(([k]) => k.includes("seen") && k.includes("count"));
      if (fuzzy) return Number(fuzzy[1] ?? 0) || 0;
  
      return 0;
    };
  
    // Array or single object
    if (Array.isArray(payload)) {
      if (payload.length === 0) return 0;
      return pick(payload[0]);
    }
    return pick(payload);
  }
  
  const fetchNotifications = React.useCallback(async () => {
    try {
      const payload = JSON.stringify({
        NTN_PKeyID: 0,
        PageNumber: 1,
        NoofRows: 100,
        Orderby: "",
        Type: 4,
        UserID: userprofile?.ID,
        TimeZone: "Asia/Kolkata",
      });
  console.log("pyload notificTION",payload)
      const res = await getnotify(payload, token);
      console.log("res[0][0].Wothout_Seen_Notification_Count",res)
      const unread = extractUnreadCount(res);
      console.log("res[0][0].Wothout_Seen_Notification_Count",res)
      console.log("ressssunread",res[0][0].Wothout_Seen_Notification_Count)
      console.log("unread parsed =", unread, "raw =", res);
      setNotifCount(res[0][0].Wothout_Seen_Notification_Count);

    } catch (err: any) {
      console.warn("Notify error:", err?.message ?? err);
      setNotifCount(0);
    }
  }, [token, userprofile?.ID]);
  
  useFocusEffect(
    React.useCallback(() => {
      let interval: NodeJS.Timeout | null = null;
  
      // Fetch immediately when screen focuses
      fetchNotifications();
   
    
      // Repeat every 20 seconds (or adjust as you like)
      interval = setInterval(fetchNotifications, 20000);
  
      // Clear when screen unfocuses
      return () => {
        if (interval) clearInterval(interval);
      };
    }, [fetchNotifications])
  );
  useFocusEffect(
    React.useCallback(() => {
      GetAllPost();
      setCommentsByPost({});
      posts.forEach(p => fetchPostComments(p.id));
    }, [token])
  );
  
  const refresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await GetUserHome();
      if (active === "location") {
        await loadNearbyPosts();
      } else {
        await GetAllPost();
        posts.forEach((p) => fetchPostComments(p.id));
      }
    } catch (e) {
      console.log("[refresh] error", e);
    } finally {
      setRefreshing(false);
    }
  };

  const GetUserHome = async () => {
    try {
      const res = await profile(token);
      console.log("res",res)
      dispatch(UserProfile(res.profile));
    } catch (error) {
      console.log("[GetUserHome] error =", error);
    }
  };

  const SendNotification = async (
    message: string,
    title: string,
    receiverId?: string,
    type?: number,
    postId?: number
  ) => {
    try {
      const me = String(userprofile?.ID ?? "");
      const rc = String(receiverId ?? "");
  
      // ✅ skip if no receiver or self
      if (!rc || me === rc) {
        console.log("[notify] skipped (self or empty)", { me, rc });
        return;
      }
  
      const payload = JSON.stringify({
        UserToken: fcmToken,
        message,
        msgtitle: title,
        User_PkeyID: userprofile?.ID,              // sender
        UserID: rc,                                // receiver
        NTN_C_L: type,
        NTN_Sender_Name: userprofile?.meta?.first_name,
        NTN_Sender_Img: userprofile?.meta?.profile_image,
        NTN_Reciever_Name: "",
        NTN_Reciever_Img: "",
        NTN_UP_PkeyID: postId,
        NTN_UP_Path: "",
      });
  
      await sendnotify(payload, token);
    } catch (err) {
      console.warn("Notify error:", err);
    }
  };
  

  const GetAllPost = async () => {
    try {
      const res = await getallpost(token);
      const apiPosts: ApiPost[] = res?.posts ?? [];

      setRawPosts(apiPosts);
      const mapped = apiPosts.map((p) => mapApiPostToCard(p, userprofile?.ID));
      setPosts(mapped);
      mapped.forEach((p) => loadCommentsForPost(p.id));
    } catch (error) {
      console.log("[GetAllPost] error =", error);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      // When Home tab gains focus, reload feed & comments
      GetUserHome();
      GetAllPost();
      fetchNotifications();
  
      // 🔁 force comment reload
      setCommentsByPost({}); // empty map forces PostCard.ensureComments() to re-run
  
      // optional: if you have a dedicated fetch function
      posts.forEach((p) => fetchPostComments(p.id)); // manual explicit reload
  
      return undefined;
    }, [token])
  );
  

  useEffect(() => {
    Animated.spring(indicatorX, {
      toValue: activeIndex * tabWidth,
      useNativeDriver: true,
      bounciness: 6,
      speed: 12,
    }).start();
  }, [activeIndex, tabWidth, indicatorX]);

  // stop all videos when list unmounts
  useEffect(() => () => setPlayMap({}), []);

  const onTabsLayout = (e: LayoutChangeEvent) => {
    setTabsWidth(e.nativeEvent.layout.width);
  };

  /* ---------- Search open/close animations ---------- */
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const searchAnim = useRef(new Animated.Value(0)).current;
// HomeScreen
useEffect(() => {
  if (searchOpen) setPlayMap({}); // pauses all Video (paused becomes true)
}, [searchOpen]);

  const openSearch = () => {
    setSearchOpen(true);
    Animated.timing(searchAnim, {
      toValue: 1,
      duration: 180,
      useNativeDriver: false,
    }).start();
  };
  const openChat = () => {
    navigation.navigate("NotificationsScreen");
  };
  const closeSearch = (clear = false) => {
    if (clear) setQuery("");
    Animated.timing(searchAnim, {
      toValue: 0,
      duration: 160,
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished) setSearchOpen(false);
    });
  };

  const searchHeight = searchAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 44],
  });
  const searchOpacity = searchAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });
  const onRepost = async (post: PostCardModel) => {
    try {
      if (!token) {
        Alert.alert("Sign in required", "Please log in to repost.");
        return;
      }
  
      // Safety: don't allow reposting your own post
      if (post.authorId && String(post.authorId) === String(userprofile?.ID)) {
        Alert.alert("Not allowed", "You cannot repost your own post.");
        return;
      }
      try {
        await repostApi(post.id, token);

        // 🔔 Notify original author (skip self)
        if (post.authorId && String(post.authorId) !== String(userprofile?.ID)) {
          const title = "Repost";
          const message = `${userprofile?.username || "Someone"} reposted your post`;
          // Use a distinct notification type code for reposts (e.g., 6)
          SendNotification(message, title, String(post.authorId), 1, Number(post.id));
        }

        await GetAllPost(); // refresh feed if you want to show new repost
        Alert.alert("Done", "Post reposted to your feed.");
      } catch (e: any) {
        Alert.alert("Repost failed", e?.message || "Please try again.");
      }
      return 0
      await repostApi(post.id, token);
      Alert.alert(
        "Repost this?",
        "This will share the original post to your feed.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Repost",
            style: "default",
            onPress: async () => {
              try {
                await repostApi(post.id, token);
  
                // 🔔 Notify original author (skip self)
                if (post.authorId && String(post.authorId) !== String(userprofile?.ID)) {
                  const title = "Repost";
                  const message = `${userprofile?.username || "Someone"} reposted your post`;
                  // Use a distinct notification type code for reposts (e.g., 6)
                  SendNotification(message, title, String(post.authorId), 1, Number(post.id));
                }
  
                await GetAllPost(); // refresh feed if you want to show new repost
                Alert.alert("Done", "Post reposted to your feed.");
              } catch (e: any) {
                Alert.alert("Repost failed", e?.message || "Please try again.");
              }
            },
          },
        ]
      );
    } catch (e: any) {
      Alert.alert("Repost failed", e?.message || "Please try again.");
    }
  };
  
// HomeScreen.tsx

const onUnrepost = async (post: PostCardModel) => {
  try {
    if (!token) {
      Alert.alert("Sign in required", "Please log in to unrepost.");
      return;
    }
    Alert.alert("Unrepost this?", "It will be removed from your feed.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Unrepost",
        style: "destructive",
        onPress: async () => {
          try {
            await unrepostApi(post.id, token);
            await GetAllPost(); // refresh the feed
            Alert.alert("Done", "Post unreposted.");
          } catch (e: any) {
            Alert.alert("Unrepost failed", e?.message || "Please try again.");
          }
        },
      },
    ]);
  } catch (e: any) {
    Alert.alert("Unrepost failed", e?.message || "Please try again.");
  }
};

const onEditPost = (post: PostCardModel) => {
  navigation.navigate("EditPostScreen", {
    postId: post.id,
    initial: {
      title: post.title || "",
      event: post.event || "",
      // 👇 pass CSV exactly like the API expects
      tag_people: (post.tags || []).join(", "),
      location: post.location || "",
      images: post.images?.length ? post.images : (post.image ? [post.image] : []),
      video: post.hasVideo ? (post.videoUrl || "") : "",
    },
  });
};

  
  const onDeletePost = (post: PostCardModel) => {
    Alert.alert(
      "Delete post?",
      "Do you want to delete this post?.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deletePostApi(post.id, token);
              // Optimistic remove from lists
              setPosts((prev) => prev.filter((p) => p.id !== post.id));
              setNearbyPosts((prev) => prev.filter((p) => p.id !== post.id));
              // Or re-fetch:
              // await GetAllPost();
              Alert.alert("Deleted", "Your post has been removed.");
            } catch (e: any) {
              Alert.alert("Delete failed", e?.message || "Please try again.");
            }
          },
        },
      ]
    );
  };
    
  /* ----------------------- Nearby (By Location) ----------------------- */
  type Coords = { latitude: number; longitude: number };

  async function requestLocationPermission(): Promise<boolean> {
    if (Platform.OS === "android") {
      const fine = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        {
          title: "Location Permission",
          message: "We use your location to find nearby posts.",
          buttonPositive: "OK",
        }
      );
      return fine === PermissionsAndroid.RESULTS.GRANTED;
    } else {
      const auth = await Geolocation.requestAuthorization("whenInUse");
      return auth === "granted";
    }
  }

  async function getCoords(): Promise<Coords> {
    const granted = await requestLocationPermission();
    if (!granted) throw new Error("Location permission denied");

    return new Promise((resolve, reject) => {
      Geolocation.getCurrentPosition(
        (pos) =>
          resolve({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          }),
        (err) => reject(err),
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 10000,
          forceRequestLocation: true,
          showLocationDialog: true,
        }
      );
    });
  }

  async function loadNearbyPosts() {
    try {
      setNearbyLoading(true);
      setNearbyErr(null);

      const { latitude, longitude } = await getCoords();
      const radius = 1000;

      const url = `https://noctimago.com/wp-json/app/v1/nearby-posts?latitude=${latitude}&longitude=${longitude}&radius=${radius}`;

      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const json = await res.json();
      const apiPosts: ApiPost[] = json?.posts ?? json ?? [];
      setRawNearby(apiPosts);
      setNearbyPosts(apiPosts.map((p) => mapApiPostToCard(p, userprofile?.ID)));
    } catch (e: any) {
      console.warn("[nearby-posts] error", e);
      setNearbyErr(
        e?.message?.toLowerCase().includes("denied")
          ? "Location not allowed. Enable it to see nearby posts."
          : "Could not load nearby posts."
      );
      setRawNearby([]);
      setNearbyPosts([]);
    } finally {
      setNearbyLoading(false);
    }
  }
  useEffect(() => {
    AvoidSoftInput.setEnabled(true);
    AvoidSoftInput.setAvoidOffset(12);
    return () => AvoidSoftInput.setEnabled(false);
  }, []);
  

  // Filtered list = tabs + query (and source switching)
  const filtered = useMemo(() => {
    let base = active === "location" ? nearbyPosts : posts;

    if (active === "video") base = base.filter((p) => p.hasVideo);

    if (active === "date" && selectedDate) {
      base = base.filter((p) => {
        const d = dateOnly(p.rawDate);
        return d && d.getTime() === selectedDate.getTime();
      });
    }

    if (query.trim().length) {
      const tokens = parseQuery(query);
      const raw = active === "location" ? rawNearby : rawPosts;
      const okIds = new Set(
        raw.filter((p) => matchesTokens(p, tokens)).map((p) => String(p.ID))
      );
      base = base.filter((p) => okIds.has(p.id));
    }

    return base;
  }, [posts, nearbyPosts, active, query, rawPosts, rawNearby, selectedDate]);

  const openDetails = (id: string) => {
    navigation.navigate("PostDetailScreen", { postId: id, token });
  };

  /* ---------- Likes ---------- */
  const [likingIds, setLikingIds] = useState<Set<string>>(new Set());
  const toggleLike = async (postId: string, item: PostCardModel) => {
    if (likingIds.has(postId)) return;

    const source = active === "location" ? nearbyPosts : posts;
    const setSource = active === "location" ? setNearbyPosts : setPosts;
    const curIdx = source.findIndex((p) => p.id === postId);
    if (curIdx === -1) return;

    const current = source[curIdx];
    const optimisticLiked = !current.liked;
    const optimisticLikes = current.likes + (optimisticLiked ? 1 : -1);

    const next = [...source];
    next[curIdx] = {
      ...current,
      liked: optimisticLiked,
      likes: Math.max(0, optimisticLikes),
    };
    setSource(next);

    const inFlight = new Set(likingIds);
    inFlight.add(postId);
    setLikingIds(inFlight);

    try {
      if (optimisticLiked) {
        await likePostApi(postId, token);
        const title = "New like";
        const message = `${userprofile?.username || "Someone"} liked your post`;
        {userprofile?.Id!==item?.authorId &&
        SendNotification(message, title, item?.authorId, 1, Number(postId));
        }
      } else {
        await unlikePostApi(postId, token);
      }
    } catch {
      const rollback = [...next];
      rollback[curIdx] = { ...current };
      setSource(rollback);
      Alert.alert("Oops", "Could not update like. Please try again.");
    } finally {
      const s = new Set(inFlight);
      s.delete(postId);
      setLikingIds(s);
    }
  };

  /* ---------- Comments ---------- */
  const [commentingIds, setCommentingIds] = useState<Set<string>>(new Set());
  const setDraftFor = (postId: string, val: string) =>
    setCommentDrafts((prev) => ({ ...prev, [postId]: val }));
  type TaggedUser = { id: string; username: string };
  const meId = String(userprofile?.ID ?? "");

  // add parentId parameter
  const addComment = async (
    postId: string,
    item: PostCardModel,
    tagged: TaggedUser[] = [],
    parentId?: string
  ): Promise<boolean> => {
    Keyboard.dismiss();
    const title = parentId ? "New reply" : "New Comment";
    const message = `${userprofile?.username || "Someone"} ${parentId ? "replied to a comment on" : "commented on"} your post`;
  
    const text = (commentDrafts[postId] || "").trim();
    if (!text) return false;
    if (commentingIds.has(postId)) return false;
  
    const source = active === "location" ? nearbyPosts : posts;
    const setSource = active === "location" ? setNearbyPosts : setPosts;
  
    const idx = source.findIndex((p) => p.id === postId);
    if (idx === -1) return;
  
    const current = source[idx];
    const next = [...source];
    next[idx] = { ...current, comments: current.comments + 1 };
    setSource(next);
  
    const inf = new Set(commentingIds);
    inf.add(postId);
    setCommentingIds(inf);
  
    try {
      const safe = encodeToHtmlEntities(text);
      console.log("🗨️ Sending comment:", text, "parentId:", parentId);
      await commentPostApi(postId, safe, token, userprofile?.ID, parentId);
      await loadCommentsForPost(postId);
   
  
      // notify post author (skip self)
      if (item.authorId && String(item.authorId) !== String(userprofile?.ID)) {
        SendNotification(message, title, item.authorId, 1, Number(postId));
      }
  
      // notify tagged users
      for (const t of tagged) {
        const msg = `${userprofile?.username || "Someone"} mentioned you in a comment`;
        SendNotification(msg, "You were mentioned", t.id, 2, Number(postId));
      }
  
      setCommentDrafts((p) => ({ ...p, [postId]: "" }));
      return true;
    } catch {
      const rb = [...next];
      rb[idx] = { ...current };
      setSource(rb);
      Alert.alert("Oops", "Could not post comment. Please try again.");
      return false;
    } finally {
      const s = new Set(inf);
      s.delete(postId);
      setCommentingIds(s);
    }
    
  };
  
  // const addComment = async (
  //   postId: string,
  //   item: PostCardModel,
  //   tagged: TaggedUser[] = []
  // ) => {
  //   Keyboard.dismiss();
  //   const title = "New Comment";
  //   const message = `${userprofile?.username || "Someone"} commented on your post`;
  
  //   const text = (commentDrafts[postId] || "").trim();
  //   if (!text) return;
  //   if (commentingIds.has(postId)) return;
  
  //   const source = active === "location" ? nearbyPosts : posts;
  //   const setSource = active === "location" ? setNearbyPosts : setPosts;
  
  //   const idx = source.findIndex((p) => p.id === postId);
  //   if (idx === -1) return;
  
  //   const current = source[idx];
  //   const next = [...source];
  //   next[idx] = { ...current, comments: current.comments + 1 };
  //   setSource(next);
  
  //   const inf = new Set(commentingIds);
  //   inf.add(postId);
  //   setCommentingIds(inf);
  
  //   try {
  //     const safe = encodeToHtmlEntities(text); 
  //     await commentPostApi(postId, text, token);
  //     await GetAllPost();
  //     SendNotification(message, title, item?.authorId, 1, Number(postId));
  
  //     // 🔔 Notify all tagged users
  //     for (const t of tagged) {
  //       const msg = `${userprofile?.username || "Someone"} mentioned you in a comment`;
  //       SendNotification(msg, "You were mentioned", t.id, 2, Number(postId));
  //     }
  
  //     setCommentDrafts((p) => ({ ...p, [postId]: "" }));
  //   } catch {
  //     const rb = [...next];
  //     rb[idx] = { ...current };
  //     setSource(rb);
  //     Alert.alert("Oops", "Could not post comment. Please try again.");
  //   } finally {
  //     const s = new Set(inf);
  //     s.delete(postId);
  //     setCommentingIds(s);
  //   }
  // };
  
  // const addComment = async (postId: string, item: PostCardModel) => {
  //   Keyboard.dismiss();
  //   const title = "New Comment";
  //   const message = `${userprofile?.username || "Someone"} commented on your post`;

  //   const text = (commentDrafts[postId] || "").trim();
  //   if (!text) return;

  //   if (commentingIds.has(postId)) return;

  //   const source = active === "location" ? nearbyPosts : posts;
  //   const setSource = active === "location" ? setNearbyPosts : setPosts;

  //   const idx = source.findIndex((p) => p.id === postId);
  //   if (idx === -1) return;

  //   const current = source[idx];
  //   const next = [...source];
  //   next[idx] = { ...current, comments: current.comments + 1 };
  //   setSource(next);

  //   const inf = new Set(commentingIds);
  //   inf.add(postId);
  //   setCommentingIds(inf);

  //   try {
  //     await commentPostApi(postId, text, token);
  //     await GetAllPost();
  //     SendNotification(message, title, item?.authorId, 1, Number(postId));
  //     setCommentDrafts((prev) => ({ ...prev, [postId]: "" }));
  //   } catch {
  //     const rb = [...next];
  //     rb[idx] = { ...current };
  //     setSource(rb);
  //     Alert.alert("Oops", "Could not post comment. Please try again.");
  //   } finally {
  //     const s = new Set(inf);
  //     s.delete(postId);
  //     setCommentingIds(s);
  //   }
  // };

  /* ---------- Friends ---------- */
  const [friendBusy, setFriendBusy] = useState<Set<string>>(new Set());
  const toggleFriendship = async (authorId?: string, confirmed = false) => {
    if (!authorId) return;
    if (String(authorId) === String(userprofile?.ID)) return;
    if (friendBusy.has(authorId)) return;

    const updateLists = (target: boolean) => {
      setPosts((prev) =>
        prev.map((p) => (p.authorId === authorId ? { ...p, areFriends: target } : p))
      );
      setNearbyPosts((prev) =>
        prev.map((p) => (p.authorId === authorId ? { ...p, areFriends: target } : p))
      );
    };

    const anyPost =
      posts.find((p) => p.authorId === authorId) ||
      nearbyPosts.find((p) => p.authorId === authorId);
    const authorName = anyPost?.author ?? "this user";
    const isFriendNow = anyPost?.areFriends ?? false;
    const target = !isFriendNow;

    if (!target && !confirmed) {
      Alert.alert("Unfriend?", `Remove ${authorName} from your friends?`, [
        { text: "Cancel", style: "cancel" },
        { text: "Unfriend", style: "destructive", onPress: () => toggleFriendship(authorId, true) },
      ]);
      return;
    }

    updateLists(target);

    const busy = new Set(friendBusy);
    busy.add(authorId);
    setFriendBusy(busy);

    try {
      const payload = JSON.stringify({ friend_id: authorId });
      if (target) await add_friend(payload, token);
      else await un_friend(payload, token);
    } catch {
      updateLists(isFriendNow);
      Alert.alert("Oops", "Could not update friend. Please try again.");
    } finally {
      const s = new Set(busy);
      s.delete(authorId);
      setFriendBusy(s);
    }
  };

  /* ---------- Follow ---------- */
  const [followBusy, setFollowBusy] = useState<Set<string>>(new Set());
  const applyFollowState = (authorId: string, following: boolean) => {
    setPosts((prev) =>
      prev.map((p) => (p.authorId === authorId ? { ...p, following } : p))
    );
    setNearbyPosts((prev) =>
      prev.map((p) => (p.authorId === authorId ? { ...p, following } : p))
    );
  };
  const toggleSave = async (postId: string) => {
    if (savingIds.has(postId)) return;
  
    // choose the current source list based on the active tab
    const source = active === "location" ? nearbyPosts : posts;
    const setSource = active === "location" ? setNearbyPosts : setPosts;
  
    const idx = source.findIndex((p) => p.id === postId);
    if (idx === -1) return;
  
    const current = source[idx];
    const optimisticSaved = !current.saved;
  
    // optimistic UI update
    const next = [...source];
    next[idx] = { ...current, saved: optimisticSaved };
    setSource(next);
  
    // mark as in-flight
    const inflight = new Set(savingIds);
    inflight.add(postId);
    setSavingIds(inflight);
  
    try {
      if (optimisticSaved) {
        await savePostApi(postId, token);
      } else {
        await unsavePostApi(postId, token);
      }
    } catch (e) {
      // rollback on failure
      const rollback = [...next];
      rollback[idx] = { ...current };
      setSource(rollback);
      Alert.alert("Oops", "Could not update saved state. Please try again.");
    } finally {
      const s = new Set(inflight);
      s.delete(postId);
      setSavingIds(s);
    }
  };
  const toggleFollow = (authorId?: string, authorName?: string) => {
    if (!authorId) return;
    if (!token) {
      Alert.alert("Sign in required", "Please log in to follow users.");
      return;
    }
    if (String(authorId) === String(userprofile?.ID)) return;
    if (followBusy.has(authorId)) return;

    const anyPost =
      posts.find((p) => p.authorId === authorId) ||
      nearbyPosts.find((p) => p.authorId === authorId);
    const isFollowingNow = !!anyPost?.following;

    if (isFollowingNow) {
      Alert.alert(
        `Unfollow ${authorName || "this user"}?`,
        "You will stop seeing their updates.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Unfollow",
            style: "destructive",
            onPress: () => performFollow(authorId, false),
          },
        ]
      );
    } else {
      performFollow(authorId, true);
    }
  };

  const performFollow = async (authorId: string, follow: boolean) => {
    applyFollowState(authorId, follow);

    const busy = new Set(followBusy);
    busy.add(authorId);
    setFollowBusy(busy);

    try {
      if (follow) await followUserApi(authorId, token);
      else await unfollowUserApi(authorId, token);
    } catch (e) {
      applyFollowState(authorId, !follow);
      Alert.alert("Oops", `Could not ${follow ? "follow" : "unfollow"}. Please try again.`);
    } finally {
      const s = new Set(busy);
      s.delete(authorId);
      setFollowBusy(s);
    }
  };

  /* ----------- Video autoplay: track visible cards ----------- */
  const [playMap, setPlayMap] = useState<Record<string, boolean>>({});
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: Array<ViewToken> }) => {
      const next: Record<string, boolean> = {};
      for (const v of viewableItems) {
        const it = v.item as PostCardModel;
        next[it.id] = true;
      }
      setPlayMap(next);
    }
  ).current;
  const [notifCount, setNotifCount] = useState(0);
  useFocusEffect(
    React.useCallback(() => {
      // TODO: call your notifications API here and set count
      // setNotifCount(server.unreadCount);
      setNotifCount((c) => c); // keep as-is for now
    }, [])
  );
  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.surface} translucent={false} />

      <SafeAreaView style={{ backgroundColor: COLORS.surface }} edges={["top"]}>
        {/* Top bar */}
        <View style={styles.topbar}>
          <View style={styles.brandRow}>
            <Image source={require("../../assets/Logo.png")} resizeMode="contain" style={styles.logo} />
          </View>

          <View style={styles.topActions}>
            <TouchableOpacity style={styles.iconBtn} onPress={openSearch}>
              <Ionicons name="search" size={20} color={COLORS.icon} />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.iconBtn, { position: "relative" }]} onPress={openChat}>
  <Ionicons name="notifications-outline" size={22} color={COLORS.icon} />
  {notifCount > 0 && (
    <View style={styles.badge}>
      <Text style={styles.badgeTxt}>{notifCount > 99 ? "99+" : String(notifCount)}</Text>
    </View>
   )} 
</TouchableOpacity>



            <TouchableOpacity
              style={styles.avatarWrap}
              onPress={() => navigation.navigate("ProfileScreen")}
            >
               <Avatar
    uri={userprofile?.meta?.profile_image}
    name={userprofile?.display_name || userprofile?.username}
    size={20}

  />
            </TouchableOpacity>
          </View>
        </View>

        {/* Slide-down Search Drawer */}
        <Animated.View style={[styles.searchDrawer, { height: searchHeight, opacity: searchOpacity }]}>
          {searchOpen && (
            <View style={styles.searchRow}>
              <View style={styles.searchWrap}>
                <Ionicons name="search" size={16} color={COLORS.icon} style={{ marginHorizontal: 8 }} />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Search event name"
                  placeholderTextColor={COLORS.sub}
                  style={styles.searchInput}
                  autoFocus
                  returnKeyType="search"
                  allowFontScaling={false}
                />
              </View>
              <TouchableOpacity onPress={() => closeSearch(false)} style={styles.cancelBtn}>
                <Text style={styles.cancelTxt} allowFontScaling={false}>Cancel</Text>
              </TouchableOpacity>
            </View>
          )}
        </Animated.View>

        {/* Tabs */}
        <View style={styles.tabsWrap} onLayout={onTabsLayout}>
          <Animated.View
            pointerEvents="none"
            style={[styles.tabIndicator, { width: tabWidth, transform: [{ translateX: indicatorX }] }]}
          />
          {FILTERS.map((f) => {
            const focused = active === f.key;
            return (
              <TouchableOpacity
                key={f.key}
                onPress={async () => {
                  if (f.key === "date") setDatePickerVisible(true);
                  else if (f.key === "location") {
                    setActive("location");
                    loadNearbyPosts();
                  } else setActive(f.key);
                }}
                activeOpacity={0.85}
                style={styles.tabBtn}
              >
                <Ionicons name={f.icon} size={20} color={focused ? COLORS.accent : COLORS.icon} />
                <TText style={[styles.tabLabel, focused && { color: COLORS.accent }]} numberOfLines={1} allowFontScaling={false}>
                  {f.label}
                </TText>
              </TouchableOpacity>
            );
          })}
        </View>
      </SafeAreaView>

      {/* Feed */}
      <AvoidSoftInputView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        // keyboardVerticalOffset={0}
      >
        <FlatList
          data={filtered}
          ref={feedRef}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="always"
          keyboardDismissMode="none"
          refreshing={refreshing}
          onRefresh={() => {
            GetAllPost();
            posts.forEach((p) => fetchPostComments(p.id));
          }}
          viewabilityConfig={viewabilityConfig}
          onViewableItemsChanged={onViewableItemsChanged}
          removeClippedSubviews
          windowSize={7}
          maxToRenderPerBatch={6}
          renderItem={({ item }) => (
            <PostCard
              post={item}
              onPress={() => openDetails(item.id)}
              onToggleLike={() => toggleLike(item.id, item)}
              liking={likingIds.has(item.id)}
              commentDraft={commentDrafts[item.id] ?? ""}
              onChangeDraft={(t) => setDraftFor(item.id, t)}
              commentsFromApi={commentsByPost[item.id]?.list ?? []}
              totalCommentsFromApi={commentsByPost[item.id]?.total ?? item.comments}
              commentsLoading={!!commentsLoading[item.id]}
              ensureComments={() => loadCommentsForPost(item.id)}
              onSendComment={(tagged, parentId) => addComment(item.id, item, tagged, parentId)}
            
              commenting={commentingIds.has(item.id)}
              onToggleFriend={() => toggleFriendship(item.authorId)}
              friendBusy={item.authorId ? friendBusy.has(item.authorId) : false}
              onToggleFollow={() => toggleFollow(item.authorId, item.author)}
              followBusy={item.authorId ? followBusy.has(item.authorId) : false}
              // isSelf={item.authorId && String(item.authorId) === String(userprofile?.ID)}
              onToggleSave={() => toggleSave(item.id)}
              saving={savingIds.has(item.id)}
              shouldPlay={!!playMap[item.id] && isFocused}
              isSelf={item.authorId && String(item.authorId) === String(userprofile?.ID)}
              // onRepost={() => onRepost(item)}
              onEdit={() => onEditPost(item)}
              onDelete={() => onDeletePost(item)}
              onRepost={() => onRepost(item)}
              onUnrepost={() => onUnrepost(item)}
              flatListNode={feedNodeRef.current}
              onNeedScroll={scrollListToY}
            
            />
          )}
          contentContainerStyle={{ paddingBottom: 24 }}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={{ alignItems: "center", marginTop: 48, paddingHorizontal: 16 }}>
              {active === "location" ? (
                nearbyLoading ? (
                  <Text style={{ color: COLORS.sub }}>Finding nearby posts…</Text>
                ) : nearbyErr ? (
                  <Text style={{ color: COLORS.sub }}>{nearbyErr}</Text>
                ) : (
                  <Text style={{ color: COLORS.sub }}>No nearby posts within the selected radius.</Text>
                )
              ) : (
                <Text style={{ color: COLORS.sub }}>
                  {query ? "No events match your search" : "No posts yet"}
                </Text>
              )}
            </View>
          }
        />

        <DateTimePickerModal
          isVisible={datePickerVisible}
          mode="date"
          onConfirm={(date) => {
            const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
            setSelectedDate(d);
            setDatePickerVisible(false);
            setActive("date");
          }}
          onCancel={() => setDatePickerVisible(false)}
        />
      </AvoidSoftInputView>
      <View style={{ alignItems: 'center', marginTop: 10 }}>
        <BannerAd
          unitId={bannerAdId}
          size={BannerAdSize.ADAPTIVE_BANNER}
          onAdLoaded={() => console.log('Banner loaded')}
          onAdFailedToLoad={(error) => console.log('Banner failed:', error)}
        />
      </View>
    </View>
  );
}
// turn u{1F60E} or &#x1F60E; or &#128526; into real emoji
const decodeCurlyUnicode = (s: string) =>
  s.replace(/u\{([0-9a-fA-F]+)\}/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)));

const decodeHtmlEntities = (s: string) =>
  s
    // hex: &#x1F60E;
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    // dec: &#128526;
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)));

// very light colon-shortcode map (add more if needed or swap for a library)
const COLON_EMOJI: Record<string, string> = {
  ":thumbsup:": "👍",
  ":sunglasses:": "😎",
  ":heart:": "❤️",
  ":fire:": "🔥",
  ":clap:": "👏",
};
// Encode everything outside plain ASCII as HTML entities: 😎👍 → &#x1F60E;&#x1F44D;
export const encodeToHtmlEntities = (s: string) =>
  Array.from(s).map(ch => {
    const cp = ch.codePointAt(0)!;
    return cp > 0x7F ? `&#x${cp.toString(16).toUpperCase()};` : ch;
  }).join("");

const decodeColonShortcodes = (s: string) =>
  s.replace(/:[a-z0-9_+\-]+:/gi, m => COLON_EMOJI[m.toLowerCase()] ?? m);

export const normalizeEmoji = (s?: string) =>
  decodeColonShortcodes(decodeHtmlEntities(decodeCurlyUnicode(String(s ?? ""))));

// Clickable @mention renderer for comment text
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
  const parts = text.split(/(\B@[a-zA-Z0-9._-]+)/g);

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
          <Text key={idx} style={normalStyle}>
            {part}
          </Text>
        );
      })}
    </Text>
  );
}

// Simple highlighter: splits text and wraps @mentions
const renderWithMentions = (
  text: string,
  stylesObj: { mention: any; normal: any }
) => {
  const parts = text.split(/(\B@[a-zA-Z0-9._-]+)/g);
  return parts.map((part, idx) => {
    if (/^\B@[a-zA-Z0-9._-]+$/.test(part)) {
      return (
        <Text key={idx} style={stylesObj.mention}>
          {part}
        </Text>
      );
    }
    return (
      <Text key={idx} style={stylesObj.normal}>
        {part}
      </Text>
    );
  });
};

/* --------------------------- Card --------------------------- */
function PostCard({
  post,
  onPress,
  onToggleLike,
  liking,
  commentDraft,
  onChangeDraft,
  onSendComment,
  commenting,
  onToggleFriend,
  onToggleFollow,
  friendBusy,
  followBusy,
  isSelf,
  onToggleSave,
  saving,
  shouldPlay,
  onRepost,
  onEdit,
  onDelete,
  commentsFromApi,
  totalCommentsFromApi,
  commentsLoading,
  ensureComments,
  flatListNode,
  onNeedScroll

}: {
  post: PostCardModel;
  onPress: () => void;
  onToggleLike: () => void;
  liking?: boolean;
  commentDraft: string;
  onChangeDraft: (t: string) => void;
  onSendComment: (tagged: TaggedUser[], parentId?: string) => Promise<boolean>;

  commenting?: boolean;
  onToggleFriend: () => void;
  onToggleFollow: () => void;
  friendBusy?: boolean;
  followBusy?: boolean;
  isSelf?: boolean | string;
  onToggleSave: () => void;
  saving?: boolean;
  shouldPlay?: boolean;
  onRepost: () => void;
  onEdit: () => void;
  onDelete: () => void;
  commentsFromApi: ApiComment[];
  totalCommentsFromApi: number;
  commentsLoading: boolean;
  ensureComments: () => void;
  flatListNode: number | null;
  onNeedScroll: (absY: number) => void;
}) {
  const nav = useNavigation<any>();
  const cardRef = useRef<View>(null);
  const inputWrapRef = useRef<View>(null);
// inside PostCard
// const meId = useSelector(
//   (s: any) => (s.authReducer?.userprofile?.ID ? String(s.authReducer.userprofile.ID) : "")
// );

// Who’s shown as the primary reposter in the banner
const primaryName =
  post.repostedById && post.repostedById === meId ? "You" : (post.repostedByName || "Someone");

// How many *other* people (besides the primary) also reposted
const others = Math.max(0, (post.repostCount || 0) - 1);

// Final banner text
const bannerText =
  others > 0
    ? `${primaryName} and ${others} other${others > 1 ? "s" : ""} reposted`
    : `${primaryName} reposted`;

  const scrollInputIntoView = useCallback(() => {
    // Wait a bit so the keyboard can begin its animation
    setTimeout(() => {
      const listNode = flatListNode;
      if (!listNode) return;

      // Measure the input container relative to the FlatList
      inputWrapRef.current?.measureLayout(
        listNode,
        (x, y /* w, h */) => {
        onNeedScroll(y);
        },
        () => {}
      );
    }, 180);
  }, [flatListNode, onNeedScroll]);
  const [expanded, setExpanded] = useState(false);
  const [showBox, setShowBox] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const toggleMenu = () => setMenuOpen((s) => !s);
  const closeMenu = () => setMenuOpen(false);
  // per-card mute state
  const userprofile = useSelector((state: any) => state.authReducer.userprofile);
  const [muted, setMuted] = useState(true);
  const handleSend = async () => {
  
    const ok = await onSendComment(tagged, replyTo ? String(replyTo.ID) : undefined);
    if (ok) {
      // ✅ clear reply state and input
      setReplyTo(null);
      setTagged([]);
      setMentionOpen(false);
      onChangeDraft("");
      // setShowBox(false); // optional: close the box
    }
  };
  
  const visibleComments = expanded ? post.commentsList : post.commentsList.slice(0, 2);
  // const canExpand = post.comments > 2;
  const token = useSelector((s: any) => s.authReducer.token);
const meId = useSelector((s: any) =>
  s.authReducer?.userprofile?.ID ? String(s.authReducer.userprofile.ID) : undefined
);
useEffect(() => {
  // if we don't have comments yet, load once
  if (!commentsFromApi || commentsFromApi.length === 0) {
    ensureComments();
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);
const threaded = useMemo(
  () => threadifyComments(commentsFromApi || []),
  [commentsFromApi]
);
const ROOTS_SHOWN_WHEN_COLLAPSED = 1;
const canExpand = threaded.length > ROOTS_SHOWN_WHEN_COLLAPSED;
const rootsToRender = expanded ? threaded : threaded.slice(0, ROOTS_SHOWN_WHEN_COLLAPSED);


// const threaded = useMemo(
//   () => threadifyComments(post.commentsList || []),
//   [post.commentsList]
// );
// inside PostCard
const [replyTo, setReplyTo] = useState<ApiComment | null>(null);

const onTapReply = (c: ApiComment) => {
  setReplyTo(c);
  setShowBox(true);
  // (optional) prefill with @mention of the author
  const at = `@${(c.author || "").replace(/\s+/g, "")} `;
  if (!commentDraft?.startsWith(at)) {
    onChangeDraft(`${at}${commentDraft || ""}`);
  }
  setTimeout(() => {
    inputRef.current?.focus();
    scrollInputIntoView();  // 👈 ensure visible on reply
  }, 0);
};

// mention state
const [mentionOpen, setMentionOpen] = useState(false);
const [mentionQuery, setMentionQuery] = useState("");
const [mentionList, setMentionList] = useState<UserLite[]>([]);
const [mentionLoading, setMentionLoading] = useState(false);
const [tagged, setTagged] = useState<TaggedUser[]>([]);
const mentionRegex = /(^|\s)@([\w.\-]{0,30})$/i;
const debTimer = useRef<any>(null);
const onMentionPress = async (username: string) => {
  // try to resolve the user id
  const uid = await resolveUserIdByUsername(username, token);
  if (uid) {
    nav.navigate("ViewProfileScreen", { NTN_User_PkeyID: uid });
  } else {
    Alert.alert("Profile not found", `Couldn't open @${username}'s profile.`);
  }
};
  const runUserSearch = (q: string) => {
    if (debTimer.current) clearTimeout(debTimer.current);
    debTimer.current = setTimeout(async () => {
      setMentionLoading(true);
      const res = await searchUsersApi(q, token, meId);
      setMentionList(res);
      setMentionLoading(false);
    }, 200);
  };
  
  const handleDraftChange = (t: string) => {
    onChangeDraft(t);
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
    const current = commentDraft || "";
    const newText = current.replace(mentionRegex, (all, lead) => `${lead}@${u.username} `);
    onChangeDraft(newText);
    setTagged((prev) =>
      prev.some((x) => x.id === u.id) ? prev : [...prev, { id: u.id, username: u.username }]
    );
    setMentionOpen(false);
    setTimeout(() => inputRef.current?.focus(), 0);
  };
  
  const onPressCommentIcon = () => {
    setShowBox(true);
    setReplyTo(null);
    setTimeout(() => {
      inputRef.current?.focus();
      scrollInputIntoView();  // 👈 ensure visible on open
    }, 0);
  };
  

  // Build media list: video first then ALL images; if none, use first image
  const mediaItems = useMemo(() => {
    const items: Array<{ type: "video" | "image"; uri: string }> = [];
    if (post.hasVideo && post.videoUrl) items.push({ type: "video", uri: post.videoUrl });
    const imgs = Array.isArray(post.images) && post.images.length > 0 ? post.images : (post.image ? [post.image] : []);
    items.push(...imgs.map((u) => ({ type: "image", uri: u })));
    return items;
  }, [post.hasVideo, post.videoUrl, post.images, post.image]);

  const [slide, setSlide] = useState(0);
  const [mediaWidth, setMediaWidth] = useState(0);
  const listRef = useRef<FlatList<{ type: "video" | "image"; uri: string }>>(null);

  const onScrollMedia = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x || 0;
    const w = e.nativeEvent.layoutMeasurement.width || 1;
    const idx = Math.round(x / w);
    if (idx !== slide) setSlide(idx);
  };

  const isVideoActive = mediaItems[slide]?.type === "video";

  // Auto-mute when leaving the video slide
  useEffect(() => {
    if (!isVideoActive && !muted) setMuted(true);
  }, [isVideoActive]);

  // ---------- Share handlers (INSIDE PostCard) ----------
  const shareCurrent = async () => {
    try {
      const item = mediaItems[slide];
      if (!item) return;
      const url = item.uri;
      const title = post.title || "Shared media";
      const message = `${title}\n${url}`;

      if (Platform.OS === "android") await Share.share({ title, message });
      else await Share.share({ title, url, message });
    } catch {
      Alert.alert("Share failed", "Unable to share this media right now.");
    }
  };

  const shareAlbum = async () => {
    try {
      const allUrls = mediaItems.map((m) => m.uri);
      if (!allUrls.length) return;

      const title = post.title || "Shared album";
      const message = `${title}\n${allUrls.join("\n")}`;

      if (Platform.OS === "android") await Share.share({ title, message });
      else await Share.share({ title, url: allUrls[0], message });
    } catch {
      Alert.alert("Share failed", "Unable to share the album right now.");
    }
  };
  // ------------------------------------------------------

  const heartName = post.liked ? "heart" : "heart-outline";
  const heartColor = post.liked ? COLORS.accent : COLORS.icon;
  useEffect(() => {
    if (!replyTo) return;
    const at = `@${(replyTo.author || "").replace(/\s+/g, "")} `;
    if (!commentDraft.startsWith(at)) {
      setReplyTo(null);
    }
  }, [commentDraft, replyTo]);
  const [expandedChildren, setExpandedChildren] = useState<Record<string, boolean>>({});
const toggleChildren = (rootId: string) =>
  setExpandedChildren(s => ({ ...s, [rootId]: !s[rootId] }));
  return (
    <View style={styles.card} >
      {/* Header */}
      {post.isRepostCard ? (
  <TouchableOpacity
    onPress={() =>
      post.repostedById && nav.navigate("ViewProfileScreen", { NTN_User_PkeyID: post.repostedById })
    }
    style={styles.repostBanner}
    activeOpacity={0.8}
  >
    <Ionicons name="repeat-outline" size={14} color={COLORS.sub} />
    <Text style={styles.repostBannerText}>{bannerText}</Text>
  </TouchableOpacity>
) : null}


      <View style={styles.rowBetween}>
        <View style={styles.row}>
          <TouchableOpacity
            onPress={() =>
              nav.navigate("ViewProfileScreen", { NTN_User_PkeyID: post.authorId })
            }
          >
              <Avatar uri={post.avatar} name={post.author} size={36} />
            {/* <Image source={{ uri: post.avatar }} style={styles.postAvatar} /> */}
          </TouchableOpacity>

          <View>
            <TouchableOpacity
              onPress={() =>
                nav.navigate("ViewProfileScreen", { NTN_User_PkeyID: post.authorId })
              }
            >
              <Text style={styles.author}>{post.author}</Text>
            </TouchableOpacity>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Text style={styles.time} allowFontScaling={false}>
                {post.timeAgo}{" "}
              </Text>
              <TText style={styles.time} allowFontScaling={false}>
                ago
              </TText>
            </View>
          </View>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
    {/* Keep the Follow pill ONLY for non-self (optional) */}
    {!isSelf ? (
      <TouchableOpacity
        style={[
          styles.pillBtn,
          post.following ? styles.pillActive : null,
          followBusy ? { opacity: 0.6 } : null,
        ]}
        onPress={onToggleFollow}
        disabled={!!followBusy}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons
          name={post.following ? "checkmark-circle-outline" : "add-circle-outline"}
          size={16}
          color={post.following ? "#fff" : COLORS.icon}
        />
        <TText
          style={[styles.pillTxt, post.following ? { color: "#fff" } : null]}
          allowFontScaling={false}
        >
          {post.following ? "Following" : "Follow"}
        </TText>
      </TouchableOpacity>
    ) : null}

    {/* 3-dot overflow menu */}
    <View style={{ position: "relative" }}>
      <TouchableOpacity
        onPress={toggleMenu}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        style={{ padding: 6 }}
      >
        <Ionicons name="ellipsis-vertical" size={20} color={COLORS.icon} />
      </TouchableOpacity>

      {menuOpen && (
        <>
          {/* click-outside overlay */}
          <TouchableOpacity
            onPress={closeMenu}
            style={styles.menuBackdrop}
            activeOpacity={1}
          />

          {/* dropdown */}
          <View style={styles.menu}>
            {isSelf ? (
              <>
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => { closeMenu(); onEdit(); }}
                >
                  <Ionicons name="create-outline" size={18} color={COLORS.text} />
                  <Text style={styles.menuText}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.menuItem, { borderTopWidth: 0 }]}
                  onPress={() => { closeMenu(); onDelete(); }}
                >
                  <Ionicons name="trash-outline" size={18} color={COLORS.accent} />
                  <Text style={[styles.menuText, { color: COLORS.accent }]}>Delete</Text>
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => { closeMenu(); onRepost(); }}
              >
                <Ionicons name="repeat-outline" size={18} color={COLORS.text} />
                <Text style={styles.menuText}>Repost</Text>
              </TouchableOpacity>
            )}
          </View>
        </>
      )}
    </View>
  </View>


        {/* {!!post.authorId && !isSelf ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            {/* Follow pill */}
            {/* <TouchableOpacity
              style={[
                styles.pillBtn,
                post.following ? styles.pillActive : null,
                followBusy ? { opacity: 0.6 } : null,
              ]}
              onPress={onToggleFollow}
              disabled={!!followBusy}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons
                name={post.following ? "checkmark-circle-outline" : "add-circle-outline"}
                size={16}
                color={post.following ? "#fff" : COLORS.icon}
              />
              <TText
                style={[styles.pillTxt, post.following ? { color: "#fff" } : null]}
                allowFontScaling={false}
              >
                {post.following ? "Following" : "Follow"}
              </TText>
            </TouchableOpacity>
          </View>
        ) : null} */} 
      </View>

      {/* Title + Media (tap opens detail) */}
      <TouchableOpacity onPress={onPress} activeOpacity={0.9}>
        <TText style={styles.title}>{post.title}</TText>

        {/* Media Carousel */}
        <View
          style={styles.media}
          onLayout={(e) => setMediaWidth(e.nativeEvent.layout.width)}
        >
          {mediaWidth > 0 && (
            <FlatList
              ref={listRef}
              data={mediaItems}
              keyExtractor={(_, i) => String(i)}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onScroll={onScrollMedia}
              scrollEventThrottle={16}
              initialNumToRender={1}
 maxToRenderPerBatch={1}
 windowSize={2}
 removeClippedSubviews
              renderItem={({ item }) =>
                item.type === "video" ? (
                  <View style={{ width: mediaWidth, height: "100%" }}>
                    <Video
                      source={{ uri: item.uri }}
                      style={StyleSheet.absoluteFill}
                      resizeMode="cover"
                      repeat={false}
                      controls={false}
                      paused={!shouldPlay || !isVideoActive}
                      muted={muted}
                      ignoreSilentSwitch="ignore"
                      playWhenInactive={false}
                      playInBackground={false}
                      poster={post.image}
                      posterResizeMode="cover"
                      bufferConfig={{
                           minBufferMs: 15000,
                             maxBufferMs: 30000,
                             bufferForPlaybackMs: 2500,
                             bufferForPlaybackAfterRebufferMs: 5000,
                           }}
                           progressUpdateInterval={800}
                           maxBitRate={800000}
                      onError={(e) => console.log("video error", e?.nativeEvent)}
                      onEnd={() => {}}
                      {...(Platform.OS === "android" ? { useTextureView: false } : {})}
                    />
                    {/* Small video glyph */}
                    <View style={[styles.multiBadge, { right: 8, top: 8, bottom: undefined }]}>
                      <Ionicons name="videocam-outline" size={14} color="#fff" />
                    </View>

                    {/* Mute / Unmute button */}
                    <TouchableOpacity
                      onPress={() => setMuted((m) => !m)}
                      style={styles.audioBtn}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons
                        name={muted ? "volume-mute-outline" : "volume-high-outline"}
                        size={18}
                        color="#fff"
                      />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={{ width: mediaWidth, height: "100%" }}>
                    <Image source={{ uri: item.uri }} style={StyleSheet.absoluteFill} />
                  </View>
                )
              }
            />
          )}

          {/* Dots indicator */}
          <View style={styles.dotsWrap}>
            {mediaItems.map((_, i) => (
              <View key={i} style={[styles.dot, i === slide && styles.dotActive]} />
            ))}
          </View>
        </View>
      </TouchableOpacity>

      {/* Share whole album (outside nav wrapper to avoid accidental navigation) */}
      <View style={styles.albumShareRow}>
        {/* <TouchableOpacity onPress={shareAlbum} style={styles.albumShareBtn}>
          <Ionicons name="share-social-outline" size={16} color="#fff" />
          <Text style={styles.albumShareTxt}>Share album</Text>
        </TouchableOpacity> */}
        {/* Repost badge (bottom-left of media) */}

      </View>


      {/* Actions row */}
      <View style={[styles.rowBetween, { marginTop: 10 }]}>
        <View className="row" style={styles.row}>
          <TouchableOpacity
            onPress={onToggleLike}
            disabled={liking}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={{ flexDirection: "row", alignItems: "center" }}
          >
            <Ionicons name={heartName} size={20} color={heartColor} />
            <Text style={styles.meta}>&nbsp;{abbreviate(post.likes)}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={onPressCommentIcon}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={{ marginLeft: 20, flexDirection: "row", alignItems: "center" }}
          >
            <Ionicons name="chatbubble-outline" size={20} color={COLORS.icon} />
            <Text style={styles.meta}>&nbsp;{abbreviate(post.comments)}</Text>
          </TouchableOpacity>

          {/* Share current slide */}
          <TouchableOpacity
            onPress={shareCurrent}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={{ marginLeft: 20, flexDirection: "row", alignItems: "center" }}
          >
            <Ionicons name="share-social-outline" size={20} color={COLORS.icon} />
          </TouchableOpacity>
        </View>

        <View style={{ flexDirection: "row", alignItems: "center" }}>
        {post.repostCount > 0 && (
  <View style={{right:10,flexDirection:'row'}}>
    <Ionicons name="repeat-outline" size={16} color="#fff" marginTop={2} />
    <Text style={styles.multiBadgeTxt}>{post.repostCount}</Text>
  </View>
)}
          <TouchableOpacity
            onPress={onToggleSave}
            disabled={saving}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={{ marginRight: 12 }}
          >
            <Ionicons
              name={post.saved ? "bookmark" : "bookmark-outline"}
              size={20}
              color={post.saved ? COLORS.accent : COLORS.icon}
            />
          </TouchableOpacity>
          
          {post.hasVideo ? <Ionicons name="videocam" size={20} color={COLORS.icon} /> : null}
        </View>
      </View>

      {/* {!!post.commentsList.length && (
  <View style={{ marginTop: 10 }}>
    {visibleComments.map((c) => (
      <View key={String(c.ID)} style={{ marginTop: 6 }}>
        <Text style={styles.commentLine}>
          <Text style={styles.commentAuthor}>{c.author}</Text>
          {" "}
          <RenderMentionsClickable
           text={normalizeEmoji(String(c.content || ""))}
            onPressUsername={onMentionPress}
            mentionStyle={styles.mentionLink}
            normalStyle={styles.commentText}
          />
        </Text>
      </View>
    ))}

    {canExpand && !expanded && (
      <TouchableOpacity onPress={() => setExpanded(true)} style={{ marginTop: 6 }}>
        <Text style={styles.viewAll}>View all {post.comments} comments</Text>
      </TouchableOpacity>
    )}
    {canExpand && expanded && (
      <TouchableOpacity onPress={() => setExpanded(false)} style={{ marginTop: 6 }}>
        <Text style={styles.viewAll}>Hide comments</Text>
      </TouchableOpacity>
    )}
  </View>
)} */}
{/* threaded comments */}

{!!threaded.length && (
  <View style={{ marginTop: 10 }}>
    {rootsToRender.map((root) => {
      const isOpen = !!expandedChildren[String(root.ID)];
      const kids = root.children || [];
      const shownKids = isOpen ? kids : kids.slice(0, 1);
      const remaining = Math.max(0, kids.length - shownKids.length);

      return (
        <View key={String(root.ID)} style={{ marginTop: 10 }}>
          {/* Root line (avatar + text + Reply) */}
          <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
            <TouchableOpacity
              style={{ marginRight: 8, marginTop: 2 }}
              onPress={() => nav.navigate("ViewProfileScreen", { NTN_User_PkeyID: root.user_id })}
            >
              <Avatar uri={root.author_profile_image} name={root.author} size={18} />
            </TouchableOpacity>

            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text style={styles.commentLine}>
                <Text style={styles.commentAuthor}>{root.author}</Text>{" "}
                <RenderMentionsClickable
                  text={normalizeEmoji(String(root.content || ""))}
                  onPressUsername={onMentionPress}
                  mentionStyle={styles.mentionLink}
                  normalStyle={styles.commentText}
                />
              </Text>

              <TouchableOpacity onPress={() => onTapReply(root)} style={{  }}>
                <Text allowFontScaling={false} style={{ color: "#7EA1FF", fontSize: 12,lineHeight:20 ,includeFontPadding: true }}>Reply</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Children */}
          {shownKids.map((child) => (
            <View
              key={String(child.ID)}
              style={{
                marginTop: 8,
                marginLeft: 26,
                paddingLeft: 12,
                borderLeftWidth: 1,
                borderLeftColor: COLORS.border,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
                <TouchableOpacity
                  style={{ marginRight: 8, marginTop: 2 }}
                  onPress={() => nav.navigate("ViewProfileScreen", { NTN_User_PkeyID: child.user_id })}
                >
                  <Avatar uri={child.author_profile_image} name={child.author} size={16} />
                </TouchableOpacity>

                <View style={{ flex: 1 }}>
                  <Text style={styles.commentLine}>
                    <Text style={styles.commentAuthor}>{child.author}</Text>{" "}
                    <RenderMentionsClickable
                      text={normalizeEmoji(String(child.content || ""))}
                      onPressUsername={onMentionPress}
                      mentionStyle={styles.mentionLink}
                      normalStyle={styles.commentText}
                    />
                  </Text>
{/* {root.user_id===userprofile?.Id && */}
                  <TouchableOpacity onPress={() => onTapReply(child)} style={{ }}>
                    <Text style={{ color: COLORS.sub, fontSize: 12, }}>Reply</Text>
                  </TouchableOpacity>
    {/* } */}
                </View>
              </View>
            </View>
          ))}

          {/* Per-root expand/collapse for children */}
          {kids.length > 2 && (
            <TouchableOpacity onPress={() => toggleChildren(String(root.ID))} style={{ marginTop: 6, marginLeft: 26 }}>
              <Text style={styles.viewAll}>
                {isOpen ? "Hide replies" : `View ${remaining} more repl${remaining === 1 ? "y" : "ies"}`}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      );
    })}

    {/* overall expand/collapse for roots (your existing controls) */}
    {canExpand && !expanded && (
      <TouchableOpacity onPress={() => setExpanded(true)} style={{ marginTop: 6 }}>
        <Text style={styles.viewAll}>View all {totalCommentsFromApi} comments</Text>
      </TouchableOpacity>
    )}
    {canExpand && expanded && (
      <TouchableOpacity onPress={() => setExpanded(false)} style={{ marginTop: 6 }}>
        <Text style={styles.viewAll}>Hide comments</Text>
      </TouchableOpacity>
    )}
  </View>
)}











      {/* Comment input */}
      {showBox && (
  <View style={styles.commentRow}>
    <TextInput
      ref={inputRef}
      value={commentDraft}
      onChangeText={handleDraftChange}
      placeholder="Add a comment…"
      placeholderTextColor={COLORS.sub}
      style={styles.commentInput}
      editable={!commenting}
      returnKeyType="send"
      blurOnSubmit={false}
      onFocus={scrollInputIntoView} 
      onSubmitEditing={handleSend}   />
 
<TouchableOpacity onPress={handleSend} disabled={commenting || !commentDraft.trim()} style={styles.sendBtn}>
  {commenting ? (
    <ActivityIndicator size="small" />
  ) : (
    <Ionicons name="send" size={18} color={commentDraft.trim() ? COLORS.text : COLORS.sub}/>
  )}
</TouchableOpacity>


    {mentionOpen && (
      <View style={styles.mentionBox}>
        {mentionLoading ? (
          <Text style={styles.mentionHint}>Searching…</Text>
        ) : mentionList.length === 0 ? (
          <Text style={styles.mentionHint}>
            {mentionQuery ? `No users for “${mentionQuery}”` : "Type after @ to search"}
          </Text>
        ) : (
          <FlatList
            keyboardShouldPersistTaps="always"
            data={mentionList}
            keyExtractor={(u) => u.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.mentionRow}
                onPress={() => insertMention(item)}
              >
                 <Avatar
    uri={item.avatar}
    name={item.username || item.name}
    size={20}
    border
  />
                {/* <Image
                  source={{ uri: item.avatar || AVATAR_PLACEHOLDER }}
                  style={styles.mentionAvatar}
                /> */}
                <View style={{ flex: 1 }}>
                  <Text style={styles.mentionName}>{item.name}</Text>
                  <Text style={styles.mentionUser}>@{item.username}</Text>
                </View>
              </TouchableOpacity>
            )}
            style={{ maxHeight: 160 }}
          />
        )}
      </View>
    )}
  </View>
)}

    </View>
  );
}

/* --------------------- Mapping from API ---------------------- */
function mapApiPostToCard(p: ApiPost, meId?: string | number): PostCardModel {
  const id = String(p.ID);
  const title = p.title || "Untitled";
  const author = p.author || "—";
  const avatar = p.author_profile_image || AVATAR_PLACEHOLDER;

  const imagesArr = parseCsvImages(p.fields?.images);
  const firstImage = imagesArr[0];
  const image =
    firstImage ||
    "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=1400&auto=format&fit=crop";

  const hasVideo = !!(p.fields?.video && p.fields.video.trim().length);
  const timeAgo = toTimeAgo(p.date);

  const likes = parseLikes(p.fields?._likes ?? 0);
  const commentsArr = Array.isArray(p.comments) ? p.comments : [];
  function parseCsvTags(csv?: string): string[] {
    if (!csv) return [];
    return csv
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
//   const repostCount =
//   typeof p.repost_count === "number"
//     ? p.repost_count
//     : parseInt(String(p.fields?.repost_count ?? 0), 10) || 0;

// // 👇 did *I* repost this?
// const isRepostedByMe =
//   isTrueish((p as any).is_reposted_by_user) ||
//   (p.fields?.reposted_by_users &&
//     String((p.fields.reposted_by_users as any).ID ?? "") === String(meId));
const rb: any = (p as any)?.fields?.reposted_by_users || (p as any)?.reposted_by_users || null;
  const repostedById   = rb?.ID ? String(rb.ID) : undefined;
  const repostedByName =
    rb?.display_name || rb?.user_nicename || rb?.nickname || rb?.user_firstname || undefined;

    const toInt = (v: any) => {
      const n = typeof v === "number" ? v : parseInt(String(v ?? 0), 10);
      return Number.isFinite(n) ? n : 0;
    };
    
    const repostCount =
      (p as any).repost_count != null
        ? toInt((p as any).repost_count)
        : toInt(p?.fields?.repost_count);
    
  const isRepostedByMe =
    isTrueish((p as any).is_reposted_by_user) ||
    (repostedById && String(repostedById) === String(meId));

  const isRepostCard =
    !!repostedById || isTrueish((p as any).is_repost) || isTrueish((p as any)?.fields?.is_repost);

  const tags = parseCsvTags(p.fields?.tag_people);
  const likedUsers = normalizeLikedUsers(p.fields?._liked_users);
  const liked =
    isTrueish((p as any).liked_by_user) ||
    (meId != null && likedUsers.includes(String(meId)));

  const areFriends =
    typeof p.fields?.are_friends === "boolean"
      ? p.fields.are_friends
      : typeof p.are_friends === "boolean"
      ? p.are_friends
      : false;

  const following =
    isTrueish((p as any).is_followed) || isTrueish(p.fields?.is_followed);

  const saved =
    isTrueish((p as any).is_saved) || isTrueish(p.fields?.is_saved);

  return {
    id,
    author,
    authorId: p.author_id ? String(p.author_id) : undefined,
    areFriends,
    following,
    avatar,
    title,
    timeAgo,
    image,
    images: imagesArr,
    likes,
    comments: commentsArr.length,
    commentsList: commentsArr,
    hasVideo,
    videoUrl: hasVideo ? p.fields!.video!.trim() : undefined,
    imagesCount: imagesArr.length,
    event: p.fields?.event,
    location: p.fields?.location,
    rawDate: p.date,
    liked,
    saved,
    tags, 
    repostCount,
    isRepostedByMe,
    isRepostCard,
    repostedById,
    repostedByName,
    repostedAt: p.date,
  };
}

/* ----------------------------- Styles ---------------------------- */
const styles = StyleSheet.create({
  topbar: {
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 10,
    backgroundColor: COLORS.surface,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomColor: COLORS.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  brandRow: { flexDirection: "row", alignItems: "center" },
  logo: { width: 140, height: 32 },
  topActions: { flexDirection: "row", alignItems: "center" },
  iconBtn: { padding: 8, marginRight: 4 },
  avatarWrap: {
    width: 20,
    height: 20,
    // borderRadius: 15,
    // borderColor:"white",
    // borderWidth:1,
    overflow: "hidden",
    // marginLeft: 6,
  },
  avatar: { width: "100%", height: "100%" },

  /* Search drawer */
  searchDrawer: {
    backgroundColor: COLORS.surface,
    overflow: "hidden",
    borderBottomColor: COLORS.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    height: 44,
    gap: 8,
  },
  searchWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0E1015",
    borderColor: COLORS.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    height: 36,
  },
  searchInput: { flex: 1, color: COLORS.text, paddingRight: 8, fontSize: 14 },
  cancelBtn: { paddingVertical: 6, paddingHorizontal: 6 },
  cancelTxt: { color: COLORS.accent, fontWeight: "700" },

  /* Tabs */
  tabsWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderBottomColor: COLORS.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    position: "relative",
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  tabLabel: { color: COLORS.text, fontSize: 10, fontWeight: "700" },
  tabIndicator: {
    position: "absolute",
    bottom: 0,
    height: 2,
    backgroundColor: COLORS.accent,
    borderRadius: 2,
    width: 0,
  },

  /* Cards */
  card: {
    backgroundColor: COLORS.card,
    marginHorizontal: 12,
    marginTop: 12,
    padding: 12,
    borderRadius: 14,
    borderColor: COLORS.border,
    borderWidth: StyleSheet.hairlineWidth,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  repostBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 10,
  },
  repostBannerText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: "700",
  },
  
  postAvatar: {
    width: 36,
    height: 36,
    // borderRadius: 18,
    borderColor:"white",borderWidth:1,
    marginRight: 8,
    backgroundColor: "#0A0B0E",
  },
  author: { color: COLORS.text, fontWeight: "700" },
  time: { color: COLORS.sub, marginTop: 2, fontSize: 12 },
  title: { color: COLORS.text, fontSize: 16, fontWeight: "600", marginVertical: 10 },
  menuBackdrop: {
    ...StyleSheet.absoluteFillObject,
    // ensure it covers the card to capture outside taps
    // parent card is position: 'relative' by default; backdrop sits above
  },
  menu: {
    position: "absolute",
    top: 28,           // just below the 3-dot icon
    right: 0,
    backgroundColor: COLORS.card,
    borderColor: COLORS.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    minWidth: 150,
    paddingVertical: 6,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
    zIndex: 100,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopColor: COLORS.border,
  },
  menuText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "600",
  },
  
  // Rounded media container for image/video carousel
  media: {
    width: "100%",
    height: 240,
    borderRadius: 12,
    backgroundColor: "#0A0B0E",
    overflow: "hidden",
  },

  meta: { color: COLORS.text, marginLeft: 6, fontWeight: "600" },
  sep: { height: 12 },

  /* Follow pill */
  pillBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.pillBorder,
    backgroundColor: COLORS.pillBg,
  },
  pillActive: {
    borderColor: COLORS.accent,
    backgroundColor: "transparent",
  },
  pillTxt: { color: COLORS.text, fontWeight: "700", fontSize: 12 },

  /* Comments */
  cAvatar: { width: 16, height: 16, marginRight: 8, backgroundColor: COLORS.card ,borderColor:"white",borderWidth:1},
 
  commentLine: { color: COLORS.text, fontSize: 14 },
  commentAuthor: { color: COLORS.text, fontWeight: "700" ,marginLeft:20},
  commentText: { color: COLORS.text ,marginLeft:10 ,includeFontPadding: true},
  mentionLink: {
    color: 'grey',
    fontWeight: "700",
    // subtle pill highlight to match your theme:
    // backgroundColor: "rgba(229,57,53,0.16)",
    paddingHorizontal: 4,
    borderRadius: 6,
  },
  
  viewAll: { color: COLORS.sub, fontSize: 13 },
  mentionChip: {
    color: "pink",
    // backgroundColor: "rgba(229, 57, 53, 0.18)", // soft accent bg
    paddingHorizontal: 4,
    borderRadius: 6,
    overflow: "hidden",
  },
  
  commentRow: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0E1015",
    borderColor: COLORS.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingLeft: 12,
  },
  commentInput: {
    flex: 1,
    height: 50,
    color: COLORS.text,
    fontSize: 14,
    paddingRight: 8,
  },
  sendBtn: { paddingHorizontal: 10, paddingVertical: 8 },

  /* Badges & Dots */
  multiBadge: {
    position: "absolute",
    right: 8,
    bottom: 8,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  multiBadgeTxt: { color: "#fff", fontWeight: "700", fontSize: 12 },

  dotsWrap: {
    position: "absolute",
    bottom: 8,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.35)",
  },
  dotActive: {
    backgroundColor: "#fff",
  },

  // audio button
  audioBtn: {
    position: "absolute",
    right: 8,
    bottom: 8,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 14,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },

  // share album
  albumShareRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 8,
  },
  albumShareBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  albumShareTxt: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 12,
  },
  mentionBox: {
    position: "absolute",
    left: 8,
    right: 8,
    bottom: 48,
    backgroundColor: "#0E1015",
    borderColor: COLORS.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingVertical: 6,
    zIndex: 50,
  },
  mentionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 8,
  },
  mentionAvatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: "#0A0B0E" },
  mentionName: { color: COLORS.text, fontSize: 13, fontWeight: "700" },
  mentionUser: { color: COLORS.sub, fontSize: 12, marginTop: 2 },
  mentionHint: { color: COLORS.sub, fontSize: 12, padding: 10, textAlign: "center" },
  badge: {
    position: "absolute",
    top: -2,
    right: -2,
    minWidth: 16,
    height: 16,
    // borderColor:"white",borderWidth:1,
    backgroundColor: "#EF2C2C",
    paddingHorizontal: 3,
    alignItems: "center",
    justifyContent: "center",
    borderRadius:10
  
  },
  badgeTxt: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
  },
  replyChip: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "#0E1015",
    borderColor: COLORS.border,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 8,
  },
  replyChipTxt: { color: COLORS.sub, marginRight: 6, fontSize: 12 },
  
  
});
{!!threaded.length && (
  <View style={{ marginTop: 10 }}>
    {rootsToRender.map((root) => {
      const isOpen = !!expandedChildren[String(root.ID)];
      const kids = root.children || [];
      const shownKids = isOpen ? kids : kids.slice(0, 1);
      const remaining = Math.max(0, kids.length - shownKids.length);
      return (
        <View key={String(root.ID)} style={{ marginTop: 10 }}>
          <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
            <TouchableOpacity
              style={{ marginRight: 8, marginTop: 2 }}
              onPress={() => nav.navigate("ViewProfileScreen", { NTN_User_PkeyID: root.user_id })}
            >
              <Avatar uri={root.author_profile_image} name={root.author} size={18} />
            </TouchableOpacity>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text style={styles.commentLine}>
                <Text style={styles.commentAuthor}>{root.author}</Text>{" "}
                <RenderMentionsClickable
                  text={normalizeEmoji(String(root.content || ""))}
                  onPressUsername={onMentionPress}
                  mentionStyle={styles.mentionLink}
                  normalStyle={styles.commentText}
                />
              </Text>
              {/* <TouchableOpacity onPress={() => onTapReply(root)}>
                <Text allowFontScaling={false} style={{ color: "#7EA1FF", fontSize: 12, lineHeight: 20, includeFontPadding: true }}>
                  Reply
                </Text>
              </TouchableOpacity> */}
            </View>
          </View>
          {shownKids.map((child) => (
            <View
              key={String(child.ID)}
              style={{
                marginTop: 8,
                marginLeft: 26,
                paddingLeft: 12,
                borderLeftWidth: 1,
                borderLeftColor: COLORS.border,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
                <TouchableOpacity
                  style={{ marginRight: 8, marginTop: 2 }}
                  onPress={() => nav.navigate("ViewProfileScreen", { NTN_User_PkeyID: child.user_id })}
                >
                  <Avatar uri={child.author_profile_image} name={child.author} size={16} />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                  <Text style={styles.commentLine}>
                    <Text style={styles.commentAuthor}>{child.author}</Text>{" "}
                    <RenderMentionsClickable
                      text={normalizeEmoji(String(child.content || ""))}
                      onPressUsername={onMentionPress}
                      mentionStyle={styles.mentionLink}
                      normalStyle={styles.commentText}
                    />
                  </Text>
                  {/* <TouchableOpacity onPress={() => onTapReply(child)}>
                    <Text style={{ color: COLORS.sub, fontSize: 12 }}>Reply</Text>
                  </TouchableOpacity> */}
                </View>
              </View>
            </View>
          ))}
          {kids.length > 2 && (
            <TouchableOpacity onPress={() => toggleChildren(String(root.ID))} style={{ marginTop: 6, marginLeft: 26 }}>
              <Text style={styles.viewAll}>{isOpen ? "Hide replies" : `View ${remaining} more repl${remaining === 1 ? "y" : "ies"}`}</Text>
            </TouchableOpacity>
          )}
        </View>
      );
    })}
    {canExpand && !expanded && (
      <TouchableOpacity onPress={() => setExpanded(true)} style={{ marginTop: 6 }}>
        <Text style={styles.viewAll}>View all {totalCommentsFromApi} comments</Text>
      </TouchableOpacity>
    )}
    {canExpand && expanded && (
      <TouchableOpacity onPress={() => setExpanded(false)} style={{ marginTop: 6 }}>
        <Text style={styles.viewAll}>Hide comments</Text>
      </TouchableOpacity>
    )}
  </View>
)}