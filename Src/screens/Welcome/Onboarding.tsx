// src/screens/Onboarding.tsx
import React, { useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  ImageBackground,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  FlatList,
  ListRenderItemInfo,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';

const { width, height } = Dimensions.get('window');

type Slide = {
  key: string;
  image: any;
  title: string;
  subtitle: string;
};

const SLIDES: Slide[] = [
  {
    key: '1',
    image: require('../../assets/slide1.png'),
    title: 'Welcome to The Real\nCommunity',
    subtitle: 'Instantly access and save your favorite event memories.',
  },
  {
    key: '2',
    image: require('../../assets/slide2.png'),
    title: 'We Picture It Differently',
    subtitle: 'Find new faces and explore the hottest party scenes.',
  },
  // {
  //   key: '3',
  //   image: require('../../assets/slide3.png'),
  //   title: 'We Picture It Differently',
  //   subtitle: 'Share your best moments and light up the gallery.',
  // },
];

export default function Onboarding() {
  const navigation = useNavigation<any>();
  const scrollX = useRef(new Animated.Value(0)).current;
  const listRef = useRef<FlatList<Slide>>(null);
  const [index, setIndex] = useState(0);

  const goNext = () => {
    if (index < SLIDES.length - 1) {
      listRef.current?.scrollToIndex({ index: index + 1, animated: true });
    } else {
      // last slide -> go to SignUp
      navigation.navigate('CreateAccountScreen');
    }
  };

  const renderItem = ({ item }: ListRenderItemInfo<Slide>) => (
    <View style={{ width, height }}>
      <ImageBackground source={item.image} style={styles.bg} resizeMode="cover">
        <View style={styles.topFade} />
        <View style={styles.bottomShade} />

        <View style={styles.copyBlock}>
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.subtitle}>{item.subtitle}</Text>

          <View style={styles.controls}>
            <PagerDots count={SLIDES.length} scrollX={scrollX} />
            <View style={styles.buttonRow}>
              <Button ghost label="Sign In" onPress={() => navigation.navigate('SignIn')} />
              <Button
                solid
                label={index === SLIDES.length - 1 ? "Let's Start" : 'Next'}
                onPress={goNext}
              />
            </View>
          </View>
        </View>
      </ImageBackground>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: 'black' }}>
      <StatusBar barStyle="light-content" />

      {/* 👉 Skip button (only show if not on last slide) */}
      {index < SLIDES.length - 1 && (
        <TouchableOpacity
          style={styles.skipBtn}
          onPress={() => navigation.navigate('SignIn')}
          activeOpacity={0.7}
        >
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      )}

      <Animated.FlatList
        ref={listRef}
        data={SLIDES}
        keyExtractor={(s) => s.key}
        renderItem={renderItem}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        onMomentumScrollEnd={(e) => {
          const idx = Math.round(e.nativeEvent.contentOffset.x / width);
          setIndex(idx);
        }}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: true }
        )}
        scrollEventThrottle={16}
      />
    </View>
  );
}

/* ------- Pager Dots ------- */

function PagerDots({ count, scrollX }: { count: number; scrollX: Animated.Value }) {
  const inputRange = Array.from({ length: count }, (_, i) => i * width);
  return (
    <View style={styles.dotsWrap}>
      {Array.from({ length: count }, (_, i) => {
        const w = scrollX.interpolate({
          inputRange,
          outputRange: inputRange.map((_, idx) => (idx === i ? 30 : 8)),
          extrapolate: 'clamp',
        });
        const bg = scrollX.interpolate({
          inputRange,
          outputRange: inputRange.map((_, idx) => (idx === i ? 1 : 0)),
        });
        return (
          <Animated.View
            key={i}
            style={[
              styles.dot,
              {
                width: w,
                backgroundColor: bg.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['white', '#ff2a2a'],
                }) as any,
              },
            ]}
          />
        );
      })}
    </View>
  );
}

/* ------- Button ------- */
function Button({
  label,
  onPress,
  solid,
  ghost,
}: {
  label: string;
  onPress: () => void;
  solid?: boolean;
  ghost?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={[styles.btn, solid && styles.btnSolid, ghost && styles.btnGhost]}
    >
      <Text style={[styles.btnLabel, solid ? styles.btnLabelSolid : styles.btnLabelGhost]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

/* ------- Styles ------- */
const styles = StyleSheet.create({
  bg: { flex: 1 },
  topFade: { position: 'absolute', top: 0, left: 0, right: 0, height: height * 0.22 },
  bottomShade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: height * 0.35,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  copyBlock: { position: 'absolute', left: 24, right: 24, bottom: 32, alignItems: 'center' },
  title: {
    color: 'white',
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 16,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 30,
  },
  controls: { width: '100%' },
  dotsWrap: { height: 22, alignSelf: 'center', flexDirection: 'row', gap: 8, marginBottom: 16 },
  dot: { height: 8, borderRadius: 6, backgroundColor: 'white', bottom: 20 },
  buttonRow: { flexDirection: 'row', gap: 14, justifyContent: 'space-between', bottom: 30 },
  btn: {
    flex: 1,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnSolid: { backgroundColor: '#0B0B38' },
  btnGhost: { backgroundColor: 'rgba(255,255,255,0.16)' },
  btnLabel: { fontSize: 16, fontWeight: '700' },
  btnLabelSolid: { color: 'white' },
  btnLabelGhost: { color: 'white' },

  // 👉 Skip button styles
  skipBtn: {
    position: 'absolute',
    top: 20, // adjust for safe area / notch
    right: 20,
    zIndex: 10,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  skipText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
});
