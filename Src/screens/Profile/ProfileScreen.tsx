// src/screens/Profile/ProfileScreen.tsx
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, StatusBar,Modal, Platform, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Feather from "react-native-vector-icons/Feather";
import { useSelector } from "react-redux";
import ManageUploadsBody from "./ManageUploadsScreen";
import LikedGridBody from "./LikedPost";
import SavedGridBody from "./Savedpost";
import { TText } from "../../i18n/TText";
import ImageView from "react-native-image-viewing";
import Avatar from "../../utils/Avatar";
import { profile } from "../../utils/apiconfig";
import { UserProfile } from "../../store/action/auth/action";
import mobileAds, { MaxAdContentRating } from "react-native-google-mobile-ads";
import {
  BannerAd,
  BannerAdSize,
  InterstitialAd,
  AdEventType,
  TestIds
} from "react-native-google-mobile-ads";
import { BANNER_AD_ID, INTERSTITIAL_AD_ID } from "../../ads/ids";
import { useIsFocused, useFocusEffect, useNavigation } from "@react-navigation/native";
const COLORS = {
  bg:"#0B0B12", card:"#16161C", elev:"#1B1C24", text:"#FFFFFF",
  sub:"#9CA3AF", border:"rgba(255,255,255,0.08)", pill:"#0F1017",


  cardElev: '#1A1A22',

  subtext: '#9CA3AF',
  accent: '#F43F5E',
  green: '#22C55E',
  gray: '#6B7280',
  divider: 'rgba(255,255,255,0.06)',

};
import {  useDispatch } from "react-redux";
function normalizeS3Url(url?: string) {
  if (!url) return "";
  try { return decodeURIComponent(url).replace(/\s+/g," "); } catch { return url.replace(/%2F/gi,"/"); }
}
let lastShownAt = 0;

function canShowInterstitialNow(minGapMs = 5 * 60 * 1000) {
  const now = Date.now();
  return now - lastShownAt > minGapMs;
}

