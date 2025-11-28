import React, { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Ionicons from 'react-native-vector-icons/Ionicons';
import HomeStack from './Home/HomeStack';
import EventsScreen from './Explore/EventsScreen';
import NewPostScreen from './Upload/NewPostScreen';
import NotificationStack from './Notification/NotificationStack';
import ProfileStack from './Profile/ ProfileStack';
import { TText } from '../../i18n/TText';
import { useAutoI18n } from '../../i18n/AutoI18nProvider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import firestore from '@react-native-firebase/firestore';
import { useSelector } from 'react-redux';

const Tab = createBottomTabNavigator();
const COLORS = { bg: '#0E0F12', border: '#1F2127', active: '#E53935', inactive: '#8B8F98' };

const label =
  (raw: string, lang: string) =>
  ({ color }: { color: string }) =>
    (
      <TText
        key={lang}
        style={{ color, fontSize: 11, lineHeight: 13, marginTop: 0 }}
        numberOfLines={1}
        allowFontScaling={false}
      >
        {raw}
      </TText>
    );

// safely convert Firestore Timestamp / number / string to ms
const toMillis = (v: any): number => {
  if (!v) return 0;
  if (typeof v?.toDate === 'function') return v.toDate().getTime();
  if (typeof v === 'number') return v;
  const t = Date.parse(v as any);
  return Number.isNaN(t) ? 0 : t;
};

export default function Tabs() {
  const { lang } = useAutoI18n();
  const insets = useSafeAreaInsets();

  const bottomPad = Math.max(insets.bottom, 20);
  const height = (Platform.OS === 'ios' ? 54 : 64) + bottomPad;

  // current user from Redux
  const userprofile = useSelector((s: any) => s.authReducer?.userprofile);
  const myUid = String(
    userprofile?.ID ??
      userprofile?.user?.id ??
      userprofile?.User_PkeyID ??
      userprofile?.User_Firebase_UID ??
      ''
  );

  // unread count for DM threads (your old unreadTotal)
  const [dmUnread, setDmUnread] = useState(0);

  // Global unread listener – works even when Chat tab is NOT open
  useEffect(() => {
    if (!myUid) return;

    const q = firestore()
      .collection('messagelist')
      .where('send', 'array-contains', String(myUid));

    const unsub = q.onSnapshot(
      snap => {
        let count = 0;
        const me = String(myUid);

        snap.docs.forEach(d => {
          const t: any = d.data();

          // skip threads where I sent the last message
          const lastSender = String(t.sentBy ?? '');
          if (lastSender === me) return;

          const updatedMs = toMillis(t.updatedAt || t.createdAt);
          const rawLastRead = t.lastRead?.[me];
          const lastReadMs = toMillis(rawLastRead);

          const explicitRead = t.readMap?.[me] === true || t.read === true;
          const hasText = !!(t.lastmsg && String(t.lastmsg).trim().length);

          const unread =
            hasText &&
            !explicitRead &&
            updatedMs > 0 &&
            (!lastReadMs || lastReadMs < updatedMs - 500);

          if (unread) count++;
        });

        setDmUnread(count);
      },
      err => {
        console.log('[Tabs unread listener] ERROR:', err?.code, err?.message);
      }
    );

    return () => unsub();
  }, [myUid]);

  // If you later add group unread, add:
  // const [groupUnread, setGroupUnread] = useState(0);
  // and another useEffect with similar logic,
  // then use dmUnread + groupUnread below.

  return (
    <Tab.Navigator
      key={lang}
      screenOptions={({ route }) => {
        // total unread for Chat tab
        const unread = route.name === 'Chat' ? dmUnread : 0;

        return {
          lazy: false, // mount all tabs immediately (so Chat stack is ready)
          headerShown: false,
          tabBarHideOnKeyboard: true,
          tabBarActiveTintColor: COLORS.active,
          tabBarInactiveTintColor: COLORS.inactive,
          tabBarStyle: {
            backgroundColor: COLORS.bg,
            borderTopColor: COLORS.border,
            borderTopWidth: 1,
            height,
            paddingBottom: bottomPad,
            paddingTop: 4,
          },
          tabBarItemStyle: { marginHorizontal: 2, paddingVertical: 0 },
          tabBarIconStyle: { marginBottom: -2 },
          tabBarLabelStyle: { fontSize: 11, lineHeight: 13, marginTop: 0 },

          tabBarBadge: route.name === 'Chat' && unread > 0 ? unread : undefined,
          tabBarBadgeStyle: { backgroundColor: COLORS.active },

          tabBarIcon: ({ focused, color, size }) => {
            let name: string = 'home-outline';
            switch (route.name) {
              case 'Home':
                name = focused ? 'home' : 'home-outline';
                break;
              case 'Explore':
                name = focused ? 'compass' : 'compass-outline';
                break;
              case 'Upload':
                name = focused ? 'add-circle' : 'add-circle-outline';
                break;
              case 'Profile':
                name = focused ? 'person' : 'person-outline';
                break;
              case 'Chat':
                name = focused ? 'chatbubble-ellipses-sharp' : 'chatbubble-ellipses-outline';
                break;
            }

            const showDot = route.name === 'Chat' && unread > 0;

            return (
              <View>
                <Ionicons
                  name={name}
                  size={route.name === 'Upload' ? 26 : size}
                  color={color}
                />
                {showDot && (
                  <View
                    pointerEvents="none"
                    style={{
                      position: 'absolute',
                      top: -1,
                      right: -6,
                      width: 10,
                      height: 10,
                      borderRadius: 5,
                      backgroundColor: COLORS.active,
                      borderWidth: 1.5,
                      borderColor: '#fff',
                    }}
                  />
                )}
              </View>
            );
          },
        };
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeStack}
        options={{ tabBarLabel: label('Home', lang) }}
      />
      <Tab.Screen
        name="Explore"
        component={EventsScreen}
        options={{ tabBarLabel: label('Explore', lang) }}
      />
      <Tab.Screen
        name="Upload"
        component={NewPostScreen}
        options={{ tabBarLabel: label('Upload', lang) }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileStack}
        options={{ tabBarLabel: label('Profile', lang) }}
      />
      <Tab.Screen
        name="Chat"
        component={NotificationStack}
        options={{ tabBarLabel: label('Chat', lang) }}
      />
    </Tab.Navigator>
  );
}
