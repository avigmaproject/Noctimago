// src/screens/Home/HomeScreen.tsx
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
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
import { findNodeHandle } from "react-native";
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
import mobileAds, { MaxAdContentRating } from "react-native-google-mobile-ads";
import {
  BannerAd,
  BannerAdSize,
  InterstitialAd,
  AdEventType,
  TestIds
} from "react-native-google-mobile-ads";



import CommentsModal from "../../components/CommentsModal";

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

type ApiComment = {
  ID: string | number;
  content: string;
  date: string;
  isPending?: boolean;
  parent_id?: string | number;
  author?: string;
  user_id?: string | number;
  author_profile_image?: string;
  is_liked?: boolean;
  like_count?: number;
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
    event_description?: string;     
    tag_people?: string | ApiTagPerson[] | false; 
    location?: string;
    images?: string;
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
    isPending: true;
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
  description?: string; 
  following?: boolean;
  avatar: string;
  title: string;
  timeAgo: string;
  image: string;
  images: string[];
  likes: number;
  comments: number;
  commentsList: ApiComment[];
  hasVideo: boolean;
  videoUrl?: string;  
  videoUrls?: string[];
  imagesCount: number;
  event?: string;
  location?: string;
  rawDate?: string;
  liked?: boolean;
  saved?: boolean;
  tags?: string[];
  repostCount: number;
  isRepostedByMe: boolean;
  isRepostCard: boolean;
  repostedById?: string;
  repostedByName?: string;
  repostedAt?: string;
};

type TaggedUser = { id: string; username: string };

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

function parseSqlAsUTC(sql?: string): Date | null {
  if (!sql) return null;
  const hasTZ = /[zZ]|[+-]\d{2}:?\d{2}$/.test(sql);
  if (hasTZ) return new Date(sql.replace(" ", "T"));
  const m = sql.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/);
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
const usernameIdCache: Record<string, string> = {};

async function resolveUserIdByUsername(username: string, token?: string): Promise<string | null> {
  const key = username.toLowerCase();
  if (usernameIdCache[key]) return usernameIdCache[key];
  try {
    const url = `https://noctimago.com/wp-json/app/v1/users?page=1&search=${encodeURIComponent(username)}`;
    const res = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (!res.ok) return null;
    const json = await res.json();
    const list = mapUsersPayload(json);
    const exact = list.find((u) => u.username.toLowerCase() === key && u.allowTag);
    const found = exact || list.find((u) => u.allowTag);
    if (found?.id) {
      usernameIdCache[key] = found.id;
      return found.id;
    }
  } catch {}
  return null;
}

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
  console.log("token",token)
  const url = `https://noctimago.com/wp-json/app/v1/like_comment/${commentId}`;
  const res = await fetch(url, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  const text = await res.text();
  console.log("[likeCommentApi]", { url, status: res.status, ok: res.ok, body: text?.slice(0, 400) });

  let json: any = null; try { json = JSON.parse(text); } catch {}
  if (!res.ok) {
    const msg = json?.message || text || `HTTP ${res.status}`;
    const err: any = new Error(msg);
    err.status = res.status; err.body = text;
    throw err;
  }
  return json ?? { ok: true };
}

