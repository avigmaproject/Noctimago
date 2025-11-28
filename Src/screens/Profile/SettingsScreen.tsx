// Src/screens/Profile/ProfileScreen.tsx
import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Image,
  Switch,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  StatusBar,
  Modal,
  Pressable,
  ActivityIndicator,
  Platform,
  Alert,
} from 'react-native';
import Feather from 'react-native-vector-icons/Feather';
import { useFocusEffect } from '@react-navigation/native';
import { useDispatch, useSelector } from 'react-redux';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { composeEmail } from '../../components/email';
import { UserProfile, signout } from '../../store/action/auth/action';
import { profile, updateprofile } from '../../utils/apiconfig';

// i18n
import { TText } from '../../i18n/TText';
import { useAutoI18n } from '../../i18n/AutoI18nProvider';

type Lang = 'en' | 'es' | 'fr' | 'de' | 'it';

const EN_NAME_BY_CODE: Record<Lang, string> = {
  en: 'English',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  it: 'Italian',
};

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

// ---------- helpers ----------
/** Make S3/CloudFront URLs WordPress-safe (%2F -> / etc). */
function normalizeS3Url(url?: string): string {
  if (!url) return '';
  try {
    const dec = decodeURIComponent(url);
    return dec.replace(/\s+/g, ' ');
  } catch {
    return url.replace(/%2F/gi, '/');
  }
}

export default function ProfileScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { lang } = useAutoI18n();
  const base = (lang || 'en').split('-')[0] as Lang;
  const currentLangEnglishName = EN_NAME_BY_CODE[base] || 'English';

  const dispatch = useDispatch();
  const token = useSelector((state: any) => state.authReducer.token);
  const userprofile = useSelector((state: any) => state.authReducer.userprofile);

  // ---- Local privacy toggles (with safe defaults) ----
  const [isPublic, setIsPublic] = useState<boolean>(false);
  const [allowTags, setAllowTags] = useState<boolean>(true);
  const [allowDownloads, setAllowDownloads] = useState<boolean>(true);

  // Inline saving indicator
  const [saving, setSaving] = useState<boolean>(false);
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);

  const GetUserHome = useCallback(async () => {
    try {
      const res = await profile(token);
      dispatch(UserProfile(res.profile));
    } catch (error) {
      console.log('[GetUserHome] error =', error);
    }
  }, [token, dispatch]);

  useFocusEffect(
    useCallback(() => {
      GetUserHome();
    }, [GetUserHome])
  );

  // Hydrate switches from server
  useEffect(() => {
    const s = userprofile?.settings || {};
    if (typeof s.public_profile === 'boolean') setIsPublic(s.public_profile);
    if (typeof s.allow_tag === 'boolean') setAllowTags(s.allow_tag);
    else setAllowTags(true);
    if (typeof s.allow_download === 'boolean') setAllowDownloads(s.allow_download);
  }, [userprofile]);

  // --- Debounced saver ---
  const queueSave = useCallback(
    (next: { public_profile?: boolean; allow_tag?: boolean; allow_download?: boolean }) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      setSaving(true);
      saveTimerRef.current = setTimeout(async () => {
        try {
          const payload = JSON.stringify({
            public_profile:
              typeof next.public_profile === 'boolean' ? next.public_profile : isPublic,
            allow_download:
              typeof next.allow_download === 'boolean' ? next.allow_download : allowDownloads,
            allow_tag: typeof next.allow_tag === 'boolean' ? next.allow_tag : allowTags,
          });

          await updateprofile(payload, token);
          await GetUserHome();
        } catch (err) {
          console.log('[updateprofile] error =', err);
        } finally {
          setSaving(false);
        }
      }, 600);
    },
    [token, isPublic, allowDownloads, allowTags, GetUserHome]
  );

  // Toggle handlers
  const onTogglePublic = (v: boolean) => {
    setIsPublic(v);
    queueSave({ public_profile: v });
  };
  const onToggleTags = (v: boolean) => {
    setAllowTags(v);
    queueSave({ allow_tag: v });
  };
  const onToggleDownloads = (v: boolean) => {
    setAllowDownloads(v);
    queueSave({ allow_download: v });
  };

  // Avatar helpers
  const avatarUri =
    normalizeS3Url(userprofile?.meta?.profile_image) ||
    'https://upload.wikimedia.org/wikipedia/commons/thumb/b/bc/Unknown_person.jpg/1200px-Unknown_person.jpg';

  // ---- Derived IDs & counts ----
  const userId = userprofile?.ID;

  const followersCount = Number(
    userprofile?.followers_count ??
      (Array.isArray(userprofile?.followers) ? userprofile.followers.length : 0)
  );

  const followingCount = Number(
    userprofile?.following_count ??
      (Array.isArray(userprofile?.following) ? userprofile.following.length : 0)
  );

  // ---- Logout modal state/handlers ----
  const [logoutVisible, setLogoutVisible] = useState(false);
  const onLogoutPress = () => setLogoutVisible(true);
  const handleConfirmLogout = () => {
    setLogoutVisible(false);
    dispatch(signout());
  };

  // ---- People list navigation handlers ----
  const goFollowers = () =>
    navigation.navigate('PeopleListScreen', {
      userId,
      type: 'followers',
      initial: Array.isArray(userprofile?.followers) ? userprofile.followers : undefined,
    });

  const goFollowing = () =>
    navigation.navigate('PeopleListScreen', {
      userId,
      type: 'following',
      initial: Array.isArray(userprofile?.following) ? userprofile.following : undefined,
    });
    const deleteAccountApi = async () => {
      try {
        
    
        const res = await fetch("https://noctimago.com/wp-json/app/v1/delete_account", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,   // Required
          },
          body: JSON.stringify({
            confirm: "yes",
          }),
        });
    
        const text = await res.text();
        let json;
    
        try { json = JSON.parse(text); } catch { json = {}; }
    
        console.log("DELETE ACCOUNT RESPONSE:", json);
    
        if (!res.ok) {
          Alert.alert("Error", json?.message || "Unable to delete account.");
          return;
        }
    
        // success
        Alert.alert(
          "Account Deleted",
          "Your account has been permanently removed.",
          [
            {
              text: "OK",
              onPress: () => {
                // 👉 Logout user & navigate to login screen
                dispatch(signout());
              
              },
            },
          ]
        );
    
      } catch (e) {
        Alert.alert("Error", "Something went wrong. Please try again.");
        console.log("deleteAccount error:", e);
      }
    };
    
    const handleDeleteAccount = () => {
      Alert.alert(
        "Delete Account",
        "Are you sure you want to permanently delete your account?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: () => deleteAccountApi(),   // 🚀 API call
          },
        ]
      );
    };
    
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />

      {/* Header */}
      <View style={styles.header}>
  <TouchableOpacity
    onPress={() => navigation.goBack()}
    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
    style={styles.backBtn}
  >
    <Feather name="chevron-left" size={24} color="#fff" />
  </TouchableOpacity>

  <TText style={styles.headerTitle}>Setting screen</TText>

  {/* placeholder view for symmetry */}
  <View style={{ width: 24 }} />
