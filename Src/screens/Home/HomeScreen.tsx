import React, {useEffect, useMemo, useRef, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  Image,
  TouchableOpacity,
  StatusBar,
  LayoutChangeEvent,
  Animated,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {useFocusEffect} from '@react-navigation/native';
import { profile } from '../../utils/apiconfig';
import { UserProfile } from '../../store/action/auth/action';
import {useSelector, useDispatch} from 'react-redux';
/*
  Noctimago — Home Feed Screen
  - Dark theme
  - Top bar: logo, search, avatar
  - Fixed (non-scroll) tab bar with icons (All, By Location, By Date/Event, Video Only)
  - Post cards list (author row, time, title, image, actions)
*/

const COLORS = {
  bg: '#0B0C0F',
  surface: '#101217',
  card: '#12141A',
  border: '#1E2128',
  text: '#E5E7EB',
  sub: '#9CA3AF',
  accent: '#E53935',
  icon: '#C0C3CC',
};

const AVATAR = 'https://i.pravatar.cc/120?img=12';

const FILTERS = [
  {key: 'all', label: 'All', icon: 'ellipsis-horizontal'},
  {key: 'location', label: 'By Location', icon: 'navigate-outline'},
  {key: 'date', label: 'By Date/Event', icon: 'calendar'},
  {key: 'video', label: 'Video Only', icon: 'videocam-outline'},
] as const;

type Post = {
  id: string;
  author: string;
  avatar: string;
  title: string;
  timeAgo: string;
  image: string;
  likes: number;
  comments: number;
};

const SAMPLE_POSTS: Post[] = [
  {
    id: '1',
    author: 'Dorian Lightwood',
    avatar:
      'https://images.unsplash.com/photo-1544006659-f0b21884ce1d?q=80&w=200&auto=format&fit=crop',
    title: 'Summer Music Festival 2024',
    timeAgo: '5h',
    image:
      'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=1400&auto=format&fit=crop',
    likes: 12034,
    comments: 89,
  },
  {
    id: '2',
    author: 'EventPro',
    avatar:
      'https://images.unsplash.com/photo-1547425260-76bcadfb4f2c?q=80&w=200&auto=format&fit=crop',
    title: 'Tech Conference 2024',
    timeAgo: '6h',
    image:
      'https://images.unsplash.com/photo-1551836022-d5d88e9218df?q=80&w=1400&auto=format&fit=crop',
    likes: 3201,
    comments: 42,
  },
  {
    id: '3',
    author: 'EventPro',
    avatar:
      'https://images.unsplash.com/photo-1547425260-76bcadfb4f2c?q=80&w=200&auto=format&fit=crop',
    title: 'Tech Conference 2024',
    timeAgo: '6h',
    image:
      'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=1400&auto=format&fit=crop',
    likes: 12034,
    comments: 89,
  },
];

export default function HomeScreen({navigation}) {
  const [active, setActive] = useState<typeof FILTERS[number]['key']>('all');
  const dispatch = useDispatch();
  // ---- Fixed Tabs: indicator animation ----
  const indicatorX = useRef(new Animated.Value(0)).current;
  const [tabsWidth, setTabsWidth] = useState(0);
  const tabCount = FILTERS.length;
  const tabWidth = tabsWidth > 0 ? tabsWidth / tabCount : 0;
  const activeIndex = FILTERS.findIndex(f => f.key === active);
  const token = useSelector((state: any) => state.authReducer.token); // <-- top-level hook

  const GetUserHome = async () => {
    try {
      console.log('[GetUserHome] token =', token); // <-- should log now
      const res = await profile(token);
      console.log('[GetUserHome] res =', res);

      // adjust to your actual response shape
      const user = res?.[0]?.[0] ?? res?.data ?? res;
      dispatch(UserProfile(res));
    } catch (error) {
      console.log('[GetUserHome] error =', error);
    }
  };

  // Call on focus (remove the extra useEffect)
  useFocusEffect(
    React.useCallback(() => {
      GetUserHome();
      // no cleanup needed
    }, [token]) // re-run if token changes
  );
  useEffect(() => {
    Animated.spring(indicatorX, {
      toValue: activeIndex * tabWidth,
      useNativeDriver: true,
      bounciness: 6,
      speed: 12,
    }).start();
  }, [activeIndex, tabWidth, indicatorX]);

  const onTabsLayout = (e: LayoutChangeEvent) => {
    setTabsWidth(e.nativeEvent.layout.width);
  };

  const filtered = useMemo(() => {
    // demo filtering: replace with your logic
    switch (active) {
      case 'video':
        return SAMPLE_POSTS.slice(0, 1);
      case 'location':
      case 'date':
      case 'all':
      default:
        return SAMPLE_POSTS;
    }
  }, [active]);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />
      {/* Top bar */}
      <View style={styles.topbar}>
        <View style={styles.brandRow}>
          <Image
            source={require('../../assets/Logo.png')}
            resizeMode="contain"
            style={styles.logo}
          />
        </View>
        <View style={styles.topActions}>
          <TouchableOpacity style={styles.iconBtn}>
            <Ionicons name="search" size={20} color={COLORS.icon} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.avatarWrap}onPress={() => navigation.navigate('ProfileScreen')}>
            <Image source={{uri: AVATAR}} style={styles.avatar} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Fixed Tab Bar (no ScrollView) */}
      <View style={styles.tabsWrap} onLayout={onTabsLayout}>
        {/* Animated underline */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.tabIndicator,
            {
              width: tabWidth,
              transform: [{translateX: indicatorX}],
            },
          ]}
        />
        {FILTERS.map(f => {
          const focused = active === f.key;
          return (
            <TouchableOpacity
              key={f.key}
              onPress={() => setActive(f.key)}
              activeOpacity={0.85}
              style={styles.tabBtn}
            >
              <Ionicons
                name={f.icon}
                size={20}
                color={focused ? COLORS.accent : COLORS.icon}
              />
              <Text
                style={[
                  styles.tabLabel,
                  focused && {color: COLORS.accent},
                ]}
                numberOfLines={1}
              >
                {f.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Feed */}
      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        renderItem={({item}) => <PostCard post={item} />}
        contentContainerStyle={{paddingBottom: 24}}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

function PostCard({post}: {post: Post}) {
  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.rowBetween}>
        <View style={styles.row}>
          <Image source={{uri: post.avatar}} style={styles.postAvatar} />
          <View>
            <Text style={styles.author}>{post.author}</Text>
            <Text style={styles.time}>{post.timeAgo} ago</Text>
          </View>
        </View>
        <TouchableOpacity hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
          <Ionicons name="ellipsis-vertical" size={18} color={COLORS.icon} />
        </TouchableOpacity>
      </View>

      {/* Title */}
      <Text style={styles.title}>{post.title}</Text>

      {/* Media */}
      <Image source={{uri: post.image}} style={styles.media} />

      {/* Actions */}
      <View style={[styles.rowBetween, {marginTop: 10}]}>
        <View style={styles.row}>
          <Ionicons name="heart-outline" size={20} color={COLORS.icon} />
          <Text style={styles.meta}>{abbreviate(post.likes)}</Text>
          <View style={{marginLeft: 20, flexDirection: 'row'}}>
            <Ionicons name="chatbubble-outline" size={20} color={COLORS.icon} />
            <Text style={styles.meta}>{abbreviate(post.comments)}</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.row}>
          <Ionicons name="person-add-outline" size={20} color={COLORS.icon} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

/* ---------- Utils ---------- */
function abbreviate(n: number) {
  if (n < 1000) return String(n);
  if (n < 10000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  if (n < 1_000_000) return Math.round(n / 1000) + 'K';
  return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
}

/* ---------- Styles ---------- */
const styles = StyleSheet.create({
  safe: {flex: 1, backgroundColor: COLORS.bg},

  topbar: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 10,
    backgroundColor: COLORS.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomColor: COLORS.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  brandRow: {flexDirection: 'row', alignItems: 'center'},
  topActions: {flexDirection: 'row', alignItems: 'center'},
  iconBtn: {padding: 8, marginRight: 8},
  avatarWrap: {width: 30, height: 30, borderRadius: 15, overflow: 'hidden'},
  avatar: {width: '100%', height: '100%'},
  logo: {width: 190, height: 36, alignSelf: 'center', justifyContent: 'center'},

  /* ---- Tabs ---- */
  tabsWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderBottomColor: COLORS.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    position: 'relative',
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  tabLabel: {color: COLORS.text, fontSize: 10, fontWeight: '700'},
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    height: 2,
    backgroundColor: COLORS.accent,
    borderRadius: 2,
  },

  /* ---- Cards ---- */
  card: {
    backgroundColor: COLORS.card,
    marginHorizontal: 12,
    marginTop: 12,
    padding: 12,
    borderRadius: 14,
    borderColor: COLORS.border,
    borderWidth: StyleSheet.hairlineWidth,
  },
  row: {flexDirection: 'row', alignItems: 'center', gap: 8},
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  postAvatar: {width: 36, height: 36, borderRadius: 18, marginRight: 8},
  author: {color: COLORS.text, fontWeight: '700'},
  time: {color: COLORS.sub, marginTop: 2, fontSize: 12},
  title: {color: COLORS.text, fontSize: 16, fontWeight: '600', marginVertical: 10},
  media: {width: '100%', height: 240, borderRadius: 12, backgroundColor: '#0A0B0E'},
  meta: {color: COLORS.text, marginLeft: 6, fontWeight: '600'},
  sep: {height: 12},
});
