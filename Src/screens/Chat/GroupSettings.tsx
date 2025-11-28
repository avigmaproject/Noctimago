// src/screens/GroupSettings.tsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image, FlatList, TextInput,
  Alert, ActivityIndicator, Modal, KeyboardAvoidingView, Platform,
  StatusBar, ScrollView, StyleProp, ViewStyle
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Feather from 'react-native-vector-icons/Feather';
import firestore from '@react-native-firebase/firestore';
import { useSelector } from 'react-redux';
import ImagePicker from 'react-native-image-crop-picker';
import { AvoidSoftInputView } from 'react-native-avoid-softinput';
import { uploaddocumnetaws } from '../../utils/Awsfile';

const COLORS = { bg:'#0B0B12', card:'#15151F', text:'#EDEDF4', sub:'#9A9AA5', line:'rgba(255,255,255,0.08)', primary:'#F44336' };
const DEFAULT_GROUP_AVATAR = 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/bc/Unknown_person.jpg/1200px-Unknown_person.jpg';

type GroupDoc = {
  id: string;
  name: string;
  avatar?: string;
  members: string[];
  admins?: string[];
  createdBy?: string;
  updatedAt?: any;
  membersInfo?: Record<string, { name: string; avatar?: string }>;
};

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

const shortId = (s: string) => (s?.length > 10 ? `${s.slice(0, 4)}…${s.slice(-4)}` : s || '—');