function markInterstitialShown() {
  lastShownAt = Date.now();
}
export default function ProfileScreen({ navigation }: any) {
  const userprofile = useSelector((s:any)=>s.authReducer.userprofile) || {};
  const [tab, setTab] = useState<"posts"|"likes"|"saved">("posts");
  const dispatch = useDispatch();
  const token = useSelector((state: any) => state.authReducer.token);
  // Turn u{1f382} back into 🎂
const decodeCurlyUnicode = (s: string) =>
  s.replace(/u\{([0-9a-fA-F]+)\}/g, (_, hex) =>
    String.fromCodePoint(parseInt(hex, 16)),
  );

// Decode things like &#x1F382; or &#128152;
const decodeHtmlEntities = (s: string) =>
  s
    .replace(/&#x([0-9A-Fa-f]+);/g, (_, hex) =>
      String.fromCodePoint(parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, num) =>
      String.fromCodePoint(parseInt(num, 10)),
    );

// Encode 4-byte emojis as u{1f382} so MySQL/wp won’t strip them
const encodeEmojiToCurlyUnicode = (text: string) =>
  [...text].map((ch) => {
    const code = ch.codePointAt(0);
    if (!code) return ch;
    // only encode characters above BMP (most emojis)
    return code > 0xffff ? `u{${code.toString(16)}}` : ch;
  }).join('');

  // const rawBio = String(userprofile?.bio ?? "").trim();
  // const bio = rawBio;
  const [showBanner, setShowBanner] = useState(true);
  useEffect(() => {
    mobileAds()
      .setRequestConfiguration({
        maxAdContentRating: MaxAdContentRating.PG,
        tagForChildDirectedTreatment: false,
      })
      .then(() => mobileAds().initialize())
      .then(() => console.log("AdMob initialized"));
  }, []);
  // bannerAdId defined above using shared ids

  // const INTERSTITIAL_UNIT_ID = __DEV__
  //   ? TestIds.INTERSTITIAL
  //   : "ca-app-pub-2847186072494111/5687551304"; // your real id
  const bannerAdId = BANNER_AD_ID;
  const INTERSTITIAL_UNIT_ID = INTERSTITIAL_AD_ID;
  // const INTERSTITIAL_UNIT_ID = __DEV__
  // ? TestIds.INTERSTITIAL
  // : "ca-app-pub-2847186072494111/6482385544";
  const interstitialRef = useRef<InterstitialAd | null>(null);
  const [interstitialLoaded, setInterstitialLoaded] = useState(false);
  const wantsToShowRef = useRef(false);
  useEffect(() => {
    console.log("[Ad] Home: creating interstitial for", INTERSTITIAL_UNIT_ID);
  
    const ad = InterstitialAd.createForAdRequest(INTERSTITIAL_UNIT_ID, {
      requestNonPersonalizedAdsOnly: false,
    });
  
    interstitialRef.current = ad;
  
    // 🔹 LOADED
    const unsubLoaded = ad.addAdEventListener(AdEventType.LOADED, () => {
      console.log("[Ad][Home] LOADED");
      setInterstitialLoaded(true);
  
      if (wantsToShowRef.current) {
        wantsToShowRef.current = false;
        ad.show();
        setInterstitialLoaded(false);
      }
    });
  
    // 🔹 ERROR
    const unsubError = ad.addAdEventListener(AdEventType.ERROR, (error) => {
      console.log("[Ad][Home] ERROR", error?.message);
      setInterstitialLoaded(false);
    });
  
    // 🔹 CLOSED
    const unsubClosed = ad.addAdEventListener(AdEventType.CLOSED, () => {
      console.log("[Ad][Home] CLOSED -> reload");
      setInterstitialLoaded(false);
      ad.load();
    });
  
    ad.load();
  
    return () => {
      console.log("[Ad][Home] cleanup");
      unsubLoaded();
      unsubError();
      unsubClosed();
    };
  }, []);
  
  const rawBioFromStore = String(userprofile?.bio ?? "").trim();
  const decodedBio = decodeHtmlEntities(decodeCurlyUnicode(rawBioFromStore));
  const bio = decodedBio;   // what you show in card + modal
  
  const isLongBio = bio.length > 250; // <- used to decide modal
  const [bioModalVisible, setBioModalVisible] = useState(false);
  const avatarUri =
    normalizeS3Url(userprofile?.meta?.profile_image) ||
    "https://upload.wikimedia.org/wikipedia/commons/thumb/b/bc/Unknown_person.jpg/1200px-Unknown_person.jpg";
    const [avatarOpen, setAvatarOpen] = useState(false);
    const avatarImages = avatarUri ? [{ uri: avatarUri }] : [];
  const followersCount = Number(userprofile?.followers_count ?? 0);
  const followingCount = Number(userprofile?.following_count ?? 0);
  useFocusEffect(
    useCallback(() => {
      GetUserHome();
    }, [GetUserHome])
  );
  const GetUserHome = async () => {
    try {
      const res = await profile(token);
      dispatch(UserProfile(res.profile));
    } catch (error) {
    }
  };

  const safeShowInterstitial = () => {
    if (!canShowInterstitialNow()) {
      console.log("[Ad][Home] skipped due to cooldown");
      return;
    }
  
    const ad = interstitialRef.current;
    if (ad && interstitialLoaded) {
      ad.show();
      markInterstitialShown();
      setInterstitialLoaded(false);
    } else {
      wantsToShowRef.current = true;
      // when LOADED, we show & mark there
    }
  };
  const handleOpenSettings = () => {
    // 🔹 optionally show interstitial before navigation
     safeShowInterstitial(); // uncomment if you want this
     navigation.navigate("SettingsScreen");
  };


  return (
    <SafeAreaView style={{flex:1, backgroundColor:COLORS.bg}} edges={["top"]}>
      <StatusBar barStyle="light-content" />

      {/* Top bar */}
      <View style={s.topbar}>
        <TText style={s.topTitle}>Profile</TText>
        <TouchableOpacity onPress={handleOpenSettings} hitSlop={{top:10,bottom:10,left:10,right:10}}>
          <Feather name="settings" size={22} color={COLORS.text} />
        </TouchableOpacity>
      </View>

      {/* Header */}
      {/* <View style={s.hero}>
        <Image source={{uri:avatarUri}} style={s.avatar} />
        <View style={{flex:1}}>
          <Text style={s.name}>{userprofile?.display_name ?? ""}</Text>
          {!!userprofile?.user_nicename && (
            <Text style={s.handle}>@{String(userprofile.user_nicename).toLowerCase()}</Text>
          )}
        </View>
        <TouchableOpacity style={s.editBtn} onPress={()=>navigation.navigate("EditProfile")}>
          <Text style={s.editTxt}>Edit</Text>
        </TouchableOpacity>
      </View> */}
      
      <TouchableOpacity
  activeOpacity={0.85}
  style={[styles.card, styles.row]}
  onPress={() => navigation.navigate('EditProfile')}
>
  <TouchableOpacity
    activeOpacity={0.9}
    onPress={() => avatarUri && setAvatarOpen(true)}
    style={{ overflow: "hidden" }}
  >
    <Avatar
      uri={userprofile?.meta?.profile_image}
      name={userprofile?.display_name}
      size={70}
      border
    />
  </TouchableOpacity>

  <View style={{ flex: 1, marginLeft: 10 }}>
    <Text
      style={styles.title}
      numberOfLines={1}
      ellipsizeMode="tail"
    >
      {userprofile?.display_name ?? ''}
    </Text>

    {!!bio && (
  <TouchableOpacity
    activeOpacity={0.7}
    onPress={() => setBioModalVisible(true)}
  >
    <Text
      style={styles.bio}
      numberOfLines={2}
      ellipsizeMode="tail"
    >
      {bio}
    </Text>

    {/* optional: always show "… more" if you like */}
    <Text style={styles.moreLink}>... more</Text>
  </TouchableOpacity>
)}

  </View>

  <Feather name="edit" size={20} color={COLORS.subtext} />
</TouchableOpacity>



      {/* Stats */}
      <View style={s.stats}>
        <Stat label="Followers" value={followersCount} onPress={()=>navigation.navigate("PeopleListScreen",{userId:userprofile?.ID, type:"followers"})}/>
        <View style={s.vsep}/>
        <Stat label="Following" value={followingCount} onPress={()=>navigation.navigate("PeopleListScreen",{userId:userprofile?.ID, type:"following"})}/>
      </View>

      {/* Tabs */}
      <View style={s.tabs}>
        <TabBtn label="Posts"  icon="grid"     active={tab==="posts"}  onPress={()=>setTab("posts")} />
        <TabBtn label="Likes"  icon="heart"    active={tab==="likes"}  onPress={()=>setTab("likes")} />
        <TabBtn label="Saved"  icon="bookmark" active={tab==="saved"}  onPress={()=>setTab("saved")} />
      </View>

      {/* Body embeds */}
      <View style={{flex:1}}>
        {tab==="posts"  && <ManageUploadsBody navigation={navigation} />}
        {tab==="likes"  && <LikedGridBody    navigation={navigation} />}
        {tab==="saved"  && <SavedGridBody    navigation={navigation} />}
      </View>
      <ImageView
  images={avatarImages}
  imageIndex={0}
  visible={avatarOpen}
  onRequestClose={() => setAvatarOpen(false)}
  swipeToCloseEnabled
  doubleTapToZoomEnabled
  HeaderComponent={() => null}
/>
<Modal
  visible={bioModalVisible}
  animationType="slide"
  transparent
  onRequestClose={() => setBioModalVisible(false)}
>
  <View style={styles.bioModalBackdrop}>
    <View style={styles.bioModalCard}>
      <View style={styles.bioModalHeader}>
        <Text style={styles.bioModalTitle}>Bio</Text>
        <TouchableOpacity onPress={() => setBioModalVisible(false)}>
          <Feather name="x" size={20} color={COLORS.text} />
        </TouchableOpacity>
      </View>

      <ScrollView style={{  }}>
        <Text style={styles.bioModalText}>{bio}</Text>
      </ScrollView>
    </View>
  </View>
</Modal>
 {showBanner && (
  <BannerAd
    unitId={bannerAdId}
    size={BannerAdSize.ADAPTIVE_BANNER}
  />
)}



    </SafeAreaView>
  );
}

