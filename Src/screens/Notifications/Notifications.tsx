// src/screens/NotificationsScreen.tsx
import React from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useSelector } from "react-redux";
import { TText } from "../../i18n/TText";
import { getnotify ,readnotify} from "../../utils/apiconfig";
import Avatar from "../../utils/Avatar";
/* ---------------- Types ---------------- */
type TabKey = "All" | "Social" | "System";

type NotificationItem = {
  id: string;
  title: string;          // NTN_Name shown as-is (clickable)
  timeAgo: string;
  avatar: string;
  thumb?: string;
  type: TabKey;
  userPkeyId?: number;    // NTN_User_PkeyID (navigate with this)
};

type ApiRow = {
  NTN_PKeyID: number;
  NTN_Name?: string;
  NTN_Description?: string;
  NTN_Sender_Name?: string | null;
  NTN_Sender_Img?: string | null;
  NTN_UP_Path?: string | null;   // "0" or URL
  NTN_C_L?: number;              // 1 Social, 2 System
  NTN_CreatedOn_Converted?: string;
  NTN_CreatedOn?: string;
  NTN_User_PkeyID?: number;
};

/* ---------------- Helpers ---------------- */
const BG = "#0B0B12";
const CARD = "#17171F";
const OUTLINE = "rgba(255,255,255,0.12)";
const TEXT = "#EDEDF4";
const SUBTEXT = "#9A9AA5";
const ACCENT = "#F44336";

const AVATAR_FALLBACK =
  "https://ui-avatars.com/api/?background=17171F&color=fff&name=?";

const toTypeFromChannel = (v?: number): TabKey => (v === 2 ? "System" : "Social");
const isHttp = (x?: string | null) => !!x && /^https?:\/\//i.test(x || "");