/* ======================================================================= */
export default function GroupSettings({ navigation, route }: any) {
  const { groupId } = route.params as { groupId: string };
  const insets = useSafeAreaInsets();

  // me
  const userprofile = useSelector((s: any) => s.authReducer?.userprofile);
  const myUid = String(userprofile?.ID ?? userprofile?.user?.id ?? userprofile?.User_PkeyID ?? '');
  const myName = userprofile?.display_name ?? userprofile?.username ?? 'You';

  const db = firestore();
  const groupRef = useMemo(() => db.collection('groups').doc(groupId), [db, groupId]);

  const [group, setGroup] = useState<GroupDoc>({ id: groupId, name: 'Group', avatar: DEFAULT_GROUP_AVATAR, members: [], membersInfo: {} });
  const [loading, setLoading] = useState(true);

  // member profiles cache (drives UI names)
  const [memberProfiles, setMemberProfiles] = useState<Record<string, { name: string; avatar?: string }>>({});

  // rename
  const [renameOpen, setRenameOpen] = useState(false);
  const [newName, setNewName] = useState('');

  // add members
  const [addOpen, setAddOpen] = useState(false);
  const [people, setPeople] = useState<WPUser[]>([]);
  const [peopleLoading, setPeopleLoading] = useState(false);
  const [peopleQuery, setPeopleQuery] = useState('');
  const [picked, setPicked] = useState<Set<string>>(new Set());

  // photo
  const [photoBusy, setPhotoBusy] = useState(false);

  const isAdmin = useMemo(() => {
    const admins = group.admins || [];
    return group.createdBy === myUid || admins.includes(String(myUid));
  }, [group, myUid]);

  useEffect(() => {
    navigation.setOptions({
      headerShown: true,
      headerStyle: { backgroundColor: COLORS.bg },
      headerTintColor: '#fff',
      title: 'Group settings',
    });
  }, [navigation]);

  // live group
  useEffect(() => {
    const unsub = groupRef.onSnapshot(s => {
      const d: any = s.data();
      if (d) {
        const next: GroupDoc = {
          id: s.id,
          name: d.name || 'Group',
          avatar: d.avatar || DEFAULT_GROUP_AVATAR,
          members: (d.members || []).map(String),
          admins: (d.admins || []).map(String),
          createdBy: d.createdBy ? String(d.createdBy) : undefined,
          updatedAt: d.updatedAt,
          membersInfo: d.membersInfo || {},
        };
        setGroup(next);
        setMemberProfiles(next.membersInfo || {});
        console.log("memberProfiles",group)
      }
      setLoading(false);
    }, err => {
      console.log('[GroupSettings] doc error', err?.code, err?.message);
      setLoading(false);
    });
    return () => unsub();
  }, [groupRef]);

  /* -------------------- change photo -------------------- */
  const changePhoto = async (src: 'camera'|'gallery') => {
    try {
      setPhotoBusy(true);
      const res = src === 'camera'
        ? await ImagePicker.openCamera({ writeTempFile: true, includeExif: true, cropping: true, mediaType: 'photo' })
        : await ImagePicker.openPicker({ multiple: false, writeTempFile: true, includeExif: true, cropping: true, mediaType: 'photo' });

      const uploaded: any = await uploaddocumnetaws({ name: `${Date.now()}-${groupId}`, size: 0, type: 'image/jpeg', uri: res.path } as any);
      const url = uploaded?.location || DEFAULT_GROUP_AVATAR;
      await groupRef.set({ avatar: url, updatedAt: firestore.FieldValue.serverTimestamp() }, { merge: true });
    } catch (e: any) {
      if (e?.message?.includes('cancelled')) return;
      Alert.alert('Photo error', e?.message || 'Could not update group photo');
    } finally {
      setPhotoBusy(false);
    }
  };

  const resetPhoto = async () => {
    try {
      await groupRef.set({ avatar: DEFAULT_GROUP_AVATAR, updatedAt: firestore.FieldValue.serverTimestamp() }, { merge: true });
    } catch (e: any) {
      Alert.alert('Failed', e?.message || 'Could not reset photo');
    }
  };

  /* -------------------- rename -------------------- */
  const saveRename = async () => {
    const n = newName.trim();
    if (!n) { Alert.alert('Name required'); return; }
    try {
      await groupRef.set({ name: n, updatedAt: firestore.FieldValue.serverTimestamp() }, { merge: true });
      setRenameOpen(false);
    } catch (e: any) {
      Alert.alert('Failed', e?.message || 'Could not rename');
    }
  };

  /* -------------------- members ops -------------------- */
  const removeMember = async (uid: string) => {
    if (!isAdmin) return;
    if (uid === group.createdBy) { Alert.alert('Cannot remove', 'Creator cannot be removed.'); return; }
    try {
      const nextMembers = group.members.filter(m => m !== uid);
      const nextInfo = { ...(group.membersInfo || {}) };
      delete nextInfo[uid];
      await groupRef.set({
        members: nextMembers,
        membersInfo: nextInfo,
        updatedAt: firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    } catch (e: any) {
      Alert.alert('Failed', e?.message || 'Could not remove member');
    }
  };

  const leaveGroup = async () => {
    try {
      const nextMembers = group.members.filter(m => m !== myUid);
      const nextInfo = { ...(group.membersInfo || {}) };
      delete nextInfo[myUid];
      await groupRef.set({
        members: nextMembers,
        membersInfo: nextInfo,
        updatedAt: firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Failed', e?.message || 'Could not leave');
    }
  };

  const deleteGroup = async () => {
    if (group.createdBy !== myUid) { Alert.alert('Only the creator can delete this group.'); return; }
    Alert.alert('Delete group?', 'This will delete all messages permanently.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          const msgsRef = groupRef.collection('messages').limit(500);
          while (true) {
            const snap = await msgsRef.get();
            if (snap.empty) break;
            const batch = db.batch();
            snap.docs.forEach(d => batch.delete(d.ref));
            await batch.commit();
          }
          await groupRef.delete();
          navigation.popToTop();
        } catch (e: any) {
          Alert.alert('Failed', e?.message || 'Could not delete group');
        }
      } }
    ]);
  };

  /* -------------------- add members (search + pick) -------------------- */
  const fetchPeople = useCallback(async () => {
    if (peopleLoading) return;
    setPeopleLoading(true);
    try {
      const res = await fetch('https://noctimago.com/wp-json/app/v1/users?page=1');
      const json = await res.json();
      setPeople(parseUsersPayload(json));
    } catch (e) {
      console.log('[GroupSettings] fetch users error', e);
    } finally {
      setPeopleLoading(false);
    }
  }, [peopleLoading]);

  const filteredPeople = useMemo(() => {
    const q = peopleQuery.trim().toLowerCase();
    const existing = new Set(group.members.map(String));
    return (people || [])
      .filter(u => !existing.has(String(u.ID)) && String(u.ID) !== myUid)
      .filter(u =>
        !q ? true
           : (u.display_name || '').toLowerCase().includes(q) ||
             (u.username || '').toLowerCase().includes(q) ||
             (u.email || '').toLowerCase().includes(q)
      );
  }, [people, peopleQuery, group.members, myUid]);

  // ✅ SAVE names to membersInfo when adding
  const addPickedMembers = async () => {
    const toAdd = Array.from(picked); // ["2628","2545"]
    if (toAdd.length === 0) { setAddOpen(false); return; }

    const existingMembers = Array.from(new Set((group.members || []).map(String)));
    const mergedMembers = Array.from(new Set([...existingMembers, ...toAdd]));

    const infoPatch: Record<string, { name: string; avatar?: string }> = {};
    for (const id of toAdd) {
      const u = (people || []).find(p => String(p.ID) === String(id));
      if (u) {
        infoPatch[String(id)] = {
          name: u.display_name || u.username || u.user_login || String(id),
          avatar: u.profile_image || undefined,
        };
      } else {
        // fallback if not found in list
        infoPatch[String(id)] = { name: String(id) };
      }
    }

    try {
      await groupRef.set({
        members: mergedMembers,
        membersInfo: { ...(group.membersInfo || {}), ...infoPatch },
        updatedAt: firestore.FieldValue.serverTimestamp(),
      }, { merge: true });

      setPicked(new Set());
      setPeopleQuery('');
      setAddOpen(false);
    } catch (e: any) {
      Alert.alert('Failed', e?.message || 'Could not add members');
    }
  };

  /* -------------------------------- UI ------------------------------------ */
  if (loading) {
    return (
      <SafeAreaView style={[styles.screen, { alignItems:'center', justifyContent:'center' }]}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        {/* Avatar + name */}
        <Card>
          <View style={{ flexDirection:'row', alignItems:'center' }}>
            <Image source={{ uri: group.avatar || DEFAULT_GROUP_AVATAR }} style={styles.groupAvatar} />
            <View style={{ marginLeft: 12, flex:1 }}>
              <Text style={styles.title}>{group.name}</Text>
              <Text style={styles.caption}>{group.members?.length || 1} members</Text>
            </View>
          </View>

          <View style={styles.rowBtns}>
            <Chip onPress={() => { setNewName(group.name); setRenameOpen(true); }}>
              <Feather name="edit-3" size={14} color="#fff" /><Text style={styles.chipText}>Rename</Text>
            </Chip>
            <Chip onPress={() => changePhoto('gallery')} disabled={photoBusy}>
              <Feather name="image" size={14} color="#fff" /><Text style={styles.chipText}>Photo</Text>
            </Chip>
            <Chip onPress={() => changePhoto('camera')} disabled={photoBusy}>
              <Feather name="camera" size={14} color="#fff" /><Text style={styles.chipText}>Camera</Text>
            </Chip>
            <Chip outline onPress={resetPhoto}>
              <Feather name="refresh-ccw" size={14} color={COLORS.text} /><Text style={[styles.chipText, { color:COLORS.text }]}>Reset</Text>
            </Chip>
          </View>
        </Card>

        {/* Members */}
        <Card>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Members</Text>
            <TouchableOpacity
  onPress={() =>
    navigation.navigate('AddFriend', {
        groupId: group.id,                 // <- must be a real string
        currentMembers: group.members || []
      })
      
  }
  style={styles.addBtn}
>
  <Feather name="user-plus" size={16} color="#fff" />
  <Text style={{ color:'#fff', fontWeight:'700', marginLeft:6 }}>Add</Text>
</TouchableOpacity>

          </View>

          <FlatList
            data={group.members}
            keyExtractor={(id) => id}
            scrollEnabled={false}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            renderItem={({ item }) => {
                console.log("name",item)
              const id = String(item);
              const isCreator = id === group.createdBy;
              const isMe = id === myUid;
              const prof = memberProfiles[id]; // 👈 from membersInfo
              const name = isMe ? `${myName} (You)` : (prof?.name || shortId(id));
              return (
                <View style={styles.memberRow}>
                  <View style={styles.memberAvatar}><Feather name="user" size={16} color={COLORS.sub} /></View>
                  <Text style={[styles.memberName, { flex:1 }]} numberOfLines={1}>{name}</Text>
                  {isAdmin && !isCreator && !isMe && (
                    <TouchableOpacity onPress={() => removeMember(id)} style={styles.removeBtn}>
                      <Feather name="user-x" size={14} color="#fff" />
                    </TouchableOpacity>
                  )}
                </View>
              );
            }}
            ListEmptyComponent={<Text style={{ color:COLORS.sub, textAlign:'center', paddingVertical: 12 }}>No members</Text>}
          />
        </Card>

        {/* Danger zone */}
        <Card>
          {/* <Text style={styles.sectionTitle}>Danger zone</Text> */}
          <View style={{ flexDirection:'row', marginTop:12 }}>
            <TouchableOpacity onPress={leaveGroup} style={[styles.dangerBtn, { flex:1, marginRight:8 }]}>
              <Text style={styles.dangerText}>Leave group</Text>
            </TouchableOpacity>
            {group.createdBy === myUid && (
              <TouchableOpacity onPress={deleteGroup} style={[styles.dangerBtn, { flex:1, backgroundColor:'#b00020' }]}>
                <Text style={styles.dangerText}>Delete group</Text>
              </TouchableOpacity>
            )}
          </View>
        </Card>
      </ScrollView>

      {/* Rename modal */}
      <Modal visible={renameOpen} transparent animationType="fade" onRequestClose={() => setRenameOpen(false)}>
        <View style={styles.backdrop}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex:1, justifyContent:'center' }}>
            <Card style={{ marginHorizontal: 16 }}>
              <Text style={styles.sectionTitle}>Rename group</Text>
              <TextInput
                value={newName}
                onChangeText={setNewName}
                placeholder="Enter group name"
                placeholderTextColor={COLORS.sub}
                style={styles.input}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={saveRename}
              />
              <View style={{ flexDirection:'row', justifyContent:'flex-end', marginTop:12 }}>
                <Chip outline onPress={() => setRenameOpen(false)}><Text style={{ color:COLORS.text, fontWeight:'700' }}>Cancel</Text></Chip>
                <Chip style={{ marginLeft:8 }} onPress={saveRename}><Text style={{ color:'#fff', fontWeight:'700' }}>Save</Text></Chip>
              </View>
            </Card>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Add members (keyboard responsive) */}
      <Modal visible={addOpen} animationType="slide" transparent onRequestClose={() => setAddOpen(false)}>
        <View style={styles.backdrop}>
          {Platform.OS === 'ios' ? (
            <KeyboardAvoidingView behavior="padding" keyboardVerticalOffset={insets.top + 44} style={{ flex:1, justifyContent:'flex-end' }}>
              <AddSheet
                peopleLoading={peopleLoading}
                filteredPeople={filteredPeople}
                peopleQuery={peopleQuery}
                setPeopleQuery={setPeopleQuery}
                picked={picked}
                setPicked={setPicked}
                onClose={() => { setAddOpen(false); setPicked(new Set()); setPeopleQuery(''); }}
                onAdd={addPickedMembers}
              />
            </KeyboardAvoidingView>
          ) : (
            <AvoidSoftInputView style={{ flex:1, justifyContent:'flex-end' }} avoidOffset={12}>
              <AddSheet
                peopleLoading={peopleLoading}
                filteredPeople={filteredPeople}
                peopleQuery={peopleQuery}
                setPeopleQuery={setPeopleQuery}
                picked={picked}
                setPicked={setPicked}
                onClose={() => { setAddOpen(false); setPicked(new Set()); setPeopleQuery(''); }}
                onAdd={addPickedMembers}
              />
            </AvoidSoftInputView>
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

/* --------------------------- Small UI helpers ---------------------------- */
const Card = ({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) => (
  <View style={[styles.section, style]}>{children}</View>
);

const Chip = ({ children, onPress, outline, disabled, style }:
  { children: React.ReactNode; onPress?: () => void; outline?: boolean; disabled?: boolean; style?: StyleProp<ViewStyle> }) => (
  <TouchableOpacity
    onPress={onPress}
    disabled={disabled}
    style={[
      styles.chip,
      outline && { backgroundColor:'transparent', borderWidth:StyleSheet.hairlineWidth, borderColor:COLORS.line },
      style,
      disabled && { opacity: 0.6 }
    ]}>
    {children}
  </TouchableOpacity>
);

const AddSheet = ({
  peopleLoading, filteredPeople, peopleQuery, setPeopleQuery, picked, setPicked, onClose, onAdd
}: {
  peopleLoading: boolean;
  filteredPeople: WPUser[];
  peopleQuery: string;
  setPeopleQuery: (s: string) => void;
  picked: Set<string>;
  setPicked: (s: Set<string>) => void;
  onClose: () => void;
  onAdd: () => void;
}) => (
  <View style={[styles.sheet, { maxHeight: '92%' }]}>
    <View style={styles.handle} />
    <View style={[styles.searchWrap, { marginTop: 8 }]}>
      <Feather name="search" size={18} color={COLORS.sub} />
      <TextInput
        value={peopleQuery}
        onChangeText={setPeopleQuery}
        placeholder="Search users"
        placeholderTextColor={COLORS.sub}
        style={[styles.input, { paddingVertical: 0 }]}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
      />
    </View>

    <View style={{ flex: 1, minHeight: 200, marginTop: 8 }}>
      {peopleLoading ? (
        <View style={{ paddingVertical: 20, alignItems: 'center' }}>
          <ActivityIndicator />
        </View>
      ) : (
        <FlatList
          style={{ flex: 1 }}
          data={filteredPeople}
          keyExtractor={(u) => String(u.ID)}
          keyboardShouldPersistTaps="handled"
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          contentContainerStyle={{ paddingBottom: 16 }}
          renderItem={({ item }) => {
            const id = String(item.ID);
            const isPicked = picked.has(id);
            return (
              <View style={styles.memberRow}>
                <Image source={{ uri: item.profile_image || DEFAULT_GROUP_AVATAR }} style={styles.memberPic} />
                <Text style={[styles.memberName, { flex:1 }]} numberOfLines={1}>
                  {item.display_name || item.username || item.user_login}
                </Text>
                <TouchableOpacity
                  onPress={() => setPicked(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; })}
                  style={[styles.pickBtn, isPicked && { backgroundColor: COLORS.primary, borderColor: COLORS.primary }]}
                >
                  <Text style={{ color: isPicked ? '#fff' : COLORS.sub, fontWeight:'800' }}>
                    {isPicked ? '✓' : '+'}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          }}
          ListEmptyComponent={<Text style={{ color:COLORS.sub, textAlign:'center', paddingVertical: 16 }}>
            {peopleQuery ? 'No matches' : 'No users'}
          </Text>}
        />
      )}
    </View>

    <View style={[styles.sheetFooter, { paddingBottom: 12 }]}>
      <Chip outline onPress={onClose}><Text style={{ color:COLORS.text, fontWeight:'700' }}>Close</Text></Chip>
      <Chip style={{ marginLeft:8 }} onPress={onAdd}><Text style={{ color:'#fff', fontWeight:'700' }}>Add</Text></Chip>
    </View>
  </View>
);

/* -------------------------------- styles --------------------------------- */
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },

  section: { backgroundColor: COLORS.card, margin: 12, padding: 12, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: COLORS.line },
  title: { color: COLORS.text, fontSize: 18, fontWeight: '800' },
  caption: { color: COLORS.sub, fontSize: 12, marginTop: 2 },
  rowBtns: { flexDirection:'row', flexWrap:'wrap', gap:8, marginTop: 12 },

  chip: { backgroundColor: COLORS.primary, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, flexDirection:'row', alignItems:'center', gap:6 },
  chipText: { color:'#fff', fontWeight:'700' },

  sectionHeader: { flexDirection:'row', alignItems:'center', justifyContent:'space-between' },
  sectionTitle: { color: COLORS.text, fontSize: 16, fontWeight: '800' },

  separator: { height: StyleSheet.hairlineWidth, backgroundColor: COLORS.line, marginVertical: 8 },

  groupAvatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#222' },

  memberRow: { flexDirection:'row', alignItems:'center', paddingVertical: 8 },
  memberAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor:'#1c1d29', alignItems:'center', justifyContent:'center', marginRight: 10 },
  memberPic: { width: 36, height: 36, borderRadius: 18, backgroundColor:'#222', marginRight: 10 },
  memberName: { color: COLORS.text, fontSize: 16, fontWeight:'700' },
  removeBtn: { backgroundColor: COLORS.primary, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8 },

  dangerBtn: { backgroundColor: COLORS.primary, paddingVertical: 12, borderRadius: 12, alignItems:'center' },
  dangerText: { color:'#fff', fontWeight:'800' },

  backdrop: { flex:1, backgroundColor:'rgba(0,0,0,0.6)' },

  input: { color: COLORS.text, fontSize: 16, marginTop: 10, paddingVertical: 10, borderRadius: 10, paddingHorizontal: 12, backgroundColor:'#1A1A25', borderWidth: StyleSheet.hairlineWidth, borderColor: COLORS.line },

  addBtn: { flexDirection:'row', alignItems:'center', backgroundColor: COLORS.primary, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10 },
  pickBtn: { height: 32, minWidth: 32, borderRadius: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: COLORS.line, alignItems:'center', justifyContent:'center' },

  searchWrap: { flexDirection:'row', alignItems:'center', backgroundColor:'#1A1A25', paddingHorizontal: 12, borderRadius: 12, height: 44, gap: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: COLORS.line },

  sheet: { backgroundColor: COLORS.card, padding: 14, borderTopLeftRadius: 16, borderTopRightRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: COLORS.line },
  handle: { alignSelf: 'center', width: 42, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.16)', marginBottom: 8 },
  sheetFooter: { flexDirection:'row', justifyContent:'flex-end', marginTop: 8 },
});
