// src/screens/NewPostScreen.tsx
import React, { useEffect, useMemo, useState, useRef } from 'react';
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
  KeyboardAvoidingView,
  findNodeHandle,
} from 'react-native';

import Feather from 'react-native-vector-icons/Feather';
import * as ImagePicker from 'react-native-image-picker';
import { useSelector } from 'react-redux';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

// API helpers
import { createpost, allusers } from '../../../utils/apiconfig';
import { uploaddocumnetaws } from '../../../utils/Awsfile';

// i18n
import { TText } from '../../../i18n/TText';
import { useAutoI18n } from '../../../i18n/AutoI18nProvider';
import Avatar from '../../../utils/Avatar';

type Media = {
  uri: string;
  type?: string;
  fileName?: string;
};
type UserLite = { id: string; name: string; avatar?: string };
// Encode emojis to curly unicode for WordPress (e.g. 😀 -> u{1f600})
// Count real characters (emojis, etc.) and trim to max
const limitByCodePoints = (s: string, max: number) => {
  const arr = Array.from(s);
  if (arr.length <= max) return s;
  return arr.slice(0, max).join("");
};

// Same encoder you already use elsewhere (for WordPress)
const encodeToHtmlEntities = (s: string) =>
  Array.from(s)
    .map((ch) => {
      const cp = ch.codePointAt(0)!;
      return cp > 0x7f ? `&#x${cp.toString(16).toUpperCase()};` : ch;
    })
    .join("");

const encodeCurlyUnicode = (s: string) => {
  if (!s) return s;
  let out = '';
  for (const ch of s) {
    const cp = ch.codePointAt(0);
    if (!cp) continue;
    // Emojis & other chars outside basic multilingual plane
    if (cp > 0xffff) {
      out += `u{${cp.toString(16)}}`;
    } else {
      out += ch;
    }
  }
  return out;
};

const AVATAR =
  'https://upload.wikimedia.org/wikipedia/commons/thumb/b/bc/Unknown_person.jpg/1200px-Unknown_person.jpg';

// ⬇️ put your key here (or pull from env/Config)


