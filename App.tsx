import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { Linking } from 'react-native';
import { useNavigationContainerRef } from '@react-navigation/native';
import AuthNavigation from './Src/navigation/Auth/AuthNavigation';
import { Provider, useDispatch, useSelector } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import store, { persistor } from './Src/store';
import { NativeBaseProvider } from 'native-base';
import Tabs from './Src/navigation/MainTab/TabNavigation';
import { AutoI18nProvider } from './Src/i18n/AutoI18nProvider';
import { useAutoRTL } from './Src/i18n/useAutoRTL';
import { initInterstitial } from './Src/ads/interstitial';
import { NavigationContainerRef } from "@react-navigation/native";
import messaging from "@react-native-firebase/messaging";
import { navigationRef, flushPendingNavigation } from "./Src/navigation/MainTab/RootNav";
// i) crypto polyfill (already added earlier)
import 'react-native-get-random-values';
import mobileAds from 'react-native-google-mobile-ads';

// ii) make sure XHR always has a numeric timeout (Android native requires it)
const _OldXHR = global.XMLHttpRequest;
global.XMLHttpRequest = function (...args) {
  const xhr = new _OldXHR(...args);
  if (typeof xhr.timeout !== 'number') xhr.timeout = 0; // 0 = no timeout
  return xhr;
} as any;



// import { configGoogle } from './Src/utils/google';
const linking = {
  prefixes: ["myapp://", "https://noctimago.com"],
  config: {
    screens: {
      AuthNavigation: {
        screens: {
          ResetPasswordScreen: "reset-password/:token",
        },
      },
    },
  },
};

const AppWrapper = () => (
  <Provider store={store}>
    <PersistGate loading={null} persistor={persistor}>
      <AutoI18nProvider>
        <NativeBaseProvider>
          <App />
        </NativeBaseProvider>
      </AutoI18nProvider>
    </PersistGate>
  </Provider>
);

const App = () => {
  const dispatch = useDispatch();
  const user = useSelector((state: any) => state.authReducer.loggedin);

  // diagnostic logging to verify release vs debug and which ad ids are used
  console.log('[Diag] __DEV__', __DEV__);
  try {
    const { BANNER_AD_ID, INTERSTITIAL_AD_ID } = require('./Src/ads/ids');
    console.log('[Diag] banner id', BANNER_AD_ID, 'interstitial id', INTERSTITIAL_AD_ID);
  } catch (e) {
    console.log('[Diag] failed to require ad ids', e);
  }

 
  
  // useEffect(() => {
  //   // killed -> open by tapping notification
  //   messaging().getInitialNotification().then(remoteMessage => {
  //     if (remoteMessage) {
  //       console.log("[FCM] Opened from killed:", remoteMessage?.data);
  //       setTimeout(() => handlePushNavigation(remoteMessage), 600);
  //     }
  //   });
  //   const handlePushNavigation = (remoteMessage: any) => {
  //     const key1 = String(remoteMessage?.data?.key1 || ""); // "1" or "2"
  //   console.log("emoteMessage?.data",remoteMessage?.data)
  //     if (!navigationRef.isReady()) return;
    
  //     // key1=1 => Notifications
  //     if (key1 === "1") {
  //       // If you want notification screen inside HomeStack:
        
  //       console.log("NotificationsScreen",key1)
  //       navigationRef.navigate("Home", {
  //         screen: "NotificationsScreen",
  //       });
  //       return;
  //     }
    
  //     // key1=2 => Chat -> MessageList
  //     if (key1 === "3") {
  //       console.log("MessageList",key1)
  //       navigationRef.navigate("Chat", {
  //         screen: "MessageList",
  //       });
  //       return;
  //     }
  //   };
  //   // background -> open by tapping notification
  //   const unsub = messaging().onNotificationOpenedApp(remoteMessage => {
  //     console.log("[FCM] Opened from background:", remoteMessage?.data);
  //     handlePushNavigation(remoteMessage);
  //   });
  
  //   return unsub;
  // }, []);
  
  
  useEffect(() => {
    // configure test devices during development so we can verify the
    // ads code path even if the real units aren’t serving yet.  *No test
    // identifiers should be added in production* because the SDK will then
    // always return test ads even when running a release build from the
    // Play Store.
    if (__DEV__) {
      mobileAds().setRequestConfiguration({
        testDeviceIdentifiers: [
          // the SDK accepts the literal string "EMULATOR" to identify an
          // emulator device. you can also add real device IDs captured from
          // logcat when you run `MobileAds.getRequestConfiguration()`.
          'EMULATOR',
        ],
      });
    }

    mobileAds()
      .initialize()
      .then(() => {
        // console.log('[AdMob] initialized (App.tsx)');
        initInterstitial(); // 🔹 only here
      });
  }, []);
  useAutoRTL();
  // configGoogle()
  // 👇 Handle deep link when app is already running
  useEffect(() => {
    const handleDeepLink = (event: { url: string }) => {
      // console.log('Deep Link URL:', event.url);
  
      try {
        const urlObj = new URL(event.url);
        const pathname = urlObj.pathname; // e.g. /app/post/123
        const search = urlObj.searchParams;
  
        // 1️⃣ Reset password link: https://noctimago.com/reset-password?key=...&login=...
        if (pathname.includes('reset-password')) {
          const key = search.get('key');
          const login = search.get('login');
  
          if (navigationRef.isReady()) {
            navigationRef.navigate('ResetPasswordScreen', { key, login });
          }
          return;
        }
  
        // 2️⃣ New style: https://noctimago.com/?custom_post=1058
        const customPost = search.get('custom_post');
        if (customPost) {
          if (navigationRef.isReady()) {
            navigationRef.navigate('PostDetailScreen', { postId: customPost });
          }
          return;
        }
  
        // 3️⃣ Old style: https://noctimago.com/app/post/1058  OR  /post/1058
        const parts = pathname.split('/').filter(Boolean);
        // "/app/post/123" -> ["app","post","123"]
        // "/post/123"     -> ["post","123"]
  
        const postIndex = parts.findIndex(p => p === 'post');
        if (postIndex !== -1 && parts[postIndex + 1]) {
          const postId = parts[postIndex + 1];
  
          if (navigationRef.isReady()) {
            navigationRef.navigate('PostDetailScreen', { postId });
          }
          return;
        }
      } catch (e) {
        console.log('Invalid deep link', e);
      }
    };
  
    // App already running
    const subscription = Linking.addEventListener('url', handleDeepLink);
  
    // Cold start
    Linking.getInitialURL().then(url => {
      if (url) {
        console.log('Initial deep link (cold start):', url);
        handleDeepLink({ url });
      }
    });
  
    return () => subscription.remove();
  }, [navigationRef]);
  
  

  

  return (
    <NavigationContainer ref={navigationRef} linking={linking} fallback={<></>} 
    onReady={() => {
      flushPendingNavigation();
    }}>
      {user ? <Tabs /> : <AuthNavigation />}
    </NavigationContainer>
  );
};

export default AppWrapper;
