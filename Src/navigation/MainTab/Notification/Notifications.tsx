import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  StatusBar,
  SafeAreaView,
} from 'react-native';
import Feather from 'react-native-vector-icons/Feather';

type TabKey = 'All' | 'Social' | 'System';

type NotificationItem = {
  id: string;
  name: string;
  action: string;      // e.g. "liked your photo"
  timeAgo: string;     // e.g. "2m ago"
  avatar: string;      // url
  thumb?: string;      // right-side image
  type: TabKey;        // for filtering by tab
};

const DATA: NotificationItem[] = [
  {
    id: '1',
    name: 'Alex Thompson',
    action: 'liked your photo',
    timeAgo: '2m ago',
    avatar: 'https://randomuser.me/api/portraits/women/72.jpg',
    thumb: 'https://picsum.photos/id/1011/120/120',
    type: 'Social',
  },
  {
    id: '2',
    name: 'Sarah Wilson',
    action: 'mentioned you in a comment',
    timeAgo: '15m ago',
    avatar: 'https://randomuser.me/api/portraits/women/65.jpg',
    thumb: 'https://picsum.photos/id/1015/120/120',
    type: 'Social',
  },
  {
    id: '3',
    name: 'Chris Evans',
    action: "tagged you in Friday's event photos",
    timeAgo: '1h ago',
    avatar: 'https://randomuser.me/api/portraits/men/11.jpg',
    thumb: 'https://picsum.photos/id/1025/120/120',
    type: 'Social',
  },
  {
    id: '4',
    name: 'System',
    action: 'Your password was changed successfully',
    timeAgo: '1d ago',
    avatar: 'https://picsum.photos/seed/system/64/64',
    type: 'System',
  },
];

export default function NotificationsScreen() {
  const [tab, setTab] = useState<TabKey>('All');

  const listData = useMemo(() => {
    if (tab === 'All') return DATA;
    return DATA.filter(n => n.type === tab);
  }, [tab]);

  const renderItem = ({ item }: { item: NotificationItem }) => (
    <View style={styles.row}>
      {/* Left: Avatar */}
      <Image source={{ uri: item.avatar }} style={styles.avatar} />

      {/* Middle: Text */}
      <View style={styles.middle}>
        <Text style={styles.title}>
          <Text style={styles.bold}>{item.name} </Text>
          {item.action}
        </Text>
        <Text style={styles.time}>{item.timeAgo}</Text>
      </View>

      {/* Right: Thumbnail (optional) */}
      {item.thumb ? (
        <Image source={{ uri: item.thumb }} style={styles.thumb} />
      ) : (
        <View style={{ width: 52 }} />
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerText}>Notifications</Text>
      </View>

      {/* Segmented tabs */}
      <View style={styles.segmentOuter}>
        {(['All', 'Social', 'System'] as TabKey[]).map(k => {
          const active = k === tab;
          return (
            <TouchableOpacity
              key={k}
              activeOpacity={0.9}
              onPress={() => setTab(k)}
              style={[styles.segmentBtn, active && styles.segmentBtnActive]}
            >
              <Text style={[styles.segmentLabel, active && styles.segmentLabelActive]}>
                {k}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* List */}
      <FlatList
        data={listData}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        contentContainerStyle={{ paddingBottom: 100 }} // space for bottom bar
        style={{ flex: 1 }}
      />

      {/* Bottom nav (mock) */}
     
    </SafeAreaView>
  );
}

function NavItem({ icon, label, active }: { icon: string; label: string; active?: boolean }) {
  return (
    <View style={styles.navItem}>
      <Feather name={icon as any} size={20} color={active ? '#F44336' : '#B7B7C2'} />
      <Text style={[styles.navText, active && { color: '#F44336' }]}>{label}</Text>
    </View>
  );
}

/* ---------------------------- Styles ---------------------------- */

const BG = '#0B0B12';
const CARD = '#17171F';
const OUTLINE = 'rgba(255,255,255,0.12)';
const TEXT = '#EDEDF4';
const SUBTEXT = '#9A9AA5';
const ACCENT = '#F44336';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  header: {
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: OUTLINE,
    alignItems: 'center',
  },
  headerText: { color: TEXT, fontSize: 20, fontWeight: '700' },

  segmentOuter: {
    marginHorizontal: 16,
    marginTop: 14,
    backgroundColor: CARD,
    borderRadius: 14,
    flexDirection: 'row',
    padding: 6,
    gap: 8,
  },
  segmentBtn: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentBtnActive: {
    backgroundColor: '#2B2B35',
    borderWidth: 1,
    borderColor: 'rgba(244,67,54,0.6)',
  },
  segmentLabel: { color: '#A5A5B2', fontWeight: '600' },
  segmentLabelActive: { color: ACCENT },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  avatar: { width: 44, height: 44, borderRadius: 22, marginRight: 12 },
  middle: { flex: 1 },
  title: { color: TEXT, fontSize: 15, lineHeight: 20 },
  bold: { fontWeight: '700', color: TEXT },
  time: { color: SUBTEXT, marginTop: 4, fontSize: 12 },
  thumb: { width: 52, height: 52, borderRadius: 8, marginLeft: 12 },

  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: OUTLINE,
    marginLeft: 74, // aligns with text start (avatar + margin)
    marginRight: 18,
  },

  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 64,
    backgroundColor: '#14141C',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: OUTLINE,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingBottom: 8,
  },
  navItem: { alignItems: 'center', gap: 2 },
  navText: { color: '#B7B7C2', fontSize: 11 },
});
