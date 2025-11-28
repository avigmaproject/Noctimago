// Src/screens/Profile/LanguageScreen.tsx
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,

  FlatList,
  StatusBar,
  StyleSheet,
} from 'react-native';
import Feather from 'react-native-vector-icons/Feather';
import { useNavigation } from '@react-navigation/native';
import { gTranslate } from '../../utils/gtranslate';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

// i18n (dynamic, no JSON)
import { useAutoI18n } from '../../i18n/AutoI18nProvider';
import { TText } from '../../i18n/TText';

type Lang = { id: string; label: string; sub: string };

const LANGUAGES: Lang[] = [
  { id: 'en', label: 'English',  sub: 'English' },
  { id: 'es', label: 'Español',  sub: 'Spanish' },
  { id: 'fr', label: 'Français', sub: 'French'  },
  { id: 'de', label: 'Deutsch',  sub: 'German'  },
  { id: 'it', label: 'Italiano', sub: 'Italian' },
];

export default function LanguageScreen() {
  const navigation = useNavigation();
  const { lang, setLang } = useAutoI18n();

  // derive 'en' from 'en-US' etc.
  const [selected, setSelected] = useState<string>(() => (lang?.split?.('-')[0] || 'en'));
  useEffect(() => {
    setSelected(lang?.split?.('-')[0] || 'en');
  }, [lang]);
  const onPick = (id: string) => {
    setSelected(id);          // update UI
    // setLang(id);              // 🔴 change app language right now
    // navigation.goBack();   // ← uncomment if you want to close the screen immediately
  };
  const onSave = () => {
    setLang(selected);         // make it global
    navigation.goBack();       // return to previous screen
  };

  const renderItem = ({ item }: { item: Lang }) => {
    const active = item.id === selected;
    return (
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => onPick(item.id)}                 // ⬅️ call onPick
        style={[styles.row, active && styles.rowActive]}
      >
        <Text style={styles.rowTitle}>{item.label}</Text>
        <View style={styles.rowRight}>
          <Text style={styles.rowSub}>{item.sub}</Text>
          {active && <Feather name="check" size={20} color={COLORS.accent} />}
        </View>
      </TouchableOpacity>
    );
  };
  

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          onPress={() => navigation.goBack()}
        >
          <Feather name="arrow-left" size={22} color="#fff" />
        </TouchableOpacity>

        {/* Live preview: translate using currently selected language */}
        <TText style={styles.headerTitle} langOverride={selected}>Language</TText>

        <View style={{ width: 22 }} />
      </View>

      {/* Language List */}
      <FlatList
        data={LANGUAGES}
        keyExtractor={(it) => it.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
      />
    
    
      {/* Save Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          onPress={onSave}
          style={styles.saveBtn}
          activeOpacity={0.95}
        >
          {/* Live preview: translate using currently selected language */}
          <TText style={styles.saveTxt} langOverride={selected}>Save Change</TText>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const COLORS = {
  bg: '#0A0A0E',
  card: '#12121A',
  cardBorder: '#1E1E2A',
  text: '#FFFFFF',
  sub: '#8B8B95',
  accent: '#E11D48',
  accentTint: 'rgba(225, 29, 72, 0.12)',
  button: '#151558',
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.cardBorder,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '600',
  },
  listContent: { padding: 16 },
  row: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    justifyContent: 'space-between',
  },
  rowActive: {
    backgroundColor: COLORS.accentTint,
    borderColor: COLORS.accent,
  },
  rowTitle: { color: COLORS.text, fontSize: 16, fontWeight: '500' },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowSub: { color: COLORS.sub, fontSize: 15 },
  footer: { paddingHorizontal: 16, paddingBottom: 24 },
  saveBtn: {
    backgroundColor: COLORS.button,
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
