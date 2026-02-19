// src/screens/Support/ContactUsScreen.tsx
import React, { useCallback, useRef, useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Modal,
  ActivityIndicator,
  StatusBar,
  Alert,
  Image,
} from "react-native";
import Feather from "react-native-vector-icons/Feather";
import Ionicons from "react-native-vector-icons/Ionicons";
import { SafeAreaView } from "react-native-safe-area-context";
import ImagePicker, { Image as PickerImage } from "react-native-image-crop-picker";

/* ---------------- config ---------------- */
const COLORS = {
  bg: "#0E0E12",
  card: "#16161C",
  cardElev: "#1A1A22",
  text: "#FFFFFF",
  subtext: "#9CA3AF",
  accent: "#F43F5E",
  border: "rgba(255,255,255,0.12)",
  inputBg: "#0F1117",
  inputBorder: "rgba(255,255,255,0.10)",
  inputPlaceholder: "#7C8493",
};

const API_ENDPOINT = "https://napi.nearbuy.space/api/NoctimagoApi/sendEmail";
const THANKS_DURATION_MS = 5000;

type Props = { navigation: any };
type Attachment = {
  uri: string;
  name: string;
  type: string;
  width?: number;
  height?: number;
  size?: number;
};

export default function ContactUsScreen({ navigation }: Props) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [attachment, setAttachment] = useState<Attachment | null>(null);

  const [apiSubmitting, setApiSubmitting] = useState(false);
  const [thanksVisible, setThanksVisible] = useState(false);
  const [remainingMs, setRemainingMs] = useState(THANKS_DURATION_MS);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const autoCloseRef = useRef<NodeJS.Timeout | null>(null);

  /* ------------- helpers ------------- */
  const isEmail = (v: string) => /^[^\s@]+@[^\s@]{1,}\.[^\s@]{2,}$/i.test(v.trim());

  const buildBody = useCallback(() => {
    const subj = subject?.trim() || "Contact from Noctimago app";
    const body = `Hello Noctimago Team,

I'd like to share the following:

Name: ${name}
Email: ${email}

Message:
${message}

—
Sent from the Noctimago app (${Platform.OS})
`;
    return { subj, body };
  }, [name, email, subject, message]);

  const clearForm = () => {
    setName("");
    setEmail("");
    setSubject("");
    setMessage("");
    setAttachment(null);
  };

  const cleanupTimers = () => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    if (autoCloseRef.current) {
      clearTimeout(autoCloseRef.current);
      autoCloseRef.current = null;
    }
  };

  const startThanksModal = () => {
    setThanksVisible(true);
    setRemainingMs(THANKS_DURATION_MS);

    countdownRef.current = setInterval(() => {
      setRemainingMs((ms) => Math.max(0, ms - 1000));
    }, 1000);

    autoCloseRef.current = setTimeout(() => {
      setThanksVisible(false);
      cleanupTimers();
      navigation.goBack();
    }, THANKS_DURATION_MS);
  };

  useEffect(() => () => cleanupTimers(), []);

  const ensureValid = () => {
    if (!name.trim()) {
      Alert.alert("Name required", "Please enter your name.");
      return false;
    }
    if (!email.trim() || !isEmail(email)) {
      Alert.alert("Valid email required", "Please enter a valid email address.");
      return false;
    }
    if (!message.trim()) {
      Alert.alert("Message required", "Please enter your message.");
      return false;
    }
    return true;
  };

  /* ------------- attachment ------------- */
  const normalizePickerImage = (img: PickerImage): Attachment => {
    const path = img.path?.startsWith("file://") ? img.path : `file://${img.path}`;
    const inferredName =
      (img as any).filename ||
      path.substring(path.lastIndexOf("/") + 1) ||
      `attachment_${Date.now()}.${(img.mime || "image/jpeg").split("/")[1] || "jpg"}`;
    return {
      uri: path,
      name: inferredName,
      type: img.mime || "image/jpeg",
      width: (img as any).width,
      height: (img as any).height,
      size: (img as any).size,
    };
  };

  const pickFromGallery = async () => {
    try {
      const img = await ImagePicker.openPicker({ mediaType: "photo", compressImageQuality: 0.9 });
      setAttachment(normalizePickerImage(img as PickerImage));
    } catch {}
  };

  const captureFromCamera = async () => {
    try {
      const img = await ImagePicker.openCamera({ mediaType: "photo", compressImageQuality: 0.9 });
      setAttachment(normalizePickerImage(img as PickerImage));
    } catch {}
  };

  const removeAttachment = () => setAttachment(null);

  /* ------------- submit (backend only) ------------- */
  const onSubmitBackend = async () => {
    if (!ensureValid()) return;

    try {
      setApiSubmitting(true);
      const { subj, body } = buildBody();

      const form = new FormData();
      // Adjust these fields to match your backend contract:
      form.append("To", "info@noctimago.com"); // or change to whoever should receive
      form.append("Message", body);
      form.append("Subject", subj);

      if (attachment) {
        form.append("attachments", {
          // @ts-ignore RN FormData shape
          uri: attachment.uri,
          name: attachment.name,
          type: attachment.type,
        });
      }

      const res = await fetch(API_ENDPOINT, {
        method: "POST",
        body: form, // don't set Content-Type manually; fetch adds boundary
      });

      const isJson = (res.headers.get("content-type") || "").includes("application/json");
      const payload = isJson ? await res.json() : await res.text();

      if (!res.ok) {
        // console.log("Email API error:", payload);
        throw new Error(typeof payload === "string" ? payload : "Failed to send email");
      }

      clearForm();
      startThanksModal();
    } catch (e: any) {
      Alert.alert("Failed to send", e?.message || "Please try again.");
    } finally {
      setApiSubmitting(false);
    }
  };

  /* ------------- UI ------------- */
  const secs = Math.ceil(remainingMs / 1000);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Feather name="chevron-left" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Contact Us</Text>
        <View style={{ width: 24 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          style={styles.container}
          contentContainerStyle={{ paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.card}>
            <View style={{ height: 10 }} />

            <Text style={styles.label}>Your Name</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Enter your name"
              placeholderTextColor={COLORS.inputPlaceholder}
              style={[styles.input, styles.inputSingle]}
              autoCapitalize="words"
              returnKeyType="next"
            />

            <Text style={styles.label}>Email</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={COLORS.inputPlaceholder}
              keyboardType="email-address"
              autoCapitalize="none"
              style={[styles.input, styles.inputSingle]}
              returnKeyType="next"
            />

            <Text style={styles.label}>Subject (optional)</Text>
            <TextInput
              value={subject}
              onChangeText={setSubject}
              placeholder="How can we help?"
              placeholderTextColor={COLORS.inputPlaceholder}
              style={[styles.input, styles.inputSingle]}
              returnKeyType="next"
            />

            <Text style={styles.label}>Message</Text>
            <TextInput
              value={message}
              onChangeText={setMessage}
              placeholder="Type your message…"
              placeholderTextColor={COLORS.inputPlaceholder}
              style={[styles.input, styles.textarea]}
              multiline
              textAlignVertical="top"
              numberOfLines={6}
            />

            {/* Attachment picker */}
            <View style={styles.attachRow}>
              <Text style={styles.label}>Attachment (optional)</Text>
              {attachment ? (
                <View style={styles.attachmentCard}>
                  <Image source={{ uri: attachment.uri }} style={styles.attachmentThumb} />
                  <View style={{ flex: 1, marginHorizontal: 10 }}>
                    <Text style={styles.attachmentName} numberOfLines={1}>
                      {attachment.name}
                    </Text>
                    <Text style={styles.attachmentSub} numberOfLines={1}>
                      {attachment.type.replace("image/", "").toUpperCase()}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={removeAttachment} style={styles.removeBtn}>
                    <Feather name="x" size={18} color="#fff" />
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.attachActions}>
                  <TouchableOpacity onPress={pickFromGallery} style={styles.attachBtn} activeOpacity={0.85}>
                    <Ionicons name="image-outline" size={18} color="#fff" />
                    <Text style={styles.attachBtnTxt}>Gallery</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={captureFromCamera} style={styles.attachBtn} activeOpacity={0.85}>
                    <Ionicons name="camera-outline" size={18} color="#fff" />
                    <Text style={styles.attachBtnTxt}>Camera</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Single submit button (backend) */}
            <TouchableOpacity
              onPress={onSubmitBackend}
              disabled={apiSubmitting}
              style={[styles.submitBtn, apiSubmitting && { opacity: 0.75 }]}
              activeOpacity={0.85}
            >
              {apiSubmitting ? (
                <>
                  <ActivityIndicator />
                  <Text style={[styles.submitTxt, { marginLeft: 10 }]}>Sending to Support…</Text>
                </>
              ) : (
                <>
                  <Ionicons name="send-outline" size={18} color="#fff" />
                  <Text style={[styles.submitTxt, { marginLeft: 10 }]}>Send to Support</Text>
                </>
              )}
            </TouchableOpacity>

            <View style={styles.noteRow}>
              <Ionicons name="information-circle-outline" size={16} color={COLORS.subtext} />
              <Text style={styles.note}>
                We’ll send your message (and photo if attached) directly to support.
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Thank You Modal */}
      <Modal transparent visible={thanksVisible} animationType="fade" statusBarTranslucent>
        <View style={m.overlay}>
          <View style={m.card}>
            <ActivityIndicator size="large" />
            <Text style={m.title}>Thank you for contacting us</Text>
            <Text style={m.subtitle}>We’ll reply soon.</Text>
            <Text style={m.timerHint}>Closing automatically in {secs}s…</Text>

            <TouchableOpacity
              style={m.closeBtn}
              onPress={() => {
                setThanksVisible(false);
                cleanupTimers();
                navigation.goBack();
              }}
              activeOpacity={0.9}
            >
              <Text style={m.closeTxt}>Close now</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

/* ---------------- styles ---------------- */
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.bg,
  },
  headerTitle: { color: "#fff", fontSize: 18, fontWeight: "700" },
  headerBtn: { padding: 4 },

  container: { flex: 1, paddingHorizontal: 16, backgroundColor: COLORS.bg },

  card: {
    backgroundColor: COLORS.cardElev,
    borderRadius: 16,
    padding: 16,
    marginTop: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
  },

  label: { color: COLORS.subtext, fontSize: 12, marginTop: 12, marginBottom: 6 },

  input: {
    color: COLORS.text,
    backgroundColor: COLORS.inputBg,
    borderWidth: 1,
    borderColor: COLORS.inputBorder,
    borderRadius: 12,
    paddingHorizontal: 12,
    fontSize: 14,
    // fix placeholder clipping on Android/Xiaomi:
    ...(Platform.OS === "android"
      ? {
          height: 48,
          paddingVertical: 0,
          textAlignVertical: "center",
        }
      : {
          height: 48,
          paddingVertical: 12,
        }),
  },
  inputSingle: {},

  textarea: {
    minHeight: 140,
    paddingTop: Platform.select({ ios: 12, android: 12 }),
    paddingBottom: Platform.select({ ios: 12, android: 12 }),
    textAlignVertical: "top",
  },

  attachRow: { marginTop: 12 },
  attachActions: { flexDirection: "row", columnGap: 10 },
  attachBtn: {
    flexDirection: "row",
    alignItems: "center",
    columnGap: 8,
    backgroundColor: "#2A2F3A",
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    height: 42,
    borderRadius: 10,
  },
  attachBtnTxt: { color: "#fff", fontWeight: "700" },

  attachmentCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1C1F27",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 8,
  },
  attachmentThumb: { width: 44, height: 44, borderRadius: 8, backgroundColor: "#0E0E12" },
  attachmentName: { color: "#fff", fontSize: 13, fontWeight: "700" },
  attachmentSub: { color: COLORS.subtext, fontSize: 11, marginTop: 2 },
  removeBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#F43F5E",
    alignItems: "center",
    justifyContent: "center",
  },

  submitBtn: {
    marginTop: 16,
    height: 48,
    borderRadius: 12,
    backgroundColor: COLORS.accent,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  submitTxt: { color: "#fff", fontWeight: "700", fontSize: 15 },

  noteRow: { flexDirection: "row", alignItems: "flex-start", marginTop: 14, columnGap: 8 },
  note: { color: COLORS.subtext, fontSize: 12, flex: 1, lineHeight: 18 },
});

const m = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: COLORS.card,
    borderRadius: 16,
    paddingVertical: 28,
    paddingHorizontal: 20,
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
  },
  title: { color: "#FFFFFF", fontSize: 18, fontWeight: "700", marginTop: 16, textAlign: "center" },
  subtitle: { color: "#C8C8CF", fontSize: 14, marginTop: 6, textAlign: "center" },
  timerHint: { color: COLORS.subtext, fontSize: 12, marginTop: 12, textAlign: "center" },
  closeBtn: {
    marginTop: 16,
    paddingHorizontal: 14,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
  },
  closeTxt: { color: "#fff", fontWeight: "700" },
});
