import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput,
  ActivityIndicator, Platform, KeyboardAvoidingView
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Feather from 'react-native-vector-icons/Feather';
import firestore from '@react-native-firebase/firestore';
import { AvoidSoftInputView } from 'react-native-avoid-softinput';

const COLORS = { bg:'#0B0B12', card:'#15151F', text:'#EDEDF4', sub:'#9A9AA5', line:'rgba(255,255,255,0.08)', primary:'#F44336' };

type WPUser = {
  ID: number | string;
  display_name?: string;
  user_login?: string;
  username?: string;
  email?: string;
  profile_image?: string;
};

const parseUsersPayload = (json: any): WPUser[] => {
  const list = Array.isArray(json?.users) ? json.users : Array.isArray(json?.data) ? json.data : [];
  return list.map((u: any) => ({
    ID: u.ID,
    display_name: u.display_name || u.user_login || '',
    user_login: u.user_login || '',
    username: u.user_login || u.username || '',
    email: u.email || '',
    profile_image: u.profile_image || '',
  }));
};

export default function AddFriend({ navigation, route }: any) {
  /**
   * Expect these route params from GroupSettings:
   *  - groupId: string
   *  - currentMembers: string[]  (ids already in the group)
   */
  const { groupId, currentMembers = [] } = route.params as {
    groupId: string; currentMembers: string[];
  };

  const insets = useSafeAreaInsets();
  const db = firestore();
  const groupRef = db.collection('groups').doc(groupId);

  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<WPUser[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const existing = useMemo(() => new Set((currentMembers || []).map(String)), [currentMembers]);

  useEffect(() => {
    navigation.setOptions({
      headerShown: true,
      headerStyle: { backgroundColor: COLORS.bg },
      headerTintColor: '#fff',
      title: 'Add members',
    });
  }, [navigation]);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('https://noctimago.com/wp-json/app/v1/users?page=1');
      const json = await res.json();
      setUsers(parseUsersPayload(json));
    } catch (e) {
      // eslint-disable-next-line no-console
      console.log('[AddFriend] fetch users error', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    const arr = (users || []).filter(u => !existing.has(String(u.ID)));
    if (!q) return arr;
    return arr.filter(u =>
      (u.display_name || '').toLowerCase().includes(q) ||
      (u.username || '').toLowerCase().includes(q) ||
      (u.user_login || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q)
    );
  }, [users, existing, query]);

  const togglePick = (id: string) => {
    setPicked(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

// helper: remove every `undefined` recursively
const stripUndefinedDeep = (obj: any) =>
    JSON.parse(JSON.stringify(obj, (_k, v) => (v === undefined ? undefined : v)));
  
  const addPicked = async () => {
    try {
      const ids = Array.from(picked).map(String);
      if (ids.length === 0) return;
      if (!groupId || typeof groupId !== 'string') {
        Alert.alert('Missing groupId');
        return;
      }
  
      // Build membersInfo patch WITHOUT undefineds
      const infoPatch: Record<string, { name: string; avatar?: string }> = {};
      for (const id of ids) {
        const u = users.find(p => String(p.ID) === id);
        const name = u?.display_name || u?.username || u?.user_login || id;
        const entry: any = { name };
        if (u?.profile_image) entry.avatar = u.profile_image; // <-- only set when present
        infoPatch[id] = entry;
      }
  
      const snap = await groupRef.get();
      const d: any = snap.data() || {};
      const currentArr: string[] = (d.members || []).map(String);
  
      const mergedMembers = Array.from(new Set([...currentArr, ...ids]));
      const mergedInfo = stripUndefinedDeep({
        ...(d.membersInfo || {}),
        ...infoPatch,
      });
  
      await groupRef.set(
        {
          members: mergedMembers,
          membersInfo: mergedInfo, // sanitized
          updatedAt: firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
  
      navigation.goBack();
    } catch (err: any) {
      console.log('[AddFriend] add error:', err?.code, err?.message, err);
      Alert.alert('Add failed', err?.message || 'Could not add members.');
    }
  };
  
  

  const Body = (
    <SafeAreaView style={styles.screen}>
      {/* Search */}
      <View style={[styles.searchWrap, { margin: 12 }]}>
        <Feather name="search" size={18} color={COLORS.sub} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search users"
          placeholderTextColor={COLORS.sub}
          style={styles.searchInput}
          returnKeyType="search"
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      {/* List */}
      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator />
        </View>
      ) : (
        <FlatList
          data={list}
          keyExtractor={(u) => String(u.ID)}
          keyboardShouldPersistTaps="handled"
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          contentContainerStyle={{ paddingBottom: 12 + Math.max(insets.bottom, 12) }}
          renderItem={({ item }) => {
            const id = String(item.ID);
            const isPicked = picked.has(id);
            return (
              <View style={styles.row}>
                <View style={styles.avatar}><Feather name="user" size={16} color={COLORS.sub} /></View>
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={styles.name}>
                    {item.display_name || item.username || item.user_login || id}
                  </Text>
                  {/* {!!item.email && <Text numberOfLines={1} style={styles.sub}>{item.email}</Text>} */}
                </View>
                <TouchableOpacity
                  onPress={() => togglePick(id)}
                  style={[styles.pickBtn, isPicked && { backgroundColor: COLORS.primary, borderColor: COLORS.primary }]}
                >
                  <Text style={{ color: isPicked ? '#fff' : COLORS.sub, fontWeight: '800' }}>
                    {isPicked ? '✓' : '+'}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          }}
          ListEmptyComponent={
            <Text style={{ color: COLORS.sub, textAlign: 'center', paddingTop: 24 }}>
              {query ? 'No matches' : 'No users'}
            </Text>
          }
        />
      )}

      {/* Footer */}
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.btn, styles.outline]}>
          <Text style={[styles.btnText, { color: COLORS.text }]}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
  onPress={addPicked}                         // ← async function above
  disabled={picked.size === 0}
  style={[styles.btn, { marginLeft: 8, opacity: picked.size === 0 ? 0.5 : 1 }]}
>
  <Text style={styles.btnText}>Add {picked.size ? `(${picked.size})` : ''}</Text>
</TouchableOpacity>

      </View>
    </SafeAreaView>
  );

  // iOS/Android keyboard handling
  if (Platform.OS === 'ios') {
    return (
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        {Body}
      </KeyboardAvoidingView>
    );
  }
  return <AvoidSoftInputView style={{ flex: 1 }}>{Body}</AvoidSoftInputView>;
}

/* ----------------------------- styles ---------------------------------- */
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#1A1A25',
    paddingHorizontal: 12, borderRadius: 12, height: 44, gap: 8,
    borderWidth: StyleSheet.hairlineWidth, borderColor: COLORS.line,
  },
  searchInput: { flex: 1, color: COLORS.text, fontSize: 16 },

  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10 },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#1c1d29', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  name: { color: COLORS.text, fontSize: 16, fontWeight: '700' },
  sub: { color: COLORS.sub, fontSize: 12, marginTop: 2 },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: COLORS.line, marginHorizontal: 12 },

  pickBtn: {
    height: 32, minWidth: 32, borderRadius: 8, borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.line, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10,
  },

  footer: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 12, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.line, backgroundColor: COLORS.bg },
  btn: { backgroundColor: COLORS.primary, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '800' },
  outline: { backgroundColor: 'transparent', borderWidth: StyleSheet.hairlineWidth, borderColor: COLORS.line },
});