const timeAgoFromISO = (iso?: string): string => {
  if (!iso) return "now";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "now";
  const diff = Date.now() - t;
  const s = Math.max(1, Math.floor(diff / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
};

const mapRowToItem = (row: ApiRow): NotificationItem => {
  const title = row.NTN_Name?.trim() || row.NTN_Description?.trim() || "Notification";
  const avatar = row.NTN_Sender_Img;
  const thumb =
    isHttp(row.NTN_UP_Path) && row.NTN_UP_Path !== "0"
      ? (row.NTN_UP_Path as string)
      : undefined;
  const when = row.NTN_CreatedOn_Converted || row.NTN_CreatedOn || new Date().toISOString();

  return {
    id: row.NTN_UP_PKeyID ,
    title,
    timeAgo: timeAgoFromISO(when),
    avatar,
    thumb,
    type: toTypeFromChannel(row.NTN_C_L),
    userPkeyId: row.NTN_User_PkeyID,
  };
};

/* ---------------- Screen ---------------- */
export default function NotificationsScreen() {
  const [tab, setTab] = React.useState<TabKey>("All");
  const [items, setItems] = React.useState<NotificationItem[]>([]);
  const token = useSelector((s: any) => s.authReducer.token);
  const userprofile = useSelector((s: any) => s.authReducer.userprofile);
  const navigation = useNavigation<any>();

  const fetchNotifications = React.useCallback(async () => {
    try {
      const payload = JSON.stringify({
        NTN_PKeyID: 0,
        PageNumber: 1,
        NoofRows: 100,
        Orderby: "",
        Type: 3,
        UserID: userprofile?.ID ,
        TimeZone: "Asia/Kolkata",
      });
    console.log("token===",token)
      const res = await getnotify(payload, token);
// console.log("ress",res)
      // Your API shape is [[ {...}, {...} ]]
      let rows: any[] = [];
      if (Array.isArray(res)) rows = res.flat(3);
      else if (Array.isArray(res?.data)) rows = res.data.flat?.(3) ?? res.data;
      else if (Array.isArray(res?.Data)) rows = res.Data.flat?.(3) ?? res.Data;
      else if (Array.isArray(res?.Result)) rows = res.Result.flat?.(3) ?? res.Result;

      const apiRows: ApiRow[] = (rows || []).filter(
        (r) => r && typeof r === "object" && "NTN_PKeyID" in r
      );

      const mapped = apiRows.map(mapRowToItem);
      setItems(mapped);
      if (__DEV__) console.log("Notify mapped:", mapped);
    } catch (err: any) {
      console.warn("Notify error:", err?.message ?? err);
      setItems([]);
    }
  }, [token, userprofile?.ID]);

  const ReadNotification = React.useCallback(async () => {
    try {
      const payload = JSON.stringify({
  
        NTN_PKeyID: 0,
        PageNumber: 1,
        NoofRows: 100,
        Orderby: "",
        Type: 8,
        UserID: userprofile?.ID ,

      });
    console.log("token===",token)
      const res = await readnotify(payload, token);
console.log("ressreadnotify",res)
     
     
    } catch (err: any) {
      console.warn("readNotify error:", err?.message ?? err);
   
    }
  }, [token, userprofile?.ID]);
  useFocusEffect(
    React.useCallback(() => {
      fetchNotifications();
      ReadNotification()
    }, [fetchNotifications,ReadNotification])
  );

  const listData = React.useMemo(() => {
    if (tab === "All") return items;
    return items.filter((n) => n.type === tab);
  }, [tab, items]);

  const onPressTitle = (userPkeyId?: number) => {
    if (userPkeyId) {
      navigation.navigate("ViewProfileScreen", { NTN_User_PkeyID: userPkeyId });
    }
  };
  const handleNotificationPress = (userPkeyId?: number) => {
    console.log("item",userPkeyId)
    if(userPkeyId){
      navigation.navigate("PostDetailScreen", { postId: userPkeyId , token });
    }
  };
  
  const renderItem = ({ item }: { item: NotificationItem }) => {
    const avatarUri = item.avatar
    const thumbUri = item.thumb && isHttp(item.thumb) ? item.thumb : undefined;

    return (
      <TouchableOpacity onPress={() =>handleNotificationPress(item.id)} activeOpacity={0.8}>
      <View style={styles.row}>
        {/* Left: Avatar */}
        <TouchableOpacity onPress={() => onPressTitle(item.userPkeyId)}>
        <Avatar
    uri={ item.avatar}
    name={item.title}
    size={30}
    border
  />
          {/* <Image source={{ uri: avatarUri }} style={styles.avatar} /> */}
        </TouchableOpacity>
    
        {/* Middle: whole NTN_Name is clickable */}
        <View style={styles.middle}>
          <TouchableOpacity onPress={() =>handleNotificationPress(item.id)} disabled={!item.userPkeyId}>
            <TText style={[styles.title, !item.userPkeyId && { opacity: 0.6 }]}>
              {item.title}
            </TText>
          </TouchableOpacity>
          <Text style={styles.time}>{item.timeAgo}</Text>
        </View>
    
        {/* Right: optional thumb */}
        {thumbUri ? (
          <Image source={{ uri: thumbUri }} style={styles.thumb} />
        ) : (
          <View style={{ width: 52 }} />
        )}
      </View>
    </TouchableOpacity>
    
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <TText style={styles.headerText}>Notifications</TText>
      </View>

      {/* Segmented tabs */}
      <View style={styles.segmentOuter}>
        {(["All", "Social", "System"] as TabKey[]).map((k) => {
          const active = k === tab;
          return (
            <TouchableOpacity
              key={k}
              activeOpacity={0.9}
              onPress={() => setTab(k)}
              style={[styles.segmentBtn, active && styles.segmentBtnActive]}
            >
              <TText style={[styles.segmentLabel, active && styles.segmentLabelActive]}>
                {k}
              </TText>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* List */}
      <FlatList
        data={listData}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        contentContainerStyle={{ paddingBottom: 100 }}
        style={{ flex: 1 }}
        ListEmptyComponent={
          <View style={{ justifyContent: "center", alignItems: "center", marginTop: 20 }}>
            <Text style={{ color: "#7c7c8a", marginTop: 8 }}>No Notifications</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

/* ---------------- Styles ---------------- */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  header: {
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: OUTLINE,
    alignItems: "center",
  },
  headerText: { color: TEXT, fontSize: 20, fontWeight: "700" },

  segmentOuter: {
    marginHorizontal: 16,
    marginTop: 14,
    backgroundColor: CARD,
    borderRadius: 14,
    flexDirection: "row",
    padding: 6,
    gap: 8,
  },
  segmentBtn: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentBtnActive: {
    backgroundColor: "#2B2B35",
    borderWidth: 1,
    borderColor: "rgba(244,67,54,0.6)",
  },
  segmentLabel: { color: "#A5A5B2", fontWeight: "600" },

  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  avatar: { width: 44, height: 44,   borderColor:"white",borderWidth:1, marginRight: 12 },
  middle: { flex: 1 ,marginLeft:10},
  title: { color: TEXT, fontSize: 15, lineHeight: 20, fontWeight: "600" },
  time: { color: SUBTEXT, marginTop: 4, fontSize: 12 },
  thumb: { width: 52, height: 52, borderRadius: 8, marginLeft: 12 },

  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: OUTLINE,
    marginLeft: 74,
    marginRight: 18,
  },
});
