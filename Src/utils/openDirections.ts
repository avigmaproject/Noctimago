// src/utils/openDirections.ts
import { Linking, Platform } from 'react-native';

type DirectionsMode = 'driving' | 'walking' | 'transit' | 'bicycling';

type DirectionsParams =
  | { address: string; mode?: DirectionsMode }                 // human-readable address
  | { lat: number; lng: number; mode?: DirectionsMode };       // exact coordinates

export async function openDirections(params: DirectionsParams) {
  const mode = ('mode' in params && params.mode) ? params.mode! : 'driving';

  // Build a destination query for each platform/scheme
  const hasCoords = 'lat' in params && 'lng' in params;
  const q = hasCoords
    ? `${params.lat},${params.lng}`
    : encodeURIComponent(params.address);

  try {
    if (Platform.OS === 'ios') {
      // Prefer Google Maps if installed, else Apple Maps
      const googleScheme = `comgooglemaps://?daddr=${q}&directionsmode=${googleMode(mode)}`;
      const appleUrl     = `http://maps.apple.com/?daddr=${q}&dirflg=${appleFlag(mode)}`;

      const canOpenGoogle = await Linking.canOpenURL('comgooglemaps://');
      await Linking.openURL(canOpenGoogle ? googleScheme : appleUrl);
      return;
    }

    // ANDROID
    // If we have exact coords, use turn-by-turn nav. Otherwise search the address.
    const androidUrl = hasCoords
      ? `google.navigation:q=${q}&mode=${androidMode(mode)}`
      : `geo:0,0?q=${q}`;

    const canOpen = await Linking.canOpenURL(androidUrl);
    if (canOpen) {
      await Linking.openURL(androidUrl);
      return;
    }

    // Browser fallback (works everywhere)
    const web = hasCoords
      ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}&travelmode=${googleMode(mode)}`
      : `https://www.google.com/maps/search/?api=1&query=${q}`;
    await Linking.openURL(web);
  } catch (err) {
    console.warn('openDirections error:', err);
  }
}

function googleMode(mode: DirectionsMode) {
  // Google/Apple accept: driving, walking, bicycling, transit
  return mode;
}

function appleFlag(mode: DirectionsMode) {
  // Apple Maps flags: d=driving, w=walking, r=transit; (no bicycling)
  switch (mode) {
    case 'walking': return 'w';
    case 'transit': return 'r';
    default:        return 'd';
  }
}

function androidMode(mode: DirectionsMode) {
  // Google nav modes for android: d=driving, w=walking, b=bicycling
  switch (mode) {
    case 'walking':   return 'w';
    case 'bicycling': return 'b';
    default:          return 'd';
  }
}
