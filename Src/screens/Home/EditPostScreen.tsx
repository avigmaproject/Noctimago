// src/screens/Post/EditPostScreen.tsx
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  Image,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
  Keyboard,
  findNodeHandle,
  FlatList,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { AvoidSoftInputView } from "react-native-avoid-softinput";
import Feather from "react-native-vector-icons/Feather";
import * as ImagePicker from "react-native-image-picker";
import { useSelector } from "react-redux";
import { GooglePlacesAutocomplete } from "react-native-google-places-autocomplete";
import { TText } from "../../i18n/TText";
import { allusers, getFcmToken, requestUserPermission, sendnotify } from "../../utils/apiconfig";
// REVIEW: switched from AWS helper to new cloud upload utility
import { uploadDocument } from "../../utils/CloudUpload";

const AVATAR = "";
const GOOGLE_PLACES_KEY = "";

// --- Emoji / entity helpers (same behavior as PostDetailScreen) ---
const decodeCurlyUnicode = (s: string) =>
  s.replace(/u\{([0-9a-fA-F]+)\}/g, (_, hex) =>
    String.fromCodePoint(parseInt(hex, 16))
  );

const decodeHtmlEntities = (s: string) =>
  s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) =>
      String.fromCodePoint(parseInt(hex, 16))
    )
    .replace(/&#(\d+);/g, (_, dec) =>
      String.fromCodePoint(parseInt(dec, 10))
    );

const COLON_EMOJI: Record<string, string> = {}; // fill if you support :smile: etc.
const decodeColonShortcodes = (s: string) =>
  s.replace(/:[a-z0-9_+\-]+:/gi, (m) => COLON_EMOJI[m.toLowerCase()] ?? m);

const normalizeEmoji = (s?: string) =>
  decodeColonShortcodes(decodeHtmlEntities(decodeCurlyUnicode(String(s ?? ""))));

const encodeToHtmlEntities = (s: string) =>
  Array.from(s)
    .map((ch) => {
      const cp = ch.codePointAt(0)!;
      return cp > 0x7f ? `&#x${cp.toString(16).toUpperCase()};` : ch;
    })
    .join("");

const MAX_DESC_LEN = 1000;