</View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: 24 + insets.bottom }}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="always"
        overScrollMode="never"
        keyboardShouldPersistTaps="handled"
      >
    

       

        {/* Language */}
        <SettingRow
          icon="globe"
          label="Language"
          value={currentLangEnglishName}
          onPress={() => navigation.navigate('LanguageScreen')}
        />

        {/* Change Password */}
        <SettingRow
          icon="lock"
          label="Change Password"
          onPress={() => navigation.navigate('ChangePasswordScreen')}
        />

        {/* Privacy */}
        <View style={[styles.card, { paddingVertical: 12 }]}>
          <View style={[styles.row, { marginBottom: 8 }]}>
            <Feather name="lock" size={16} color={COLORS.subtext} />
            <TText style={[styles.title, { marginLeft: 8 }]}>Privacy</TText>
            <View style={{ flex: 1 }} />
            {saving ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', columnGap: 6 }}>
                <ActivityIndicator size="small" />
                <TText style={styles.muted}>Saving…</TText>
              </View>
            ) : null}
          </View>

          <ToggleRow label="Public Profile" value={!!isPublic} onValueChange={onTogglePublic} />
          <Divider />
          <ToggleRow label="Allow Tags" value={!!allowTags} onValueChange={onToggleTags} />
          <Divider />
          <ToggleRow
            label="Allow Downloads"
            value={!!allowDownloads}
            onValueChange={onToggleDownloads}
          />
        </View>
        <SettingRow
  icon="slash"
  label="Block List"
  onPress={() => navigation.navigate("BlockListScreen")}
/>
        <SettingRow
  icon="mail"
  label="Contact Us"
  onPress={() => navigation.navigate("ContactUsScreen")}
/>


        {/* Manage Uploads */}
        {/* <SettingRow
          icon="upload"
          label="Manage Uploads"
          value={String(userprofile?.total_posts ?? '')}
          onPress={() => navigation.navigate('ManageUploadsScreen')}
        />
        <SettingRow
          icon="heart"
          label="Liked Post"
          onPress={() => navigation.navigate('LikedPost')}
        />
         <SettingRow
          icon="bookmark"
          label="Saved Post"
          onPress={() => navigation.navigate('SavedScreen')}
        /> */}

        {/* Logout */}
        <TouchableOpacity style={styles.logoutBtn} onPress={onLogoutPress}>
          <Ionicons name="log-out" size={18} color={COLORS.accent} />
          <TText style={styles.logoutText}>Logout</TText>
        </TouchableOpacity>
        <TouchableOpacity
  style={styles.dangerButton}
  activeOpacity={0.8}
  onPress={handleDeleteAccount}
