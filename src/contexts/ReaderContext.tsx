import React, { createContext, useContext, useState, ReactNode } from 'react';

export type ThemeType = 'default' | 'light' | 'dark' | 'paper';
export type FontType = 'default' | 'palatino' | 'bookerly' | 'minhphung';

interface ReaderContextType {
  theme: ThemeType;
  setTheme: (t: ThemeType) => void;
  font: FontType;
  setFont: (f: FontType) => void;
  fontSize: number;
  setFontSize: (s: number) => void;
  lineHeight: number;
  setLineHeight: (l: number) => void;
  textAlign: 'left' | 'right' | 'justify';
  setTextAlign: (a: 'left' | 'right' | 'justify') => void;
}

const ReaderContext = createContext<ReaderContextType | undefined>(undefined);

export function ReaderProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<ThemeType>('default');
  const [font, setFont] = useState<FontType>('default');
  const [fontSize, setFontSize] = useState(20);
  const [lineHeight, setLineHeight] = useState<number>(1.4);
  const [textAlign, setTextAlign] = useState<'left' | 'right' | 'justify'>('left');

  return (
    <ReaderContext.Provider
      value={{
        theme, setTheme,
        font, setFont,
        fontSize, setFontSize,
        lineHeight, setLineHeight,
        textAlign, setTextAlign
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
