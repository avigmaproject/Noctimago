// src/i18n/AutoI18nProvider.tsx
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { gTranslate } from '../utils/gtranslate';

export type Lang = 'en' | 'es' | 'fr' | 'de' | 'it';

type Ctx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  translate: (text: string, opts?: { from?: Lang; to?: Lang }) => Promise<string>;
};

const LANG_KEY = 'app.lang';
const C = createContext<Ctx | null>(null);

export const AutoI18nProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [lang, setLangState] = useState<Lang>('en');

  useEffect(() => {
    (async () => {
      const saved = (await AsyncStorage.getItem(LANG_KEY)) as Lang | null;
      if (saved) setLangState(saved);
    })();
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    AsyncStorage.setItem(LANG_KEY, l).catch(() => {});
  };

  const translate = (text: string, opts?: { from?: Lang; to?: Lang }) => {
    const from = opts?.from ?? 'en';
    const to = opts?.to ?? lang;
    __DEV__ 
    // && console.log('[Provider.translate] -> gTranslate', { from, to, text });
    return gTranslate(text, to, from);
  };

  const value = useMemo(() => ({ lang, setLang, translate }), [lang]);
  return <C.Provider value={value}>{children}</C.Provider>;
};

export const useAutoI18n = () => {
  const ctx = useContext(C);
  if (!ctx) throw new Error('useAutoI18n must be used inside <AutoI18nProvider>');
  return ctx;
};
