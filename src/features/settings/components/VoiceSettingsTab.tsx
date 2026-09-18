import React, { useEffect, useState, useRef } from 'react';
import {
  Volume2,
  Sliders,
  Cpu,
  Loader2,
  Minus,
  Plus,
  Sparkles,
  Globe,
  Server,
  RotateCcw,
  Radio,
} from 'lucide-react';
import { useReaderConfigStore } from '../../../stores/useReaderConfigStore';
import { useAppStore } from '../../../stores/useAppStore';
import { TTSService, VieNeuVoice, DEFAULT_VIENEU_SERVER_URL } from '../../../services/ttsService';
import { EdgeTTSService, EdgeVoice } from '../../../services/edgeTtsService';
import { showToast } from '../../../stores/useToastStore';

export function VoiceSettingsTab() {
  const activeDomain = useAppStore((state) => state.activeDomain);
  const {
    voiceUri,
    setVoiceUri,
    edgeVoiceUri = 'vi-VN-HoaiMyNeural',
    setEdgeVoiceUri,
    speechRate,
    setSpeechRate,
    ttsEngine = 'vieneu',
    setTTSEngine,
    vieneuServerUrl = DEFAULT_VIENEU_SERVER_URL,
    setVieneuServerUrl,
  } = useReaderConfigStore();

  const [vieneuVoices, setVieneuVoices] = useState<VieNeuVoice[]>([]);
  const [edgeVoices, setEdgeVoices] = useState<EdgeVoice[]>([]);
  const [browserVoices, setBrowserVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [isLoadingVoices, setIsLoadingVoices] = useState(false);
  const [isTestingAudio, setIsTestingAudio] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);

  const [isPingTesting, setIsPingTesting] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Fetch VieNeu AI Voices
  useEffect(() => {
    let isMounted = true;
    if (ttsEngine === 'vieneu') {
      setVieneuVoices([]);
      setIsLoadingVoices(true);
      TTSService.fetchVoices(vieneuServerUrl)
        .then((voices) => {
          if (isMounted) {
            setVieneuVoices(voices);
            if (voices.length > 0 && (!voiceUri || !voices.some((voice) => voice.id === voiceUri))) {
              setVoiceUri(voices[0].id);
            }
            setIsLoadingVoices(false);
          }
        })
        .catch(() => {
          if (isMounted) {
            setVieneuVoices([]);
            setIsLoadingVoices(false);
          }
        });
    }

    return () => {
      isMounted = false;
    };
  }, [vieneuServerUrl, ttsEngine, setVoiceUri, voiceUri]);

  // Fetch Edge TTS Voices
  useEffect(() => {
    let isMounted = true;
    if (ttsEngine === 'edge') {
      setIsLoadingVoices(true);
      EdgeTTSService.fetchVoices(activeDomain?.url)
        .then((voices) => {
          if (isMounted) {
            setEdgeVoices(voices);
            setIsLoadingVoices(false);
          }
        })
        .catch(() => {
          if (isMounted) setIsLoadingVoices(false);
        });
    }

    return () => {
      isMounted = false;
    };
  }, [ttsEngine, activeDomain?.url]);

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

  const handleTestVoice = async (overrideVoice?: string) => {
    setTestError(null);

    if (ttsEngine === 'browser') {
      const targetVoice = overrideVoice || voiceUri;
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance('Xin chào, đây là giọng đọc thử nghiệm từ trình duyệt.');
      utterance.rate = speechRate;
      if (targetVoice) {
        const v = browserVoices.find((item) => item.voiceURI === targetVoice);
        if (v) utterance.voice = v;
      }
      window.speechSynthesis.speak(utterance);
      return;
    }

    if (ttsEngine === 'edge') {
      const targetVoice = overrideVoice || edgeVoiceUri || 'vi-VN-HoaiMyNeural';
      try {
        setIsTestingAudio(true);
        if (audioRef.current) {
          audioRef.current.pause();
        }

        const sampleText = 'Xin chào bạn, đây là bản đọc thử nghiệm từ Microsoft Edge TTS AI.';
        const blob = await EdgeTTSService.synthesizeSpeech(sampleText, targetVoice, speechRate, activeDomain?.url);
        const audioUrl = URL.createObjectURL(blob);

        const audio = new Audio(audioUrl);
        audioRef.current = audio;

        audio.onended = () => {
          setIsTestingAudio(false);
          URL.revokeObjectURL(audioUrl);
        };

        audio.onerror = () => {
          setIsTestingAudio(false);
          setTestError('Không thể phát âm thanh Microsoft Edge TTS');
          URL.revokeObjectURL(audioUrl);
        };

        await audio.play();
      } catch (err: any) {
        console.error('[VoiceSettingsTab] Error testing Edge TTS voice:', err);
        setTestError(err.message || 'Lỗi kết nối Microsoft Edge TTS API');
        setIsTestingAudio(false);
      }
      return;
    }

    // Test VieNeu AI Voice
    try {
      const targetVoice = overrideVoice || voiceUri;
      if (!targetVoice) {
        setTestError('Chưa có voice nào từ máy chủ VieNeu');
        return;
      }
      setIsTestingAudio(true);
      if (audioRef.current) {
        audioRef.current.pause();
      }

      const sampleText = 'Xin chào bạn, đây là bản đọc thử nghiệm từ máy chủ VieNeu TTS.';
      const blob = await TTSService.synthesizeSpeech(sampleText, targetVoice, speechRate, vieneuServerUrl);
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

  const handleTestConnection = async () => {
    setIsPingTesting(true);
    try {
      const voices = await TTSService.fetchVoices(vieneuServerUrl);
      if (voices && voices.length > 0) {
        showToast(`Kết nối tốt! (${voices.length} giọng)`, 'success');
      } else {
        showToast('Kết nối máy chủ thành công!', 'success');
      }
    } catch (err: any) {
      showToast(err.message || 'Lỗi kết nối máy chủ', 'error');
    } finally {
      setIsPingTesting(false);
    }
  };

  const handleResetServerUrl = () => {
    setVieneuServerUrl(DEFAULT_VIENEU_SERVER_URL);
  };

  return (
    <div className="space-y-3 text-on-surface">
      {/* 1. Supplier Tabs Switcher (3 Supplier Options) */}
      <div className="flex items-center gap-1 p-1 bg-white/5 border border-white/10 rounded-2xl">
        <button
          type="button"
          onClick={() => {
            setTTSEngine('vieneu');
            if (vieneuVoices.length > 0 && (!voiceUri || !vieneuVoices.some((v) => v.id === voiceUri))) {
              setVoiceUri(vieneuVoices[0].id);
            }
          }}
          className={`flex-1 py-1.5 px-2 rounded-xl text-[11px] font-extrabold transition-all flex items-center justify-center gap-1 cursor-pointer active:scale-95 ${
            ttsEngine === 'vieneu'
              ? 'bg-primary/20 hover:bg-primary/25 border border-primary/60 text-primary font-black shadow-xs'
              : 'text-on-surface-variant hover:text-on-surface border border-transparent'
          }`}
        >
          <Sparkles size={12} className={ttsEngine === 'vieneu' ? 'text-primary' : 'opacity-70'} />
          <span>VieNeu AI</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setTTSEngine('edge');
          }}
          className={`flex-1 py-1.5 px-2 rounded-xl text-[11px] font-extrabold transition-all flex items-center justify-center gap-1 cursor-pointer active:scale-95 ${
            ttsEngine === 'edge'
              ? 'bg-primary/20 hover:bg-primary/25 border border-primary/60 text-primary font-black shadow-xs'
              : 'text-on-surface-variant hover:text-on-surface border border-transparent'
          }`}
        >
          <Cpu size={12} className={ttsEngine === 'edge' ? 'text-primary' : 'opacity-70'} />
          <span>Edge TTS</span>
        </button>

        <button
          type="button"
          onClick={() => setTTSEngine('browser')}
          className={`flex-1 py-1.5 px-2 rounded-xl text-[11px] font-extrabold transition-all flex items-center justify-center gap-1 cursor-pointer active:scale-95 ${
            ttsEngine === 'browser'
              ? 'bg-primary/20 hover:bg-primary/25 border border-primary/60 text-primary font-black shadow-xs'
              : 'text-on-surface-variant hover:text-on-surface border border-transparent'
          }`}
        >
          <Globe size={12} className={ttsEngine === 'browser' ? 'text-primary' : 'opacity-70'} />
          <span>Native</span>
        </button>
      </div>

      {/* 2. VieNeu TTS Server Endpoint */}
      {ttsEngine === 'vieneu' && (
        <div className="p-2 rounded-2xl bg-white/5 border border-white/10 shadow-xs space-y-1.5">
          <div className="flex items-center justify-between px-0.5">
            <label className="text-xs font-bold text-on-surface flex items-center gap-1.5">
              <Server size={13} className="text-primary" /> Máy chủ VieNeu TTS
            </label>
            <button
              type="button"
              onClick={handleResetServerUrl}
              className="text-[10px] font-mono font-bold text-primary hover:underline flex items-center gap-1 cursor-pointer opacity-85 hover:opacity-100"
              title="Khôi phục mặc định"
            >
              <RotateCcw size={10} /> Mặc định
            </button>
          </div>

          <div className="flex items-center gap-1.5 bg-white/10 p-1 rounded-xl border border-white/15 focus-within:ring-1 focus-within:ring-primary/60">
            <input
              type="text"
              value={vieneuServerUrl}
              onChange={(e) => {
                setVieneuServerUrl(e.target.value);
              }}
              placeholder="https://..."
              className="w-full bg-transparent px-2 py-1 text-xs font-mono text-on-surface focus:outline-none font-bold placeholder:text-on-surface-variant/40 min-w-0"
            />

            <button
              type="button"
              onClick={handleTestConnection}
              disabled={isPingTesting}
              className="w-7 h-7 rounded-lg bg-primary/20 hover:bg-primary/30 border border-primary/50 text-primary flex items-center justify-center shrink-0 transition-all active:scale-90 cursor-pointer disabled:opacity-50"
              title="Kiểm tra kết nối máy chủ"
              aria-label="Kiểm tra kết nối máy chủ"
            >
              {isPingTesting ? (
                <Loader2 size={13} className="animate-spin text-primary" />
              ) : (
                <Radio size={13} />
              )}
            </button>
          </div>
        </div>
      )}

      {/* 3. Voice Selection Section */}
      <div>
        <div className="flex items-center justify-between mb-1.5 px-0.5">
          <span className="text-xs font-bold text-on-surface flex items-center gap-1.5">
            <Volume2 size={13} className="text-primary" /> Chọn Giọng đọc Supplier
          </span>
          {isLoadingVoices && (
            <span className="flex items-center gap-1 text-[10px] text-primary font-bold">
              <Loader2 size={11} className="animate-spin" /> Đang tải...
            </span>
          )}
        </div>

        {ttsEngine === 'vieneu' && (
          <div className="grid grid-cols-3 gap-1.5 max-h-[210px] overflow-y-auto no-scrollbar pr-0.5">
            {vieneuVoices.map((v) => {
              const isSelected = (voiceUri || vieneuVoices[0]?.id) === v.id;
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => {
                    setVoiceUri(v.id);
                    handleTestVoice(v.id);
                  }}
                  title={`${v.name} (${v.gender === 'male' ? 'Nam' : v.gender === 'female' ? 'Nữ' : 'Không xác định'})`}
                  className={`py-1.5 px-1.5 rounded-xl border text-center transition-all active:scale-95 flex flex-col items-center justify-center gap-0.5 cursor-pointer min-w-0 ${
                    isSelected
                      ? 'bg-primary/20 hover:bg-primary/25 border-primary/60 text-primary font-black shadow-xs'
                      : 'bg-white/5 hover:bg-white/10 border-white/10 text-on-surface font-bold'
                  }`}
                >
                  <div className="flex items-center justify-center gap-1 w-full min-w-0">
                    {isSelected && isTestingAudio ? (
                      <Loader2 size={10} className="animate-spin text-primary shrink-0" />
                    ) : isSelected ? (
                      <Volume2 size={10} className="text-primary shrink-0 animate-pulse" />
                    ) : null}
                    <span className="text-xs truncate leading-tight">{v.name}</span>
                  </div>
                  <span
                    className={`text-[8.5px] font-mono font-black px-1.5 py-0.2 rounded-md border leading-none ${
                      v.gender === 'male'
                        ? 'bg-blue-500/15 text-blue-400 border-blue-500/30'
                        : 'bg-pink-500/15 text-pink-400 border-pink-500/30'
                    }`}
                  >
                    {v.gender === 'male' ? 'Nam' : 'Nữ'}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {ttsEngine === 'edge' && (
          <div className="grid grid-cols-2 gap-1.5 max-h-[210px] overflow-y-auto no-scrollbar pr-0.5">
            {edgeVoices.map((v) => {
              const isSelected = (edgeVoiceUri || 'vi-VN-HoaiMyNeural') === v.id;
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => {
                    setEdgeVoiceUri(v.id);
                    handleTestVoice(v.id);
                  }}
                  title={v.desc || v.name}
                  className={`py-2 px-2 rounded-xl border text-left transition-all active:scale-95 flex flex-col justify-center gap-0.5 cursor-pointer min-w-0 ${
                    isSelected
                      ? 'bg-primary/20 hover:bg-primary/25 border-primary/60 text-primary font-black shadow-xs'
                      : 'bg-white/5 hover:bg-white/10 border-white/10 text-on-surface font-bold'
                  }`}
                >
                  <div className="flex items-center gap-1.5 w-full min-w-0">
                    {isSelected && isTestingAudio ? (
                      <Loader2 size={11} className="animate-spin text-primary shrink-0" />
                    ) : isSelected ? (
                      <Volume2 size={11} className="text-primary shrink-0 animate-pulse" />
                    ) : null}
                    <span className="text-xs truncate font-bold">{v.name}</span>
                  </div>
                  <span className="text-[9px] text-on-surface-variant/70 truncate">{v.desc || v.language}</span>
                </button>
              );
            })}
          </div>
        )}

        {ttsEngine === 'browser' && (
          <div className="p-1.5 rounded-2xl bg-white/5 border border-white/10 shadow-xs">
            <select
              value={voiceUri}
              onChange={(e) => {
                const selected = e.target.value;
                setVoiceUri(selected);
                handleTestVoice(selected);
              }}
              className="w-full px-3 py-2 rounded-xl bg-white/10 border border-white/15 text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-primary/60 font-bold cursor-pointer"
            >
              <option value="" className="bg-background text-on-background">
                Giọng mặc định thiết bị
              </option>
              {browserVoices.map((v) => (
                <option key={v.voiceURI} value={v.voiceURI} className="bg-background text-on-background">
                  {v.name} ({v.lang})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* 4. Speech Rate Stepper & Slider */}
      <div className="p-2 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between gap-2 shadow-xs">
        <div className="flex items-center gap-1.5 text-xs font-bold text-on-surface shrink-0">
          <Sliders size={13} className="text-primary" />
          <span>Tốc độ</span>
        </div>

        <div className="flex-1 flex items-center gap-2">
          <input
            type="range"
            min="0.5"
            max="2.0"
            step="0.1"
            value={speechRate}
            onChange={(e) => setSpeechRate(Number(e.target.value))}
            className="w-full accent-primary cursor-pointer"
          />

          <div className="flex items-center gap-1 bg-white/10 p-0.5 rounded-xl border border-white/15 shrink-0">
            <button
              type="button"
              onClick={() => setSpeechRate(Math.max(0.5, Number((speechRate - 0.1).toFixed(2))))}
              disabled={speechRate <= 0.5}
              className="w-6 h-6 rounded-lg bg-white/10 hover:bg-white/20 active:scale-95 disabled:opacity-30 text-on-surface flex items-center justify-center font-bold cursor-pointer"
              title="Giảm tốc độ"
            >
              <Minus size={11} />
            </button>
            <span className="px-1 text-xs font-mono font-extrabold text-primary min-w-[36px] text-center select-none">
              {speechRate.toFixed(1)}x
            </span>
            <button
              type="button"
              onClick={() => setSpeechRate(Math.min(2.0, Number((speechRate + 0.1).toFixed(2))))}
              disabled={speechRate >= 2.0}
              className="w-6 h-6 rounded-lg bg-white/10 hover:bg-white/20 active:scale-95 disabled:opacity-30 text-on-surface flex items-center justify-center font-bold cursor-pointer"
              title="Tăng tốc độ"
            >
              <Plus size={11} />
            </button>
          </div>
        </div>
      </div>

      {testError && (
        <div className="text-[11px] font-bold text-rose-400 bg-rose-500/10 p-2 rounded-2xl border border-rose-500/25 animate-in fade-in duration-200">
          {testError}
        </div>
      )}
    </div>
  );
}
