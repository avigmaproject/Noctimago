// src/utils/lang.ts
import AsyncStorage from '@react-native-async-storage/async-storage';

const LANG_KEY = 'app.lang';
export type Lang = 'en' | 'es' | 'fr' | 'de' | 'it';

export async function getSavedLang(): Promise<Lang> {
  const v = await AsyncStorage.getItem(LANG_KEY);
  return (v as Lang) || 'en';
}
export async function setSavedLang(l: Lang) {
  await AsyncStorage.setItem(LANG_KEY, l);
}
