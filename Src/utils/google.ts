// src/google.ts
import { GoogleSignin } from '@react-native-google-signin/google-signin';

export function configGoogle() {
  GoogleSignin.configure({
    // The WEB client ID (from “Web application” OAuth client)
    webClientId: '965542777595-uj02jif0ne1hbnee85oj8h9jm9jingi2.apps.googleusercontent.com',
    // Optional but recommended:
    iosClientId: 'YOUR_IOS_CLIENT_ID.apps.googleusercontent.com',
    offlineAccess: true, // if you need server auth / refresh token (Android)
    forceCodeForRefreshToken: false,
  });
}
