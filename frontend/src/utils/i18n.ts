import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import tutorialEN from './locales/tutorial-en.json';
import tutorialKR from './locales/tutorial-kr.json';

import manualEN from './locales/manual-en.json';
import manualKR from './locales/manual-kr.json';

import shopEN from './locales/shop-en.json';
import shopKR from './locales/shop-kr.json';

import arenaEN from './locales/arena-en.json';
import arenaKR from './locales/arena-kr.json';

import machineEN from './locales/machine-en.json';
import machineKR from './locales/machine-kr.json';

import contestEN from './locales/contest-en.json';
import contestKR from './locales/contest-kr.json';

import userEN from './locales/user-en.json';
import userKR from './locales/user-kr.json';

import commonEN from './locales/common-en.json';
import commonKR from './locales/common-kr.json';

import landingEN from './locales/landing-en.json';
import landingKR from './locales/landing-kr.json';

// localStorage에서 저장된 언어 불러오기, 없으면 'ko' 기본값
const savedLanguage = localStorage.getItem('language') || 'ko';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        tutorial: tutorialEN,
        manual: manualEN,
        shop: shopEN,
        arena: arenaEN,
        machine: machineEN,
        contest: contestEN,
        user: userEN,
        common: commonEN,
        landing: landingEN
      },
      ko: {
        tutorial: tutorialKR,
        manual: manualKR,
        shop: shopKR,
        arena: arenaKR,
        machine: machineKR,
        contest: contestKR,
        user: userKR,
        common: commonKR,
        landing: landingKR
      }
    },
    lng: savedLanguage,  // localStorage에서 불러온 언어 사용
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false
    },
    ns: ['tutorial', 'manual', 'shop', 'arena', 'machine', 'contest', 'user', 'common', 'landing'],
    defaultNS: 'common'  // 기본 네임스페이스를 common으로 변경
  });

export default i18n;
