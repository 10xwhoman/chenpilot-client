import { translations, Language, LANGUAGES } from './translations';

export function getLanguageDirection(lang: Language): 'ltr' | 'rtl' {
  const langData = LANGUAGES.find(l => l.code === lang);
  return langData?.dir || 'ltr';
}

export function t(lang: Language, path: string): string {
  const keys = path.split('.');
  let value: any = translations[lang];

  for (const key of keys) {
    value = value?.[key];
  }

  // Fallback to English if translation missing
  if (!value) {
    value = translations.en;
    for (const key of keys) {
      value = value?.[key];
    }
  }

  return value || path;
}

export function getStoredLanguage(): Language {
  if (typeof window === 'undefined') return 'en';
  const stored = localStorage.getItem('language');
  if (stored && translations[stored as Language]) {
    return stored as Language;
  }
  return 'en';
}

export function setStoredLanguage(lang: Language): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('language', lang);
  }
}
