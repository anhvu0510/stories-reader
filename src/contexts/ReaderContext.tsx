import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { api } from '../lib/api';

export type ThemeType = 'default' | 'amoled' | 'midnight' | 'obsidian' | 'coffee' | 'modern-vn';
export type FontType = 'default' | 'palatino' | 'bookerly' | 'font_viet_tay';

interface ReaderContextType {
  theme: ThemeType;
  setTheme: (t: ThemeType) => void;
  font: FontType;
  setFont: (f: FontType) => void;
  fontSize: number;
  setFontSize: (s: number) => void;
  lineHeight: number;
  setLineHeight: (l: number) => void;
  groupLines: number;
  setGroupLines: (g: number) => void;
  isEnabledReplace: boolean;
  setIsEnabledReplace: (e: boolean) => void;
  voiceUri: string;
  setVoiceUri: (v: string) => void;
  speechRate: number;
  setSpeechRate: (r: number) => void;
  bookLimit: number;
  setBookLimit: (l: number) => void;
  chapterLimit: number;
  setChapterLimit: (l: number) => void;
}

const ReaderContext = createContext<ReaderContextType | undefined>(undefined);

interface ReaderConfig {
  theme: ThemeType;
  font: FontType;
  fontSize: number;
  lineHeight: number;
  groupLines: number;
  isEnabledReplace: boolean;
  voiceUri: string;
  speechRate: number;
  bookLimit: number;
  chapterLimit: number;
}

const SETTINGS_KEY = 'stories.ui.config';

const defaultSettings: ReaderConfig = {
  theme: 'default',
  font: 'default',
  fontSize: 20,
  lineHeight: 1.4,
  groupLines: 1,
  isEnabledReplace: true,
  voiceUri: '',
  speechRate: 1.0,
  bookLimit: 20,
  chapterLimit: 50,
};

function getInitialSettings(): ReaderConfig {
  try {
    const local = localStorage.getItem(SETTINGS_KEY);
    if (local) {
      return { ...defaultSettings, ...JSON.parse(local) };
    }
  } catch (e) {}
  return defaultSettings;
}

export function ReaderProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<ReaderConfig>(getInitialSettings);
  const debounceRef = useRef<any>(null);

  useEffect(() => {
    // Initial fetch from API
    api.getSettings(SETTINGS_KEY).then(res => {
      if (res) {
        let apiValue = res.value !== undefined ? res.value : res;
        
        // Sometimes backend returns stringified json in the value field
        if (typeof apiValue === 'string') {
          try {
            apiValue = JSON.parse(apiValue);
          } catch (e) {
            console.warn('Failed to parse API settings string:', e);
          }
        }
        
        // Check if apiValue is an object with valid settings keys
        if (apiValue && typeof apiValue === 'object' && Object.keys(apiValue).length > 0 && !apiValue.error) {
          setSettings(prev => {
            const nextSettings = { ...defaultSettings, ...apiValue, voiceUri: prev.voiceUri, speechRate: prev.speechRate };
            localStorage.setItem(SETTINGS_KEY, JSON.stringify(nextSettings));
            return nextSettings;
          });
        } else {
          // Config doesn't exist on server, sync our local initial settings
          // We can sync without voice fields
          const { voiceUri, speechRate, ...apiSync } = settings;
          api.updateSettings(SETTINGS_KEY, apiSync);
        }
      } else {
        const { voiceUri, speechRate, ...apiSync } = settings;
        api.updateSettings(SETTINGS_KEY, apiSync);
      }
    });
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', settings.theme);
  }, [settings.theme]);

  const updateSetting = (key: keyof ReaderConfig, value: any, syncWithApi: boolean = true) => {
    setSettings(prev => {
      const next = { ...prev, [key]: value };
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
      
      if (syncWithApi) {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
          const { voiceUri, speechRate, ...apiSync } = next;
          api.updateSettings(SETTINGS_KEY, apiSync);
        }, 1000);
      }
      
      return next;
    });
  };

  const setTheme = (t: ThemeType) => updateSetting('theme', t);
  const setFont = (f: FontType) => updateSetting('font', f);
  const setFontSize = (s: number) => updateSetting('fontSize', s);
  const setLineHeight = (l: number) => updateSetting('lineHeight', l);
  const setGroupLines = (g: number) => updateSetting('groupLines', g);
  const setIsEnabledReplace = (e: boolean) => updateSetting('isEnabledReplace', e);
  const setVoiceUri = (v: string) => updateSetting('voiceUri', v, false);
  const setSpeechRate = (r: number) => updateSetting('speechRate', r, false);
  const setBookLimit = (l: number) => updateSetting('bookLimit', l);
  const setChapterLimit = (l: number) => updateSetting('chapterLimit', l);

  return (
    <ReaderContext.Provider
      value={{
        theme: settings.theme, setTheme,
        font: settings.font, setFont,
        fontSize: settings.fontSize, setFontSize,
        lineHeight: settings.lineHeight, setLineHeight,
        groupLines: settings.groupLines, setGroupLines,
        isEnabledReplace: settings.isEnabledReplace, setIsEnabledReplace,
        voiceUri: settings.voiceUri, setVoiceUri,
        speechRate: settings.speechRate, setSpeechRate,
        bookLimit: settings.bookLimit, setBookLimit,
        chapterLimit: settings.chapterLimit, setChapterLimit,
      }}
    >
      {children}
    </ReaderContext.Provider>
  );
}

export function useReaderSettings() {
  const context = useContext(ReaderContext);
  if (context === undefined) {
    throw new Error('useReaderSettings must be used within a ReaderProvider');
  }
  return context;
}
