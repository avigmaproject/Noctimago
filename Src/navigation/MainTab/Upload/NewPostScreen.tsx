import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  SafeAreaView,
  TouchableOpacity,
  Image,
  TextInput,
  ScrollView,
  Platform,
  Modal,
} from 'react-native';
import Feather from 'react-native-vector-icons/Feather';
// import * as ImagePicker from 'react-native-image-picker';

type Media = {
  uri: string;
  type?: string | undefined;
  fileName?: string | undefined;
};

export default function NewPostScreen({ navigation }: any) {
  const [media, setMedia] = useState<Media | null>(null);
  const [title, setTitle] = useState('');
  const [event, setEvent] = useState<string | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [location, setLocation] = useState<string | null>(null);

  const canSubmit = useMemo(() => !!media && title.trim().length > 0, [media, title]);

  const pickMedia = async () => {
    return 0
    const res = await ImagePicker.launchImageLibrary({
      mediaType: 'mixed',
      selectionLimit: 1,
      quality: 0.9,
    });

    if (res.didCancel) return;
    const asset = res.assets?.[0];
    if (asset?.uri) {
      setMedia({ uri: asset.uri, type: asset.type, fileName: asset.fileName });
    }
  };

  const onSubmit = () => {
    // TODO: upload logic
    console.log({
      media,
      title: title.trim(),
      event,
      tags,
      location,
    });
    // navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation?.goBack?.()}>
          <Feather name="chevron-left" size={26} color="#EDEDF4" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Post</Text>
        <View style={{ width: 26 }} />
      </View>

      {/* Content */}
      <ScrollView
        contentContainerStyle={{ paddingBottom: 120 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Media picker area */}
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={pickMedia}
          style={[styles.mediaBox, media ? styles.mediaSelected : null]}
        >
          {media ? (
            <>
              <Image source={{ uri: media.uri }} style={styles.mediaPreview} />
              <View style={styles.changeOverlay}>
                <Feather name="camera" size={18} color="#fff" />
                <Text style={styles.changeOverlayText}>Change photo or video</Text>
              </View>
            </>
          ) : (
            <View style={styles.mediaEmptyInner}>
              <Feather name="camera" size={32} color="#EF2C2C" />
              <Text style={styles.mediaHint}>Tap to select photo or video</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Watermark note */}
        <View style={styles.watermark}>
          <Text style={styles.watermarkText}>
            This upload will be watermarked for authenticity
          </Text>
        </View>

        {/* Title */}
        <FieldLabel label="Title" />
        <View style={styles.inputWrap}>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Add a title..."
            placeholderTextColor="#8D8D97"
            style={styles.input}
            autoCapitalize="sentences"
            returnKeyType="done"
          />
        </View>

        {/* Event */}
        <FieldLabel label="Event" />
        <ChevronRow
          label={event ? event : 'Select event'}
          onPress={() => setEvent('Friday Night Beach')}
          muted={!event}
        />

        {/* Tag People */}
        <FieldLabel label="Tag People" />
        <ChevronRow
          label={tags.length ? tags.join(', ') : 'Tag people'}
          onPress={() => setTags(['Sarah Wilson', 'Chris Evans'])}
          muted={!tags.length}
        />

        {/* Location */}
        <FieldLabel label="Location" />
        <ChevronRow
          label={location ? location : 'Add location'}
          leftIcon="map-pin"
          onPress={() => setLocation('San Francisco, CA')}
          muted={!location}
        />
         <View style={styles.submitBar}>
        <TouchableOpacity
          activeOpacity={0.9}
          style={[styles.submitBtn, !canSubmit && { opacity: 0.6 }]}
          onPress={onSubmit}
          disabled={!canSubmit}
        >
          <Text style={styles.submitText}>Submit</Text>
        </TouchableOpacity>
      </View>
      </ScrollView>

      {/* Sticky Submit */}
     
    </SafeAreaView>
  );
}

/* ---------- Small subcomponents ---------- */
function FieldLabel({ label }: { label: string }) {
  return <Text style={styles.fieldLabel}>{label}</Text>;
}

function ChevronRow({
  label,
  onPress,
  leftIcon,
  muted,
}: {
  label: string;
  onPress: () => void;
  leftIcon?: string;
  muted?: boolean;
}) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={styles.row}>
      <View style={styles.rowLeft}>
        {leftIcon ? <Feather name={leftIcon as any} size={18} color="#B7B7C2" /> : null}
        <Text style={[styles.rowText, muted && { color: '#8D8D97' }]} numberOfLines={1}>
          {label}
        </Text>
      </View>
      <Feather name="chevron-right" size={20} color="#6F6F7A" />
    </TouchableOpacity>
  );
}

/* ---------------------------- Styles ---------------------------- */

const BG = '#0B0B12';
const CARD = '#1A1A22';
const INPUT = 'rgba(255,255,255,0.08)';
const OUTLINE = 'rgba(255,255,255,0.16)';
const TEXT = '#EDEDF4';
const SUBTEXT = '#9A9AA5';
const ACCENT = '#201A83';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  header: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: OUTLINE,
  },
  headerTitle: { color: TEXT, fontSize: 18, fontWeight: '700', flex: 1, textAlign: 'center' },

  mediaBox: {
    height: 260,
    backgroundColor: '#240A0E', // very dark red to match mock
    marginTop: 6,
    marginHorizontal: 16,
    borderRadius: 8,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaSelected: { backgroundColor: '#000' },
  mediaEmptyInner: { alignItems: 'center', gap: 10 },
  mediaHint: { color: '#EF2C2C', fontSize: 16 },
  mediaPreview: { width: '100%', height: '100%' },
  changeOverlay: {
    position: 'absolute',
    alignSelf: 'center',
    bottom: 14,
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  changeOverlayText: { color: '#fff', fontWeight: '600' },

  watermark: {
    marginTop: 8,
    marginHorizontal: 16,
    backgroundColor: '#2A2A31',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 6,
  },
  watermarkText: { color: '#C8C8CF', fontSize: 13 },

  fieldLabel: {
    color: TEXT,
    fontWeight: '700',
    marginTop: 18,
    marginBottom: 8,
    marginHorizontal: 16,
  },

  inputWrap: {
    height: 48,
    backgroundColor: INPUT,
    borderWidth: 1,
    borderColor: OUTLINE,
    borderRadius: 12,
    marginHorizontal: 16,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  input: { color: TEXT, fontSize: 15 },

  row: {
    height: 52,
    backgroundColor: INPUT,
    borderWidth: 1,
    borderColor: OUTLINE,
    borderRadius: 12,
    marginHorizontal: 16,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  rowText: { color: TEXT, fontSize: 15, flexShrink: 1 },

  submitBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: BG,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: OUTLINE,
  },
  submitBtn: {
    height: 52,
    backgroundColor: ACCENT,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