export default function NewPostScreen({ navigation }: any) {
  /* ------------------------ media state ------------------------ */
  const [images, setImages] = useState<Media[]>([]);
  const [video, setVideo] = useState<Media | null>(null);
  const [uploading, setUploading] = useState(false); // media upload
  const [submitting, setSubmitting] = useState(false); // post submit

  /* ------------------------ form fields ------------------------ */
  const [title, setTitle] = useState('');
  const [event, setEvent] = useState('');
  const [eventDesc, setEventDesc] = useState(''); // event description
  const [tags, setTags] = useState<string[]>([]);
  const [location, setLocation] = useState('');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [tagInput, setTagInput] = useState('');

  const token = useSelector((state: any) => state.authReducer.token);

  const canSubmit = useMemo(
    () =>
      (images.length > 0 || !!video) &&
      title.trim().length > 0 &&
      !uploading &&
      !submitting,
    [images.length, video, title, uploading, submitting]
  );

  // i18n dynamic placeholder
  const { translate, lang } = useAutoI18n();
  const [titlePH, setTitlePH] = useState('Add a title...');

  /* ------------------------ users & suggestions ------------------------ */
  const [users, setUsers] = useState<UserLite[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersErr, setUsersErr] = useState<string | null>(null);
  const [showSuggest, setShowSuggest] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const t = await translate('Add a title...', { from: 'en', to: lang });
      if (alive) setTitlePH(t);
    })();
    return () => {
      alive = false;
    };
  }, [lang, translate]);

  useEffect(() => {
    let alive = true;
    setUsersLoading(true);
    (async () => {
      try {
        const res = await allusers();
        const raw = Array.isArray(res) ? res : res?.users ?? [];
        const mapped: UserLite[] = raw
          .map((u: any) => {
            const id =
              (u && (u.ID ?? u.id ?? u.user_id ?? u.uid ?? u.pk)) || null;

            const fullName = [u?.first_name, u?.last_name].filter(Boolean).join(' ').trim();

            const name =
              (u?.display_name || fullName || u?.user_login || u?.username || u?.email) || null;

            let avatar = u?.profile_image || u?.avatar || u?.avatar_url || '';
            if (typeof avatar === 'string' && avatar.trim()) {
              avatar = avatar.trim();
              if (avatar.startsWith('//')) avatar = 'https:' + avatar;
              else if (!/^https?:\/\//i.test(avatar)) {
                avatar = `https://noctimago.com/${avatar.replace(/^\/+/, '')}`;
              }
            } else {
              // avatar = AVATAR; // fallback if you want
            }

            if (!id || !name) return null;
            return { id: String(id), name: String(name), avatar };
          })
          .filter(Boolean) as UserLite[];

        if (alive) {
          setUsers(mapped);
          setUsersErr(null);
        }
      } catch (e: any) {
        if (alive) setUsersErr(e?.message ?? 'Failed to load users');
      } finally {
        if (alive) setUsersLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const filteredUsers = useMemo(() => {
    const q = tagInput.trim().toLowerCase();
    if (!q) return [];
    const selected = new Set(tags.map((t) => t.toLowerCase()));
    return users
      .filter((u) => !selected.has(u.name.toLowerCase()))
      .filter((u) => u.name.toLowerCase().includes(q))
      .slice(0, 12);
  }, [tagInput, users, tags]);

  /* --------------------- picker & upload logic --------------------- */
  const pickMedia = async () => {
    const res = await ImagePicker.launchImageLibrary({
      mediaType: 'mixed',
      selectionLimit: 10,
      quality: 0.9,
      videoQuality: 'high',
    });

    if (res.didCancel) return;
    const assets = res.assets?.filter((a) => !!a.uri) ?? [];
    if (assets.length === 0) return;

    setUploading(true);
    try {
      for (const a of assets) {
        const file = {
          uri: a.uri!,
          name: a.fileName ?? `media_${Date.now()}`,
          type: a.type ?? (a.type?.startsWith('video/') ? 'video/mp4' : 'image/jpeg'),
        };
        const up = await uploaddocumnetaws(file as any, token);
        const normalizedUrl = decodeURIComponent((up as any).location);

        if ((file.type || '').startsWith('image/')) {
          setImages((prev) => [
            ...prev,
            { uri: normalizedUrl, type: file.type, fileName: file.name },
          ]);
        } else if ((file.type || '').startsWith('video/')) {
          setVideo({ uri: normalizedUrl, type: file.type, fileName: file.name });
        }
      }
    } catch (err) {
      console.log('Upload error', err);
      Alert.alert('Upload failed', 'Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const removeImageAt = (idx: number) => {
    setImages((prev) => prev.filter((_, i) => i !== idx));
  };
  const clearVideo = () => setVideo(null);

  /* ----------------------------- tags ----------------------------- */
  const addTagFromTyping = (text: string) => {
    if (text.endsWith(' ')) {
      const newTag = text.trim();
      if (newTag.length > 0) addTagByName(newTag);
      setTagInput('');
      return;
    }
    setTagInput(text);
    setShowSuggest(true);
  };

  const addTagByName = (name: string) => {
    const exists = tags.some((t) => t.toLowerCase() === name.toLowerCase());
    if (!exists) setTags((prev) => [...prev, name]);
  };

  const onPickUser = (u: UserLite) => {
    addTagByName(u.name);
    setTagInput('');
    setShowSuggest(false);
  };

  const removeTag = (name: string) => {
    setTags((prev) => prev.filter((t) => t !== name));
  };

  /* ---------------------- Google Places config --------------------- */
  const placesQuery = useMemo(() => ({ key: GOOGLE_PLACES_KEY, language: 'en' }), []);
  const placesRef = useRef<GooglePlacesAutocomplete>(null);
  const placesInputRef = useRef<TextInput | null>(null); // ref to inner input

  /* ------------------------- scroll helpers ------------------------- */
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);

  const scrollToRef = (node?: TextInput | null) => {
    if (!node || !scrollRef.current) return;
    requestAnimationFrame(() => {
      try {
        (node as any)?.measureLayout?.(
          findNodeHandle(scrollRef.current) as any,
          (_x: number, y: number, _w: number, _h: number) => {
            scrollRef.current?.scrollTo({ y: Math.max(0, y - 24), animated: true });
          },
          () => {}
        );
      } catch {}
    });
  };

  // Refs for inputs
  const titleRef = useRef<TextInput>(null);
  const eventRef = useRef<TextInput>(null);
  const eventDescRef = useRef<TextInput>(null);
  const tagRef = useRef<TextInput>(null);

  /* ---------------------------- submit ---------------------------- */
  const onSubmit = async () => {
    if (!canSubmit || submitting) return;

    setSubmitting(true);
    try {
      const safeTitle = encodeCurlyUnicode(title.trim());
      const safeEvent = event ? encodeCurlyUnicode(event) : '';
      const safeEventDesc = eventDesc ? encodeCurlyUnicode(eventDesc) : '';
      
      const payload = JSON.stringify({
        title: safeTitle,
        status: 'publish',
        fields: {
          event: safeEvent || null,
          event_description: safeEventDesc || null,
          tag_people: tags.length ? tags.join(', ') : null,
          location: location || null,
          images: images.length ? images.map((i) => decodeURI(i.uri)).join(',') : null,
          video: video?.uri ? decodeURI(video.uri) : '',
          latitude: coords ? String(coords.lat) : '',
          longitude: coords ? String(coords.lng) : '',
        },
      });
      
      console.log('payload', payload, token);

      const res = await createpost(payload, token);
      console.log('createpost res =>', res);

      // Reset
      setTitle('');
      setEvent('');
      setEventDesc('');
      setTags([]);
      setLocation('');
      setImages([]);
      setVideo(null);
      setTagInput('');
      setCoords(null);

      // // safely clear GooglePlaces input if ref is ready
      // const refAny = placesRef.current as any;
      // if (refAny && typeof refAny.clear === 'function') {
      //   refAny.clear();
      // }

      Alert.alert('Success', 'Post added successfully');
      navigation.goBack();
    } catch (error) {
      console.log('[NewPostScreen] error =', error);
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  /* ------------------------------- UI ------------------------------ */
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation?.goBack?.()}>
          <Feather name="chevron-left" size={26} color="#EDEDF4" />
        </TouchableOpacity>
        <TText style={styles.headerTitle}>New Post</TText>
        <View style={{ width: 26 }} />
      </View>

      {/* Content (button is part of scroll, NOT floating) */}
      <KeyboardAvoidingView
        style={styles.flex1}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <ScrollView
          ref={scrollRef}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            paddingBottom: 24 + insets.bottom, // just for safe-area
          }}
        >
          {/* Media picker */}
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={pickMedia}
            style={[
              styles.mediaBox,
              images.length || video ? styles.mediaSelected : null,
            ]}
            disabled={uploading || submitting}
          >
            {images.length > 0 || video ? (
              <>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ padding: 10, gap: 8 }}
                >
                  {images.map((img, idx) => (
                    <View key={`${img.uri}-${idx}`} style={styles.thumbWrap}>
                      <Image source={{ uri: img.uri }} style={styles.thumb} />
                      <TouchableOpacity
                        style={styles.removeBtn}
                        onPress={() => removeImageAt(idx)}
                        disabled={uploading || submitting}
                      >
                        <Feather name="x" size={14} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  ))}

                  {video && (
                    <View style={[styles.thumbWrap, { backgroundColor: '#0F1116' }]}>
                      <View
                        style={[
                          styles.thumb,
                          { alignItems: 'center', justifyContent: 'center' },
                        ]}
                      >
                        <Feather name="video" size={22} color="#fff" />
                        <Text style={{ color: '#fff', marginTop: 6 }} numberOfLines={1}>
                          {video.fileName ?? 'video.mp4'}
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={styles.removeBtn}
                        onPress={clearVideo}
                        disabled={uploading || submitting}
                      >
                        <Feather name="x" size={14} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  )}
                </ScrollView>

                {uploading && (
                  <View style={styles.loadingOverlay}>
                    <ActivityIndicator size="large" color="#fff" />
                  </View>
                )}

                {!uploading && (
                  <View style={styles.changeOverlay}>
                    <Feather name="camera" size={18} color="#fff" />
                    <TText style={styles.changeOverlayText}>
                      Add more photos or video
                    </TText>
                  </View>
                )}
              </>
            ) : (
              <View style={styles.mediaEmptyInner}>
                {uploading ? (
                  <ActivityIndicator size="large" color="#EF2C2C" />
                ) : (
                  <>
                    <Feather name="camera" size={32} color="#EF2C2C" />
                    <TText style={styles.mediaHint}>Tap to select photo or video</TText>
                  </>
                )}
              </View>
            )}
          </TouchableOpacity>

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
              placeholder={titlePH}
              placeholderTextColor="#8D8D97"
              style={styles.input}
              autoCapitalize="sentences"
              returnKeyType="next"
              onFocus={() => scrollToRef(titleRef.current)}
              onSubmitEditing={() => eventRef.current?.focus()}
              blurOnSubmit={false}
              editable={!submitting}
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
              onSubmitEditing={() => eventDescRef.current?.focus()}
              blurOnSubmit={false}
              editable={!submitting}
            />
          </View>

          {/* Event Description */}
          <FieldLabel label="Description" />  {/* you can rename label if you want */}
<View style={[styles.inputWrap, styles.multilineWrap]}>
  <TextInput
    ref={eventDescRef}
    value={eventDesc}
    onChangeText={(txt) => setEventDesc(limitByCodePoints(txt, 1000))}
    placeholder="Tell a bit more about the event…"
    placeholderTextColor="#8D8D97"
    style={[styles.input, styles.multilineInput]}
    multiline
    textAlignVertical="top"
    returnKeyType="next"
    onFocus={() => scrollToRef(eventDescRef.current)}
    onSubmitEditing={() => tagRef.current?.focus()}
    blurOnSubmit={false}
  />
</View>
<View style={{ marginHorizontal: 16, marginTop: 4, alignItems: "flex-end" }}>
  <Text style={{ color: "#8D8D97", fontSize: 12 }}>
    {Array.from(eventDesc).length}/1000
  </Text>
</View>


          {/* Tag People */}
          <FieldLabel label="Tag People" />
          <View style={styles.inputWrap}>
            <TextInput
              ref={tagRef}
              value={tagInput}
              onChangeText={addTagFromTyping}
              placeholder="Type a name… "
              placeholderTextColor="#8D8D97"
              style={styles.input}
              autoCapitalize="words"
              onFocus={() => {
                setShowSuggest(true);
                scrollToRef(tagRef.current);
              }}
              onBlur={() => setTimeout(() => setShowSuggest(false), 150)}
              returnKeyType="done"
              editable={!submitting}
            />
           
          </View>
          <Text style={{color: TEXT, fontSize: 10 ,marginLeft:20,marginTop:10}}>(pick below or press space to add)</Text>
          {/* Selected chips */}
          <View style={styles.tagContainer}>
            {tags.map((tag, idx) => (
              <View key={idx} style={styles.tagChip}>
                <Text style={styles.tagText}>{tag}</Text>
                <TouchableOpacity onPress={() => removeTag(tag)} disabled={submitting}>
                  <Feather name="x" size={14} color="#fff" />
                </TouchableOpacity>
              </View>
            ))}
          </View>

          {/* Suggestions dropdown */}
          {(showSuggest && (filteredUsers.length > 0 || usersLoading || usersErr)) && (
            <View style={styles.suggestWrap}>
              {usersLoading && (
                <View style={styles.suggestLoading}>
                  <ActivityIndicator size="small" color="#fff" />
                  <Text style={styles.suggestLoadingTxt}>Loading users…</Text>
                </View>
              )}

              {!!usersErr && !usersLoading && (
                <Text style={styles.suggestErr}>Could not load users</Text>
              )}

              {!usersLoading &&
                !usersErr &&
                filteredUsers.map((u) => (
                  <TouchableOpacity
                    key={u.id}
                    style={styles.suggestItem}
                    activeOpacity={0.85}
                    onPress={() => onPickUser(u)}
                    disabled={submitting}
                  >
                    <Avatar uri={u?.avatar} name={u.name} size={28} border />
                    <Text style={styles.suggestName} numberOfLines={1}>
                      {u.name}
                    </Text>
                    <View style={{ flex: 1 }} />
                    <Feather name="plus-circle" size={18} color="#C9CED8" />
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

          {/* Location (Google Places) */}
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
              query={placesQuery}
              GooglePlacesDetailsQuery={{ fields: 'geometry,name,formatted_address' }}
              timeout={20000}
              textInputProps={{
                ref: placesInputRef,
                value: location,
                onChangeText: setLocation,
                placeholderTextColor: '#8D8D97',
                onFocus: () => {
                  scrollToRef(placesInputRef.current);
                },
                editable: !submitting,
              }}
              onPress={(data, details) => {
                const label =
                  data?.description ?? data?.structured_formatting?.main_text ?? '';
                if (label && label !== location) setLocation(label);

                const loc = (details as any)?.geometry?.location;
                if (loc && typeof loc.lat === 'number' && typeof loc.lng === 'number') {
                  setCoords({ lat: loc.lat, lng: loc.lng });
                }
              }}
              onFail={(err) => console.warn('Places error:', err)}
              onNotFound={() => console.log('Places: no results')}
              styles={{
                container: { flex: 0 },
                textInputContainer: {
                  padding: 0,
                  borderTopWidth: 0,
                  borderBottomWidth: 0,
                },
                textInput: styles.placesInput,
                listView: styles.placesList, // normal flow, scrollable
                row: styles.placesRow,
                description: { color: '#EDEDF4' },
                separator: { height: StyleSheet.hairlineWidth, backgroundColor: OUTLINE },
              }}
              predefinedPlaces={[]}
            />
          </View>

          {/* Submit button as part of scroll */}
          <View style={styles.submitBar}>
            <TouchableOpacity
              activeOpacity={0.9}
              style={[styles.submitBtn, (!canSubmit || submitting) && { opacity: 0.6 }]}
              onPress={onSubmit}
              disabled={!canSubmit || submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <TText style={styles.submitText}>Submit</TText>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/* ---------- Small subcomponents ---------- */
function FieldLabel({ label }: { label: string }) {
  return <TText style={styles.fieldLabel}>{label}</TText>;
}

/* ---------------------------- Styles ---------------------------- */
const BG = '#0B0B12';
const INPUT = 'rgba(255,255,255,0.08)';
const OUTLINE = 'rgba(255,255,255,0.16)';
const TEXT = '#EDEDF4';
const ACCENT = '#201A83';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  flex1: { flex: 1 },

  header: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: OUTLINE,
  },
  headerTitle: {
    color: TEXT,
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
  },

  mediaBox: {
    height: 260,
    backgroundColor: '#240A0E',
    marginTop: 6,
    marginHorizontal: 16,
    borderRadius: 8,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaSelected: { backgroundColor: '#000' },
  mediaEmptyInner: { alignItems: 'center', gap: 10 },
  mediaHint: { color: '#EF2C2C', fontSize: 16 },

  thumbWrap: {
    width: 120,
    height: 120,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#0B0C12',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: OUTLINE,
  },
  thumb: { width: '100%', height: '100%' },
  removeBtn: {
    position: 'absolute',
    right: 6,
    top: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  changeOverlay: {
    position: 'absolute',
    alignSelf: 'center',
    bottom: 14,
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  changeOverlayText: { color: '#fff', fontWeight: '600' },

  watermark: {
    marginTop: 8,
    marginHorizontal: 16,
    backgroundColor: '#2A2A31',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 6,
  },
  watermarkText: { color: '#C8C8CF', fontSize: 13 },

  fieldLabel: {
    color: TEXT,
    fontWeight: '700',
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
    justifyContent: 'center',
  },
  multilineWrap: {
    paddingVertical: 8,
  },
  input: { color: TEXT, fontSize: 15 },
  multilineInput: {
    minHeight: 80,
  },

  tagContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: 16,
    marginTop: 8,
    gap: 6,
  },
  tagChip: {
    flexDirection: 'row',
    backgroundColor: ACCENT,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    alignItems: 'center',
    gap: 6,
  },
  tagText: { color: '#fff', fontSize: 14 },

  /* Suggestions list */
  suggestWrap: {
    marginHorizontal: 16,
    marginTop: 6,
    borderRadius: 12,
    backgroundColor: '#12141A',
    borderWidth: 1,
    borderColor: OUTLINE,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.2,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
      },
      android: { elevation: 2 },
    }),
  },
  suggestLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  suggestLoadingTxt: { color: '#fff' },
  suggestErr: {
    color: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  suggestEmpty: {
    color: '#C8C8CF',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  suggestItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: OUTLINE,
  },
  suggestName: { color: '#EDEDF4', fontSize: 14, fontWeight: '700', maxWidth: '75%' },

  /* Google Places */
  placesWrap: {
    marginHorizontal: 16,
    marginTop: 6,
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
    backgroundColor: '#12141A',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  placesList: {
    backgroundColor: '#12141A',
    borderRadius: 12,
    marginTop: 6,
    borderWidth: 1,
    borderColor: OUTLINE,
  },

  submitBar: {
    marginTop: 18,
    paddingHorizontal: 16,
  },
  submitBtn: {
    height: 52,
    backgroundColor: ACCENT,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
