import React, { useEffect, useState } from 'react';
import { Volume2, Play, Sliders } from 'lucide-react';
import { useReaderConfigStore } from '../../../stores/useReaderConfigStore';

export function VoiceSettingsTab() {
  const { voiceUri, setVoiceUri, speechRate, setSpeechRate } = useReaderConfigStore();
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    const updateVoices = () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        const voices = window.speechSynthesis.getVoices();
        const vnVoices = voices.filter((v) => v.lang.includes('vi') || v.lang.includes('VI'));
        setAvailableVoices(vnVoices.length > 0 ? vnVoices : voices);
      }
    };

    updateVoices();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = updateVoices;
    }
  }, []);

  const handleTestVoice = () => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance('Xin chào, đây là giọng đọc thử nghiệm của Stories Reader.');
    utterance.rate = speechRate;
    if (voiceUri) {
      const v = availableVoices.find((item) => item.voiceURI === voiceUri);
      if (v) utterance.voice = v;
    }
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className="space-y-6">
      <div>
        <label className="text-xs font-semibold text-on-surface flex items-center gap-1.5 mb-2.5">
          <Volume2 size={14} className="text-primary" /> Chọn Giọng đọc (TTS Voice)
        </label>
        <select
          value={voiceUri}
          onChange={(e) => setVoiceUri(e.target.value)}
          className="w-full px-3 py-2 rounded-xl bg-surface-container border border-outline-variant/30 text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="">Giọng đọc mặc định thiết bị</option>
          {availableVoices.map((v) => (
            <option key={v.voiceURI} value={v.voiceURI}>
              {v.name} ({v.lang})
            </option>
          ))}
        </select>
      </div>

      <div>
        <div className="flex justify-between items-center mb-2">
          <label className="text-xs font-semibold text-on-surface flex items-center gap-1.5">
            <Sliders size={14} className="text-primary" /> Tốc độ đọc ({speechRate.toFixed(1)}x)
          </label>
        </div>
        <input
          type="range"
          min="0.5"
          max="2.5"
          step="0.1"
          value={speechRate}
          onChange={(e) => setSpeechRate(Number(e.target.value))}
          className="w-full accent-primary"
        />
      </div>

      <div className="pt-2">
        <button
          onClick={handleTestVoice}
          className="w-full py-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 text-xs font-medium transition-all flex items-center justify-center gap-2"
        >
          <Play size={14} /> Thử giọng đọc
        </button>
      </div>
    </div>
  );
}