async function unlikeCommentApi(commentId: string, token?: string) {
  const url = `https://noctimago.com/wp-json/app/v1/unlike_comment/${commentId}`;
  const res = await fetch(url, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  const text = await res.text();
  console.log("[unlikeCommentApi]", { url, status: res.status, ok: res.ok, body: text?.slice(0, 400) });

  let json: any = null; try { json = JSON.parse(text); } catch {}
  if (!res.ok) {
    const msg = json?.message || text || `HTTP ${res.status}`;
    const err: any = new Error(msg);
    err.status = res.status; err.body = text;
    throw err;
  }
  return json ?? { ok: true };
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
let lastShownAt = 0;

function canShowInterstitialNow(minGapMs = 5 * 60 * 1000) {
  const now = Date.now();
  return now - lastShownAt > minGapMs;
}

function markInterstitialShown() {
  lastShownAt = Date.now();
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
  console.log("reposted",res)
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
      list = list.filter(
        (u) =>
          u.allowTag &&
          (!meId || u.id !== String(meId)) &&
          (u.username.toLowerCase().includes(q) || u.name.toLowerCase().includes(q))
      );
      return list.slice(0, 20);
    }
  } catch {}
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
export async function updateCommentApi(commentId: string, text: string, token?: string) {
  const res = await fetch(`https://noctimago.com/wp-json/app/v1/edit_comment/${commentId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ comment: text }),
  });
  if (!res.ok) {
    let msg = "HTTP " + res.status;
    try { const j = await res.json(); msg = j?.message || msg; } catch {}
    throw new Error(msg);
  }
  return res.json().catch(() => ({}));
}

export async function deleteCommentApi(commentId: string, token?: string) {
  const res = await fetch(`https://noctimago.com/wp-json/app/v1/delete_comment/${commentId}`, {
    method: "DELETE",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!res.ok) {
    let msg = "HTTP " + res.status;
    try { const j = await res.json(); msg = j?.message || msg; } catch {}
    throw new Error(msg);
  }
  return res.json().catch(() => ({}));
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
  list.forEach((c) => {
    byId.set(String(c.ID), { ...c, children: [] });
  });
  list.forEach((c) => {
    const pid = getParentId(c);
    const node = byId.get(String(c.ID))!;
    if (pid && byId.has(pid)) {
      byId.get(pid)!.children.push(node);
    } else {
      roots.push(node);
    }
  });
  const sortTree = (arr: CommentNode[]) => {
    arr.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    arr.forEach((n) => sortTree(n.children));
  };
  sortTree(roots);
  return roots;
}

export default function HomeScreen({ navigation }: any) {
  const dispatch = useDispatch();
  const token = useSelector((state: any) => state.authReducer.token);
  const userprofile = useSelector((state: any) => state.authReducer.userprofile);
  const isFocused = useIsFocused();
  const feedRef = useRef<FlatList<PostCardModel>>(null);
  const [refreshing, setRefreshing] = useState(false);
  const feedNodeRef = useRef<number | null>(null);
// top-level state
const getAllPostInFlight = useRef(false);
const [loadingPosts, setLoadingPosts] = useState(true);      // replaces initialLoading for feed
const [hasLoadedOnce, setHasLoadedOnce] = useState(false);   // prevents "No posts yet" on first paint

  useEffect(() => {
    feedNodeRef.current = findNodeHandle(feedRef.current) as number | null;
  }, []);
  const [showBanner, setShowBanner] = useState(true);
  useEffect(() => {
    mobileAds()
      .setRequestConfiguration({
        maxAdContentRating: MaxAdContentRating.PG,
        tagForChildDirectedTreatment: false,
      })
      .then(() => mobileAds().initialize())
      .then(() => console.log("AdMob initialized"));
  }, []);
  
  

  const scrollListToY = useCallback((absY: number) => {
    const cushion = Platform.select({ ios: 90, android: 110 })!;
    const offset = Math.max(0, absY - cushion);
    feedRef.current?.scrollToOffset({ offset, animated: true });
  }, []);

  const [active, setActive] = useState<(typeof FILTERS)[number]["key"]>("all");
  const [posts, setPosts] = useState<PostCardModel[]>([]);
  const [rawPosts, setRawPosts] = useState<ApiPost[]>([]);
  const [nearbyPosts, setNearbyPosts] = useState<PostCardModel[]>([]);
  const [rawNearby, setRawNearby] = useState<ApiPost[]>([]);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [nearbyErr, setNearbyErr] = useState<string | null>(null);
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const indicatorX = useRef(new Animated.Value(0)).current;
  const [tabsWidth, setTabsWidth] = useState(0);
  const tabWidth = tabsWidth > 0 ? tabsWidth / FILTERS.length : 0;
  const activeIndex = FILTERS.findIndex((f) => f.key === active);
  const bannerAdId = __DEV__ ? TestIds.BANNER : "ca-app-pub-2847186072494111/8751364810";

const INTERSTITIAL_UNIT_ID = __DEV__
  ? TestIds.INTERSTITIAL
  : "ca-app-pub-2847186072494111/8751364810"; // your real id

const interstitialRef = useRef<InterstitialAd | null>(null);
const [interstitialLoaded, setInterstitialLoaded] = useState(false);
const wantsToShowRef = useRef(false);
useEffect(() => {
  console.log("[Ad] Home: creating interstitial for", INTERSTITIAL_UNIT_ID);

  const ad = InterstitialAd.createForAdRequest(INTERSTITIAL_UNIT_ID, {
    requestNonPersonalizedAdsOnly: false,
  });

  interstitialRef.current = ad;

  // 🔹 LOADED
  const unsubLoaded = ad.addAdEventListener(AdEventType.LOADED, () => {
    console.log("[Ad][Home] LOADED");
    setInterstitialLoaded(true);

    if (wantsToShowRef.current) {
      wantsToShowRef.current = false;
      ad.show();
      setInterstitialLoaded(false);
    }
  });

  // 🔹 ERROR
  const unsubError = ad.addAdEventListener(AdEventType.ERROR, (error) => {
    console.log("[Ad][Home] ERROR", error?.message);
    setInterstitialLoaded(false);
  });

  // 🔹 CLOSED
  const unsubClosed = ad.addAdEventListener(AdEventType.CLOSED, () => {
    console.log("[Ad][Home] CLOSED -> reload");
    setInterstitialLoaded(false);
    ad.load();
  });

  ad.load();

  return () => {
    console.log("[Ad][Home] cleanup");
    unsubLoaded();
    unsubError();
    unsubClosed();
  };
}, []);



  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [fcmToken, setFcmToken] = useState("");
  const [commentsByPost, setCommentsByPost] = useState<Record<string, { total: number; list: ApiComment[] }>>({});
  const [commentsLoading, setCommentsLoading] = useState<Record<string, boolean>>({});

  const loadCommentsForPost = useCallback(
    async (postId: string) => {
      if (commentsLoading[postId]) return;
      setCommentsLoading((m) => ({ ...m, [postId]: true }));
      try {
        const { total, comments } = await fetchPostComments(postId, token);
        setCommentsByPost((m) => ({ ...m, [postId]: { total, list: comments } }));
      } catch {
        setCommentsByPost((m) => ({ ...m, [postId]: { total: 0, list: [] } }));
      } finally {
        setCommentsLoading((m) => ({ ...m, [postId]: false }));
      }
    },
    [token, commentsLoading]
  );
  const [commentLikeBusy, setCommentLikeBusy] = useState<Set<string>>(new Set());

  // const [commentLikeBusy, setCommentLikeBusy] = useState<Set<string>>(new Set());

  const toggleCommentLike = useCallback(
    async (postId: string, commentId: string) => {
  
      if (!token) {
        Alert.alert("Sign in required", "You need to log in to like comments.");
        return false;
      }
  
      const key = `${postId}:${commentId}`;
      if (commentLikeBusy.has(key)) return false;
  
      setCommentLikeBusy(prev => new Set(prev).add(key));
  
      // Get before-state for accuracy
      const entry = commentsByPost[postId];
      if (!entry) return false;
      const current = entry.list.find(c => String(c.ID) === String(commentId));
      if (!current) return false;
  
      const wasLikedBefore = !!current.is_liked;
  
      // ---- 1) OPTIMISTIC UPDATE (instant UI) ----
      setCommentsByPost(prev => {
        const e = prev[postId]; if (!e) return prev;
        const list = e.list.map(c =>
          String(c.ID) === String(commentId)
            ? {
                ...c,
                is_liked: !wasLikedBefore,
                like_count: wasLikedBefore
                  ? Math.max(0, (c.like_count ?? 0) - 1)
                  : (c.like_count ?? 0) + 1
              }
            : c
        );
        return { ...prev, [postId]: { ...e, list } };
      });
  
      try {
        // ---- 2) SERVER CALL ----
        if (wasLikedBefore) {
          await unlikeCommentApi(commentId, token);
        } else {
          await likeCommentApi(commentId, token);
  
          // 🔔 Notify comment author
        const targetId = current.user_id; // set in fetchPostComments()
        const me = String(userprofile?.ID ?? "");

        if (targetId && String(targetId) !== me) {
          const title = "New like on your comment";
          const message = `${
            userprofile?.username || userprofile?.display_name || "Someone"
          } liked your comment`;
          SendNotification(message, title, String(targetId), 1, Number(postId));
        }
      
        }
  
        // ❌ DO NOT RELOAD COMMENTS HERE — that causes flicker  
        // await loadComments();   <-- REMOVE THIS
  
        return true;
      } catch (err) {
        console.log("[toggleCommentLike] API failed, rolling back...");
  
        // ---- 3) ROLLBACK ON FAILURE ----
        setCommentsByPost(prev => {
          const e = prev[postId]; if (!e) return prev;
          const list = e.list.map(c =>
            String(c.ID) === String(commentId)
              ? {
                  ...c,
                  is_liked: wasLikedBefore,
                  like_count: wasLikedBefore
                    ? (c.like_count ?? 0)
                    : Math.max(0, (c.like_count ?? 0) - 1)
                }
              : c
          );
          return { ...prev, [postId]: { ...e, list } };
        });
  
        Alert.alert("Oops", "Could not update like on comment.");
        return false;
      } finally {
        setCommentLikeBusy(prev => {
          const setCopy = new Set(prev);
          setCopy.delete(key);
          return setCopy;
        });
      }
    },
    [token, commentsByPost, setCommentsByPost, commentLikeBusy]
  );
  
  
  
  
  
  useEffect(() => {
    const parent = navigation.getParent?.();
    if (!parent) return;
    const unsub = parent.addListener("tabPress", () => {
      if (navigation.isFocused()) {
        feedRef.current?.scrollToOffset({ offset: 0, animated: true });
        setTimeout(() => {
          GetAllPost();
          refresh();
        }, 150);
      }
    });
    return unsub;
  }, [navigation]);

  useEffect(() => {
    if (!posts.length) return;
    posts.forEach((p) => loadCommentsForPost(p.id));
  }, [posts, token, loadCommentsForPost]);

  useEffect(() => {
    (async () => {
      const authStatus = await requestUserPermission();
      if (authStatus) {
        const fcmtoken = await getFcmToken();
        if (fcmtoken) {
          setFcmToken(fcmtoken);
        } else {
          Alert.alert("Please enable notifications to receive time-critical updates");
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
      fetchNotifications();
      interval = setInterval(fetchNotifications, 10000);
      return () => {
        if (interval) clearInterval(interval);
      };
    }, [fetchNotifications])
  );
  useFocusEffect(React.useCallback(() => { setNotifCount((c) => c); }, []));

  useFocusEffect(
    React.useCallback(() => {
      GetAllPost();
      setCommentsByPost({});
      posts.forEach((p) => loadCommentsForPost(p.id));
      return undefined;
    }, [token])
  );



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
  
  const GetUserHome = async () => {
    try {
      const res = await profile(token);
      dispatch(UserProfile(res.profile));
    } catch (error) {
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
      if (!rc || me === rc) {
        return;
      }
      const payload = JSON.stringify({
        UserToken: fcmToken,
        message,
        msgtitle: title,
        User_PkeyID: userprofile?.ID,
        UserID: rc,
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
    }
  };

  const GetAllPost = useCallback(async () => {
    if (getAllPostInFlight.current) return;        // avoid racing fetches
    getAllPostInFlight.current = true;
    setLoadingPosts(true);
  
    try {
      const res = await getallpost(token);
      const apiPosts: ApiPost[] = res?.posts ?? [];
      const mapped = apiPosts.map((p) => mapApiPostToCard(p, userprofile?.ID));
      setRawPosts(apiPosts);
      setPosts(mapped);
  
      // kick comment loads after posts are set (no forEach on stale state)
      mapped.forEach((p) => loadCommentsForPost(p.id));
  
      setHasLoadedOnce(true);
    } catch (error) {
      console.log("GetAllPost error:", error);
    } finally {
      getAllPostInFlight.current = false;
      // tiny delay smooths out ultra-fast flicker on some devices
      setTimeout(() => setLoadingPosts(false), 120);
    }
  }, [token, userprofile?.ID, loadCommentsForPost]);
  
  
  // top-level state

  useEffect(() => {
    if (!isFocused) return;
  
    // When Home gains focus (e.g. coming back from EditProfile)
    GetUserHome();       // refresh userprofile (avatar, name etc.)
    GetAllPost();        // refresh feed
    fetchNotifications(); // refresh notification badge
  }, [isFocused]);  // 👈 only depends on focus
  
// run once when screen mounts
useEffect(() => {
  (async () => {
    await GetUserHome();
    await GetAllPost();
    if (active === "location") await loadNearbyPosts();
  })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);

const refresh = async () => {
  if (refreshing) return;
  setRefreshing(true);
  try {
    await GetUserHome();
    if (active === "location") await loadNearbyPosts();
    else await GetAllPost();
  } finally {
    setRefreshing(false);
  }
};


  useEffect(() => {
    Animated.spring(indicatorX, {
      toValue: activeIndex * tabWidth,
      useNativeDriver: true,
      bounciness: 6,
      speed: 12,
    }).start();
  }, [activeIndex, tabWidth, indicatorX]);

  useEffect(() => () => setPlayMap({}), []);

  const onTabsLayout = (e: LayoutChangeEvent) => {
    setTabsWidth(e.nativeEvent.layout.width);
  };

  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const searchAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (searchOpen) setPlayMap({});
  }, [searchOpen]);

  const openSearch = () => {
    setSearchOpen(true);
    Animated.timing(searchAnim, {
      toValue: 1,
      duration: 180,
      useNativeDriver: false,
    }).start();
  };
  const safeShowInterstitial = () => {
    if (!canShowInterstitialNow()) {
      console.log("[Ad][Home] skipped due to cooldown");
      return;
    }
  
    const ad = interstitialRef.current;
    if (ad && interstitialLoaded) {
      ad.show();
      markInterstitialShown();
      setInterstitialLoaded(false);
    } else {
      wantsToShowRef.current = true;
      // when LOADED, we show & mark there
    }
  };
  
  
  const openChat = () => {
    // 🔹 optionally show interstitial before navigation
     safeShowInterstitial(); // uncomment if you want this
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
      if (post.authorId && String(post.authorId) === String(userprofile?.ID)) {
        Alert.alert("Not allowed", "You cannot repost your own post.");
        return;
      }
      try {
        await repostApi(post.id, token);
        if (post.authorId && String(post.authorId) !== String(userprofile?.ID)) {
          const title = "Repost";
          const message = `${userprofile?.username || "Someone"} reposted your post`;
          SendNotification(message, title, String(post.authorId), 1, Number(post.id));
        }
        await GetAllPost();
        Alert.alert("Done", "Post reposted to your feed.");
      } catch (e: any) {
        Alert.alert("Repost failed", e?.message || "Please try again.");
      }
    } catch (e: any) {
      Alert.alert("Repost failed", e?.message || "Please try again.");
    }
  };

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
              await GetAllPost();
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
    console.log("post",post)

    navigation.navigate("EditPostScreen", {
      postId: post.id,
      initial: {
        title: post.title || "",
        event: post.event || "",
        event_description: post?.description || "",  // 👈 IMPORTANT
        tag_people: post?.tags
        || [],
        location: post.location || "",
        images: post.images?.length ? post.images : post.image ? [post.image] : [],
        video: post.hasVideo ? post.videoUrls || "" : "",
      },
    });
  };

  const onDeletePost = (post: PostCardModel) => {
    Alert.alert("Delete post?", "Do you want to delete this post?.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deletePostApi(post.id, token);
            setPosts((prev) => prev.filter((p) => p.id !== post.id));
            setNearbyPosts((prev) => prev.filter((p) => p.id !== post.id));
            Alert.alert("Deleted", "Your post has been removed.");
          } catch (e: any) {
            Alert.alert("Delete failed", e?.message || "Please try again.");
          }
        },
      },
    ]);
  };

  type Coords = { latitude: number; longitude: number };

  async function requestLocationPermission(): Promise<boolean> {
    if (Platform.OS === "android") {
      const fine = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION, {
        title: "Location Permission",
        message: "We use your location to find nearby posts.",
        buttonPositive: "OK",
      });
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
      setNearbyErr(e?.message?.toLowerCase().includes("denied") ? "Location not allowed. Enable it to see nearby posts." : "Could not load nearby posts.");
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
      const okIds = new Set(raw.filter((p) => matchesTokens(p, tokens)).map((p) => String(p.ID)));
      base = base.filter((p) => okIds.has(p.id));
    }
    return base;
  }, [posts, nearbyPosts, active, query, rawPosts, rawNearby, selectedDate]);

  const openDetails = (id: string) => {
    navigation.navigate("PostDetailScreen", { postId: id, token });
  };

  const [likingIds, setLikingIds] = useState<Set<string>>(new Set());
