// src/screens/SignIn.tsx
import React, { useEffect, useState } from 'react';
import {
  Platform,
  KeyboardAvoidingView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Image,
  Pressable,
  Alert,
} from 'react-native';
import {setLoggedIn, setToken} from '../../store/action/auth/action';
import Feather from 'react-native-vector-icons/Feather';
import FontAwesome from 'react-native-vector-icons/FontAwesome';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useDispatch } from 'react-redux';
// import { setToken } from '../store/authSlice'; // <- Uncomment/adjust if you store token in Redux
import { register,login } from '../../utils/apiconfig';

type Props = {
  navigation: any; // Replace with your navigator type if available
  onForgot?: () => void;
  onGoogle?: () => void;
  onFacebook?: () => void;
};

export default function SignIn({
  navigation,
  onForgot,
  onGoogle,
  onFacebook,
}: Props) {
  const [email, setEmail] = useState('');
  const [pwd, setPwd] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);

  const dispatch = useDispatch();

  const canSubmit = email.trim().length > 3 && pwd.length >= 6;

  useEffect(() => {
    // Pre-fill remembered email if present
    (async () => {
      try {
        const saved = await AsyncStorage.getItem('@auth_email');
        if (saved) {
          setEmail(saved);
          setRemember(true);
        }
      } catch {
        // ignore
      }
    })();
  }, []);

  const submitForm = async () => {
    if (!canSubmit || loading) return;

    try {
      setLoading(true);

      const payload = JSON.stringify({
        username: email.trim(),
        password: pwd,
      });

      console.log('login payload:', payload);

      const res = await login(payload);
      console.log('login response:', res.status);
  if(res.status==='success'){
    dispatch(setToken(res.token));
    dispatch(setLoggedIn());
    if (remember) {
      await AsyncStorage.setItem('@auth_email', email.trim());
      await AsyncStorage.setItem('@auth_password', pwd); // ✅ Save password
    } else {
      await AsyncStorage.removeItem('@auth_email');
      await AsyncStorage.removeItem('@auth_password'); // ✅ Remove password if not remember
    }
  
  }
  else
  {
    Alert.alert('The Email or password is incorrect.');
  }
      
return 0
      // Accept common shapes: { token }, { userToken }, { data: { token } }, etc.
      const token =
        res?.token ||
        res?.userToken ||
        res?.data?.token ||
        res?.data?.userToken;

      if (!token) {
        const message =
          res?.message || res?.error || 'Invalid credentials or server error.';
        throw new Error(message);
      }

      // Persist token in Redux if you have a slice
      // dispatch(setToken(token));

      // Remember email if toggled
      if (remember) {
        await AsyncStorage.setItem('@auth_email', email.trim());
      } else {
        await AsyncStorage.removeItem('@auth_email');
      }

      // Navigate to your main/root screen
      navigation.replace('Home'); // <- adjust to your app's initial route
    } catch (err: any) {
      console.warn('login error:', err);
      Alert.alert('Sign In Failed', err?.message ?? 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <KeyboardAvoidingView
        behavior={Platform.select({ ios: 'padding', android: undefined })}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo */}
          <Image
            source={require('../../assets/Logo.png')}
            resizeMode="contain"
            style={styles.logo}
          />

          <Text style={styles.welcome}>Welcome Back!</Text>

          {/* Email */}
          <Text style={styles.label}>Email Address</Text>
          <View style={styles.inputWrap}>
            <Feather name="mail" size={18} color="#8C8C99" style={styles.leftIcon} />
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="Enter your email address..."
              placeholderTextColor="#777784"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
              editable={!loading}
            />
          </View>

          {/* Password */}
          <Text style={[styles.label, { marginTop: 16 }]}>Password</Text>
          <View style={styles.inputWrap}>
            <Feather name="lock" size={18} color="#8C8C99" style={styles.leftIcon} />
            <TextInput
              value={pwd}
              onChangeText={setPwd}
              placeholder="••••••••••••••"
              placeholderTextColor="#777784"
              secureTextEntry={!showPwd}
              style={styles.input}
              editable={!loading}
            />
            <Pressable
              onPress={() => setShowPwd((s) => !s)}
              style={styles.rightIcon}
              disabled={loading}
            >
              <Feather name={showPwd ? 'eye' : 'eye-off'} size={18} color="#A0A0AD" />
            </Pressable>
          </View>

          {/* Remember + Forgot */}
          <View style={styles.rowBetween}>
            <Pressable
              onPress={() => setRemember(!remember)}
              style={styles.rememberWrap}
              disabled={loading}
            >
              <View style={[styles.checkbox, remember && styles.checkboxChecked]}>
                {remember && <Feather name="check" size={14} color="#0B0B38" />}
              </View>
              <Text style={styles.rememberText}>Remember me</Text>
            </Pressable>

            <TouchableOpacity onPress={onForgot} disabled={loading}>
              <Text style={styles.link}>Forgot password?</Text>
            </TouchableOpacity>
          </View>

          {/* Sign In button */}
          <TouchableOpacity
            activeOpacity={0.9}
            style={[styles.primaryBtn, (!canSubmit || loading) && { opacity: 0.6 }]}
            disabled={!canSubmit || loading}
            onPress={submitForm}
          >
            <Text style={styles.primaryLabel}>
              {loading ? 'Signing in…' : 'Sign In'}
            </Text>
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.dividerRow}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.divider} />
          </View>

          {/* Social buttons */}
          <TouchableOpacity style={styles.socialBtn} onPress={onGoogle} disabled={loading}>
            <FontAwesome name="google" size={18} color="#ffffff" style={{ marginRight: 10 }} />
            <Text style={styles.socialLabel}>Sign In With Google</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.socialBtn, { marginTop: 12 }]}
            onPress={onFacebook}
            disabled={loading}
          >
            <FontAwesome name="facebook" size={20} color="#ffffff" style={{ marginRight: 10 }} />
            <Text style={styles.socialLabel}>Sign In With Facebook</Text>
          </TouchableOpacity>

          {/* Bottom link */}
          <TouchableOpacity
            onPress={() => navigation.navigate('CreateAccountScreen')}
            style={{ marginTop: 16, alignSelf: 'center' }}
            disabled={loading}
          >
            <Text style={styles.bottomLink}>Don’t have an account</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const BG = '#0A0A12';
