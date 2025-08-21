// src/screens/Splash.tsx
import React, { useEffect, useRef } from 'react';
import { Animated, ImageBackground, Image, StyleSheet, View, Easing } from 'react-native';

const BG_FADE_DURATION = 600;
const LOGO_DELAY = 200;
const LOGO_ANIM_DURATION = 650;

export default function Splash({ onDone }: { onDone?: () => void }) {
  const bgOpacity = useRef(new Animated.Value(0)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.85)).current;
  const logoTranslateY = useRef(new Animated.Value(8)).current;

  // ensure we call onDone only once
  const doneCalled = useRef(false);
  const fireDone = () => {
    if (doneCalled.current) return;
    doneCalled.current = true;
    onDone?.();
  };

  useEffect(() => {
    // hard timeout: navigate after 5s no matter what
    const timer = setTimeout(fireDone, 5000);

    // animations (can also call fireDone at the end; guard prevents double)
    Animated.timing(bgOpacity, {
      toValue: 1,
      duration: BG_FADE_DURATION,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      Animated.sequence([
        Animated.delay(LOGO_DELAY),
        Animated.parallel([
          Animated.timing(logoOpacity, {
            toValue: 1,
            duration: LOGO_ANIM_DURATION,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(logoScale, {
            toValue: 1,
            duration: LOGO_ANIM_DURATION,
            easing: Easing.out(Easing.back(1.4)),
            useNativeDriver: true,
          }),
          Animated.timing(logoTranslateY, {
            toValue: 0,
            duration: LOGO_ANIM_DURATION,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
        Animated.delay(350),
      ]).start(fireDone);
    });

    return () => clearTimeout(timer);
  }, [bgOpacity, logoOpacity, logoScale, logoTranslateY]);

  return (
    <View style={styles.container}>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: bgOpacity }]}>
        <ImageBackground source={require('../../assets/Splash.png')} style={styles.bg} resizeMode="cover" />
        <View pointerEvents="none" style={styles.vignette} />
      </Animated.View>

      <Animated.View
        style={[
          styles.logoWrap,
          { opacity: logoOpacity, transform: [{ translateY: logoTranslateY }, { scale: logoScale }] },
        ]}
      >
        <Image source={require('../../assets/Logo.png')} style={styles.logo} resizeMode="contain" />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  bg: { flex: 1 },
  vignette: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.25)' },
  logoWrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' },
  logo: { width: 220, height: 60 },
});
