// Src/screens/Profile/EditProfileScreen.tsx
import React, { useMemo, useState, useEffect } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  StatusBar,
  Dimensions,
} from 'react-native';
import Feather from 'react-native-vector-icons/Feather';
import { useSelector } from 'react-redux';
import { updateprofile } from '../../utils/apiconfig';
import ImagePicker from 'react-native-image-crop-picker';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';

// i18n
import { TText } from '../../i18n/TText';
import { useAutoI18n } from '../../i18n/AutoI18nProvider';
// REVIEW: switched from AWS helper to new cloud upload utility
import { uploadDocument } from '../../utils/CloudUpload';

const COLORS = {
  bg: '#0B0B10',
  card: '#141420',
  input: '#2A2A36',
  text: '#FFFFFF',
  hint: '#A3A3B0',
  border: 'rgba(255,255,255,0.14)',
  primary: '#181a6b',
  primaryText: '#FFFFFF',
  danger: '#F43F5E',
  overlay: 'rgba(0,0,0,0.35)',
};

// ---------- helpers ----------
/** Make S3/Cloudfront URLs WordPress-safe (remove % encodes like %2F). */
function normalizeS3Url(url: string | undefined): string {
  if (!url) return '';
  try {
    const dec = decodeURIComponent(url);
    return dec.replace(/\s+/g, ' ');
  } catch {
    return url.replace(/%2F/gi, '/');
  }
}

const W = Dimensions.get('window').width;
const AVATAR_SIZE = Math.round(Math.min(140, Math.max(96, W * 0.32))); // 96–140 responsive
const BIO_MAX = 250;

