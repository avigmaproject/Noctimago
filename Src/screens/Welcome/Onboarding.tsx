// src/screens/Onboarding.tsx
import React, { useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Image,
  ImageBackground,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  FlatList,
  ListRenderItemInfo,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import LinearGradient from 'react-native-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width, height } = Dimensions.get('window');

// Slide 1 uses an exported PNG (stable on all devices)
const TITLE1_IMG = require('../../assets/body-text.png');
const TITLE1_AR = 454 / 264; // (w / h)

type Slide = { key: string; image: any; title: string; subtitle: string };

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
];

export default function Onboarding() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const scrollX = useRef(new Animated.Value(0)).current;
  const listRef = useRef<FlatList<Slide>>(null);
  const [index, setIndex] = useState(0);

  const goNext = () => {
    if (index < SLIDES.length - 1) {
      listRef.current?.scrollToIndex({ index: index + 1, animated: true });
    } else {
      navigation.navigate('CreateAccountScreen');
    }
  };

  const renderItem = ({ item }: ListRenderItemInfo<Slide>) => (
    <View style={{ width, height }}>
      <ImageBackground source={item.image} style={styles.bg} resizeMode="cover">
        {/* soft bottom gradient */}
        <LinearGradient
          pointerEvents="none"
          colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.38)', 'rgba(0,0,0,0.70)']}
          locations={[0, 0.45, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.bottomFade}
        />

        <View
          style={[
            styles.copyBlock,
            {
              paddingBottom: insets.bottom + 16, // keep above gesture bar
            },
          ]}
        >
          {/* Slide 1: use PNG (locked layout) */}
          {item.key === '1' ? (
            <Image source={TITLE1_IMG} resizeMode="contain" style={styles.titleImage} />
          ) : (
            <>
              <TitleWithUnderline text={item.title} highlight="Real" />
              <Text
                style={styles.subtitle}
                allowFontScaling={false} // keep copy consistent
              >
                {item.subtitle}
              </Text>
            </>
          )}

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

      {index < SLIDES.length - 1 && (
        <TouchableOpacity
          style={[
            styles.skipBtn,
            { top: (Platform.OS === 'android' ? insets.top : insets.top) + 8, right: 20 },
          ]}
          onPress={() => navigation.navigate('SignIn')}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={styles.skipText} allowFontScaling={false}>
            Skip
          </Text>
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
          { useNativeDriver: false } // we animate width/color
        )}
        scrollEventThrottle={16}
      />
    </View>
  );
}

/* ── Title with underline that anchors to measured width ── */
function TitleWithUnderline({ text, highlight }: { text: string; highlight: string }) {
  const [hw, setHW] = useState(0); // measured width of highlight

  const [line1 = '', line2 = ''] = text.split('\n');
  const i = line1.indexOf(highlight);

  if (i === -1) {
    return (
      <View style={{ alignItems: 'center', marginBottom: 18 }}>
        <Text style={styles.title} allowFontScaling={false}>
          {line1}
        </Text>
        {!!line2 && (
          <Text style={styles.title} allowFontScaling={false}>
            {line2}
          </Text>
        )}
      </View>
    );
  }

  const pre = line1.slice(0, i);
  const post = line1.slice(i + highlight.length);

  // Underline sized to the highlighted word width (no magic offsets)
  const length = Math.max(24, Math.min(hw * 0.95, 220));
  const heightU = 10;
  const bulge = 5;
  const d = [
    `M 0 ${heightU - 2}`,
    `Q ${length / 2} ${2 - bulge} ${length} ${heightU - 2}`,
    `L ${length} ${heightU - 1}`,
    `Q ${length / 2} ${2 + bulge} 0 ${heightU - 1}`,
    'Z',
  ].join(' ');

  return (
    <View style={{ alignItems: 'center', marginBottom: 18 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
        <Text style={styles.title} allowFontScaling={false}>
          {pre}
        </Text>

        <View style={{ position: 'relative' }}>
          <Text
            style={styles.title}
            onLayout={(e) => setHW(e.nativeEvent.layout.width)}
            allowFontScaling={false}
          >
            {highlight}
          </Text>
          {hw > 0 && (
            <Svg
              width={length}
              height={heightU}
              style={{
                position: 'absolute',
                left: (hw - length) / 2,
                bottom: 2,
                transform: [{ rotate: '-12deg' }],
              }}
            >
              <Path d={d} fill="#ff2a2a" />
            </Svg>
          )}
        </View>

        <Text style={styles.title} allowFontScaling={false}>
          {post}
        </Text>
      </View>

      {!!line2 && (
        <Text style={styles.title} allowFontScaling={false}>
          {line2}
        </Text>
      )}
    </View>
  );
}

/* ── Pager Dots ── */
function PagerDots({ count, scrollX }: { count: number; scrollX: Animated.Value }) {
  const inputRange = Array.from({ length: count }, (_, i) => i * width);
  return (
    <View style={styles.dotsWrap}>
      {Array.from({ length: count }, (_, i) => {
        const w = scrollX.interpolate({
          inputRange,
          outputRange: inputRange.map((_, idx) => (idx === i ? 26 : 8)),
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

/* ── Buttons ── */
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
      <Text
        style={[styles.btnLabel, solid ? styles.btnLabelSolid : styles.btnLabelGhost]}
        allowFontScaling={false}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

/* ── Styles ── */
const styles = StyleSheet.create({
  bg: { flex: 1 },

  bottomFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: height * 0.5,
  },

  copyBlock: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 24,
    alignItems: 'center',
  },

  // PNG that contains both title + subheading for slide 1
  titleImage: {
    width: width * 0.86,
    aspectRatio: TITLE1_AR,
    marginBottom: 24,
  },

  title: {
    color: 'white',
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '800',
    textAlign: 'center',
    includeFontPadding: false, // Android text baseline consistency
  },

  subtitle: {
    color: 'rgba(255,255,255,0.95)',
    fontSize: 18,
    lineHeight: 22,
    textAlign: 'center',
    marginTop: 14,
  },

  controls: { width: '100%' },

  dotsWrap: {
    height: 22,
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  dot: { height: 8, borderRadius: 6 },

  buttonRow: { flexDirection: 'row', gap: 14, justifyContent: 'space-between' },
  btn: { flex: 1, height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  btnSolid: { backgroundColor: '#0B0B38' },
  btnGhost: { backgroundColor: 'rgba(255,255,255,0.16)' },
  btnLabel: { fontSize: 16, fontWeight: '700' },
  btnLabelSolid: { color: 'white' },
  btnLabelGhost: { color: 'white' },

  skipBtn: { position: 'absolute', zIndex: 10 },
  skipText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowRadius: 6,
    textShadowOffset: { width: 0, height: 1 },
  },
});