// --- API: edit post ---
async function editPostApi(
  postId: string | number,
  payload: {
    title: string;
    event?: string;
    tag_people?: string;
    location?: string;
    images?: string[];
    video?: string; // CSV string of video URLs
    latitude?: string;
    longitude?: string;
    event_description?: string;
  },
  token?: string
) {
  const url = `https://noctimago.com/wp-json/app/v1/edit-post/${postId}`;
  const body = {
    title: payload.title,
    fields: {
      event: payload.event || "",
      event_description: payload.event_description || "",
      tag_people: payload.tag_people || "",
      location: payload.location || "",
      images: (payload.images || []).join(","), // CSV
      video: payload.video || "",
      latitude: payload.latitude ?? "",
      longitude: payload.longitude ?? "",
    },
  };
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Edit HTTP ${res.status}`);
  try {
    return await res.json();
  } catch {
    return {};
  }
}

type Media = { uri: string; type?: string; fileName?: string };
type UserLite = { id: string; name: string; avatar?: string };

const BG = "#0B0B12",
  INPUT = "rgba(255,255,255,0.08)",
  OUTLINE = "rgba(255,255,255,0.16)",
  TEXT = "#EDEDF4",
  ACCENT = "#201A83";

export default function EditPostScreen({ route, navigation }: any) {
  const token = useSelector((s: any) => s.authReducer?.token);
  const userprofile = useSelector((state: any) => state.authReducer.userprofile);

  const params = route?.params as {
    postId: string;
    initial: {
      title: string;
      event?: string;
      event_description?: string;
      tag_people?: string | any[]; // "Jane, John" or array
      location?: string;
      images: string[];
      video?: string; // single url or CSV
      coords?: { lat: number; lng: number } | null;
    };
  };

  function extractInitialTags(src: any): string[] {
    if (!src) return [];

    // Case 1: array of user/tag objects from backend
    if (Array.isArray(src)) {
      return src
        .map((u: any) => {
          const name =
            u.name || // { id, name }
            u.user_nicename ||
            u.nickname ||
            u.display_name ||
            [u.user_firstname, u.user_lastname].filter(Boolean).join(" ");

          return (name || "").toString().trim();
        })
        .filter(Boolean);
    }

    // Case 2: comma-separated string
    if (typeof src === "string") {
      return src
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
    }

    return [];
  }

  const postId = params?.postId;
  const initial = params?.initial || {
    title: "",
    event: "",
    tag_people: [],
    location: "",
    images: [],
    video: "",
    coords: null,
    event_description: "",
  };

  console.log("initial", params?.initial);

  // --- media state ---
  const rawInitialImages = Array.isArray(initial.images) ? initial.images : [];

  // turn initial.video (string or CSV) into array of urls
  const initialVideoUrls = useMemo(() => {
    if (!initial.video) return [];
    if (Array.isArray(initial.video)) {
      return initial.video
        .map((v: any) => String(v).trim())
        .filter(Boolean);
    }
    return String(initial.video)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }, [initial.video]);

  // multiple videos
  const [videos, setVideos] = useState<Media[]>(() =>
    initialVideoUrls.map((u) => ({ uri: u }))
  );

  // images, but drop the "single thumbnail" if only 1 image + video
  const [images, setImages] = useState<Media[]>(() => {
    if (initialVideoUrls.length > 0 && rawInitialImages.length === 1) {
      // treat that single image as auto thumbnail → hide it
      return [];
    }
    return rawInitialImages.map((u) => ({ uri: u }));
  });

  const [uploading, setUploading] = useState(false);

  // --- form fields ---
  const [tags, setTags] = useState<string[]>(() =>
    extractInitialTags(initial.tag_people)
  );

  const [title, setTitle] = useState(
    normalizeEmoji(typeof initial.title === "string" ? initial.title : "")
  );
  const [event, setEvent] = useState(
    normalizeEmoji(typeof initial.event === "string" ? initial.event : "")
  );
  const [description, setDescription] = useState(
    normalizeEmoji(
      typeof initial.event_description === "string"
        ? initial.event_description
        : ""
    )
  );

  const [tagInput, setTagInput] = useState("");
  const [location, setLocation] = useState(initial.location || "");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    initial.coords || null
  );

  const canSubmit = useMemo(
    () =>
      (images.length > 0 || videos.length > 0) &&
      title.trim().length > 0 &&
      !uploading,
    [images.length, videos.length, title, uploading]
  );

  // --- users & suggestions ---
  const [users, setUsers] = useState<UserLite[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersErr, setUsersErr] = useState<string | null>(null);
  const [showSuggest, setShowSuggest] = useState(false);

  useEffect(() => {
    const val = initial.location || "";
    setLocation(val);
    requestAnimationFrame(() => placesRef.current?.setAddressText(val));
  }, [initial.location]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setUsersLoading(true);
        const res = await allusers();
        const raw = Array.isArray(res) ? res : res?.users ?? [];
        const mapped: UserLite[] = raw
          .map((u: any) => {
            const id = u?.ID ?? u?.id ?? u?.user_id ?? u?.uid ?? u?.pk;
            const fullName = [u?.first_name, u?.last_name]
              .filter(Boolean)
              .join(" ")
              .trim();
            const name =
              u?.display_name ||
              fullName ||
              u?.user_login ||
              u?.username ||
              u?.email;
            let avatar =
              u?.profile_image || u?.avatar || u?.avatar_url || "";
            if (typeof avatar === "string" && avatar.trim()) {
              avatar = avatar.trim();
              if (avatar.startsWith("//")) avatar = "https:" + avatar;
              else if (!/^https?:\/\//i.test(avatar))
                avatar = `https://noctimago.com/${avatar.replace(/^\/+/, "")}`;
            } else avatar = AVATAR;
            if (!id || !name) return null;
            return { id: String(id), name: String(name), avatar };
          })
          .filter(Boolean) as UserLite[];
        if (alive) {
          setUsers(mapped);
          setUsersErr(null);
        }
      } catch (e: any) {
        if (alive) setUsersErr(e?.message ?? "Failed to load users");
      } finally {
        if (alive) setUsersLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  async function fetchReminderUsers(postId: string | number, token?: string) {
    const res = await fetch(
      `https://noctimago.com/wp-json/app/v1/get-reminder-users/${postId}`,
      {
        method: "GET",
        headers: token
          ? { Authorization: `Bearer ${token}`, Accept: "application/json" }
          : { Accept: "application/json" },
      }
    );
    const json = await res.json().catch(() => ({}));
    const list = Array.isArray(json?.reminder_user_list)
      ? json.reminder_user_list
      : [];
    return list.map((u: any) => ({
      id: u?.ID,
      name: u?.display_name || "",
      email: u?.user_email || "",
      token:
        u?.deviceToken ||
        u?.fcm_token ||
        u?.fcm ||
        u?.push_token ||
        u?.notification_token ||
        undefined,
    }));
  }

  const filteredUsers = useMemo(() => {
    const q = tagInput.trim().toLowerCase();
    if (!q) return [];
    const selected = new Set(tags.map((t) => t.toLowerCase()));
    return users
      .filter((u) => !selected.has(u.name.toLowerCase()))
      .filter((u) => u.name.toLowerCase().includes(q))
      .slice(0, 12);
  }, [tagInput, users, tags]);

  // --- pick & upload ---
  const pickMedia = async () => {
    const res = await ImagePicker.launchImageLibrary({
      mediaType: "mixed",
      selectionLimit: 10,
      quality: 0.9,
      videoQuality: "high",
    });

    if (res.didCancel) return;

    const assets = res.assets?.filter((a) => !!a.uri) ?? [];
    if (assets.length === 0) return;

    setUploading(true);

    try {
      for (const a of assets) {
        const mime = a.type || "";
        const isVideo = mime.startsWith("video/");
        const isImage = mime.startsWith("image/");

        const file = {
          uri: a.uri!,
          name: a.fileName ?? `media_${Date.now()}`,
          type: mime || (isVideo ? "video/mp4" : "image/jpeg"),
        };

        // REVIEW: uploadDocument returns URL string directly
        const normalizedUrl = await uploadDocument(file as any, token);

        if (isImage) {
          setImages((prev) => [
            ...prev,
            { uri: decodeURIComponent(normalizedUrl as string), type: file.type, fileName: file.name },
          ]);
        } else if (isVideo) {
          setVideos((prev) => [
            ...prev,
            { uri: decodeURIComponent(normalizedUrl as string), type: file.type, fileName: file.name },
          ]);
        }
      }
    } catch (err) {
      console.log("Upload error", err);
      Alert.alert("Upload failed", "Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const removeImageAt = (idx: number) =>
    setImages((prev) => prev.filter((_, i) => i !== idx));

  const removeVideoAt = (idx: number) =>
    setVideos((prev) => prev.filter((_, i) => i !== idx));

  // --- tags UX ---
  const addTagByName = (name: string) => {
    const exists = tags.some((t) => t.toLowerCase() === name.toLowerCase());
    if (!exists) setTags((p) => [...p, name]);
  };

  const addTagFromTyping = (text: string) => {
    if (text.endsWith(" ")) {
      const newTag = text.trim();
      if (newTag.length > 0) addTagByName(newTag);
      setTagInput("");
      return;
    }
    setTagInput(text);
    setShowSuggest(true);
  };

  const onPickUser = (u: UserLite) => {
    addTagByName(u.name);
    setTagInput("");
    setShowSuggest(false);
  };

  const removeTag = (name: string) =>
    setTags((p) => p.filter((t) => t !== name));

  // --- Places: prefill previous location text ---
  const placesRef = useRef<GooglePlacesAutocomplete>(null);
  useEffect(() => {
    if (initial.location) {
      requestAnimationFrame(() =>
        placesRef.current?.setAddressText(initial.location!)
      );
    }
  }, [initial.location]);

  // --- keyboard helpers ---
  const insets = useSafeAreaInsets();
  const [gap, setGap] = useState(0);
  useEffect(() => {
    const s = Keyboard.addListener("keyboardDidShow", (e) => {
      const h = e?.endCoordinates?.height ?? 0;
      setGap(Math.max(0, h - insets.bottom));
    });
    const h = Keyboard.addListener("keyboardDidHide", () => setGap(0));
    return () => {
      s.remove();
      h.remove();
    };
  }, [insets.bottom]);

  const scrollRef = useRef<ScrollView>(null);
  const HEADER_APPROX = 56;
  const keyboardVerticalOffset = HEADER_APPROX + insets.top;
  const titleRef = useRef<TextInput>(null);
  const eventRef = useRef<TextInput>(null);
  const tagRef = useRef<TextInput>(null);

  const scrollToRef = (node?: TextInput | null) => {
    if (!node || !scrollRef.current) return;
    requestAnimationFrame(() => {
      try {
        (node as any)?.measureLayout?.(
          findNodeHandle(scrollRef.current) as any,
          (_x: number, y: number) =>
            scrollRef.current?.scrollTo({
              y: Math.max(0, y - 24),
              animated: true,
            }),
          () => {}
        );
      } catch {}
    });
  };

  const [fcmToken, setFcmToken] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const authStatus = await requestUserPermission();
      if (authStatus) {
        const fcmtoken = await getFcmToken();
        if (!fcmtoken) {
          Alert.alert(
            "Please enable notifications to receive time-critical updates"
          );
        } else {
          setFcmToken(fcmtoken);
        }
      }
    })();
  }, []);

  async function notifyReminderUsersNonBlocking(
    postId: string | number,
    title: string,
    token?: string,
    SendNotification?: (...args: any[]) => Promise<any>
  ) {
    try {
      const res = await fetch(
        `https://noctimago.com/wp-json/app/v1/get-reminder-users/${postId}`,
        {
          method: "GET",
          headers: {
            Accept: "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        }
      );
      const json = await res.json().catch(() => ({}));
      const list = Array.isArray(json?.reminder_user_list)
        ? json.reminder_user_list
        : [];
      console.log(`🔔 will notify ${list.length} user(s) for post`, postId);

      const body = `“${title}” has been updated.`;
      const jobs = list.map((u: any) =>
        SendNotification?.(
          body,
          "Event Updated",
          String(u?.ID ?? ""),
          5,
          Number(postId)
        )
          .then(() => console.log("✅ sent to", u?.display_name || u?.ID))
          .catch((e: any) =>
            console.log("❌ send failed for", u?.ID, e)
          )
      );
      await Promise.race([
        Promise.allSettled(jobs),
        new Promise((r) => setTimeout(r, 4000)),
      ]);
    } catch (e) {
      console.log("⚠️ notifyReminderUsersNonBlocking error:", e);
    }
  }

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
        console.log("[notify] skipped (self or empty)", { me, rc });
        return;
      }

      const payload = JSON.stringify({
        UserToken: fcmToken,
        message,
        msgtitle: title,
        User_PkeyID: userprofile?.ID,
        UserID: rc,
        NTN_C_L: 1,
        NTN_Sender_Name: userprofile?.meta?.first_name,
        NTN_Sender_Img: userprofile?.meta?.profile_image,
        NTN_Reciever_Name: "",
        NTN_Reciever_Img: "",
        NTN_UP_PkeyID: postId,
        NTN_UP_Path: "",
      });

      await sendnotify(payload, token);
      console.log("sendnotifyy", payload);
    } catch (err) {
      console.warn("Notify error:", err);
    }
  };

  // --- Update (submit) ---
  const onUpdate = async () => {
    if (saving) return;
    if (!postId)
      return Alert.alert("Missing post", "Unable to find this post id.");
    if (!title.trim())
      return Alert.alert("Missing title", "Please enter a title.");
    if (uploading)
      return Alert.alert("Please wait", "Media is still uploading.");

    try {
      setSaving(true);

      const tag_people = tags
        .map((t) => t.trim())
        .filter(Boolean)
        .filter(
          (t, i, arr) =>
            arr.findIndex((x) => x.toLowerCase() === t.toLowerCase()) === i
        )
        .join(", ");

      const imagesArr = images.length
        ? images
            .map((i) => (i?.uri ? decodeURIComponent(i.uri) : ""))
            .filter(Boolean)
        : [];

      const encodedDescription = encodeToHtmlEntities(description.trim());

      const videosArr = videos
        .map((v) => (v.uri ? decodeURIComponent(v.uri) : ""))
        .filter(Boolean);

      await editPostApi(
        postId,
        {
          title: title.trim(),
          event: event || "",
          tag_people,
          location: location || "",
          event_description: encodedDescription,
          images: imagesArr,
          video: videosArr.join(","), // send ALL videos as CSV
          latitude: coords ? String(coords.lat) : "",
          longitude: coords ? String(coords.lng) : "",
        },
        token
      );

      console.log("✅ Post updated successfully:", postId);

      notifyReminderUsersNonBlocking(
        postId,
        title.trim(),
        token,
        SendNotification
      );

      Alert.alert("Updated", "Your post has been updated.", [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    } catch (e: any) {
      Alert.alert("Update failed", e?.message || "Please try again.");
    } finally {
      setSaving(false);
    }
  };

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation?.goBack?.()}>
          <Feather name="chevron-left" size={26} color="#EDEDF4" />
        </TouchableOpacity>
        <TText style={styles.headerTitle}>Edit Post</TText>
      </View>

      {/* Body */}
      <AvoidSoftInputView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={
          Platform.OS === "ios" ? keyboardVerticalOffset : 0
        }
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{ paddingBottom: gap }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Media box (scrollable) */}
          <View
            style={[
              styles.mediaBox,
              images.length || videos.length ? styles.mediaSelected : null,
            ]}
          >
            {images.length || videos.length ? (
              <>
                <FlatList
                  data={[
                    ...images.map((img) => ({
                      kind: "image" as const,
                      uri: img.uri,
                    })),
                    ...videos.map((v) => ({
                      kind: "video" as const,
                      uri: v.uri,
                    })),
                  ]}
                  keyExtractor={(_, i) => String(i)}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ padding: 10, gap: 8 }}
                  nestedScrollEnabled
                  renderItem={({ item, index }) => {
                    const imageCount = images.length;

                    if (item.kind === "image") {
                      return (
                        <View style={styles.thumbWrap}>
                          <Image
                            source={{ uri: item.uri }}
                            style={styles.thumb}
                          />
                          <TouchableOpacity
                            style={styles.removeBtn}
                            onPress={() => removeImageAt(index)}
                          >
                            <Feather name="x" size={14} color="#fff" />
                          </TouchableOpacity>
                        </View>
                      );
                    }

                    if (item.kind === "video") {
                      const videoIndex = index - imageCount;
                      return (
                        <View
                          style={[
                            styles.thumbWrap,
                            { backgroundColor: "#0F1116" },
                          ]}
                        >
                          <View
                            style={[
                              styles.thumb,
                              {
                                alignItems: "center",
                                justifyContent: "center",
                              },
                            ]}
                          >
                            <Feather name="video" size={22} color="#fff" />
                            <Text
                              style={{ color: "#fff", marginTop: 6 }}
                              numberOfLines={1}
                            >
                              video.mp4
                            </Text>
                          </View>
                          <TouchableOpacity
                            style={styles.removeBtn}
                            onPress={() => removeVideoAt(videoIndex)}
                          >
                            <Feather name="x" size={14} color="#fff" />
                          </TouchableOpacity>
                        </View>
                      );
                    }

                    return null;
                  }}
                />

                {/* Add button BELOW */}
                <TouchableOpacity
                  onPress={pickMedia}
                  style={styles.addBelowBtn}
                  activeOpacity={0.9}
                  disabled={uploading}
                >
                  <Feather name="plus" size={20} color="#fff" />
                  <Text style={styles.addBelowText}>
                    Add more photos or video
                  </Text>
                </TouchableOpacity>

                {uploading && (
                  <View style={styles.loadingOverlay}>
                    <ActivityIndicator size="large" color="#fff" />
                  </View>
                )}
              </>
            ) : (
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={pickMedia}
                disabled={uploading}
                style={styles.mediaEmptyInner}
              >
                {uploading ? (
                  <ActivityIndicator size="large" color="#EF2C2C" />
                ) : (
                  <>
                    <Feather name="camera" size={32} color="#EF2C2C" />
                    <TText style={styles.mediaHint}>
                      Tap to select photo or video
                    </TText>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>

          {/* Watermark note */}
          <View style={styles.watermark}>
            <TText style={styles.watermarkText}>
              This upload will be watermarked for authenticity
            </TText>
          </View>

          {/* Title */}
          <FieldLabel label="Title" />
          <View style={styles.inputWrap}>
            <TextInput
              ref={titleRef}
              value={title}
              onChangeText={setTitle}
              placeholder="Add a title..."
              placeholderTextColor="#8D8D97"
              style={styles.input}
              autoCapitalize="sentences"
              returnKeyType="next"
              onFocus={() => scrollToRef(titleRef.current)}
              onSubmitEditing={() => eventRef.current?.focus()}
              blurOnSubmit={false}
            />
          </View>

          {/* Event */}
          <FieldLabel label="Event" />
          <View style={styles.inputWrap}>
            <TextInput
              ref={eventRef}
              value={event}
              onChangeText={setEvent}
              placeholder="Enter event name"
              placeholderTextColor="#8D8D97"
              style={styles.input}
              returnKeyType="next"
              onFocus={() => scrollToRef(eventRef.current)}
              onSubmitEditing={() => tagRef.current?.focus()}
              blurOnSubmit={false}
            />
          </View>

          {/* Description */}
          <FieldLabel label="Description" />
          <View
            style={[styles.inputWrap, { minHeight: 100, paddingVertical: 8 }]}
          >
            <TextInput
              value={description}
              onChangeText={(txt) =>
                setDescription(txt.slice(0, MAX_DESC_LEN))
              }
              placeholder="Write something about this event..."
              placeholderTextColor="#8D8D97"
              style={[styles.input, { textAlignVertical: "top" }]}
              multiline
              maxLength={MAX_DESC_LEN}
            />
            <Text style={styles.charCount}>
              {description.length}/{MAX_DESC_LEN}
            </Text>
          </View>

          {/* Tag People */}
          <FieldLabel label="Tag People" />
          <View style={styles.inputWrap}>
            <TextInput
              ref={tagRef}
              value={tagInput}
              onChangeText={addTagFromTyping}
              placeholder="Type a name… (pick below or press space to add)"
              placeholderTextColor="#8D8D97"
              style={styles.input}
              autoCapitalize="words"
              onFocus={() => {
                setShowSuggest(true);
                scrollToRef(tagRef.current);
              }}
              onBlur={() => setTimeout(() => setShowSuggest(false), 150)}
              returnKeyType="done"
            />
          </View>

          {/* Chips */}
          <View style={styles.tagContainer}>
            {tags.map((tag, idx) => (
              <View key={idx} style={styles.tagChip}>
                <Text style={styles.tagText}>{tag}</Text>
                <TouchableOpacity onPress={() => removeTag(tag)}>
                  <Feather name="x" size={14} color="#fff" />
                </TouchableOpacity>
              </View>
            ))}
          </View>

          {/* Suggestions */}
          {showSuggest &&
            (filteredUsers.length > 0 || usersLoading || usersErr) && (
              <View style={styles.suggestWrap}>
                {usersLoading && (
                  <View style={styles.suggestLoading}>
                    <ActivityIndicator size="small" color="#fff" />
                    <Text style={styles.suggestLoadingTxt}>
                      Loading users…
                    </Text>
                  </View>
                )}
                {!!usersErr && !usersLoading && (
                  <Text style={styles.suggestErr}>
                    Could not load users
                  </Text>
                )}
                {!usersLoading &&
                  !usersErr &&
                  filteredUsers.map((u) => (
                    <TouchableOpacity
                      key={u.id}
                      style={styles.suggestItem}
                      activeOpacity={0.85}
                      onPress={() => onPickUser(u)}
                    >
                      <Image
                        source={{
                          uri: u.avatar?.trim() ? u.avatar : AVATAR,
                        }}
                        defaultSource={{ uri: AVATAR }}
                        style={styles.suggestAvatar}
                      />
                      <Text
                        style={styles.suggestName}
                        numberOfLines={1}
                      >
                        {u.name}
                      </Text>
                      <View style={{ flex: 1 }} />
                      <Feather
                        name="plus-circle"
                        size={18}
                        color="#C9CED8"
                      />
                    </TouchableOpacity>
                  ))}
                {!usersLoading &&
                  !usersErr &&
                  filteredUsers.length === 0 &&
                  tagInput.trim().length > 0 && (
                    <Text style={styles.suggestEmpty}>
                      No matches. Press space to add “{tagInput.trim()}”.
                    </Text>
                  )}
              </View>
            )}

          {/* Location */}
          <FieldLabel label="Location" />
          <View style={styles.placesWrap}>
            <GooglePlacesAutocomplete
              ref={placesRef}
              placeholder="Search a location"
              fetchDetails
              enablePoweredByContainer={false}
              keyboardShouldPersistTaps="handled"
              minLength={1}
              debounce={200}
              query={{ key: GOOGLE_PLACES_KEY, language: "en" }}
              GooglePlacesDetailsQuery={{
                fields: "geometry,name,formatted_address",
              }}
              timeout={20000}
              textInputProps={{
                value: location,
                onChangeText: setLocation,
                placeholderTextColor: "#8D8D97",
              }}
              onPress={(data, details) => {
                const label =
                  data?.description ??
                  data?.structured_formatting?.main_text ??
                  "";
                if (label) setLocation(label);
                const loc = (details as any)?.geometry?.location;
                if (
                  loc &&
                  typeof loc.lat === "number" &&
                  typeof loc.lng === "number"
                ) {
                  setCoords({ lat: loc.lat, lng: loc.lng });
                }
              }}
              onFail={(err) => console.warn("Places error:", err)}
              styles={{
                container: { flex: 0, zIndex: 9999 },
                textInputContainer: {
                  padding: 0,
                  borderTopWidth: 0,
                  borderBottomWidth: 0,
                },
                textInput: styles.placesInput,
                listView: {
                  ...styles.placesList,
                  zIndex: 9999,
                  elevation: 8,
                  position: "absolute",
                  top: 54,
                  left: 0,
                  right: 0,
                },
                row: styles.placesRow,
                description: { color: "#EDEDF4" },
                separator: {
                  height: StyleSheet.hairlineWidth,
                  backgroundColor: OUTLINE,
                },
              }}
              predefinedPlaces={[]}
            />
          </View>

          {/* Submit */}
          <View style={styles.submitBar}>
            <TouchableOpacity
              activeOpacity={0.9}
              style={[
                styles.submitBtn,
                (!canSubmit || saving) && { opacity: 0.6 },
              ]}
              onPress={onUpdate}
              disabled={!canSubmit || saving}
            >
              {saving ? (
                <ActivityIndicator />
              ) : (
                <TText style={styles.submitText}>Update</TText>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </AvoidSoftInputView>

      {saving && (
        <View style={styles.fullscreenLoader}>
          <ActivityIndicator size="large" />
        </View>
      )}
    </SafeAreaView>
  );
}

function FieldLabel({ label }: { label: string }) {
  return <TText style={styles.fieldLabel}>{label}</TText>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  charCount: {
    position: "absolute",
    right: 10,
    bottom: 6,
    fontSize: 11,
    color: "#8D8D97",
  },

  header: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: OUTLINE,
  },
  headerTitle: {
    color: TEXT,
    fontSize: 18,
    fontWeight: "700",
    flex: 1,
    textAlign: "center",
  },

  mediaBox: {
    height: 260,
    backgroundColor: "#240A0E",
    marginTop: 6,
    marginHorizontal: 16,
    borderRadius: 14,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  mediaSelected: { backgroundColor: "#000" },
  mediaEmptyInner: { alignItems: "center", gap: 10 },
  mediaHint: { color: "#EF2C2C", fontSize: 16 },

  thumbWrap: {
    width: 120,
    height: 120,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "#0B0C12",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: OUTLINE,
  },
  thumb: { width: "100%", height: "100%" },
  removeBtn: {
    position: "absolute",
    right: 6,
    top: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(0,0,0,0.65)",
    alignItems: "center",
    justifyContent: "center",
  },

  addBelowBtn: {
    marginTop: 10,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 12,
    alignSelf: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  addBelowText: { color: "#fff", fontWeight: "600", fontSize: 14 },

  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },

  watermark: {
    marginTop: 8,
    marginHorizontal: 16,
    backgroundColor: "#2A2A31",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 6,
  },
  watermarkText: { color: "#C8C8CF", fontSize: 13 },

  fieldLabel: {
    color: TEXT,
    fontWeight: "700",
    marginTop: 18,
    marginBottom: 8,
    marginHorizontal: 16,
  },
  inputWrap: {
    minHeight: 48,
    backgroundColor: INPUT,
    borderWidth: 1,
    borderColor: OUTLINE,
    borderRadius: 12,
    marginHorizontal: 16,
    paddingHorizontal: 14,
    justifyContent: "center",
  },
  input: { color: TEXT, fontSize: 15 },

  tagContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: 16,
    marginTop: 8,
    gap: 6,
  },
  tagChip: {
    flexDirection: "row",
    backgroundColor: ACCENT,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    alignItems: "center",
    gap: 6,
  },
  tagText: { color: "#fff", fontSize: 14 },

  suggestWrap: {
    marginHorizontal: 16,
    marginTop: 6,
    borderRadius: 12,
    backgroundColor: "#12141A",
    borderWidth: 1,
    borderColor: OUTLINE,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.2,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
      },
      android: { elevation: 2 },
    }),
  },
  suggestLoading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  suggestLoadingTxt: { color: "#fff" },
  suggestErr: { color: "#fff", paddingHorizontal: 12, paddingVertical: 10 },
  suggestEmpty: {
    color: "#C8C8CF",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  suggestItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: OUTLINE,
  },
  suggestAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#0B0C12",
  },
  suggestName: {
    color: "#EDEDF4",
    fontSize: 14,
    fontWeight: "700",
    maxWidth: "75%",
  },

  placesWrap: {
    marginHorizontal: 16,
    marginTop: 6,
    position: "relative",
    zIndex: 9999,
  },
  placesInput: {
    color: TEXT,
    backgroundColor: INPUT,
    borderWidth: 1,
    borderColor: OUTLINE,
    borderRadius: 12,
    height: 48,
    paddingHorizontal: 14,
  },
  placesRow: {
    backgroundColor: "#12141A",
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  placesList: {
    backgroundColor: "#12141A",
    borderRadius: 12,
    marginTop: 6,
  },

  submitBar: {
    marginTop: 18,
    padding: 16,
    backgroundColor: BG,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: OUTLINE,
  },
  submitBtn: {
    height: 52,
    backgroundColor: ACCENT,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  submitText: { color: "#fff", fontSize: 16, fontWeight: "700" },

  fullscreenLoader: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.25)",
    zIndex: 9999,
    elevation: 10,
  },
});