export default function EditProfileScreen({ navigation }: any) {
  const userprofile = useSelector((s: any) => s?.authReducer?.userprofile);
  const token = useSelector((s: any) => s?.authReducer?.token);
// Turn u{1f382} back into 🎂
console.log("updateToken====>",userprofile)
const decodeCurlyUnicode = (s: string) =>
  s.replace(/u\{([0-9a-fA-F]+)\}/g, (_, hex) =>
    String.fromCodePoint(parseInt(hex, 16)),
  );

// Decode things like &#x1F382; or &#128152;
const decodeHtmlEntities = (s: string) =>
  s
    .replace(/&#x([0-9A-Fa-f]+);/g, (_, hex) =>
      String.fromCodePoint(parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, num) =>
      String.fromCodePoint(parseInt(num, 10)),
    );

// Encode 4-byte emojis as u{1f382} so MySQL/wp won’t strip them
const encodeEmojiToCurlyUnicode = (text: string) =>
  [...text].map((ch) => {
    const code = ch.codePointAt(0);
    if (!code) return ch;
    // only encode characters above BMP (most emojis)
    return code > 0xffff ? `u{${code.toString(16)}}` : ch;
  }).join('');

  const defaultAvatar =
    'https://upload.wikimedia.org/wikipedia/commons/thumb/b/bc/Unknown_person.jpg/1200px-Unknown_person.jpg';

  const [avatarUri, setAvatarUri] = useState(
    normalizeS3Url(userprofile?.meta?.profile_image) || defaultAvatar
  );
  const [username, setUsername] = useState(userprofile?.username ?? '');
  const [fullName, setFullName] = useState(userprofile?.display_name ?? '');
  const [email] = useState(userprofile?.email ?? '');
  const [loading, setLoading] = useState(false);
  const rawBioFromStore = String(userprofile?.bio ?? '');
  const [bio, setBio] = useState<string>(
    decodeHtmlEntities(decodeCurlyUnicode(rawBioFromStore)),
  );
  
  const emailValid = useMemo(() => /^\S+@\S+\.\S+$/.test(email.trim()), [email]);
  const canSave = fullName.trim().length > 0 && emailValid; // username/email locked

  const { translate, lang } = useAutoI18n();
  const [phName, setPhName] = useState('Enter your name');
  const [phEmail, setPhEmail] = useState('Enter your email address...');

  useEffect(() => {
    let live = true;
    (async () => {
      const t1 = await translate('Enter your name', { from: 'en', to: lang });
      const t2 = await translate('Enter your email address...', { from: 'en', to: lang });
      if (live) {
        setPhName(t1);
        setPhEmail(t2);
      }
    })();
    return () => {
      live = false;
    };
  }, [lang, translate]);

  // ---------- image picking ----------
  const pickAvatar = async () => {
    Alert.alert('Select Image', 'Choose an option', [
      { text: 'Camera', onPress: ImageCamera },
      { text: 'Gallery', onPress: ImageGallery },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const ImageGallery = async () => {
    setTimeout(() => {
      ImagePicker.openPicker({
        width: 500,
        height: 500,
        cropping: true,
        includeBase64: false,
        writeTempFile: true,
        includeExif: true,
        multiple: false,
        compressImageQuality: 0.75,
        cropperCircleOverlay: true,
      })
        .then((image) => {
          const imagedata = {
            name: Platform.OS === 'ios' ? image.filename : image.modificationDate,
            size: image.size,
            type: image.mime,
            uri:
              Platform.OS === 'ios'
                ? image.path
                  ? image.path
                  : (image as any).sourceURL
                : image.path,
          };
          uploadImage(imagedata);
        })
        .catch(() => {});
    }, 200);
  };

  const ImageCamera = async () => {
    console.log("camera")
    setTimeout(() => {
      ImagePicker.openCamera({
        width: 500,
        height: 500,
        cropping: true,
        includeBase64: false,
        writeTempFile: true,
        includeExif: true,
        multiple: false,
        compressImageQuality: 0.75,
        cropperCircleOverlay: true,
      })
        .then((image) => {
          const imagedata = {
            fileCopyUri: null,
            name: Platform.OS === 'ios' ? image.filename : image.modificationDate,
            size: image.size,
            type: image.mime,
            uri:
              Platform.OS === 'ios'
                ? image.path
                  ? image.path
                  : (image as any).sourceURL
                : image.path,
          };
          uploadImage(imagedata);
        })
        .catch(() => {});
    }, 200);
  };

  const uploadImage = async (file: any) => {
    try {
      // REVIEW: using cloud upload utility instead of AWS
      const uploadedUrl = await uploadDocument(file, token);
      // uploadDocument returns a URL string directly
      const safe = normalizeS3Url(uploadedUrl as string);
      setAvatarUri(safe || defaultAvatar);
    } catch (error) {
      Alert.alert('Upload failed', 'Could not upload image. Please try again.');
    }
  };

  // ---------- save ----------
  const onSave = async () => {
    if (!canSave) return;
    console.log("BIO SENDING:", bio); 
    setLoading(true);
    try {
      const payload = JSON.stringify({
        email,
        display_name: fullName.trim(),
        username,
        profile_image: normalizeS3Url(avatarUri),
        bio: encodeEmojiToCurlyUnicode(bio.trim()), 
      });

      await updateprofile(payload, token);
console.log("payload",payload)
      const ok = await translate('OK');
      const msg = await translate('Profile updated!');
      Alert.alert('', msg, [{ text: ok, onPress: () => navigation.goBack() }]);
    } catch (error: any) {
      const ok = await translate('OK');
      const msg =
        error?.response?.data?.message || (await translate('Something went wrong'));
      Alert.alert('', msg, [{ text: ok }]);
    } finally {
      setLoading(false);
    }
  };

  const insets = useSafeAreaInsets();
  const isIOS = Platform.OS === 'ios';
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />
      <KeyboardAvoidingView
  style={{ flex: 1 }}
  behavior={isIOS ? 'padding' : undefined}
  keyboardVerticalOffset={isIOS ? insets.top : 0}
>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation?.goBack?.()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Feather name="chevron-left" size={26} color={COLORS.text} />
          </TouchableOpacity>
          <TText style={styles.headerTitle}>Edit Profile</TText>
          <View style={{ width: 26 }} />
        </View>

        <ScrollView
          contentContainerStyle={{ paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentInsetAdjustmentBehavior="always"
          overScrollMode="never"
        >
          {/* Avatar */}
          <View style={styles.avatarWrap}>
            <View style={styles.avatarOuter}>
              <Image
                source={{ uri: avatarUri }}
                style={styles.avatar}
                onError={() => setAvatarUri(defaultAvatar)}
              />
              <TouchableOpacity style={styles.avatarBadge} onPress={pickAvatar} activeOpacity={0.9}>
                <View style={styles.avatarBadgeBg} />
                <Feather name="edit" size={Math.round(AVATAR_SIZE * 0.15)} color="#000" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Inputs */}
          <LabeledInput
            label="User Name"
            placeholder={phName}
            icon="user"
            value={username}
            editable={false}
            disabled
          />

          <LabeledInput
            label="Full Name"
            placeholder={phName}
            icon="user"
            value={fullName}
            onChangeText={setFullName}
            autoCapitalize="words"
            maxLength={60}
          />

          <LabeledInput
            label="Email Address"
            placeholder={phEmail}
            icon="mail"
            value={email}
            keyboardType="email-address"
            autoCapitalize="none"
            editable={false}
            disabled
            error={email.length > 0 && !emailValid ? 'Enter a valid email' : undefined}
          />
  <LabeledInput
            label="Bio"
            placeholder="Tell something about yourself..."
            icon="file-text"
            value={bio}
            onChangeText={(text) => {
              const next = text.length > BIO_MAX ? text.slice(0, BIO_MAX) : text;
              setBio(next);
            }}
            multiline
            numberOfLines={4}
            maxLength={BIO_MAX}
            style={{ marginTop: 18 }}
          />
          <View
            style={{
              marginHorizontal: 16,
              marginTop: 4,
              alignItems: 'flex-end',
            }}
          >
            <TText style={{ color: COLORS.hint, fontSize: 11 }}>
              {bio.length}/{BIO_MAX}
            </TText>
          </View>
          {/* Save Button */}
          <View style={styles.stickyCtaWrap}>
            <TouchableOpacity
              disabled={!canSave || loading}
              onPress={onSave}
              style={[styles.cta, (!canSave || loading) && { opacity: 0.6 }]}
              activeOpacity={0.9}
            >
              {loading ? (
                <ActivityIndicator color={COLORS.primaryText} />
              ) : (
                <TText style={styles.ctaText}>Save Changes</TText>
              )}
            </TouchableOpacity>
          </View>
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
  placeholder,
  disabled,
  style,
  ...inputProps
}: {
  label: string;
  icon: string;
  error?: string;
  placeholder?: string;
  disabled?: boolean;
  style?: any;
} & React.ComponentProps<typeof TextInput>) {
  return (
    <View style={[{ marginHorizontal: 16, marginTop: 18 }, style]}>
      <TText style={styles.label}>{label}</TText>
      <View style={[styles.inputRow, disabled && styles.inputRowDisabled]}>
        <Feather
          name={icon as any}
          size={18}
          color={disabled ? '#6F6F7A' : COLORS.hint}
          style={{ marginLeft: 12 }}
        />
        <TextInput
          placeholder={placeholder}
          placeholderTextColor={COLORS.hint}
          style={[styles.input, disabled && styles.inputDisabled]}
          editable={!disabled && (inputProps.editable ?? true)}
          {...inputProps}
        />
      </View>
      {!!error && <TText style={styles.error}>{error}</TText>}
    </View>
  );
}

/* --------------------------------- Styles -------------------------------- */

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },

  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomColor: 'rgba(255,255,255,0.08)',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { color: COLORS.text, fontSize: 18, fontWeight: '700' },

  avatarWrap: { alignItems: 'center', marginTop: 20, marginBottom: 8 },
  avatarOuter: {
    width: AVATAR_SIZE + 8,
    height: AVATAR_SIZE + 8,
    borderRadius: (AVATAR_SIZE + 8) / 2,
    backgroundColor: COLORS.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    // borderRadius: AVATAR_SIZE / 2,
    backgroundColor: COLORS.card,
  },
  avatarBadge: {
    position: 'absolute',
    right: Math.round(AVATAR_SIZE * 0.1),
    bottom: Math.round(AVATAR_SIZE * 0.1),
    width: Math.round(AVATAR_SIZE * 0.3),
    height: Math.round(AVATAR_SIZE * 0.3),
    borderRadius: Math.round(AVATAR_SIZE * 0.15),
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.25,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 },
      },
      android: { elevation: 3 },
    }),
  },
  avatarBadgeBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.overlay,
    borderRadius: Math.round(AVATAR_SIZE * 0.15),
  },

  label: { color: COLORS.text, fontWeight: '700', marginBottom: 8 },
  inputRow: {
    minHeight: 52,
    backgroundColor: COLORS.input,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputRowDisabled: {
    backgroundColor: '#232536',
    borderColor: 'rgba(255,255,255,0.12)',
  },
  input: { flex: 1, color: COLORS.text, paddingHorizontal: 12, fontSize: 15, paddingVertical: 12 },
  inputDisabled: { color: '#C9CAD6' },
  error: { color: COLORS.danger, marginTop: 6, fontSize: 12.5 },

  stickyCtaWrap: { marginHorizontal: 16, marginTop: 28 },
  cta: {
    backgroundColor: COLORS.primary,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: { color: COLORS.primaryText, fontWeight: '700', fontSize: 16 },
});
