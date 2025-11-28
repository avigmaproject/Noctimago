// src/i18n/TText.tsx
import React, { useEffect, useState } from 'react';
import { Text, TextProps } from 'react-native';
import { useAutoI18n } from './AutoI18nProvider';
import type { Lang } from './AutoI18nProvider';

type Props = TextProps & { langOverride?: Lang; from?: Lang; children: string };

export const TText: React.FC<Props> = ({ children, langOverride, from = 'en', ...rest }) => {
  const { lang, translate } = useAutoI18n();
  const target = (langOverride ?? lang) as Lang;
  const [out, setOut] = useState(children);

  useEffect(() => {
    let live = true;
    __DEV__;
    // __DEV__ && console.log('[TText] start', { children, from, to: target });
    (async () => {
      try {
        const t = await translate(children, { from, to: target });
        if (live) {
          setOut(t);
          __DEV__ 
        //   && console.log('[TText] done', { children, out: t, to: target });
        }
      } catch (e) {
        __DEV__ 
        // && console.log('[TText] error', String(e));
      }
    })();
    return () => { live = false; };
  }, [children, target, from, translate]);

  return <Text {...rest}>{out}</Text>;
};
