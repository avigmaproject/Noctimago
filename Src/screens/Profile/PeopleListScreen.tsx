// Src/screens/PeopleList/PeopleListScreen.tsx
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Feather from 'react-native-vector-icons/Feather';
import { useFocusEffect, useRoute, RouteProp, useNavigation } from '@react-navigation/native';
import { useSelector } from 'react-redux';
import { SafeAreaView } from 'react-native-safe-area-context';

import { profile as fetchProfile } from '../../utils/apiconfig';
import { TText } from '../../i18n/TText';
import Avatar from '../../utils/Avatar';

const COLORS = {
  bg: '#0E0E12',
  card: '#16161C',
  cardElev: '#1A1A22',
  text: '#FFFFFF',
  subtext: '#9CA3AF',
  accent: '#F43F5E',
  green: '#22C55E',
  gray: '#6B7280',
  divider: 'rgba(255,255,255,0.06)',
  border: 'rgba(255,255,255,0.08)',
};

type Person = {
  ID: number;
  name: string;
  email?: string;
  profile_image?: string;
};

type ParamList = {
  PeopleList: {
    userId: number;
    type: 'followers' | 'following';
    initial?: Person[];
    titleOverride?: string;
  };
};

type PeopleListRoute = RouteProp<ParamList, 'PeopleList'>;

function normalizeS3Url(url?: string): string {
  if (!url) return '';
  try {
    const dec = decodeURIComponent(url);
    return dec.replace(/\s+/g, ' ');
  } catch {
    return url.replace(/%2F/gi, '/');
  }
}

export default function PeopleListScreen() {
  const route = useRoute<PeopleListRoute>();
  const navigation = useNavigation<any>();

  const token = useSelector((s: any) => s.authReducer.token);
  const { type, userId, initial, titleOverride } = route.params || {};

  const [loading, setLoading] = useState<boolean>(!initial);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [people, setPeople] = useState<Person[]>(initial ?? []);
  const [error, setError] = useState<string>('');
  const [query, setQuery] = useState<string>('');

  const headerTitle = titleOverride ?? (type === 'followers' ? 'Followers' : 'Following');

  const handleBack = () => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate('Profile'); // fallback
  };

  const load = useCallback(async () => {
    if (!token) return;
    setError('');
    try {
      setLoading(true);
      const res = await fetchProfile(token);
      const prof = res?.profile;

      let list: Person[] = [];
      if (type === 'followers') {
        list = (prof?.followers ?? []) as Person[];
      } else {
        list = (prof?.following ?? []) as Person[];
      }
      setPeople(Array.isArray(list) ? list : []);
    } catch (e: any) {
      setError('Unable to load people. Please try again.');
      console.log('[PeopleList] load error =>', e);
    } finally {
      setLoading(false);
    }
  }, [token, type]);

  useFocusEffect(
    useCallback(() => {
      if (!initial) load();
    }, [initial, load])
  );

  const onRefresh = useCallback(async () => {
    if (!token) return;
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load, token]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return people;
    return people.filter(
      p =>
        p?.name?.toLowerCase()?.includes(q) ||
        p?.email?.toLowerCase()?.includes(q)
    );
  }, [people, query]);

  const renderItem = ({ item }: { item: Person }) => {
    console.log("profile_image",route)
    const AVATAR_PLACEHOLDER =
  "https://upload.wikimedia.org/wikipedia/commons/thumb/b/bc/Unknown_person.jpg/1200px-Unknown_person.jpg";

    const avatarUri =
      normalizeS3Url(item?.profile_image) 
    return (
      <TouchableOpacity
        activeOpacity={0.85}
        style={[styles.card, styles.row]}
        onPress={() => {
          // navigation.navigate('UserProfile', { userId: item.ID });
          navigation.navigate  ("ViewProfileScreen", { NTN_User_PkeyID: Number(item.ID) || undefined })}}
        
      >
        <Avatar
      uri={item?.profile_image}
      name={item?.name}
      size={30}
      border
    />
        {/* <Image source={{ uri: item?.profile_image? item?.profile_image: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/bc/Unknown_person.jpg/1200px-Unknown_person.jpg" }} style={styles.avatar} /> */}
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{item?.name ?? 'Unknown'}</Text>
          {/* {item?.email ? <TText style={styles.muted}>{item.email}</TText> : null} */}
        </View>
        <Feather name="chevron-right" size={18} color={COLORS.subtext} />
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* Header with back icon */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={handleBack}
          style={styles.backBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Feather name="chevron-left" size={22} color={COLORS.text} />
        </TouchableOpacity>

        <TText style={styles.headerTitle}>{headerTitle}</TText>

        {/* spacer to balance layout */}
        <View style={{ width: 34 }} />
      </View>

      {/* Search */}
      <View style={[styles.card, styles.searchCard]}>
        <Feather name="search" size={16} color={COLORS.subtext} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search people"
          placeholderTextColor={COLORS.subtext}
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
          autoCapitalize="none"
        />
        {query ? (
          <TouchableOpacity onPress={() => setQuery('')}>
            <Feather name="x" size={16} color={COLORS.subtext} />
          </TouchableOpacity>
        ) : null}
      </View>

      {loading ? (
        <View style={styles.centerWrap}>
          <ActivityIndicator />
          <TText style={[styles.muted, { marginTop: 10 }]}>Loading…</TText>
        </View>
      ) : error ? (
        <View style={styles.centerWrap}>
          <TText style={[styles.muted, { textAlign: 'center' }]}>{error}</TText>
          <TouchableOpacity onPress={load} style={[styles.retryBtn]}>
            <TText style={styles.retryText}>Retry</TText>
          </TouchableOpacity>
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.centerWrap}>
          <Feather name="users" size={24} color={COLORS.subtext} />
          <TText style={[styles.muted, { marginTop: 10 }]}>
            {type === 'followers'
              ? 'No followers yet.'
              : 'Not following anyone yet.'}
          </TText>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item, idx) => `${item?.ID ?? idx}`}
          renderItem={renderItem}
          refreshControl={
            <RefreshControl
              tintColor="#fff"
              colors={['#fff']}
              refreshing={refreshing}
              onRefresh={onRefresh}
            />
          }
          contentContainerStyle={{ paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },

  header: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 12,
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomColor: COLORS.divider,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    flex: 1,
  },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },

  card: {
    backgroundColor: COLORS.cardElev,
    borderRadius: 16,
    padding: 14,
    marginHorizontal: 16,
    marginTop: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    ...Platform.select({
      android: { elevation: 1 },
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 },
      },
    }),
  },

  row: { flexDirection: 'row', alignItems: 'center', columnGap: 10 },

  title: { color: COLORS.text, fontSize: 16, fontWeight: '600' },
  muted: { color: COLORS.subtext, marginTop: 2, fontSize: 13 },

  avatar: { width: 44, height: 44, borderRadius: 22 },

  searchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 10,
  },
  searchInput: {
    flex: 1,
    color: COLORS.text,
    fontSize: 14,
    paddingVertical: 6,
  },

  centerWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },

  retryBtn: {
    marginTop: 12,
    backgroundColor: COLORS.card,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
  },
  retryText: { color: COLORS.text, fontWeight: '700' },
});
