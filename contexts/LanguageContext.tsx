"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import translations, { Locale, Translations } from '@/locales/translations';

interface LanguageContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: Translations;
  languages: Array<{ code: Locale; name: string; nativeName: string }>;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const LOCALE_STORAGE_KEY = 'aipdf_locale';

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('zh');

  // 从 localStorage 或浏览器语言设置中获取初始语言
  useEffect(() => {
    const savedLocale = localStorage.getItem(LOCALE_STORAGE_KEY) as Locale;
    if (savedLocale && translations[savedLocale]) {
      setLocaleState(savedLocale);
    } else {
      // 检测浏览器语言
      const browserLang = navigator.language.split('-')[0] as Locale;
      if (translations[browserLang]) {
        setLocaleState(browserLang);
      } else {
        // 检测完整语言代码（如 zh-CN）
        const fullLang = navigator.language as Locale;
        if (translations[fullLang]) {
          setLocaleState(fullLang);
        } else if (navigator.language.startsWith('zh')) {
          // 中文变体默认使用简体
          setLocaleState('zh');
        } else {
          setLocaleState('en');
        }
      }
    }
  }, []);

  const setLocale = (newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem(LOCALE_STORAGE_KEY, newLocale);
    // 更新 HTML lang 属性
    if (typeof document !== 'undefined') {
      document.documentElement.lang = newLocale;
    }
  };

  const value: LanguageContextType = {
    locale,
    setLocale,
    t: translations[locale],
    languages: [
      { code: 'en', name: 'English', nativeName: 'English' },
      { code: 'zh', name: 'Chinese (Simplified)', nativeName: '中文 (简体)' },
      { code: 'zh-TW', name: 'Chinese (Traditional)', nativeName: '中文 (繁體)' },
      { code: 'es', name: 'Spanish', nativeName: 'Español' },
      { code: 'fr', name: 'French', nativeName: 'Français' },
      { code: 'de', name: 'German', nativeName: 'Deutsch' },
      { code: 'it', name: 'Italian', nativeName: 'Italiano' },
      { code: 'pt', name: 'Portuguese', nativeName: 'Português' },
      { code: 'ja', name: 'Japanese', nativeName: '日本語' },
      { code: 'ru', name: 'Russian', nativeName: 'Русский' },
      { code: 'ko', name: 'Korean', nativeName: '한국어' },
      { code: 'ar', name: 'Arabic', nativeName: 'العربية' },
    ],
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}



