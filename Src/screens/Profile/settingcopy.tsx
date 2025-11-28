// src/screens/Settings/SettingsScreen.tsx
import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Feather from "react-native-vector-icons/Feather";
import { TText } from "../../i18n/TText";

const COLORS = { bg:"#0E0E12", card:"#1A1A22", text:"#fff", sub:"#9CA3AF", border:"rgba(255,255,255,0.08)" };

export default function SettingsScreen({ navigation }: any) {
  return (
    <SafeAreaView style={StyleSheet.safe} edges={['top', 'bottom']}>
    <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />



    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 24 + insets.bottom }}
      showsVerticalScrollIndicator={false}
      contentInsetAdjustmentBehavior="always"
      overScrollMode="never"
      keyboardShouldPersistTaps="handled"
    >
      {/* Profile Card */}
      <TouchableOpacity
        activeOpacity={0.85}
        style={[styles.card, styles.row]}
        onPress={() => navigation.navigate('EditProfile')}
      >
        <Image
          source={{ uri: avatarUri }}
          style={styles.avatar}
          onError={() => {
            // If the remote URI fails (often due to % encodes on Android), do nothing; the default image is shown by URI above.
          }}
        />
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{userprofile?.display_name ?? ''}</Text>
          <TText style={styles.muted}>Edit Profile</TText>
        </View>
        <Feather name="chevron-right" size={20} color={COLORS.subtext} />
      </TouchableOpacity>

      {/* Followers / Following two-button row */}
      <View style={styles.statsRow}>
        <StatButton
          icon="users"
          label="Followers"
          count={followersCount}
          onPress={goFollowers}
        />
        <StatButton
          icon="user-plus"
          label="Following"
          count={followingCount}
          onPress={goFollowing}
        />
      </View>

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

      {/* Manage Uploads */}
      <SettingRow
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
      />

      {/* Logout */}
      <TouchableOpacity style={styles.logoutBtn} onPress={onLogoutPress}>
        <Ionicons name="log-out" size={18} color={COLORS.accent} />
        <TText style={styles.logoutText}>Logout</TText>
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

const Row = ({icon,label,onPress}:{icon:string;label:string;onPress:()=>void})=>(
  <TouchableOpacity onPress={onPress} style={s.row} activeOpacity={0.85}>
    <Feather name={icon as any} size={18} color={COLORS.sub}/>
    <Text style={s.rowText}>{label}</Text>
    <Feather name="chevron-right" size={20} color={COLORS.sub}/>
  </TouchableOpacity>
);

const s = StyleSheet.create({
  header:{height:52, paddingHorizontal:16, flexDirection:"row", alignItems:"center", justifyContent:"space-between",
    borderBottomWidth:StyleSheet.hairlineWidth, borderBottomColor:COLORS.border},
  title:{color:"#fff", fontSize:18, fontWeight:"700"},
  row:{
    backgroundColor:COLORS.card, borderRadius:14, padding:14, marginTop:12,
    borderWidth:StyleSheet.hairlineWidth, borderColor:COLORS.border, flexDirection:"row", alignItems:"center", justifyContent:"space-between"
  },
  rowText:{ color:COLORS.text, fontSize:16, fontWeight:"600", flex:1, marginLeft:12 }
});
const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: COLORS.bg },
  
    header: {
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 12,
      minHeight: 52,
      alignItems: 'center',
      justifyContent: 'center',
      borderBottomColor: COLORS.divider,
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    headerTitle: { color: COLORS.text, fontSize: 18, fontWeight: '700' },
  
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
    muted: { color: COLORS.subtext, marginTop: 2, fontSize: 13 },
  
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