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
import { setInitialName, setInitialroute } from '../../store/action/auth/action';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useNavigationContainerRef } from '@react-navigation/native';
import firestore from '@react-native-firebase/firestore';
import { useDispatch, useSelector } from 'react-redux';
import messaging from "@react-native-firebase/messaging";
import {navigate } from "../MainTab/RootNav"; // adjust path


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



export default function Tabs() {
  const { lang } = useAutoI18n();
  const insets = useSafeAreaInsets();

  const bottomPad = Math.max(insets.bottom, 20);
  const height = (Platform.OS === 'ios' ? 54 : 64) + bottomPad;
  const dispatch = useDispatch();
  // current user from Redux
  const userprofile = useSelector((s: any) => s.authReducer?.userprofile);
  const myUid = String(
    userprofile?.ID ??
      userprofile?.user?.id ??
      userprofile?.User_PkeyID ??
      userprofile?.User_Firebase_UID ??
      ''
  );
  const navigation = useNavigation() 
  // useEffect(() => {
  //   // When user opens app from notification
  //   messaging().onNotificationOpenedApp(remoteMessage => {
  //     const key1 = String(remoteMessage?.data?.key1 ?? '');
  //     if (key1==="3") {
  //       console.log("remoteMessage",remoteMessage)
  //       dispatch(setInitialroute('Chat'));
  //       dispatch(setInitialName('MessageList'));
  //       navigation.navigate('Chat', { screen: 'MessageList' });
      
  //     } else {
  //       dispatch(setInitialroute('Home'));
  //       dispatch(setInitialName('NotificationsScreen'));
  //       navigation.navigate('Home', { screen: 'NotificationsScreen' });
  //     }
  //   });

  //   // When app is closed and opened by notification
  //   messaging()
  //     .getInitialNotification()
  //     .then(remoteMessage => {
  //       const key1 = String(remoteMessage?.data?.key1 ?? '');
  //       if (key1==="3") {
  //         console.log("remoteMessage",remoteMessage)
  //         dispatch(setInitialroute('Chat'));
  //         dispatch(setInitialName('MessageList'));
  //         navigation.navigate('Chat', { screen: 'MessageList' });
        
  //       } else {
  //         dispatch(setInitialroute('Home'));
  //         dispatch(setInitialName('NotificationsScreen'));
  //         navigation.navigate('Home', { screen: 'NotificationsScreen' });
  //       }
  //     });
  // }, [dispatch, navigation]);
  

  
  
  return (
    <Tab.Navigator
      key={lang}
      screenOptions={({ route }) => {
        // total unread for Chat tab
        const unread = route.name === 'Chat' ? route?.params?.chatUnreadCount : 0;

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

          tabBarBadge: route.name === 'Chat' && route?.params?.chatUnreadCount > 0 ? unread : undefined,

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

            const showDot = route.name === 'Chat' && route?.params?.chatUnreadCount > 0;

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
