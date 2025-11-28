// responsive.ts
import { Dimensions, PixelRatio } from "react-native";
export const { width: W, height: H, fontScale: FS } = Dimensions.get("window");

// scale font but respect system fontScale (FS)
export const sp = (size: number) => PixelRatio.roundToNearestPixel(size * Math.max(1, FS * 0.95));
// percentage sizes
export const wp = (p: number) => Math.round((W * p) / 100);
export const hp = (p: number) => Math.round((H * p) / 100);
