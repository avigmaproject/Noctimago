import { createNavigationContainerRef } from "@react-navigation/native";

export const navigationRef = createNavigationContainerRef<any>();

type PendingNav = { name: string; params?: any } | null;
let pending: PendingNav = null;

export function navigate(name: string, params?: any) {
  if (navigationRef.isReady()) {
    navigationRef.navigate(name as never, params as never);
  } else {
    pending = { name, params };
  }
}

export function flushPendingNavigation() {
  if (pending && navigationRef.isReady()) {
    navigationRef.navigate(pending.name as never, pending.params as never);
    pending = null;
  }
}
