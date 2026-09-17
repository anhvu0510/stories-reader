import React, { useEffect, useState, useRef } from 'react';
import { Volume2, Play, Sliders, Cpu, Loader2, CheckCircle2 } from 'lucide-react';
import { useReaderConfigStore } from '../../../stores/useReaderConfigStore';
import { TTSService, VieNeuVoice, DEFAULT_VIENEU_SERVER_URL } from '../../../services/ttsService';

export function VoiceSettingsTab() {
  const {
    voiceUri,
    setVoiceUri,
    speechRate,
    setSpeechRate,
    ttsEngine = 'vieneu',
    setTTSEngine,
    vieneuServerUrl = DEFAULT_VIENEU_SERVER_URL,
  } = useReaderConfigStore();

  const [vieneuVoices, setVieneuVoices] = useState<VieNeuVoice[]>([]);
  const [browserVoices, setBrowserVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [isLoadingVoices, setIsLoadingVoices] = useState(false);
  const [isTestingAudio, setIsTestingAudio] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Fetch VieNeu AI Voices
  useEffect(() => {
    let isMounted = true;
    setIsLoadingVoices(true);

    TTSService.fetchVoices(vieneuServerUrl)
      .then((voices) => {
        if (isMounted) {
          setVieneuVoices(voices);
          setIsLoadingVoices(false);
        }
      })
      .catch(() => {
        if (isMounted) setIsLoadingVoices(false);
      });

    return () => {
      isMounted = false;
    };
  }, [vieneuServerUrl]);

  // Fetch Browser Web Speech Synthesis Voices
  useEffect(() => {
    const updateBrowserVoices = () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        const v = window.speechSynthesis.getVoices();
        const vn = v.filter((item) => item.lang.includes('vi') || item.lang.includes('VI'));
        setBrowserVoices(vn.length > 0 ? vn : v);
      }
    };

    updateBrowserVoices();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = updateBrowserVoices;
    }
  }, []);

  const handleTestVoice = async () => {
    setTestError(null);
    if (isTestingAudio) return;

    if (ttsEngine === 'browser') {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance('Xin chào, đây là giọng đọc trình duyệt của Stories Reader.');
      utterance.rate = speechRate;
      if (voiceUri) {
        const v = browserVoices.find((item) => item.voiceURI === voiceUri);
        if (v) utterance.voice = v;
      }
      window.speechSynthesis.speak(utterance);
      return;
    }

    // Test VieNeu AI Voice
    try {
      setIsTestingAudio(true);
      if (audioRef.current) {
        audioRef.current.pause();
      }

      const sampleText = 'Xin chào bạn, đây là bản đọc thử nghiệm giọng AI từ máy chủ VieNeu TTS.';
      const activeVoice = voiceUri || 'Minh Quân';
      const blob = await TTSService.synthesizeSpeech(sampleText, activeVoice, speechRate, vieneuServerUrl);
      const audioUrl = TTSService.createAudioUrl(blob);

      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      audio.onended = () => {
        setIsTestingAudio(false);
        TTSService.revokeAudioUrl(audioUrl);
      };

      audio.onerror = () => {
        setIsTestingAudio(false);
        setTestError('Không thể phát âm thanh thử nghiệm');
        TTSService.revokeAudioUrl(audioUrl);
      };

      await audio.play();
    } catch (err: any) {
      console.error('[VoiceSettingsTab] Error testing voice:', err);
      setTestError(err.message || 'Lỗi kết nối VieNeu TTS Server');
      setIsTestingAudio(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Engine Switcher */}
      <div>
        <label className="text-xs font-semibold text-on-surface flex items-center gap-1.5 mb-2.5">
          <Cpu size={14} className="text-primary" /> Động Cơ Đọc Thoại (TTS Engine)
        </label>
        <div className="grid grid-cols-2 gap-2 p-1 bg-surface-container rounded-xl border border-outline-variant/30">
          <button
            type="button"
            onClick={() => {
              setTTSEngine('vieneu');
              if (!voiceUri || !vieneuVoices.some((v) => v.id === voiceUri)) {
                setVoiceUri('Minh Quân');
              }
            }}
            className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              ttsEngine === 'vieneu'
                ? 'bg-primary text-on-primary shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            {ttsEngine === 'vieneu' && <CheckCircle2 size={13} />}
            <span>VieNeu AI TTS (Khuyên dùng)</span>
          </button>

          <button
            type="button"
            onClick={() => setTTSEngine('browser')}
            className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              ttsEngine === 'browser'
                ? 'bg-primary text-on-primary shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            {ttsEngine === 'browser' && <CheckCircle2 size={13} />}
            <span>Giọng Trình Duyệt</span>
          </button>
        </div>
      </div>

      {/* Voice Selector Dropdown */}
      <div>
        <label className="text-xs font-semibold text-on-surface flex items-center justify-between gap-1.5 mb-2.5">
          <span className="flex items-center gap-1.5">
            <Volume2 size={14} className="text-primary" /> Chọn Giọng đọc
          </span>
          {isLoadingVoices && <Loader2 size={12} className="animate-spin text-primary" />}
        </label>

        {ttsEngine === 'vieneu' ? (
          <select
            value={voiceUri || 'Minh Quân'}
            onChange={(e) => setVoiceUri(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl bg-surface-container border border-outline-variant/30 text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-primary font-medium"
          >
            {vieneuVoices.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name} ({v.gender === 'male' ? 'Nam' : 'Nữ'} - {v.desc || v.language})
              </option>
            ))}
          </select>
        ) : (
          <select
            value={voiceUri}
            onChange={(e) => setVoiceUri(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl bg-surface-container border border-outline-variant/30 text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-primary font-medium"
          >
            <option value="">Giọng đọc mặc định thiết bị</option>
            {browserVoices.map((v) => (
              <option key={v.voiceURI} value={v.voiceURI}>
                {v.name} ({v.lang})
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Speech Rate Slider */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <label className="text-xs font-semibold text-on-surface flex items-center gap-1.5">
            <Sliders size={14} className="text-primary" /> Tốc độ đọc ({speechRate.toFixed(1)}x)
          </label>
        </div>
        <input
          type="range"
          min="0.5"
          max="2.0"
          step="0.1"
          value={speechRate}
          onChange={(e) => setSpeechRate(Number(e.target.value))}
          className="w-full accent-primary cursor-pointer"
        />
      </div>

      {testError && (
        <div className="text-[11px] text-error bg-error/10 p-2.5 rounded-xl border border-error/20">
          {testError}
        </div>
      )}

      {/* Test Voice Button */}
      <div className="pt-2">
        <button
          onClick={handleTestVoice}
          disabled={isTestingAudio}
          className="w-full py-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
        >
          {isTestingAudio ? (
            <>
              <Loader2 size={14} className="animate-spin" /> Đang phát thử nghiệm...
            </>
          ) : (
            <>
              <Play size={14} fill="currentColor" /> Thử giọng đọc
            </>
          )}
        </button>
      </div>
    </div>
  );
}
