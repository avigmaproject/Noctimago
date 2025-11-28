// src/i18n/useAutoRTL.ts
import { useEffect } from 'react';
import { I18nManager } from 'react-native';
import { useAutoI18n } from './AutoI18nProvider';

// languages that need RTL layout
const RTL_LANGS = new Set(['ar', 'ur', 'fa', 'he']);

export function useAutoRTL() {
  const { lang } = useAutoI18n();
  useEffect(() => {
    const isRTL = RTL_LANGS.has(lang.split('-')[0]);
    if (I18nManager.isRTL !== isRTL) {
      // We won't force a reload here; just log.
      if (__DEV__) console.log('[useAutoRTL] would switch RTL =', isRTL);
      // If you later add RTL langs and want to force reload:
      // I18nManager.allowRTL(isRTL);
      // I18nManager.forceRTL(isRTL);
      // RNRestart.restart(); // if using react-native-restart
    }
  }, [lang]);
}
