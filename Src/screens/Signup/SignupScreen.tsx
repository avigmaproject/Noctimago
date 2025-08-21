// CreateAccountScreen.tsx
import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  TouchableOpacity,
  Alert,
  Image,
  ActivityIndicator,
} from 'react-native';
import Feather from 'react-native-vector-icons/Feather';
import { register } from '../../utils/apiconfig'; // ⬅️ uses your API helper
import {setLoggedIn, setToken} from '../../store/action/auth/action';
import { useDispatch } from 'react-redux';
const COLORS = {
  bg: '#0E0F12',
  card: '#1A1C21',
  border: '#32343A',
  text: '#E5E7EB',
  sub: '#9CA3AF',
  placeholder: '#8B8F98',
  primary: '#1A125C',
  primaryText: '#FFFFFF',
  danger: '#F05C67',
  warn: '#F4B63D',
  ok: '#6FCF97',
  track: '#3A3D45',
  link: '#C7CAD1',
};

export default function CreateAccountScreen({ navigation }: any) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [pwd, setPwd] = useState('');
  const [pwd2, setPwd2] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [showPwd2, setShowPwd2] = useState(false);
  const [loading, setLoading] = useState(false);          // ⬅️ NEW
  const dispatch = useDispatch();
  const strength = useMemo(() => evaluatePassword(pwd), [pwd]);
  const strengthMeta = useMemo(() => strengthDescriptor(strength), [strength]);

  const canSubmit =
    fullName.trim().length > 1 &&
    isValidEmail(email) &&
    strength >= 2 && // require at least "Fair"
    pwd === pwd2 &&
    !loading;

  const onSubmit = async () => {
    if (!canSubmit) {
      Alert.alert('Check your details', 'Please fix the highlighted fields.');
      return;
    }

    try {
      setLoading(true);

      // shape your backend expects — adjust keys if needed
      const payload = JSON.stringify({
        username: fullName,
        email: email,
        password: pwd,
      });

      // API call
      console.log("data",payload)
      const res = await register(payload);
      console.log('register response:', res);
      console.log('login response:', res);
    //   dispatch(setToken(res.userToken));
      dispatch(setLoggedIn());
return 0
      // Accept common success shapes:
      const success =
        res?.success === true ||
        !!res?.userId ||
        !!res?.id ||
        !!res?.data?.id;

      if (!success) {
        // surface backend message if present
        const message =
          res?.message || res?.error || 'Could not create account.';
        throw new Error(message);
      }

      Alert.alert('🎉 Account created', 'You can now sign in.', [
        {
          text: 'OK',
          onPress: () => navigation.replace('SignIn'),
        },
      ]);
    } catch (err: any) {
      console.warn('register error:', err);
      Alert.alert('Sign up failed', err?.message ?? 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
        keyboardVerticalOffset={24}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo */}
          <View style={styles.logoRow}>
            <Image
              source={require('../../assets/Logo.png')}
              resizeMode="contain"
              style={styles.logo}
            />
          </View>

          {/* Title */}
          <Text style={styles.title}>Create Your Account</Text>

          {/* Full Name */}
          <LabeledInput
            label="Full Name"
            placeholder="Enter your name"
            value={fullName}
            onChangeText={setFullName}
            leftIcon="user"
            autoCapitalize="words"
            returnKeyType="next"
          />

          {/* Email */}
          <LabeledInput
            label="Email Address"
            placeholder="Enter your email address..."
            value={email}
            onChangeText={setEmail}
            leftIcon="mail"
            keyboardType="email-address"
            autoCapitalize="none"
            textContentType="emailAddress"
            error={email.length > 0 && !isValidEmail(email)}
          />

          {/* Password */}
          <LabeledInput
            label="Password"
            placeholder="****************"
            value={pwd}
            onChangeText={setPwd}
            leftIcon="lock"
            secureTextEntry={!showPwd}
            rightIcon={showPwd ? 'eye' : 'eye-off'}
            onRightIconPress={() => setShowPwd(s => !s)}
            textContentType="newPassword"
            autoCapitalize="none"
          />

          {/* Strength meter */}
          <View style={styles.meterWrap}>
            <StrengthMeter score={strength} />
            {pwd.length > 0 ? (
              <Text style={[styles.meterHint, { color: strengthMeta.color }]}>
                {strengthMeta.text}
              </Text>
            ) : null}
          </View>

          {/* Confirm Password */}
          <LabeledInput
            label="Confirm Password"
            placeholder="Enter your password..."
            value={pwd2}
            onChangeText={setPwd2}
            leftIcon="lock"
            secureTextEntry={!showPwd2}
            rightIcon={showPwd2 ? 'eye' : 'eye-off'}
            onRightIconPress={() => setShowPwd2(s => !s)}
            autoCapitalize="none"
            textContentType="newPassword"
            error={pwd2.length > 0 && pwd2 !== pwd}
          />

          {/* CTA */}
          <TouchableOpacity
            style={[styles.cta, (!canSubmit) && { opacity: 0.5 }]}
            activeOpacity={0.8}
            onPress={onSubmit}
            disabled={!canSubmit}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.ctaText}>Create Account</Text>
            )}
          </TouchableOpacity>

          {/* Footer link */}
          <TouchableOpacity
            onPress={() => navigation.navigate('SignIn')}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            disabled={loading}
          >
            <Text style={styles.link}>I already have an account</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/* ---------- Components ---------- */

