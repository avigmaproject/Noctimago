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
  const navigationRef = useNavigationContainerRef();
  useEffect(() => {
    mobileAds()
      .initialize()
      .then(() => {
        console.log('[AdMob] initialized (App.tsx)');
        initInterstitial(); // 🔹 only here
      });
  }, []);
  useAutoRTL();
  // configGoogle()
  // 👇 Handle deep link when app is already running
  useEffect(() => {
    const handleDeepLink = (event: { url: string }) => {
      console.log("Deep Link URL:", event.url);
  
      try {
        const urlObj = new URL(event.url);
        if (urlObj.pathname.includes("reset-password")) {
          const key = urlObj.searchParams.get("key");
          const login = urlObj.searchParams.get("login");
  
          if (navigationRef.isReady()) {
            navigationRef.navigate("ResetPasswordScreen", { key, login });
          }
        }
      } catch (e) {
        console.log("Invalid deep link", e);
      }
    };
  
    // 👇 1. Listen when app is already running
    const subscription = Linking.addEventListener("url", handleDeepLink);
  
    // 👇 2. Handle when app is opened from a cold start
    Linking.getInitialURL().then((url) => {
      if (url) {
        console.log("Initial deep link:", url);
        handleDeepLink({ url });
      }
    });
  
    return () => subscription.remove();
  }, [navigationRef]);
  

  return (
    <NavigationContainer ref={navigationRef} linking={linking} fallback={<></>}>
      {user ? <Tabs /> : <AuthNavigation />}
    </NavigationContainer>
  );
};

export default AppWrapper;
