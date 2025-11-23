import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import tutorialEN from './locales/tutorial-en.json';
import tutorialKR from './locales/tutorial-kr.json';

import manualEN from './locales/manual-en.json';
import manualKR from './locales/manual-kr.json';

import shopEN from './locales/shop-en.json';
import shopKR from './locales/shop-kr.json';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        tutorial: tutorialEN,
        manual: manualEN,
        shop: shopEN
      },
      ko: {
        tutorial: tutorialKR,
        manual: manualKR,
        shop: shopKR
      }
    },
    lng: 'en',          // 기본 언어
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false
    },
    ns: ['tutorial', 'manual', 'shop'], // ← shop 네임스페이스 추가
    defaultNS: 'tutorial'               // 기본값은 그대로 유지
  });

export default i18n;