type LabeledInputProps = {
  label: string;
  placeholder?: string;
  value: string;
  onChangeText: (t: string) => void;
  leftIcon?: string;
  rightIcon?: string;
  onRightIconPress?: () => void;
  secureTextEntry?: boolean;
  keyboardType?: any;
  textContentType?: any;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  returnKeyType?: any;
  error?: boolean;
};

function LabeledInput({
  label,
  placeholder,
  value,
  onChangeText,
  leftIcon,
  rightIcon,
  onRightIconPress,
  secureTextEntry,
  keyboardType,
  textContentType,
  autoCapitalize = 'none',
  returnKeyType = 'done',
  error,
}: LabeledInputProps) {
  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.label}>{label}</Text>
      <View
        style={[
          styles.inputWrap,
          error ? { borderColor: COLORS.danger } : null,
        ]}
      >
        {leftIcon ? (
          <Feather
            name={leftIcon as any}
            size={18}
            color={COLORS.sub}
            style={styles.leftIcon}
          />
        ) : null}
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor={COLORS.placeholder}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          textContentType={textContentType}
          autoCapitalize={autoCapitalize}
          returnKeyType={returnKeyType}
        />
        {rightIcon ? (
          <TouchableOpacity onPress={onRightIconPress} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Feather name={rightIcon as any} size={18} color={COLORS.sub} />
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

function StrengthMeter({ score }: { score: 0 | 1 | 2 | 3 | 4 }) {
  const colorFor = (i: number) => {
    if (score === 0) return COLORS.track;
    if (i <= score) {
      if (score <= 1) return COLORS.danger;
      if (score === 2) return COLORS.warn;
      if (score >= 3) return COLORS.ok;
    }
    return COLORS.track;
  };

  return (
    <View>
      <View style={styles.meterTrack}>
        {[1, 2, 3, 4].map(i => (
          <View key={i} style={[styles.meterSeg, { backgroundColor: colorFor(i) }]} />
        ))}
      </View>
    </View>
  );
}

/* ---------- Utils ---------- */

function isValidEmail(e: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());
}

// Simple strength evaluator: 0..4
function evaluatePassword(pw: string): 0 | 1 | 2 | 3 | 4 {
  if (!pw) return 0;
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return Math.max(1, Math.min(score, 4)) as 0 | 1 | 2 | 3 | 4;
}

function strengthDescriptor(score: number) {
  switch (score) {
    case 0:
    case 1:
      return { text: 'Weak! Please add more strength! 💪', color: COLORS.danger };
    case 2:
      return { text: 'Fair. Add symbols or numbers.', color: COLORS.warn };
    case 3:
      return { text: 'Good! One more step.', color: COLORS.ok };
    case 4:
      return { text: 'Strong password ✅', color: COLORS.ok };
    default:
      return { text: '', color: COLORS.sub };
  }
}

/* ---------- Styles ---------- */

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { paddingHorizontal: 24, paddingBottom: 32 },
  logoRow: { marginTop: 8, justifyContent: 'center' },
  title: {
    marginTop: 24,
    marginBottom: 20,
    color: COLORS.text,
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  fieldBlock: { marginBottom: 16 },
  label: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    height: 52,
    borderRadius: 14,
  },
  leftIcon: { marginRight: 10 },
  input: {
    flex: 1,
    color: COLORS.text,
    fontSize: 16,
    paddingVertical: Platform.select({ ios: 12, android: 8 }),
  },
  meterWrap: { marginTop: 8, marginBottom: 8 },
  meterTrack: {
    height: 6,
    backgroundColor: COLORS.track,
    borderRadius: 6,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  meterSeg: { flex: 1, marginHorizontal: 4, borderRadius: 6, height: 6 },
  meterHint: { marginTop: 8, fontSize: 13, fontWeight: '600' },
  cta: {
    marginTop: 18,
    backgroundColor: COLORS.primary,
    height: 56,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  ctaText: {
    color: COLORS.primaryText,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  link: {
    marginTop: 18,
    color: COLORS.link,
    textAlign: 'center',
    textDecorationLine: 'underline',
  },
  logo: {
    width: 190,
    height: 56,
    alignSelf: 'center',
    marginTop: 50,
    marginBottom: 60,
    justifyContent: 'center',
  },
});
