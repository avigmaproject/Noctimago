// src/screens/EventsScreen.tsx
import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  StatusBar,
  Platform,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

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

type EventItem = {
  id: string;
  title: string;
  image: string;
  date: string;     // e.g. 'March 22–24, 2024 • 12:00 PM'
  venue: string;    // e.g. 'Bayfront Park, Miami'
};

const DATA: EventItem[] = [
  {
    id: '1',
    title: 'ULTRA Music Festival 2024',
    image:
      'https://images.unsplash.com/photo-1444824775686-4185f172c44b?q=80&w=1400&auto=format&fit=crop',
    date: 'March 22–24, 2024 • 12:00 PM',
    venue: 'Bayfront Park, Miami',
  },
  {
    id: '2',
    title: 'Neon Nights Party',
    image:
      'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=1400&auto=format&fit=crop',
    date: 'Sep 6, 2024 • 9:00 PM',
    venue: 'Arcadia Club, NYC',
  },
];

export default function EventsScreen() {
  const [query, setQuery] = useState('');
  const [loc, setLoc] = useState('Location');
  const [date, setDate] = useState('Date');
  const [type, setType] = useState('Event Type');

  const filtered = useMemo(() => {
    if (!query) return DATA;
    const q = query.toLowerCase();
    return DATA.filter(
      e =>
        e.title.toLowerCase().includes(q) ||
        e.venue.toLowerCase().includes(q)
    );
  }, [query]);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />
      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <>
            {/* Search */}
            <View style={styles.searchWrap}>
              <Ionicons name="search" size={18} color={COLORS.icon} style={{ marginRight: 8 }} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search events, artists, or venues"
                placeholderTextColor={COLORS.sub}
                style={styles.searchInput}
                returnKeyType="search"
              />
            </View>

            {/* Filter Row */}
            <View style={styles.pillsRow}>
              <Pill label={loc} icon="location-outline" onPress={() => { /* open location filter */ }} />
              <Pill label={date} icon="calendar-outline" onPress={() => { /* open date picker */ }} />
              <Pill label={type} icon="options-outline" onPress={() => { /* open type sheet */ }} />
            </View>
          </>
        }
        renderItem={({ item }) => <EventCard item={item} />}
        ItemSeparatorComponent={() => <View style={{ height: 16 }} />}
        showsVerticalScrollIndicator={false}
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
      <Text style={styles.pillText} numberOfLines={1}>{label}</Text>
      <Ionicons name="chevron-down" size={14} color={COLORS.icon} />
    </TouchableOpacity>
  );
}

function EventCard({ item }: { item: EventItem }) {
  return (
    <View style={styles.card}>
      <Image source={{ uri: item.image }} style={styles.hero} />

      <View style={{ padding: 12 }}>
        <Text style={styles.cardTitle}>{item.title}</Text>

        <View style={styles.metaRow}>
          <Ionicons name="time-outline" size={16} color={COLORS.icon} />
          <Text style={styles.metaText}>{item.date}</Text>
        </View>
        <View style={styles.metaRow}>
          <Ionicons name="location-outline" size={16} color={COLORS.icon} />
          <Text style={styles.metaText}>{item.venue}</Text>
        </View>

        <View style={styles.actionsRow}>
          <ActionBtn
            icon="notifications-outline"
            label="Set Reminder"
            onPress={() => {/* schedule notification */}}
          />
          <ActionBtn
            icon="navigate-outline"
            label="Get Directions"
            onPress={() => {/* open maps deeplink */}}
          />
        </View>
      </View>
    </View>
  );
}

function ActionBtn({
  icon,
  label,
  onPress,
}: {
  icon: string;
  label: string;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity style={styles.actionBtn} onPress={onPress} activeOpacity={0.9}>
      <Ionicons name={icon as any} size={18} color={COLORS.text} />
      <Text style={styles.actionText}>{label}</Text>
    </TouchableOpacity>
  );
}

/* ---------------- Styles ---------------- */

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },

  listContent: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 24,
  },

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
  pillsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
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
    gap: 6,
    justifyContent: 'center',
  },
  pillText: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '700',
    flexShrink: 1,
  },

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
  hero: {
    width: '100%',
    height: 190,
    backgroundColor: '#0A0B0E',
  },
  cardTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  metaText: {
    color: COLORS.sub,
    fontSize: 14,
    fontWeight: '600',
  },

  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 10,
  },
  actionBtn: {
    flex: 1,
    height: 44,
    backgroundColor: COLORS.button,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  actionText: {
    color: COLORS.buttonText,
    fontSize: 15,
    fontWeight: '800',
  },
});
