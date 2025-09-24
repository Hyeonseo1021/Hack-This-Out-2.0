import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import tutorialEN from './locales/tutorial-en.json';
import tutorialKR from './locales/tutorial-kr.json';
import manualEN from './locales/manual-en.json';
import manualKR from './locales/manual-kr.json';


i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        tutorial: tutorialEN,
        manual: manualEN,
      },
      ko: {
        tutorial: tutorialKR,
        manual: manualKR,
      }
    },
    lng: 'en',
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false
    },
    ns: ['tutorial', 'manual'], // 사용 가능한 네임스페이스 명시
    defaultNS: 'tutorial'       // 기본값을 tutorial로 두되,
  });

export default i18n;
