// src/screens/ChangePasswordScreen.tsx
import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

const COLORS = {
  bg: '#0B0C0F',
  surface: '#101217',
  field: '#1A1D24',
  fieldBorder: '#3A3F4A',
  text: '#E5E7EB',
  sub: '#9CA3AF',
  placeholder: '#9CA3AF',
  accent: '#11116B', // button
  accentText: '#FFFFFF',
  success: '#16A34A',
  divider: '#252833',
  icon: '#C0C3CC',
  danger: '#ef4444',
  mutedBar: '#AEB4C2',
};

export default function ChangePasswordScreen({ navigation }: any) {
  const [oldPwd, setOldPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');

  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // ---- Strength rules (tweak as you like)
  const rules = useMemo(() => {
    const len = newPwd.length >= 8;
    const upper = /[A-Z]/.test(newPwd);
    const lower = /[a-z]/.test(newPwd);
    const num = /\d/.test(newPwd);
    const sym = /[^A-Za-z0-9]/.test(newPwd);
    return { len, upperLower: upper && lower, num, sym };
  }, [newPwd]);

  const passedCount = Object.values(rules).filter(Boolean).length;
  const segments = 4; // show 4 bars as in your screenshot (merge upper/lower as one rule)
  const segmentFilled = (i: number) => i < passedCount;

  const match = newPwd.length > 0 && confirmPwd.length > 0 && newPwd === confirmPwd;
  const canSubmit = oldPwd.length > 0 && passedCount >= 3 && match; // enable when strong enough + match

  const onSubmit = () => {
    if (!canSubmit) return;
    // TODO: call API to change password
    // await changePassword({ oldPwd, newPwd });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation?.goBack?.()}>
          <Ionicons name="chevron-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Change Password</Text>
        <View style={{ width: 24 }} />
      </View>
      <View style={styles.divider} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
      >
        <View style={styles.container}>

          {/* Old Password */}
          <Text style={styles.label}>Old Password</Text>
          <Field
            value={oldPwd}
            onChangeText={setOldPwd}
            secureTextEntry={!showOld}
            placeholder="****************"
            leftIcon="lock-closed-outline"
            rightIcon={showOld ? 'eye-off-outline' : 'eye-outline'}
            onRightPress={() => setShowOld((s) => !s)}
          />

          {/* New Password */}
          <Text style={[styles.label, { marginTop: 14 }]}>New Password</Text>
          <Field
            value={newPwd}
            onChangeText={setNewPwd}
            secureTextEntry={!showNew}
            placeholder="****************"
            leftIcon="lock-closed-outline"
            rightIcon={showNew ? 'eye-off-outline' : 'eye-outline'}
            onRightPress={() => setShowNew((s) => !s)}
          />

          {/* Strength meter */}
          <View style={styles.meterRow}>
            {Array.from({ length: segments }).map((_, i) => (
              <View
                key={i}
                style={[
                  styles.meterSeg,
                  { backgroundColor: segmentFilled(i) ? COLORS.success : COLORS.mutedBar },
                ]}
              />
            ))}
          </View>

          {/* Confirm Password */}
          <Text style={[styles.label, { marginTop: 14 }]}>Confirm Password</Text>
          <Field
            value={confirmPwd}
            onChangeText={setConfirmPwd}
            secureTextEntry={!showConfirm}
            placeholder="****************"
            leftIcon="lock-closed-outline"
            rightIcon={showConfirm ? 'eye-off-outline' : 'eye-outline'}
            onRightPress={() => setShowConfirm((s) => !s)}
          />

          {/* Helper / mismatch */}
          {confirmPwd.length > 0 && !match && (
            <Text style={styles.errorText}>Passwords do not match</Text>
          )}

          {/* Spacer */}
          <View style={{ flex: 1 }} />

          {/* Submit */}
          <TouchableOpacity
            style={[styles.cta, !canSubmit && { opacity: 0.6 }]}
            activeOpacity={0.9}
            disabled={!canSubmit}
            onPress={onSubmit}
          >
            <Text style={styles.ctaText}>Confirm Password</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/* ---------- Reusable Field ---------- */
function Field({
  value,
  onChangeText,
  secureTextEntry,
  placeholder,
  leftIcon,
  rightIcon,
  onRightPress,
}: {
  value: string;
  onChangeText: (t: string) => void;
  secureTextEntry?: boolean;
  placeholder?: string;
  leftIcon?: string;
  rightIcon?: string;
  onRightPress?: () => void;
}) {
  return (
    <View style={styles.fieldWrap}>
      {!!leftIcon && (
        <Ionicons name={leftIcon as any} size={18} color={COLORS.icon} style={styles.leftIcon} />
      )}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={COLORS.placeholder}
        secureTextEntry={secureTextEntry}
        style={styles.input}
      />
      {!!rightIcon && (
        <TouchableOpacity onPress={onRightPress} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name={rightIcon as any} size={20} color={COLORS.icon} />
        </TouchableOpacity>
      )}
    </View>
  );
}

/* ---------- Styles ---------- */
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },

  header: {
    height: 52,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: { color: COLORS.text, fontSize: 18, fontWeight: '800' },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: COLORS.divider,
  },

  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 16,
  },

  label: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
  },

  fieldWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.field,
    borderWidth: 1,
    borderColor: COLORS.fieldBorder,
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 56,
  },
  leftIcon: { marginRight: 8 },
  input: {
    flex: 1,
    color: COLORS.text,
    fontSize: 16,
    paddingVertical: 0,
  },

  meterRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  meterSeg: {
    flex: 1,
    height: 4,
    borderRadius: 4,
  },

  errorText: {
    marginTop: 6,
    color: COLORS.danger,
    fontSize: 13,
    fontWeight: '600',
  },

  cta: {
    height: 56,
    borderRadius: 16,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
  },
  ctaText: {
    color: COLORS.accentText,
    fontSize: 16,
    fontWeight: '800',
  },
});
