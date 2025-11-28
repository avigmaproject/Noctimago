// src/screens/EventsScreen.tsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert } from 'react-native';
import { createThumbnail } from 'react-native-create-thumbnail';
import {
  View,
  Text,
  StyleSheet,

  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  StatusBar,
  Platform,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Pressable,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useSelector } from 'react-redux';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
// i18n
import { TText } from '../../../i18n/TText';
import { useAutoI18n } from '../../../i18n/AutoI18nProvider';

// deeplink helper
import { openDirections } from '../../../utils/openDirections';

// API
import { getallpost } from '../../../utils/apiconfig'; // adjust if your path differs

const COLORS = {
  bg: '#0B0C0F',
  surface: '#111318',
  surfaceRaised: '#131720',
  field: '#1A1F29',
  text: '#E5E7EB',
  sub: '#A1A8B3',
  border: '#262A33',
  pill: '#1A1F29',
  pillBorder: '#2D3440',
  accent: '#3D68FF',
  cardBorder: '#1E2430',
  icon: '#C7CCD6',
  button: '#1A1F29',
  buttonText: '#E6E8EE',
};

const FALLBACK_IMG =
  '';
  const decodeHtmlEntities = (s: string) =>
    s
      .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) =>
        String.fromCodePoint(parseInt(hex, 16))
      )
      .replace(/&#(\d+);/g, (_, dec) =>
        String.fromCodePoint(parseInt(dec, 10))
      );
      const decodeCurlyUnicode = (s: string) =>
        s.replace(/u\{([0-9a-fA-F]+)\}/g, (_, hex) =>
          String.fromCodePoint(parseInt(hex, 16))
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
/* ---------------- API types (based on your response) ---------------- */
type ApiPost = {
  ID: number | string;
  title: string;
  author_id: number | string;
  author: string;
  date: string; // "YYYY-MM-DD HH:mm:ss"
  fields?: {
    event?: string;
    location?: string;
    images?: string; // CSV
    video?: string;
    latitude?: string;
    longitude?: string;
    is_remember?: boolean | number | string;
  };
};

type ApiResponse = {
  status: 'success' | 'error';
  page: number;
  per_page: number;
  total: number;
  totalPages: number;
  posts: ApiPost[];
};

/* ---------------- List item model for this screen ---------------- */
type EventItem = {
  id: string;
  title: string;        // post title
  eventName?: string;   // fields.event (human event name)
  image: string;
  video?: string;  
  date: string;         // SQL-like string from API
  venue: string;
  lat?: number;
  lng?: number;
};

/* ---------------- Helpers ---------------- */
const firstCsvImage = (csv?: string): string => {
  if (!csv) return '';
  const arr = csv.split(',').map(s => s.trim()).filter(Boolean);
  return arr[0] || '';
};

const toDateOnly = (sql: string) => {
  const d = new Date(sql.replace(' ', 'T'));
  if (isNaN(d.getTime())) return null;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
};

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const formatHumanDate = (sql: string) => {
  const d = new Date(sql.replace(' ', 'T'));
  return isNaN(d.getTime()) ? sql : d.toLocaleString();
};

const mapApiToEvent = (p: ApiPost): EventItem => {
  const imageFromCsv = firstCsvImage(p.fields?.images);
  const venue = p.fields?.location || '';
  const lat = p.fields?.latitude ? Number(p.fields.latitude) : undefined;
  const lng = p.fields?.longitude ? Number(p.fields.longitude) : undefined;

  return {
    id: String(p.ID),
    title: p.title || 'Untitled',
    eventName: p.fields?.event || undefined,
    image: imageFromCsv || undefined,          // only real images
    video: p.fields?.video || undefined,       // keep video URL
    date: p.date,
    venue,
    lat: Number.isFinite(lat!) ? lat : undefined,
    lng: Number.isFinite(lng!) ? lng : undefined,
  };
};




export default function EventsScreen() {
  const token = useSelector((s: any) => s.authReducer?.token);

  const [query, setQuery] = useState('');
  const [events, setEvents] = useState<EventItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [selectedEventName, setSelectedEventName] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // Modals
  const [locSheet, setLocSheet] = useState(false);
  const [titleSheet, setTitleSheet] = useState(false);
  const [datePickerVisible, setDatePickerVisible] = useState(false);

  // i18n
  const [locLbl] = useState('Location');
  const [dateLbl] = useState('Date');
  const [eventLbl] = useState('Event Title');
  const { translate, lang } = useAutoI18n();
  const [searchPH, setSearchPH] = useState('Search events, artists, or venues');
  const insets = useSafeAreaInsets();

  useEffect(() => {
    let alive = true;
    (async () => {
      const t = await translate('Search events, artists, or venues', { from: 'en', to: lang });
      if (alive) setSearchPH(t);
    })();
    return () => { alive = false; };
  }, [lang, translate]);
  const [reminderById, setReminderById] = useState<Record<string, boolean>>({});
  const [reminderLoadingId, setReminderLoadingId] = useState<string | null>(null);

  // Helper to coerce booleans from various API shapes
  const toBool = (v: any) => {
    if (typeof v === 'boolean') return v;
    if (typeof v === 'number') return v !== 0;
    if (typeof v === 'string') return ['true','1','yes','on'].includes(v.toLowerCase());
    return undefined;
  };

  // Call your endpoint to toggle/check reminder
  const toggleReminder = useCallback(async (postId: string) => {
    if (!token) {
      Alert.alert('Login required', 'Please sign in to set reminders.');
      return;
    }
  
    try {
      setReminderLoadingId(postId);
  
      const res = await fetch(`https://noctimago.com/wp-json/app/v1/is_remember/${postId}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      });
  
      const json = await res.json();
      console.log('Reminder API:', json);
  
      if (res.ok && json?.status === 'success') {
        const newState = !!json.is_remember;
        setReminderById(prev => ({ ...prev, [postId]: newState }));
        Alert.alert('Reminder', newState ? 'Reminder set for this event.' : 'Reminder removed.');
      } else {
        Alert.alert('Reminder', json?.message || 'Failed to update reminder.');
      }
    } catch (e) {
      console.log('toggleReminder error:', e);
      Alert.alert('Reminder', 'Network error. Please try again.');
    } finally {
      setReminderLoadingId(null);
    }
  }, [token]);
  
  

  /* ---------------- Load from API ---------------- */
  const load = useCallback(
    async (targetPage = 1, mode: 'replace' | 'append' = 'replace') => {
      if (loading) return;
      setLoading(true);
      setError(null);
      try {
        const res: ApiResponse = await getallpost(token, targetPage);
        const list = (res?.posts || []).map(mapApiToEvent);
        const nextMap: Record<string, boolean> = {};
for (const p of res?.posts || []) {
  const v = toBool((p as any)?.is_remember) ?? toBool((p as any)?.fields?.is_remember);
  if (typeof v === 'boolean') nextMap[String(p.ID)] = v;
}
setReminderById(prev => (mode === 'replace' ? nextMap : { ...prev, ...nextMap }));

        setTotalPages(res?.totalPages || 1);
        setPage(res?.page || targetPage);
        setEvents(prev => (mode === 'replace' ? list : [...prev, ...list]));
      } catch (e) {
        console.log('[Events load] error =', e);
        setError('Could not load events.');
      } finally {
        setLoading(false);
      }
    },
    [token, loading]
  );

  useEffect(() => {
    load(1, 'replace');
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load(1, 'replace');
    setRefreshing(false);
  };

  const loadMore = () => {
    if (loading) return;
    if (page >= totalPages) return;
    load(page + 1, 'append');
  };

  /* ---------------- Options for sheets ---------------- */
  const locationOptions = useMemo(
    () =>
      Array.from(
        new Set(events.map(e => e.venue).filter(Boolean))
      ).sort((a, b) => a.localeCompare(b)),
    [events]
  );

  const eventNameOptions = useMemo(
    () =>
      Array.from(
        new Set(events.map(e => e.eventName || e.title).filter(Boolean))
      ).sort((a, b) => a.localeCompare(b)),
    [events]
  );

  /* ---------------- Combined filtering ---------------- */
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    return events.filter((e) => {
      // search text
      const wordHit =
        !q ||
        e.title.toLowerCase().includes(q) ||
        (e.eventName || '').toLowerCase().includes(q) ||
        e.venue.toLowerCase().includes(q);

      // location
      const locOk = !selectedLocation || e.venue === selectedLocation;

      // event name
      const evName = e.eventName || e.title;
      const titleOk = !selectedEventName || evName === selectedEventName;

      // date
      const d = toDateOnly(e.date);
      const dateOk = !selectedDate || (d && sameDay(d, selectedDate));

      return wordHit && locOk && titleOk && dateOk;
    });
  }, [events, query, selectedLocation, selectedEventName, selectedDate]);

  const resetFilters = () => {
    setSelectedLocation(null);
    setSelectedEventName(null);
    setSelectedDate(null);
  };

  /* ---------------- UI ---------------- */
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="light-content" />

      {/* Search + filter header */}
      <View style={styles.listContent}>
        <View style={styles.searchWrap}>
          <Ionicons name="search" size={18} color={COLORS.icon} style={{ marginRight: 8 }} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={searchPH}
            placeholderTextColor={COLORS.sub}
            style={styles.searchInput}
            returnKeyType="search"
          />
          {(selectedLocation || selectedEventName || selectedDate) ? (
            <TouchableOpacity onPress={resetFilters} style={{ paddingHorizontal: 6, paddingVertical: 4 }}>
              <Text style={{ color: COLORS.accent, fontWeight: '700' }}>Reset</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.pillsRow}>
          <Pill
            label={selectedLocation ? truncate(selectedLocation, 18) : locLbl}
            icon="location-outline"
            onPress={() => setLocSheet(true)}
          />
          <Pill
            label={selectedDate ? selectedDate.toDateString() : dateLbl}
            icon="calendar-outline"
            onPress={() => setDatePickerVisible(true)}
          />
          <Pill
            label={selectedEventName ? truncate(selectedEventName, 18) : eventLbl}
            icon="options-outline"
            onPress={() => setTitleSheet(true)}
          />
        </View>
      </View>

      {/* List */}
      {error ? (
        <View style={{ alignItems: 'center', marginTop: 30 }}>
          <Text style={{ color: COLORS.sub, marginBottom: 10 }}>{error}</Text>
          <TouchableOpacity
            onPress={() => load(1, 'replace')}
            style={{ paddingHorizontal: 12, paddingVertical: 8, backgroundColor: COLORS.button, borderRadius: 8, borderColor: COLORS.cardBorder, borderWidth: 1 }}
          >
            <Text style={{ color: COLORS.buttonText, fontWeight: '700' }}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <EventCard
              item={item}
              reminderOn={!!reminderById[item.id]}
              reminderLoading={reminderLoadingId === item.id}
              onToggleReminder={() => toggleReminder(item.id)}
            />
          )}
          ItemSeparatorComponent={() => <View style={{ height: 16 }} />}
          contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#fff"
              titleColor="#fff"
            />
          }
          ListFooterComponent={
            loading && events.length > 0 ? (
              <View style={{ paddingVertical: 16 }}>
                <ActivityIndicator color="#fff" />
              </View>
            ) : null
          }
          onEndReachedThreshold={0.4}
          onEndReached={loadMore}
          ListEmptyComponent={
            !loading ? (
              <View style={{ alignItems: 'center', marginTop: 40 }}>
                <Text style={{ color: COLORS.sub }}>No events</Text>
              </View>
            ) : null
          }
        />
      )}

      {loading && events.length === 0 && (
        <View style={{ position: 'absolute', top: '45%', left: 0, right: 0, alignItems: 'center' }}>
          <ActivityIndicator color="#fff" />
        </View>
      )}

      {/* Location sheet */}
      <OptionSheet
        visible={locSheet}
        title="Choose a location"
        options={locationOptions}
        selected={selectedLocation}
        onClose={() => setLocSheet(false)}
        onClear={() => { setSelectedLocation(null); setLocSheet(false); }}
        onSelect={(v) => { setSelectedLocation(v); setLocSheet(false); }}
      />

      {/* Event title sheet */}
      <OptionSheet
        visible={titleSheet}
        title="Choose an event"
        options={eventNameOptions}
        selected={selectedEventName}
        onClose={() => setTitleSheet(false)}
        onClear={() => { setSelectedEventName(null); setTitleSheet(false); }}
        onSelect={(v) => { setSelectedEventName(v); setTitleSheet(false); }}
      />

      {/* Date picker */}
      <DateTimePickerModal
        isVisible={datePickerVisible}
        mode="date"
        onConfirm={(date) => {
          const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
          setSelectedDate(d);
          setDatePickerVisible(false);
        }}
        onCancel={() => setDatePickerVisible(false)}
      />
    </SafeAreaView>
  );
}

/* ---------------- Components ---------------- */

function Pill({
  label,
  icon,
  onPress,
}: {
  label: string;
  icon: string;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity style={styles.pill} onPress={onPress} activeOpacity={0.85}>
      <Ionicons name={icon as any} size={16} color={COLORS.icon} />
      <TText style={styles.pillText} numberOfLines={1}>{label}</TText>
      <Ionicons name="chevron-down" size={14} color={COLORS.icon} />
    </TouchableOpacity>
  );
}

function EventCard({
  item,
  reminderOn,
  reminderLoading,
  onToggleReminder,
}: {
  item: EventItem;
  reminderOn: boolean;
  reminderLoading: boolean;
  onToggleReminder: () => void;
}) {
  const [thumb, setThumb] = useState<string | null>(null);
  const [thumbError, setThumbError] = useState(false);

  // If we already have an image from CSV, we just use that.
  // If there is no image but there IS a video, we generate a thumbnail.
  const baseImage = item.image;
  const shouldMakeThumb = !baseImage && !!item.video && !thumb && !thumbError;

  useEffect(() => {
    let cancelled = false;

    if (!shouldMakeThumb) return;

    (async () => {
      try {
        const res = await createThumbnail({
          url: item.video!,      // video URL
          timeStamp: 1000,       // 1 second into the video
        });
        if (!cancelled && res?.path) {
          setThumb(res.path);
        }
      } catch (e) {
        console.log('thumbnail error', e);
        if (!cancelled) setThumbError(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [item.video, shouldMakeThumb]);

  const heroUri = baseImage || thumb || undefined;

  const handleDirections = () => {
    if (typeof item.lat === 'number' && typeof item.lng === 'number') {
      openDirections({ lat: item.lat, lng: item.lng, mode: 'driving' });
    } else if (item.venue) {
      openDirections({ address: item.venue, mode: 'driving' });
    }
  };

  const displayDate = formatHumanDate(item.date);


  return (
    <View style={styles.card}>
      {heroUri ? (
        <Image source={{ uri: heroUri }} style={styles.hero} />
      ) : (
        // no fallback image; just an empty dark block
        <View style={styles.hero} />
      )}

      <View style={{ padding: 12 }}>
      const [title, setTitle] = useState(
    normalizeEmoji(
      typeof initial.title === "string"
        ? initial.title
        : ""
    )
  );
        <Text style={styles.cardTitle}> {normalizeEmoji(item.title)}</Text>

        <View style={styles.metaRow}>
          <Ionicons name="time-outline" size={16} color={COLORS.icon} />
          <Text style={styles.metaText}>{displayDate}</Text>
        </View>

        {!!item.venue && (
          <View style={styles.metaRow}>
            <Ionicons name="location-outline" size={16} color={COLORS.icon} />
            <Text style={styles.metaText}>{item.venue}</Text>
          </View>
        )}

        <View style={styles.actionsRow}>
          <View style={{ width: '45%' }}>
            <ActionBtn
              icon={reminderOn ? 'notifications' : 'notifications-outline'}
              label={reminderOn ? 'Reminder On' : 'Set Reminder'}
              onPress={onToggleReminder}
              loading={reminderLoading}
              disabled={reminderLoading}
            />
          </View>
          <View style={{ width: '45%' }}>
            <ActionBtn
              icon="navigate-outline"
              label="Get Directions"
              onPress={handleDirections}
            />
          </View>
        </View>
      </View>
    </View>
  );
}



function ActionBtn({
  icon,
  label,
  onPress,
  disabled,
  loading,
}: {
  icon: string;
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.actionBtn, disabled && { opacity: 0.6 }]}
      onPress={onPress}
      activeOpacity={0.9}
      disabled={disabled}
    >
      {loading ? (
        <ActivityIndicator />
      ) : (
        <>
          <View style={{ marginLeft: 10, marginRight: 10 }}>
            <Ionicons name={icon as any} size={16} color={COLORS.text} />
          </View>
          <View style={{ width: '80%' }}>
            <TText style={styles.actionText}>{label}</TText>
          </View>
        </>
      )}
    </TouchableOpacity>
  );
}


/* Bottom option sheet (simple, cross-platform) */
function OptionSheet({
  visible,
  title,
  options,
  selected,
  onClose,
  onClear,
  onSelect,
}: {
  visible: boolean;
  title: string;
  options: string[];
  selected: string | null;
  onClose: () => void;
  onClear: () => void;
  onSelect: (v: string) => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.sheetBackdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>{title}</Text>
          <TouchableOpacity onPress={onClear}>
            <Text style={styles.sheetClear}>Clear</Text>
          </TouchableOpacity>
        </View>
        <FlatList
          data={options}
          keyExtractor={(s) => s}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          contentContainerStyle={{ paddingBottom: 14 }}
          renderItem={({ item }) => {
            const active = selected === item;
            return (
              <TouchableOpacity
                onPress={() => onSelect(item)}
                style={[styles.optionRow, active && styles.optionRowActive]}
                activeOpacity={0.85}
              >
                <Text style={[styles.optionTxt, active && styles.optionTxtActive]} numberOfLines={1}>
                  {item}
                </Text>
                {active ? <Ionicons name="checkmark" size={16} color="#fff" /> : null}
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingVertical: 20 }}>
              <Text style={{ color: COLORS.sub }}>No options</Text>
            </View>
          }
        />
      </View>
    </Modal>
  );
}

/* ---------------- Styles ---------------- */

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },

  listContent: { paddingHorizontal: 10 ,paddingVertical:10},

  /* Search */
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.field,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 44,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    color: COLORS.text,
    fontSize: 15,
    paddingVertical: 0,
  },

  /* Pills Row */
  pillsRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  pill: {
    flex: 1,
    minWidth: 0,
    height: 40,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: COLORS.pill,
    borderWidth: 1,
    borderColor: COLORS.pillBorder,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    justifyContent: 'center',
  },
  pillText: { color: COLORS.text, fontSize: 13, fontWeight: '700', flexShrink: 1 },

  /* Card */
  card: {
    backgroundColor: COLORS.surfaceRaised,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
      android: { elevation: 3 },
    }),
  },
  hero: { width: '100%', height: 190, backgroundColor: '#0A0B0E' },
  cardTitle: { color: COLORS.text, fontSize: 18, fontWeight: '800', marginBottom: 8 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  metaText: { color: COLORS.sub, fontSize: 14, fontWeight: '600' },

  actionsRow: { flexDirection: 'row',justifyContent:'space-between', marginTop: 10 ,gap:10},
  actionBtn: {
    flex: 1,
    width:"100%",
    height: 45,
    backgroundColor: COLORS.button,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
   
  },
  actionText: { color: COLORS.buttonText, fontSize: 12, fontWeight: '600' },

  /* Option sheet */
  sheetBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    backgroundColor: COLORS.surfaceRaised,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 14,
    borderTopWidth: 1,
    borderColor: COLORS.cardBorder,
    maxHeight: '65%',
  },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  sheetTitle: { color: COLORS.text, fontWeight: '800', fontSize: 16 },
  sheetClear: { color: COLORS.accent, fontWeight: '800' },
  optionRow: {
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    backgroundColor: COLORS.button,
    paddingHorizontal: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  optionRowActive: {
    borderColor: COLORS.accent,
  },
  optionTxt: { color: COLORS.text, fontWeight: '700', flexShrink: 1 },
  optionTxtActive: { color: '#fff' },
});

/* utils */
function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}
