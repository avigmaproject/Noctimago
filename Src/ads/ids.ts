// src/ads/ids.ts
// centralized AdMob unit ids so you don’t accidentally leave a test
// ID in production

import { TestIds } from 'react-native-google-mobile-ads';

export const BANNER_AD_ID = __DEV__
  ? TestIds.BANNER
  : 'ca-app-pub-2847186072494111/3698240885';

export const INTERSTITIAL_AD_ID = __DEV__
  ? TestIds.INTERSTITIAL
  : 'ca-app-pub-2847186072494111/5687551304';

// add more ids (rewarded, native, etc.) as needed