>
  <Text style={styles.dangerButtonText}>Delete Account</Text>
</TouchableOpacity>

      </ScrollView>

      {/* Logout Confirm Modal */}
      <ConfirmLogoutModal
        visible={logoutVisible}
        onClose={() => setLogoutVisible(false)}
        onConfirm={handleConfirmLogout}
      />
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
  <TouchableOpacity activeOpacity={0.85} style={[styles.card, styles.row]} onPress={onPress}>
    <Feather name={icon as any} size={18} color={COLORS.subtext} />
    <TText style={[styles.title, { flex: 1, marginLeft: 12 }]}>{label}</TText>
    {value ? <TText style={styles.muted}>{value}</TText> : null}
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
    <TText style={styles.title}>{label}</TText>
    <Switch
      value={!!value}
      onValueChange={onValueChange}
      trackColor={{ false: COLORS.gray, true: COLORS.green }}
      thumbColor="#FFFFFF"
      ios_backgroundColor={COLORS.gray}
    />
  </View>
);

const Divider = () => <View style={styles.divider} />;

/** Followers/Following stat button */
const StatButton = ({
  icon,
  label,
  count,
  onPress,
}: {
  icon: string;
  label: string;
  count: number;
  onPress?: () => void;
}) => (
  <TouchableOpacity
    activeOpacity={0.9}
    onPress={onPress}
    style={[styles.card, styles.statBtn]}
    accessibilityRole="button"
    accessibilityLabel={`${label}, ${count}`}
  >
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
      <Feather name={icon as any} size={16} color={COLORS.subtext} />
      <TText style={[styles.muted, { marginLeft: 6 }]}>{label}</TText>
    </View>
    <Text style={styles.statCount}>{count ?? 0}</Text>
  </TouchableOpacity>
);

/* --------------------------- Logout Modal --------------------------- */

function ConfirmLogoutModal({
  visible,
  onClose,
  onConfirm,
}: {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
      <View style={m.overlay}>
        <View style={m.card}>
          <View style={m.badge}>
            <Ionicons name="log-out" size={25} color="#F41717" />
          </View>
          <TText style={m.title}>Logout</TText>
          <TText style={m.msg}>Are you sure you want to log out?</TText>

          <View style={m.actions}>
            <Pressable onPress={onConfirm} style={m.btnGhost}>
              <TText style={m.btnGhostText}>Yes</TText>
            </Pressable>
            <Pressable onPress={onClose} style={m.btnFill}>
              <TText style={m.btnFillText}>No</TText>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

/* -------------------------------- Styles -------------------------------- */

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
dangerButton: {
    marginTop: 40,
    alignSelf: "stretch",          // full width in parent, or use "center" + width
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1.5,              // 🔴 red line border
    borderColor: "#F44336",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  dangerButtonText: {
    color: "#F44336",
    fontWeight: "700",
    fontSize: 14,
    // textDecorationLine: "underline", // 👈 adds a line on the text
  },
  
  header: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.12)",
    backgroundColor: "#0B0B12", // optional
  },
  headerTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
  backBtn: {
    padding: 4,
  },
  container: { paddingHorizontal: 16, backgroundColor: COLORS.bg },

  card: {
    backgroundColor: COLORS.cardElev,
    borderRadius: 16,
    padding: 14,
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

  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },

  title: { color: COLORS.text, fontSize: 16, fontWeight: '600' },
  muted: { color: COLORS.subtext, fontSize: 11 ,marginBottom:5},

  avatar: { width: 56, height: 56, borderRadius: 28, marginRight: 12 },

  divider: { height: StyleSheet.hairlineWidth, backgroundColor: COLORS.divider, marginVertical: 8 },

  // ---- Stats buttons row ----
  statsRow: {
    flexDirection: 'row',
    columnGap: 12,
    marginTop: 12,
  },
  statBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  statCount: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: '800',
  },

  logoutBtn: {
    marginTop: 18,
    backgroundColor: COLORS.card,
    borderRadius: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
  },
  logoutText: { color: COLORS.accent, marginLeft: 8, fontWeight: '600', fontSize: 15 },
});

/* ---- Modal styles ---- */
const m = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    backgroundColor: '#0E0E12',
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
  },
  badge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  title: { color: '#FFFFFF', fontSize: 20, fontWeight: '700', marginTop: 4 },
  msg: { color: '#C8C8CF', fontSize: 16, textAlign: 'center', marginTop: 20 },
  actions: { flexDirection: 'row', columnGap: 10, marginTop: 16, width: '100%' },
  btnGhost: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#151558',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  btnGhostText: { color: '#E6E8EE', fontWeight: '700' },
  btnFill: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#151558',
  },
  btnFillText: { color: '#fff', fontWeight: '700' },
});
