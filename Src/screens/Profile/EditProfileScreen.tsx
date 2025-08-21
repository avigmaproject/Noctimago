// EditProfileScreen.tsx
import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Image,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import Feather from 'react-native-vector-icons/Feather';
import {useDispatch, useSelector} from 'react-redux';
import { updateprofile } from '../../utils/apiconfig';
const COLORS = {
  bg: '#0B0B10',
  card: '#141420',
  input: '#2A2A36',
  text: '#FFFFFF',
  hint: '#A3A3B0',
  border: 'rgba(255,255,255,0.14)',
  primary: '#181a6b', // deep indigo like the mock CTA
  primaryText: '#FFFFFF',
  danger: '#F43F5E',
};

export default function EditProfileScreen({ navigation }: any) {
  const userprofile = useSelector(state => state.authReducer.userprofile);
  const [avatarUri, setAvatarUri] = useState('https://i.pravatar.cc/120?img=12');
  const [username, setUsername] = useState(userprofile?.username?userprofile?.username:'');
  const [fullName, setFullName] = useState(userprofile?.name?userprofile?.name:'');
  const [email, setEmail] = useState(userprofile?.email?userprofile?.email:'');
  const token = useSelector((state: any) => state.authReducer.token);
  const emailValid = useMemo(
    () => /^\S+@\S+\.\S+$/.test(email.trim()),
    [email],
  );
  const canSave = username.trim().length > 0 && fullName.trim().length > 0 && emailValid;

  const pickAvatar = async () => {
    // Plug in your picker (expo-image-picker/react-native-image-crop-picker)
    // For now mock change:
    setAvatarUri('https://i.pravatar.cc/160?img=15');
  };


  const onSave = async () => {
    try {
      const payload = JSON.stringify({
        email: email,
        name: fullName,
        username:username
      });

      console.log('login payload:', payload);

      const res = await updateprofile(payload,token);
      console.log('[GetUserHome] token =', token); // <-- should log now
    
      console.log('[GetUserHome] res =', res);
      Alert.alert("Profile Updated!!!")
navigation.goBack()
  

    } catch (error) {
      console.log('[GetUserHome] error =', error);
    }
  };
  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation?.goBack?.()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Feather name="chevron-left" size={26} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Profile</Text>
          <View style={{ width: 26 }} />
        </View>

        <ScrollView
          contentContainerStyle={{ paddingBottom: 28 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Avatar */}
          <View style={styles.avatarWrap}>
            <Image source={{ uri: avatarUri }} style={styles.avatar} />
            <TouchableOpacity style={styles.avatarBadge} onPress={pickAvatar}>
              <Feather name="camera" size={16} color="#000" />
            </TouchableOpacity>
          </View>

          {/* Inputs */}
          <LabeledInput
            label="User Name"
            placeholder="Enter your name"
            icon="user"
            value={username}
            onChangeText={setUsername}
            editable={false}
          />

          <LabeledInput
            label="Full Name"
            placeholder="Enter your name"
            icon="user"
            value={fullName}
            onChangeText={setFullName}
          />

          <LabeledInput
            label="Email Address"
            placeholder="Enter your email address..."
            icon="mail"
            value={email}
            keyboardType="email-address"
            autoCapitalize="none"
            onChangeText={setEmail}
            editable={false}
            error={email.length > 0 && !emailValid ? 'Enter a valid email' : undefined}
          />

          {/* Save Button */}
          <TouchableOpacity
            disabled={!canSave}
            onPress={onSave}
            style={[styles.cta, !canSave && { opacity: 0.5 }]}
            activeOpacity={0.9}
          >
            <Text style={styles.ctaText}>Save Change</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/* ----------------------------- Reusable Input ----------------------------- */

function LabeledInput({
  label,
  icon,
  error,
  style,
  ...inputProps
}: {
  label: string;
  icon: string;
  error?: string;
  style?: any;
} & React.ComponentProps<typeof TextInput>) {
  return (
    <View style={[{ marginHorizontal: 16, marginTop: 18 }, style]}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputRow}>
        <Feather name={icon as any} size={18} color={COLORS.hint} style={{ marginLeft: 12 }} />
        <TextInput
          placeholderTextColor={COLORS.hint}
          style={styles.input}
          {...inputProps}
        />
      </View>
      {!!error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

/* --------------------------------- Styles -------------------------------- */

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomColor: 'rgba(255,255,255,0.08)',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { color: COLORS.text, fontSize: 18, fontWeight: '700' },

  avatarWrap: {
    alignSelf: 'center',
    marginTop: 24,
    marginBottom: 8,
  },
  avatar: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: COLORS.card,
  },
  avatarBadge: {
    position: 'absolute',
    right: 4,
    bottom: 6,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
  },

  label: {
    color: COLORS.text,
    fontWeight: '700',
    marginBottom: 8,
  },
  inputRow: {
    height: 52,
    backgroundColor: COLORS.input,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    color: COLORS.text,
    paddingHorizontal: 12,
    fontSize: 15,
  },
  error: {
    color: COLORS.danger,
    marginTop: 6,
    fontSize: 12.5,
  },

  cta: {
    marginHorizontal: 16,
    marginTop: 30,
    backgroundColor: COLORS.primary,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: { color: COLORS.primaryText, fontWeight: '700', fontSize: 16 },
});
