// src/ads/interstitial.ts
import {
    InterstitialAd,
    AdEventType,
    TestIds,
  } from 'react-native-google-mobile-ads';
  
  // 🔹 Keep TEST ID while debugging

const INTERSTITIAL_UNIT_ID = __DEV__
  ? TestIds.INTERSTITIAL
  : 'ca-app-pub-2847186072494111/8751364810'; // <-- your real interstitial ID later

  // When everything works, change to your real ID:
  // const INTERSTITIAL_UNIT_ID = 'ca-app-pub-XXXXXXXXXXXXXXX/XXXXXXXXXX';
  
  let interstitial: InterstitialAd | null = null;
  let loaded = false;
  
  // For "show later"
  let pendingShow = false;
  let delayTimer: NodeJS.Timeout | null = null;
  
  export function initInterstitial() {
    console.log('[Ad] initInterstitial called, current interstitial =', !!interstitial);
  
    if (!interstitial) {
      console.log('[Ad] initInterstitial: creating for', INTERSTITIAL_UNIT_ID);
  
      interstitial = InterstitialAd.createForAdRequest(INTERSTITIAL_UNIT_ID, {
        requestNonPersonalizedAdsOnly: false,
      });
  
      interstitial.onAdEvent((type, error) => {
        console.log('[Ad] onAdEvent =>', type, error?.message);
  
        switch (type) {
          case AdEventType.LOADED:
            loaded = true;
            console.log('[Ad] Interstitial loaded ✔');
  
            if (pendingShow && interstitial) {
              console.log('[Ad] pendingShow=true & loaded, showing now');
              pendingShow = false;
              interstitial.show();
              loaded = false;
            }
            break;
  
          case AdEventType.ERROR:
            loaded = false;
            console.log('[Ad] Interstitial error ❌', error);
            break;
  
          case AdEventType.CLOSED:
            loaded = false;
            console.log('[Ad] Interstitial closed, reloading…');
            interstitial?.load();
            break;
        }
      });
  
      interstitial.load();
    } else {
      console.log('[Ad] initInterstitial: already created, not recreating');
    }
  }
  
  export function scheduleInterstitialAfter(delayMs: number) {
    console.log('[Ad] scheduleInterstitialAfter', delayMs, 'ms');
  
    if (delayTimer) {
      clearTimeout(delayTimer);
      delayTimer = null;
    }
  
    delayTimer = setTimeout(() => {
      console.log('[Ad] delayTimer fired, loaded =', loaded);
  
      if (loaded && interstitial) {
        console.log('[Ad] loaded already, showing now');
        pendingShow = false;
        interstitial.show();
        loaded = false;
      } else {
        console.log('[Ad] not loaded yet, set pendingShow=true and ensure load');
        pendingShow = true;
        interstitial?.load();
      }
    }, delayMs);
  }
  