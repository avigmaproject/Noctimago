// ProfileScreen.tsx (or .jsx)
import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  Switch,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
Alert
} from 'react-native';
import Feather from 'react-native-vector-icons/Feather';
import { UserProfile, signout } from '../../store/action/auth/action';
import { profile } from '../../utils/apiconfig';
import {useFocusEffect} from '@react-navigation/native';
const COLORS = {
  bg: '#0E0E12',
  card: '#16161C', // slightly lighter than bg
  cardElev: '#1A1A22',
  text: '#FFFFFF',
  subtext: '#9CA3AF',
  accent: '#F43F5E',
  green: '#22C55E',
  gray: '#6B7280',
  divider: 'rgba(255,255,255,0.06)',
};
import {useDispatch, useSelector} from 'react-redux';

export default function ProfileScreen({navigation}) {
  const [isPublic, setIsPublic] = useState(true);
  const [allowTags, setAllowTags] = useState(false);
  const [allowDownloads, setAllowDownloads] = useState(true);
  const dispatch = useDispatch();
  const onLogout = () => {
    Alert.alert('Sign Out!!', 'Are you sure you want to Sign Out?', [
      {
        text: 'Cancel',
        onPress: () => console.log('Cancel Pressed'),
        style: 'cancel',
      },
      {text: 'OK', onPress: () => SignOut()},
    ]);
  };
  const userprofile = useSelector(state => state.authReducer.userprofile);
  const SignOut = () => {
    dispatch(signout());
  };
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
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Card */}
        <TouchableOpacity
          activeOpacity={0.8}
          style={[styles.card, styles.row]}
          onPress={() => navigation.navigate('EditProfile')}
        >
          <Image
            source={{ uri: 'https://i.pravatar.cc/120?img=12' }}
            style={styles.avatar}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{userprofile.name}</Text>
            <Text style={styles.muted}>Edit Profile</Text>
          </View>
          <Feather name="chevron-right" size={20} color={COLORS.subtext} />
        </TouchableOpacity>

        {/* Language */}
        <SettingRow
          icon="globe"
          label="Language"
          value="English"
          onPress={() => {navigation.navigate('LanguageScreen')}}
        />

        {/* Change Password */}
        <SettingRow
          icon="lock"
          label="Change Password"
          onPress={() => {navigation.navigate('ChangePasswordScreen')}}
        />

        {/* Privacy */}
        <View style={[styles.card, { paddingVertical: 12 }]}>
          <View style={[styles.row, { marginBottom: 8 }]}>
            <Feather name="lock" size={16} color={COLORS.subtext} />
            <Text style={[styles.title, { marginLeft: 8 }]}>Privacy</Text>
          </View>

          <ToggleRow
            label="Public Profile"
            value={isPublic}
            onValueChange={setIsPublic}
          />
          <Divider />
          <ToggleRow
            label="Allow Tags"
            value={allowTags}
            onValueChange={setAllowTags}
          />
          <Divider />
          <ToggleRow
            label="Allow Downloads"
            value={allowDownloads}
            onValueChange={setAllowDownloads}
          />
        </View>

        {/* Manage Uploads */}
        <SettingRow
          icon="upload"
          label="Manage Uploads"
          value="12 items"
          onPress={() => {}}
        />

        {/* Logout */}
        <TouchableOpacity style={styles.logoutBtn} onPress={onLogout}>
          <Feather name="log-out" size={18} color={COLORS.accent} />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

/* --------------------------- Reusable Pieces --------------------------- */

const SettingRow = ({
  icon,
  label,
  value,
  onPress,
}: {
  icon: string;
  label: string;
  value?: string;
  onPress?: () => void;
}) => (
  <TouchableOpacity activeOpacity={0.8} style={[styles.card, styles.row]} onPress={onPress}>
    <Feather name={icon as any} size={18} color={COLORS.subtext} />
    <Text style={[styles.title, { flex: 1, marginLeft: 12 }]}>{label}</Text>
    {value ? <Text style={styles.muted}>{value}</Text> : null}
    <Feather name="chevron-right" size={20} color={COLORS.subtext} style={{ marginLeft: 6 }} />
  </TouchableOpacity>
);

const ToggleRow = ({
  label,
  value,
  onValueChange,
}: {
  label: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
}) => (
  <View style={[styles.row, { paddingVertical: 8 }]}>
    <Text style={styles.title}>{label}</Text>
    <Switch
      value={value}
      onValueChange={onValueChange}
      trackColor={{ false: COLORS.gray, true: COLORS.green }}
      thumbColor="#FFFFFF"
      ios_backgroundColor={COLORS.gray}
    />
  </View>
);

const Divider = () => <View style={styles.divider} />;

/* -------------------------------- Styles -------------------------------- */

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  header: {
    paddingTop: 4,
    paddingBottom: 8,
    alignItems: 'center',
    borderBottomColor: COLORS.divider,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '700',
  },
  container: {
    paddingHorizontal: 16,
    backgroundColor: COLORS.bg,
  },
  card: {
    backgroundColor: COLORS.cardElev,
    borderRadius: 16,
    padding: 14,
    marginTop: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  title: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '600',
  },
  muted: {
    color: COLORS.subtext,
    marginTop: 2,
    fontSize: 13,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    marginRight: 12,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: COLORS.divider,
    marginVertical: 8,
  },
  logoutBtn: {
    marginTop: 18,
    backgroundColor: COLORS.card,
    borderRadius: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoutText: {
    color: COLORS.accent,
    marginLeft: 8,
    fontWeight: '600',
    fontSize: 15,
  },
});
