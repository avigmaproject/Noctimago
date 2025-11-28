// components/KeyboardDockModal.tsx
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Keyboard,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

type Props = {
  visible: boolean;           // you control it (usually true while TextInput focused)
  value: string;
  onChangeText: (t: string) => void;
  onSend: () => void;
  onRequestClose: () => void; // called when user taps backdrop or dismiss
};

export default function KeyboardDockModal({
  visible,
  value,
  onChangeText,
  onSend,
  onRequestClose,
}: Props) {
  const [kbh, setKbh] = useState(0);                // keyboard height
  const bottom = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const onShow = (e: any) => {
      const h = e?.endCoordinates?.height ?? 0;
      setKbh(h);
      Animated.timing(bottom, {
        toValue: h,
        duration: Platform.OS === 'ios' ? e.duration ?? 250 : 200,
        useNativeDriver: false,
      }).start();
    };
    const onHide = (e: any) => {
      Animated.timing(bottom, {
        toValue: 0,
        duration: Platform.OS === 'ios' ? e.duration ?? 200 : 180,
        useNativeDriver: false,
      }).start(() => setKbh(0));
    };

    const s1 = Keyboard.addListener(showEvt, onShow);
    const s2 = Keyboard.addListener(hideEvt, onHide);
    return () => {
      s1.remove();
      s2.remove();
    };
  }, [bottom]);

  if (!visible) return null;

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onRequestClose}
    >
      {/* Backdrop (click-through except to close on tap) */}
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onRequestClose} />

      {/* Docked container that tracks keyboard height */}
      <Animated.View style={[styles.dock, { paddingBottom: kbh }]}>
        <View style={styles.bar}>
          <TextInput
            style={styles.input}
            placeholder="Add a comment..."
            placeholderTextColor="#a1a1b0"
            value={value}
            onChangeText={onChangeText}
            returnKeyType="send"
            blurOnSubmit={false}
            onSubmitEditing={onSend}
            autoFocus
          />
          <TouchableOpacity
            onPress={onSend}
            disabled={!value.trim()}
            style={[styles.send, !value.trim() && { opacity: 0.5 }]}
          >
            <Text style={styles.sendTxt}>Send</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  dock: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0, // we'll add keyboard height as paddingBottom
  },
  bar: {
    backgroundColor: '#0B0B12',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  input: {
    flex: 1,
    height: 42,
    borderRadius: 10,
    backgroundColor: '#11121a',
    paddingHorizontal: 12,
    color: '#EDEDF4',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  send: {
    height: 42,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: '#201A83',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendTxt: { color: '#fff', fontWeight: '700' },
});