const Stat = ({label, value, onPress}:{label:string; value:number; onPress:()=>void})=>(
  <TouchableOpacity onPress={onPress} style={{flex:1, alignItems:"center"}}>
    <Text style={{color:COLORS.text, fontWeight:"800", fontSize:18}}>{value ?? 0}</Text>
    <Text style={{color:COLORS.sub, fontSize:12, marginTop:2}}>{label}</Text>
  </TouchableOpacity>
);

const TabBtn = ({label, icon, active, onPress}:{label:string; icon:string; active:boolean; onPress:()=>void})=>(
  <TouchableOpacity onPress={onPress} style={[s.tabBtn, active && s.tabActive]}>
    <Feather name={icon as any} size={14} color={active? "#fff":"#9CA3AF"} />
    <Text style={[s.tabTxt, active && {color:"#fff"}]}>{label}</Text>
  </TouchableOpacity>
);

const s = StyleSheet.create({
  topbar:{
    height:52, paddingHorizontal:16, borderBottomWidth:StyleSheet.hairlineWidth,
    borderBottomColor:COLORS.border, flexDirection:"row", alignItems:"center", justifyContent:"space-between"
  },
  topTitle:{ color:COLORS.text, fontSize:18, fontWeight:"700" },

  hero:{ flexDirection:"row", alignItems:"center", paddingHorizontal:16, paddingVertical:14 },
  avatar:{ width:74, height:74, borderRadius:37, marginRight:12, backgroundColor:COLORS.pill },
  name:{ color:COLORS.text, fontSize:18, fontWeight:"800" },
  handle:{ color:COLORS.sub, marginTop:2, fontSize:12 },
  editBtn:{
    paddingHorizontal:14, height:34, borderRadius:10, alignItems:"center", justifyContent:"center",
    backgroundColor:COLORS.pill, borderWidth:StyleSheet.hairlineWidth, borderColor:COLORS.border, marginLeft:8
  },
  editTxt:{ color:"#fff", fontWeight:"700", fontSize:13 },

  stats:{
    marginHorizontal:16, borderRadius:14, backgroundColor:COLORS.elev,
    borderWidth:StyleSheet.hairlineWidth, borderColor:COLORS.border,
    flexDirection:"row", paddingVertical:10, marginBottom:8
  },
  vsep:{ width:1, backgroundColor:COLORS.border, marginVertical:6 },

  tabs:{
    flexDirection:"row", paddingHorizontal:8, gap:8, marginTop:6, marginHorizontal:8,justifyContent:'space-between',
    borderBottomWidth:StyleSheet.hairlineWidth, borderBottomColor:COLORS.border, paddingBottom:8
  },
  tabBtn:{ flexDirection:"row", alignItems:"center", gap:6, paddingHorizontal:12, height:32, borderRadius:10 },
  tabActive:{ backgroundColor:"#222433" },
  tabTxt:{ color:"#9CA3AF", fontWeight:"700", fontSize:13 },
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
    bioModalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.6)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    
    bioModalCard: {
      width: '88%',
      maxHeight: '75%',
      backgroundColor: COLORS.card,
      borderRadius: 18,
      padding: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: COLORS.border,
    },
    
    bioModalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 10,
    },
    
    bioModalTitle: {
      color: COLORS.text,
      fontSize: 16,
      fontWeight: '700',
    },
    
    bioModalText: {
      color: COLORS.subtext,
      fontSize: 14,
      lineHeight: 20,
    },
    
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
      backgroundColor:'#1A1A22',
      borderRadius: 16,
      marginBottom:10,
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
    bio: {
      color: COLORS.subtext,
      fontSize: 13,
      marginTop: 6,
      flexShrink: 1,          // allow multiple lines in row
    },
    
    moreLink: {
      color: COLORS.accent,
      fontSize: 12,
      marginTop: 4,
    },
    
    

    avatar: { width: 56, height: 56,  marginRight: 12 },
  
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