const CARD = 'rgba(255,255,255,0.08)';
const OUTLINE = 'rgba(255,255,255,0.16)';
const PRIMARY = '#0B0552';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG, justifyContent: 'center' },
  scroll: { padding: 24, paddingBottom: 40 },
  logo: { width: 190, height: 56, alignSelf: 'center', marginTop: 50, marginBottom: 60, justifyContent: 'center' },
  welcome: { color: '#FFFFFF', fontSize: 22, fontWeight: '800', marginBottom: 30, alignSelf: 'center' },

  label: { color: '#EDEDF2', fontSize: 14, marginBottom: 8, fontWeight: '600' },

  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: OUTLINE,
    borderRadius: 16,
    height: 54,
    paddingLeft: 44,
    paddingRight: 44,
  },
  input: { flex: 1, color: '#FFFFFF', fontSize: 16 },
  leftIcon: { position: 'absolute', left: 14 },
  rightIcon: { position: 'absolute', right: 14, padding: 6 },

  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  rememberWrap: { flexDirection: 'row', alignItems: 'center' },
  checkbox: {
    width: 20, height: 20, borderRadius: 4, borderWidth: 1,
    borderColor: OUTLINE, backgroundColor: 'transparent', marginRight: 8, alignItems: 'center', justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: '#FFFFFF' },
  rememberText: { color: '#CFCFD6' },

  primaryBtn: {
    height: 56,
    backgroundColor: PRIMARY,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  primaryLabel: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },

  dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 22 },
  divider: { height: 1, flex: 1, backgroundColor: OUTLINE },
  dividerText: { color: '#8F8F99', marginHorizontal: 10, fontWeight: '700' },

  socialBtn: {
    height: 54,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: OUTLINE,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  socialLabel: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },

  link: { color: '#FFFFFF', fontWeight: '600' },
  bottomLink: { color: '#CFCFD6', textDecorationLine: 'underline' },
});