// ⬆️ top-level in component state

// ⬇️ replace your toggleCommentLike with this guarded version
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


  const [commentingIds, setCommentingIds] = useState<Set<string>>(new Set());
  const setDraftFor = (postId: string, val: string) => setCommentDrafts((prev) => ({ ...prev, [postId]: val }));
  const meId = String(userprofile?.ID ?? "");
  useFocusEffect(
    React.useCallback(() => {
      // 👇 make sure list jumps to top whenever Home gets focus
      setTimeout(() => {
        feedRef.current?.scrollToOffset({ offset: 0, animated: false });
      }, 0);
  
      // When Home tab gains focus, reload feed & comments
      GetUserHome();
      GetAllPost();
      fetchNotifications();
  
      setCommentsByPost({});
      posts.forEach((p) => fetchPostComments(p.id));
  
      return undefined;
    }, [token])
  );
  
  const addComment = async (
    postId: string,
    item: PostCardModel,
    tagged: TaggedUser[] = [],
    parentId?: string,
    textOverride?: string
  ): Promise<boolean> => {
    Keyboard.dismiss();
    const title = parentId ? "New reply" : "New Comment";
    const message = `${userprofile?.username || "Someone"} ${parentId ? "replied to a comment on" : "commented on"} your post`;
    const text = (textOverride ?? commentDrafts[postId] ?? "").trim();
    if (!text) return false;
    if (commentingIds.has(postId)) return false;
    const source = active === "location" ? nearbyPosts : posts;
    const setSource = active === "location" ? setNearbyPosts : setPosts;
    const idx = source.findIndex((p) => p.id === postId);
    if (idx === -1) return false;
    const current = source[idx];
    const next = [...source];
    next[idx] = { ...current, comments: current.comments + 1 };
    setSource(next);
    const inf = new Set(commentingIds);
    inf.add(postId);
    setCommentingIds(inf);
    try {
      const safe = encodeToHtmlEntities(text);
      await commentPostApi(postId, safe, token, userprofile?.ID, parentId);
      await loadCommentsForPost(postId);
  
      // 🔔 1) Notify post author (existing behavior)
      if (item.authorId && String(item.authorId) !== String(userprofile?.ID)) {
        SendNotification(message, title, item.authorId, 1, Number(postId));
      }
  
      // 🔔 2) If this is a reply, also notify the comment author
      if (parentId) {
        const entry = commentsByPost[postId];
        const parent = entry?.list.find((c) => String(c.ID) === String(parentId));
        const replyTargetId = parent?.user_id;
  
        if (
          replyTargetId &&
          String(replyTargetId) !== String(userprofile?.ID) &&          // not self
          String(replyTargetId) !== String(item.authorId || "")         // not duplicate of post author
        ) {
          const replyTitle = "New reply";
          const replyMsg = `${userprofile?.username || userprofile?.display_name || "Someone"} replied to your comment`;
          SendNotification(replyMsg, replyTitle, String(replyTargetId), 1, Number(postId));
        }
      }
  
      // 🔔 3) Mention notifications (already there)
      if (item.authorId && String(item.authorId) !== String(userprofile?.ID)) {
        // keep as-is or remove if it feels double
      }
  
      for (const t of tagged) {
        const msg = `${userprofile?.username || "Someone"} mentioned you in a comment`;
        SendNotification(msg, "You were mentioned", t.id, 1, Number(postId));
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

  const [friendBusy, setFriendBusy] = useState<Set<string>>(new Set());
  const toggleFriendship = async (authorId?: string, confirmed = false) => {
    if (!authorId) return;
    if (String(authorId) === String(userprofile?.ID)) return;
    if (friendBusy.has(authorId)) return;
    const updateLists = (target: boolean) => {
      setPosts((prev) => prev.map((p) => (p.authorId === authorId ? { ...p, areFriends: target } : p)));
      setNearbyPosts((prev) => prev.map((p) => (p.authorId === authorId ? { ...p, areFriends: target } : p)));
    };
    const anyPost =
      posts.find((p) => p.authorId === authorId) || nearbyPosts.find((p) => p.authorId === authorId);
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

  const [followBusy, setFollowBusy] = useState<Set<string>>(new Set());
  const applyFollowState = (authorId: string, following: boolean) => {
    setPosts((prev) => prev.map((p) => (p.authorId === authorId ? { ...p, following } : p)));
    setNearbyPosts((prev) => prev.map((p) => (p.authorId === authorId ? { ...p, following } : p)));
  };
  const toggleSave = async (postId: string) => {
    if (savingIds.has(postId)) return;
    const source = active === "location" ? nearbyPosts : posts;
    const setSource = active === "location" ? setNearbyPosts : setPosts;
    const idx = source.findIndex((p) => p.id === postId);
    if (idx === -1) return;
    const current = source[idx];
    const optimisticSaved = !current.saved;
    const next = [...source];
    next[idx] = { ...current, saved: optimisticSaved };
    setSource(next);
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
      Alert.alert(`Unfollow ${authorName || "this user"}?`, "You will stop seeing their updates.", [
        { text: "Cancel", style: "cancel" },
        { text: "Unfollow", style: "destructive", onPress: () => performFollow(authorId, false) },
      ]);
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
      if (follow) {await followUserApi(authorId, token);
      const title = "New follower";
      const message = `${userprofile?.username || userprofile?.display_name || "Someone"} started following you`;
      SendNotification(message, title, authorId, 1);
      }
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
      setNotifCount((c) => c);
    }, [])
  );

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.surface} translucent={false} />
      <SafeAreaView style={{ backgroundColor: COLORS.surface }} edges={["top"]}>
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
                <Text style={styles.cancelTxt} allowFontScaling={false}>
                  Cancel
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </Animated.View>

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

      <AvoidSoftInputView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <FlatList
          data={filtered}
          ref={feedRef}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="always"
          keyboardDismissMode="none"
          refreshing={refreshing}
          onRefresh={() => {
            GetAllPost();
            posts.forEach((p) => loadCommentsForPost(p.id));
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
              onSendComment={(tagged, parentId, text) => addComment(item.id, item, tagged, parentId, text)}
              commenting={commentingIds.has(item.id)}
              onToggleFriend={() => toggleFriendship(item.authorId)}
              friendBusy={item.authorId ? friendBusy.has(item.authorId) : false}
              onToggleFollow={() => toggleFollow(item.authorId, item.author)}
              followBusy={item.authorId ? followBusy.has(item.authorId) : false}
              onToggleSave={() => toggleSave(item.id)}
              saving={savingIds.has(item.id)}
              shouldPlay={!!playMap[item.id] && isFocused}
              isSelf={item.authorId && String(item.authorId) === String(userprofile?.ID)}
              onEdit={() => onEditPost(item)}
              onDelete={() => onDeletePost(item)}
              onRepost={() => onRepost(item)}
              onUnrepost={() => onUnrepost(item)}
              flatListNode={feedNodeRef.current}
              onNeedScroll={scrollListToY}
              onToggleCommentLike={(commentId) => toggleCommentLike(item.id, commentId)}
              isCommentLikeBusy={(commentId) => commentLikeBusy.has(`${item.id}:${commentId}`)}         
            />
          )}
          contentContainerStyle={{ paddingBottom: 24 }}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={{ alignItems: "center", marginTop: 48, paddingHorizontal: 16 }}>
              {loadingPosts || refreshing ? (
                <View style={{ alignItems: "center", gap: 10 }}>
                  <ActivityIndicator size="large" color={COLORS.accent} />
                  <Text style={{ color: COLORS.sub }}>Loading …</Text>
                </View>
              ) : !hasLoadedOnce ? (
                // Safety: also show loader if we somehow haven't finished the first load
                <View style={{ alignItems: "center", gap: 10 }}>
                  <ActivityIndicator size="small" color={COLORS.accent} />
                  <Text style={{ color: COLORS.sub }}>Loading …</Text>
                </View>
              ) : active === "location" ? (
                nearbyLoading ? (
                  <View style={{ alignItems: "center", gap: 10 }}>
                    <ActivityIndicator size="small" color={COLORS.accent} />
                    <Text style={{ color: COLORS.sub }}>Finding nearby posts…</Text>
                  </View>
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
      {showBanner && (
  <BannerAd
    unitId={bannerAdId}
    size={BannerAdSize.ADAPTIVE_BANNER}
  />
)}

<TouchableOpacity onPress={() => setShowBanner(false)}>
<TText style={{color:"white",marginLeft:10}}>Hide Ads</TText>
</TouchableOpacity>




    </View>
  );
}

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

export const encodeToHtmlEntities = (s: string) =>
  Array.from(s)
    .map((ch) => {
      const cp = ch.codePointAt(0)!;
      return cp > 0x7f ? `&#x${cp.toString(16).toUpperCase()};` : ch;
    })
    .join("");

const decodeColonShortcodes = (s: string) => s.replace(/:[a-z0-9_+\-]+:/gi, (m) => COLON_EMOJI[m.toLowerCase()] ?? m);

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
  const parts = text.split(/(\B@[a-zA-Z0-9._-]+)/g);
  return (
    <Text>
      {parts.map((part, idx) => {
        const m = part.match(/^\B@([a-zA-Z0-9._-]+)$/);
        if (m) {
          const username = m[1];
          return (
            <Text key={idx} style={mentionStyle} suppressHighlighting onPress={() => onPressUsername(username)}>
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

const renderWithMentions = (text: string, stylesObj: { mention: any; normal: any }) => {
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
  onNeedScroll,
  onToggleCommentLike,   
  isCommentLikeBusy
}: {
  post: PostCardModel;
  onPress: () => void;
  onToggleLike: () => void;
  liking?: boolean;
  commentDraft: string;
  onChangeDraft: (t: string) => void;
  onSendComment: (tagged: TaggedUser[], parentId?: string, text?: string) => Promise<boolean>;
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
  onToggleCommentLike: (commentId: string) => void;
  isCommentLikeBusy?: (commentId: string) => boolean; 
  
}) {
  const nav = useNavigation<any>();
  const cardRef = useRef<View>(null);
  const inputWrapRef = useRef<View>(null);
  // const primaryName =
  //   post.repostedById && post.repostedById === useSelector((s: any) => (s.authReducer?.userprofile?.ID ? String(s.authReducer.userprofile.ID) : "")) ? "You" : post.repostedByName || "Someone";
  // ✅ hooks must be unconditional and at top level
  const myId = useSelector(
    (s: any) => (s.authReducer?.userprofile?.ID ? String(s.authReducer.userprofile.ID) : "")
  );
 
  const primaryName =
    post.repostedById && post.repostedById === myId
      ? "You"
      : post.repostedByName || "Someone";
  const others = Math.max(0, (post.repostCount || 0) - 1);
  const bannerText = others > 0 ? `${primaryName} and ${others} other${others > 1 ? "s" : ""} reposted` : `${primaryName} reposted`;
  const scrollInputIntoView = useCallback(() => {
    setTimeout(() => {
      const listNode = flatListNode;
      if (!listNode) return;
      inputWrapRef.current?.measureLayout(
        listNode,
        (x, y) => {
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
  const userprofile = useSelector((state: any) => state.authReducer.userprofile);
  const [muted, setMuted] = useState(true);
  const token = useSelector((s: any) => s.authReducer.token);
  const meId = useSelector((s: any) => (s.authReducer?.userprofile?.ID ? String(s.authReducer.userprofile.ID) : undefined));
  const [replyTo, setReplyTo] = useState<ApiComment | null>(null);
  const [descExpanded, setDescExpanded] = useState(false);

  const onTapReply = (c: ApiComment) => {
    setReplyTo(c);
    setShowBox(true);
    const at = `@${(c.author || "").replace(/\s+/g, "")} `;
    if (!commentDraft?.startsWith(at)) {
      onChangeDraft(`${at}${commentDraft || ""}`);
    }
    setTimeout(() => {
      inputRef.current?.focus();
      scrollInputIntoView();
    }, 0);
  };
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionList, setMentionList] = useState<UserLite[]>([]);
  const [mentionLoading, setMentionLoading] = useState(false);
  const [tagged, setTagged] = useState<TaggedUser[]>([]);
  const mentionRegex = /(^|\s)@([\w.\-]{0,30})$/i;
  const debTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onMentionPress = async (username: string) => {
    const uid = await resolveUserIdByUsername(username, token);
   
 
    if (uid) {
      nav.navigate("ViewProfileScreen", { NTN_User_PkeyID: uid });
    } else {
      Alert.alert("Profile not found", `Couldn't open @${username}'s profile.`);
    }
  };
  const [commentModal, setCommentModal] = useState<{ open: boolean; postId?: string }>({ open: false });
const openComments = (postId: string) => setCommentModal({ open: true, postId });
const closeComments = () => setCommentModal({ open: false });

  const runUserSearch = (q: string) => {
    if (debTimer.current) clearTimeout(debTimer.current);
    debTimer.current = setTimeout(async () => {
      setMentionLoading(true);
      const res = await searchUsersApi(q, token, meId);
      setMentionList(res);
      setMentionLoading(false);
    }, 200);
  };
  useEffect(() => {
    return () => {
      if (debTimer.current) {
        clearTimeout(debTimer.current);
        debTimer.current = null;
      }
    };
  }, []);
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
    setTagged((prev) => (prev.some((x) => x.id === u.id) ? prev : [...prev, { id: u.id, username: u.username }]));
    setMentionOpen(false);
    setTimeout(() => inputRef.current?.focus(), 0);
  };
  const onPressCommentIcon = () => {
    setShowBox(true);
    setReplyTo(null);
    setTimeout(() => {
      inputRef.current?.focus();
      scrollInputIntoView();   
    }, 0);
  };
  const mediaItems = useMemo(() => {
    const items: Array<{ type: "video" | "image"; uri: string }> = [];
  
    // 1) Videos
    const videoUrls =
      (post.videoUrls && post.videoUrls.length > 0
        ? post.videoUrls
        : post.videoUrl
        ? [post.videoUrl]
        : []) as string[];
  
    videoUrls.forEach((u) => {
      if (u) {
        items.push({ type: "video", uri: u });
      }
    });
  
    // 2) Images
    const imgs =
      Array.isArray(post.images) && post.images.length > 0
        ? post.images
        : post.image
        ? [post.image]
        : [];
  
    imgs.forEach((u) => {
      if (u) {
        items.push({ type: "image", uri: u });
      }
    });
  
    return items;
  }, [post.videoUrls, post.videoUrl, post.images, post.image, post.hasVideo]);
  
  
  
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
  useEffect(() => {
    if (!isVideoActive && !muted) setMuted(true);
  }, [isVideoActive]);
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
  const toggleChildren = (rootId: string) => setExpandedChildren((s) => ({ ...s, [rootId]: !s[rootId] }));
  useEffect(() => {
    if (!commentsFromApi || commentsFromApi.length === 0) {
      ensureComments();
    }
  }, []);
  const threaded = useMemo(() => threadifyComments(commentsFromApi || []), [commentsFromApi]);
  const ROOTS_SHOWN_WHEN_COLLAPSED = 1;
  const canExpand = threaded.length > ROOTS_SHOWN_WHEN_COLLAPSED;
  const rootsToRender = expanded ? threaded : threaded.slice(0, ROOTS_SHOWN_WHEN_COLLAPSED);
  const handleSend = async () => {
    const ok = await onSendComment(tagged, replyTo ? String(replyTo.ID) : undefined);
    if (ok) {
      setReplyTo(null);
      setTagged([]);
      setMentionOpen(false);
      onChangeDraft("");
    }
  };
  return (
    <View style={styles.card}>
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
          <TouchableOpacity onPress={() => nav.navigate("ViewProfileScreen", { NTN_User_PkeyID: post.authorId })}>
            <Avatar uri={post.avatar} name={post.author} size={36} />
          </TouchableOpacity>
          <View>
            <TouchableOpacity onPress={() => nav.navigate("ViewProfileScreen", { NTN_User_PkeyID: post.authorId })}>
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
  {/* show follow button ONLY if:
      - not my own post
      - and I'm NOT following */}
{!isSelf && !post.following &&  (
  <TouchableOpacity
    style={[
      styles.pillBtn,
      post.following && styles.pillActive,   // highlight when following
      // followBusy ? { opacity: 0.5 } : null, // dim while API is busy
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
      style={[
        styles.pillTxt,
        post.following ? { color: "#fff" } : null,
      ]}
      allowFontScaling={false}
    >
      {post.following ? "Following" : "Follow"}
    </TText>
  </TouchableOpacity>
)}



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
        <TouchableOpacity
          onPress={closeMenu}
          style={styles.menuBackdrop}
          activeOpacity={1}
        />
        <View style={styles.menu}>
          {isSelf ? (
            <>
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  closeMenu();
                  onEdit();
                }}
              >
                <Ionicons name="create-outline" size={18} color={COLORS.text} />
                <TText style={styles.menuText}>Edit</TText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.menuItem, { borderTopWidth: 0 }]}
                onPress={() => {
                  closeMenu();
                  onDelete();
                }}
              >
                <Ionicons name="trash-outline" size={18} color={COLORS.accent} />
                <TText style={[styles.menuText, { color: COLORS.accent }]}>
                  Delete
                </TText>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                closeMenu();
                onRepost();
              }}
            >
              <Ionicons name="repeat-outline" size={18} color={COLORS.text} />
              <TText style={styles.menuText}>Repost</TText>
            </TouchableOpacity>
          )}
        </View>
      </>
    )}
  </View>
</View>

      </View>

      <TouchableOpacity onPress={onPress} activeOpacity={0.9}>
      <TText style={styles.title}>{normalizeEmoji(post.title)}</TText>
        <View style={styles.media} onLayout={(e) => setMediaWidth(e.nativeEvent.layout.width)}>
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
                      onError={() => {}}
                      onEnd={() => {}}
                      {...(Platform.OS === "android" ? { useTextureView: false } : {})}
                    />
                    <View style={[styles.multiBadge, { right: 8, top: 8, bottom: undefined }]}>
                      <Ionicons name="videocam-outline" size={14} color="#fff" />
                    </View>
                    <TouchableOpacity onPress={() => setMuted((m) => !m)} style={styles.audioBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Ionicons name={muted ? "volume-mute-outline" : "volume-high-outline"} size={18} color="#fff" />
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
          <View style={styles.dotsWrap}>
            {mediaItems.map((_, i) => (
              <View key={i} style={[styles.dot, i === slide && styles.dotActive]} />
            ))}
          </View>
        </View>
      </TouchableOpacity>

      <View style={styles.albumShareRow} />

      <View style={[styles.rowBetween, { marginTop: 10 }]}>
        <View style={styles.row}>
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
           onPress={() => openComments(post.id)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={{ marginLeft: 20, flexDirection: "row", alignItems: "center" }}
          >
            <Ionicons name="chatbubble-outline" size={20} color={COLORS.icon} />
            <Text style={styles.meta}>&nbsp;{abbreviate(post.comments)}</Text>
          </TouchableOpacity>

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
            <View style={{ right: 10, flexDirection: "row" }}>
              <Ionicons name="repeat-outline" size={16} color="#fff" />
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
      {!!post.description && (
  <View style={styles.descContainer}>
    <TText
      style={styles.description}
      numberOfLines={descExpanded ? undefined : 2}  // 3 lines when collapsed
    >
      {normalizeEmoji(post.description)}
    </TText>
   {/* Under description or under title – wherever you put tags */}

    {Array.from(normalizeEmoji(post.description)).length > 120 && (
      <TouchableOpacity
        onPress={() => setDescExpanded((v) => !v)}
        hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
      >
        <Text style={styles.descMore}>
          {descExpanded ? "See less" : "See more"}
        </Text>
      </TouchableOpacity>
    )}
  </View>
)}
   {post.tags && post.tags.length > 0 && (
  <View style={styles.tagsRow}>
    {post.tags.slice(0, 3).map((t, idx) => (
      <TouchableOpacity
        key={idx}
        style={styles.tagChip}
        activeOpacity={0.7}
        onPress={() => {
          if (t.id) {
            console.log("t,id",t.id)
            nav.navigate("ViewProfileScreen", { NTN_User_PkeyID: t.id });
          } else {
            Alert.alert("Profile not available", "This tagged user has no profile ID.");
          }
        }}
      >
        <Text style={styles.tagChipTxt} numberOfLines={1}>
          @{t.name}
        </Text>
      </TouchableOpacity>
    ))}

    {post.tags.length > 3 && (
      <Text style={styles.tagMore}>+{post.tags.length - 3} more</Text>
    )}
  </View>
)}
      {commentModal.open && commentModal.postId === post.id && (
 <CommentsModal
 open
 onClose={closeComments}
 postId={post.id}
 totalFromApi={totalCommentsFromApi}
 comments={commentsFromApi}
 loading={commentsLoading}
 ensureLoaded={ensureComments}
 onSend={({ text, tagged, parentId }) => onSendComment(tagged, parentId, text)}
 onToggleCommentLike={onToggleCommentLike}  // ✅ parent’s optimistic handler
 isCommentLikeBusy={isCommentLikeBusy} 
 searchUsersApi={(q) => searchUsersApi(q, token, String(userprofile?.ID ?? ""))}
 onPressProfile={(uid) => uid && nav.navigate("ViewProfileScreen", { NTN_User_PkeyID: uid })}
 COLORS={COLORS}
 meId={String(userprofile?.ID ?? "")}
 token={token}
/>

)}

      {/* {showBox && (
        <View style={styles.commentRow} ref={inputWrapRef}>
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
            onSubmitEditing={handleSend}
          />
          <TouchableOpacity onPress={handleSend} disabled={commenting || !commentDraft.trim()} style={styles.sendBtn}>
            {commenting ? <ActivityIndicator size="small" /> : <Ionicons name="send" size={18} color={commentDraft.trim() ? COLORS.text : COLORS.sub} />}
          </TouchableOpacity>
          {mentionOpen && (
            <View style={styles.mentionBox}>
              {mentionLoading ? (
                <Text style={styles.mentionHint}>Searching…</Text>
              ) : mentionList.length === 0 ? (
                <Text style={styles.mentionHint}>{mentionQuery ? `No users for “${mentionQuery}”` : "Type after @ to search"}</Text>
              ) : (
                <FlatList
                  keyboardShouldPersistTaps="always"
                  data={mentionList}
                  keyExtractor={(u) => u.id}
                  renderItem={({ item }) => (
                    <TouchableOpacity style={styles.mentionRow} onPress={() => insertMention(item)}>
                      <Avatar uri={item.avatar} name={item.username || item.name} size={20} border />
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
     
        
      )} */}
    </View>
  );
}

function mapApiPostToCard(p: ApiPost, meId?: string | number): PostCardModel {
  const id = String(p.ID);
  const title = p.title || "Untitled";
  const author = p.author || "—";
  const avatar = p.author_profile_image ;
  const imagesArr = parseCsvImages(p.fields?.images);
  const firstImage = imagesArr[0];
  const image =
    firstImage ||
    "";
    const videoArr = parseCsvImages(p.fields?.video);
    const hasVideo = videoArr.length > 0;
    const primaryVideo = videoArr[0] || undefined;
  // const hasVideo = !!(p.fields?.video && p.fields.video.trim().length);
  const timeAgo = toTimeAgo(p.date);
  const likes = parseLikes(p.fields?._likes ?? 0);
  const commentsArr = Array.isArray(p.comments) ? p.comments : [];
  function parseTagPeople(val: any): string[] {
    if (!val) return [];
    if (Array.isArray(val)) {
      return val
        .map((u) => u?.user_login || u?.display_name || u?.nickname || u?.user_firstname || "")
        .filter(Boolean);
    }
    if (typeof val === "string") {
      return val
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }
    return [];
  }

  // const tags = parseTagPeople(p.fields?.tag_people);
  let tags: { id: string; name: string }[] = [];

  if (Array.isArray(p.fields?.tag_people)) {
    // If tag_people is already an array of objects
    tags = p.fields.tag_people.map((u: any) => ({
      id: String(u.ID ?? u.id ?? ""),
      name: u.display_name || u.user_login || u.name || "",
    }));
  } else if (typeof p.fields?.tag_people === "string") {
    // If WordPress returns comma-separated names only
    tags = p.fields.tag_people.split(",").map((nm) => ({
      id: "",                        // no ID available
      name: nm.trim(),
    }));
  }
  
  
  const rb: any = (p as any)?.fields?.reposted_by_users || (p as any)?.reposted_by_users || null;
  const repostedById = rb?.ID ? String(rb.ID) : undefined;
  const repostedByName = rb?.display_name || rb?.user_nicename || rb?.nickname || rb?.user_firstname || undefined;
  const toInt = (v: any) => {
    const n = typeof v === "number" ? v : parseInt(String(v ?? 0), 10);
    return Number.isFinite(n) ? n : 0;
  };
  const repostCount = (p as any).repost_count != null ? toInt((p as any).repost_count) : toInt(p?.fields?.repost_count);
  const isRepostedByMe = isTrueish((p as any).is_reposted_by_user) || (repostedById && String(repostedById) === String(meId));
  const isRepostCard = !!repostedById || isTrueish((p as any).is_repost) || isTrueish((p as any)?.fields?.is_repost);
  // const tags = parseCsvTags(p.fields?.tag_people);
  const likedUsers = normalizeLikedUsers(p.fields?._liked_users);
  const liked = isTrueish((p as any).liked_by_user) || (meId != null && likedUsers.includes(String(meId)));
  const areFriends =
    typeof p.fields?.are_friends === "boolean"
      ? p.fields.are_friends
      : typeof p.are_friends === "boolean"
      ? p.are_friends
      : false;
  const following = isTrueish((p as any).is_followed) || isTrueish(p.fields?.is_followed);
  const saved = isTrueish((p as any).is_saved) || isTrueish(p.fields?.is_saved);
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
    videoUrl: primaryVideo,     // 👈 first video
    videoUrls: videoArr, 
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
    description: p.fields?.event_description || "", 
  };
}

const styles = StyleSheet.create({
  tagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 4,
  },
  
  tagChip: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: COLORS.pillBg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.pillBorder,
  },
  
  tagChipTxt: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: "600",
  },
  
  tagMore: {
    color: COLORS.sub,
    fontSize: 12,
    alignSelf: "center",
  },
  
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
    overflow: "hidden",
  },
  avatar: { width: "100%", height: "100%" },
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
    borderColor: "white",
    borderWidth: 1,
    marginRight: 8,
    backgroundColor: "#0A0B0E",
  },
  author: { color: COLORS.text, fontWeight: "700" },
  time: { color: COLORS.sub, marginTop: 2, fontSize: 12 },
  title: { color: COLORS.text, fontSize: 16, fontWeight: "600", marginVertical: 10 },
  menuBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  menu: {
    position: "absolute",
    top: 28,
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
  media: {
    width: "100%",
    height: 240,
    borderRadius: 12,
    backgroundColor: "#0A0B0E",
    overflow: "hidden",
  },
  meta: { color: COLORS.text, marginLeft: 6, fontWeight: "600" },
  sep: { height: 12 },
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
  cAvatar: { width: 16, height: 16, marginRight: 8, backgroundColor: COLORS.card, borderColor: "white", borderWidth: 1 },
  commentLine: { color: COLORS.text, fontSize: 14 },
  commentAuthor: { color: COLORS.text, fontWeight: "700", marginLeft: 20 },
  commentText: { color: COLORS.text, marginLeft: 10, includeFontPadding: true },
  mentionLink: {
    color: "grey",
    fontWeight: "700",
    paddingHorizontal: 4,
    borderRadius: 6,
  },
  viewAll: { color: COLORS.sub, fontSize: 13 },
  mentionChip: {
    color: "pink",
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
  audioBtn: {
    position: "absolute",
    right: 8,
    bottom: 8,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 14,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
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
    backgroundColor: "#EF2C2C",
    paddingHorizontal: 3,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
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
  description: {
    color: COLORS.sub,
    fontSize: 14,
    marginBottom: 8,
    marginTop:10
  },
  descContainer: {
    marginTop: 6,
  },
  
  descMore: {
    color: COLORS.accent,
    fontSize: 12,
    fontWeight: "600",
    marginTop: 4,
    marginBottom:10
  },
});
