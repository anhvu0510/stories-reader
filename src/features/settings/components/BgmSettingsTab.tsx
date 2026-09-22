import React, { useState, useRef, useEffect } from 'react';
import {
  Music,
  Volume2,
  VolumeX,
  Play,
  Pause,
  Sliders,
  RotateCcw,
  Sparkles,
  Radio,
  Clock,
  ExternalLink,
  Waves,
  CloudRain,
  Piano,
  Info,
} from 'lucide-react';
import { useReaderConfigStore } from '../../../stores/useReaderConfigStore';
import { getAssetUrl } from '../../../shared/utils/assetUrl';

const PRESET_MUSIC_LIST = [
  {
    id: 'synth',
    name: 'Tổng hợp Synth Ambient',
    description: 'Hợp âm C-Major mượt mà sinh ra từ Web Audio Synthesizer',
    icon: Sparkles,
    url: '/audio/ambient-bgm.mp3',
  },
  {
    id: 'lofi',
    name: 'Lofi Piano Thư Giãn',
    description: 'Tiếng piano nhẹ nhàng du dương tạo cảm giác thư thái',
    icon: Piano,
    url: '/audio/lofi-piano.mp3',
  },
  {
    id: 'ocean',
    name: 'Tiếng Sóng Biển Vỗ',
    description: 'Âm thanh sóng biển rì rào giúp tập trung đọc sách',
    icon: Waves,
    url: '/audio/ocean-waves.mp3',
  },
  {
    id: 'rain',
    name: 'Tiếng Mưa Rào Rơi',
    description: 'Tiếng mưa rơi tĩnh lặng phù hợp đọc truyện ban đêm',
    icon: CloudRain,
    url: '/audio/gentle-rain.mp3',
  },
];

export function BgmSettingsTab() {
  const {
    bgmEnabled = true,
    setBgmEnabled,
    bgmVolume = 0.2,
    setBgmVolume,
    bgmAudioUrl = '/audio/ambient-bgm.mp3',
    setBgmAudioUrl,
    bgmFadeInMs = 500,
    bgmFadeOutMs = 800,
    bgmStopDelayMs = 1500,
    bgmOnlyOnEdgeReadAloud = true,
    setBgmParameter,
  } = useReaderConfigStore();

  const [customUrl, setCustomUrl] = useState(bgmAudioUrl);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const previewAudioCtxRef = useRef<AudioContext | null>(null);
  const previewSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const previewGainRef = useRef<GainNode | null>(null);

  useEffect(() => {
    return () => {
      stopPreview();
    };
  }, []);

  // Real-time volume update for active preview audio
  useEffect(() => {
    if (previewGainRef.current && previewAudioCtxRef.current) {
      const ctx = previewAudioCtxRef.current;
      const gain = previewGainRef.current;
      const now = ctx.currentTime;
      try {
        if (typeof gain.gain.setValueAtTime === 'function') {
          gain.gain.setValueAtTime(bgmVolume, now);
        } else {
          gain.gain.value = bgmVolume;
        }
      } catch {}
    }
  }, [bgmVolume]);

  const stopPreview = () => {
    if (previewSourceRef.current) {
      try {
        previewSourceRef.current.stop();
        previewSourceRef.current.disconnect();
      } catch {}
      previewSourceRef.current = null;
    }
    if (previewGainRef.current) {
      try {
        previewGainRef.current.disconnect();
      } catch {}
      previewGainRef.current = null;
    }
    if (previewAudioCtxRef.current && previewAudioCtxRef.current.state !== 'closed') {
      void previewAudioCtxRef.current.close();
      previewAudioCtxRef.current = null;
    }
    setIsPreviewing(false);
  };

  const togglePreview = async () => {
    if (isPreviewing) {
      stopPreview();
      return;
    }

    try {
      setIsPreviewing(true);
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

      if (!AudioContextClass) return;

      const ctx = new AudioContextClass();
      previewAudioCtxRef.current = ctx;

      const resolvedUrl = getAssetUrl(bgmAudioUrl);

      let buffer: AudioBuffer;
      try {
        const res = await fetch(resolvedUrl);
        const arrayBuffer = await res.arrayBuffer();
        buffer = await ctx.decodeAudioData(arrayBuffer);
      } catch {
        // Fallback to synth ambient if fetch fails
        const sampleRate = ctx.sampleRate || 44100;
        const duration = 4.0;
        const numSamples = Math.floor(sampleRate * duration);
        buffer = ctx.createBuffer(2, numSamples, sampleRate);
        const left = buffer.getChannelData(0);
        const right = buffer.getChannelData(1);
        for (let i = 0; i < numSamples; i++) {
          const t = i / sampleRate;
          const lfo = 0.5 + 0.5 * Math.sin(2 * Math.PI * 0.25 * t);
          const note1 = Math.sin(2 * Math.PI * 261.63 * t) * 0.15;
          const note2 = Math.sin(2 * Math.PI * 329.63 * t) * 0.12;
          const note3 = Math.sin(2 * Math.PI * 392.00 * t) * 0.10;
          const wave = (note1 + note2 + note3) * lfo;
          left[i] = wave;
          right[i] = wave;
        }
      }

      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;

      const gain = ctx.createGain();
      gain.gain.value = bgmVolume;

      source.connect(gain);
      gain.connect(ctx.destination);
      source.start(0);

      previewSourceRef.current = source;
      previewGainRef.current = gain;
    } catch (err) {
      console.error('Failed to preview BGM audio:', err);
      setIsPreviewing(false);
    }
  };

  const handleSelectPreset = (url: string) => {
    stopPreview();
    setBgmAudioUrl(url);
    setCustomUrl(url);
  };

  const handleCustomUrlBlur = () => {
    if (customUrl && customUrl.trim() !== bgmAudioUrl) {
      stopPreview();
      setBgmAudioUrl(customUrl.trim());
    }
  };

  const handleResetDefaults = () => {
    stopPreview();
    setBgmEnabled(true);
    setBgmVolume(0.2);
    setBgmAudioUrl('/audio/ambient-bgm.mp3');
    setCustomUrl('/audio/ambient-bgm.mp3');
    setBgmParameter('bgmFadeInMs', 500);
    setBgmParameter('bgmFadeOutMs', 800);
    setBgmParameter('bgmStopDelayMs', 1500);
    setBgmParameter('bgmOnlyOnEdgeReadAloud', true);
  };

  const volumePercent = Math.round(bgmVolume * 100);

  return (
    <div className="space-y-3 text-on-surface">
      {/* 1. Master Toggle Header (Glassmorphic translucent) */}
      <div className="p-3 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md space-y-2.5 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-xl transition-all ${bgmEnabled ? 'bg-primary/20 text-primary border border-primary/40' : 'bg-white/10 text-on-surface-variant'}`}>
              <Music size={18} />
            </div>
            <div>
              <h3 className="text-xs font-bold text-on-surface flex items-center gap-2">
                Nhạc Nền Đọc Sách
                <span className={`text-[9px] px-2 py-0.5 rounded-full font-black uppercase tracking-wider ${bgmEnabled ? 'bg-primary/20 text-primary border border-primary/30' : 'bg-white/10 text-on-surface-variant'}`}>
                  {bgmEnabled ? 'Đang bật' : 'Đã tắt'}
                </span>
              </h3>
              <p className="text-[11px] text-on-surface-variant/80 mt-0.5">
                Tự động phát nhạc nền khi bật tính năng Edge Read Aloud
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setBgmEnabled(!bgmEnabled)}
            className={`w-9 h-5 rounded-full transition-colors relative p-0.5 cursor-pointer shrink-0 ${
              bgmEnabled ? 'bg-primary' : 'bg-white/20'
            }`}
            title={bgmEnabled ? 'Tắt nhạc nền' : 'Bật nhạc nền'}
            aria-label="Chuyển đổi bật tắt nhạc nền"
          >
            <div
              className={`w-4 h-4 rounded-full bg-white shadow-xs transition-transform ${
                bgmEnabled ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Live Sound Preview Controls */}
        <div className="flex items-center justify-between pt-2 border-t border-white/10 text-xs">
          <div className="flex items-center gap-1.5 text-on-surface-variant">
            <Radio size={13} className={isPreviewing ? 'text-primary animate-pulse' : 'text-on-surface-variant/60'} />
            <span className="text-[11px]">{isPreviewing ? 'Đang phát nghe thử...' : 'Nghe thử giai điệu hiện tại'}</span>
          </div>
          <button
            onClick={togglePreview}
            disabled={!bgmEnabled}
            className={`px-2.5 py-1 rounded-xl font-bold flex items-center gap-1.5 transition-all text-[11px] active:scale-95 ${
              isPreviewing
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 hover:bg-amber-500/30'
                : 'bg-primary/20 text-primary border border-primary/40 hover:bg-primary/30'
            } disabled:opacity-40 disabled:pointer-events-none`}
          >
            {isPreviewing ? <Pause size={13} /> : <Play size={13} />}
            {isPreviewing ? 'Tạm dừng' : 'Nghe thử'}
          </button>
        </div>
      </div>

      {/* 2. Volume Slider & Presets (Glassmorphic translucent) */}
      <div className={`p-3 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md space-y-2.5 shadow-xs transition-opacity ${!bgmEnabled ? 'opacity-40 pointer-events-none' : ''}`}>
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-on-surface flex items-center gap-1.5">
            {volumePercent === 0 ? <VolumeX size={15} className="text-error" /> : <Volume2 size={15} className="text-primary" />}
            Âm lượng Nhạc Nền: <span className="text-primary font-black">{volumePercent}%</span>
          </label>
          <span className="text-[10px] text-on-surface-variant/70 font-mono">Khuyên dùng 15% - 25%</span>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={bgmVolume}
            onChange={(e) => setBgmVolume(parseFloat(e.target.value))}
            className="w-full accent-primary h-1.5 bg-white/10 rounded-lg cursor-pointer"
          />
        </div>

        {/* Quick Volume Preset Buttons */}
        <div className="flex items-center justify-between gap-1.5 pt-0.5">
          {[0.1, 0.2, 0.35, 0.5, 0.75].map((presetVol) => {
            const pct = Math.round(presetVol * 100);
            const isSelected = Math.abs(bgmVolume - presetVol) < 0.03;
            return (
              <button
                key={presetVol}
                onClick={() => setBgmVolume(presetVol)}
                className={`flex-1 py-1 text-[11px] font-bold rounded-lg border transition-all text-center active:scale-95 ${
                  isSelected
                    ? 'bg-primary/30 text-primary border-primary/60 shadow-xs'
                    : 'bg-white/5 border-white/10 text-on-surface-variant hover:text-on-surface hover:bg-white/10'
                }`}
              >
                {pct}%
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Audio Source Selector (Glassmorphic translucent) */}
      <div className={`p-3 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md space-y-2.5 shadow-xs transition-opacity ${!bgmEnabled ? 'opacity-40 pointer-events-none' : ''}`}>
        <h4 className="text-xs font-bold text-on-surface flex items-center gap-1.5">
          <Music size={14} className="text-primary" />
          Chọn Bản Nhạc Nền
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {PRESET_MUSIC_LIST.map((preset) => {
            const Icon = preset.icon;
            const isSelected = bgmAudioUrl === preset.url;
            return (
              <button
                key={preset.id}
                onClick={() => handleSelectPreset(preset.url)}
                className={`p-2 rounded-xl border text-left transition-all flex items-start gap-2 relative ${
                  isSelected
                    ? 'bg-primary/20 border-primary/60 text-on-surface shadow-xs'
                    : 'bg-white/5 border-white/10 text-on-surface-variant hover:text-on-surface hover:bg-white/10'
                }`}
              >
                <div className={`p-1.5 rounded-lg ${isSelected ? 'bg-primary/30 text-primary' : 'bg-white/10 text-on-surface-variant'}`}>
                  <Icon size={15} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold truncate flex items-center gap-1">
                    {preset.name}
                    {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />}
                  </div>
                  <div className="text-[10px] text-on-surface-variant/70 line-clamp-1 mt-0.5">
                    {preset.description}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Custom URL Input */}
        <div className="space-y-1 pt-1.5 border-t border-white/10">
          <label className="text-[10px] font-bold text-on-surface-variant flex items-center gap-1">
            <ExternalLink size={11} />
            URL file âm thanh tùy chọn (.mp3, .wav):
          </label>
          <input
            type="url"
            value={customUrl}
            onChange={(e) => setCustomUrl(e.target.value)}
            onBlur={handleCustomUrlBlur}
            placeholder="https://domain.com/audio/bgm.mp3 hoặc /audio/bgm.mp3"
            className="w-full text-xs px-2.5 py-1.5 rounded-xl bg-white/10 border border-white/15 text-on-surface placeholder:text-on-surface-variant/40 focus:outline-hidden focus:border-primary"
          />
        </div>
      </div>

      {/* 4. Advanced Timing & Ramp Controls */}
      <div className={`p-3 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md space-y-2.5 shadow-xs transition-opacity ${!bgmEnabled ? 'opacity-40 pointer-events-none' : ''}`}>
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="w-full flex items-center justify-between text-xs font-bold text-on-surface"
        >
          <span className="flex items-center gap-1.5">
            <Sliders size={14} className="text-primary" />
            Cấu hình Nâng cao (Fade & Trễ ngắt câu)
          </span>
          <span className="text-[10px] text-primary font-bold">
            {showAdvanced ? 'Thu gọn' : 'Mở rộng'}
          </span>
        </button>

        {showAdvanced && (
          <div className="space-y-2.5 pt-2 border-t border-white/10 animate-in fade-in duration-200">
            {/* Fade In Ms */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-on-surface-variant text-[11px]">Thời gian Fade In (tăng âm):</span>
                <span className="font-mono text-primary font-bold text-[11px]">{bgmFadeInMs} ms</span>
              </div>
              <input
                type="range"
                min="100"
                max="2000"
                step="100"
                value={bgmFadeInMs}
                onChange={(e) => setBgmParameter('bgmFadeInMs', parseInt(e.target.value, 10))}
                className="w-full accent-primary h-1.5 bg-white/10 rounded-lg cursor-pointer"
              />
            </div>

            {/* Fade Out Ms */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-on-surface-variant text-[11px]">Thời gian Fade Out (giảm âm):</span>
                <span className="font-mono text-primary font-bold text-[11px]">{bgmFadeOutMs} ms</span>
              </div>
              <input
                type="range"
                min="100"
                max="3000"
                step="100"
                value={bgmFadeOutMs}
                onChange={(e) => setBgmParameter('bgmFadeOutMs', parseInt(e.target.value, 10))}
                className="w-full accent-primary h-1.5 bg-white/10 rounded-lg cursor-pointer"
              />
            </div>

            {/* Stop Delay Ms */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-on-surface-variant text-[11px] flex items-center gap-1">
                  <Clock size={11} />
                  Độ trễ chờ chuyển câu/dòng:
                </span>
                <span className="font-mono text-primary font-bold text-[11px]">{bgmStopDelayMs} ms</span>
              </div>
              <input
                type="range"
                min="0"
                max="5000"
                step="250"
                value={bgmStopDelayMs}
                onChange={(e) => setBgmParameter('bgmStopDelayMs', parseInt(e.target.value, 10))}
                className="w-full accent-primary h-1.5 bg-white/10 rounded-lg cursor-pointer"
              />
              <p className="text-[10px] text-on-surface-variant/70">
                Khoảng trễ giữ nhạc phát liên tục không bị ngắt giữa các câu.
              </p>
            </div>

            {/* Only on Edge Read Aloud toggle */}
            <div className="flex items-center justify-between pt-1">
              <span className="text-xs text-on-surface font-medium flex items-center gap-1">
                <Info size={12} className="text-primary" />
                Chỉ phát khi Edge Read Aloud hoạt động
              </span>
              <button
                type="button"
                onClick={() => setBgmParameter('bgmOnlyOnEdgeReadAloud', !bgmOnlyOnEdgeReadAloud)}
                className={`w-8 h-4.5 rounded-full transition-colors relative p-0.5 cursor-pointer shrink-0 ${
                  bgmOnlyOnEdgeReadAloud ? 'bg-primary' : 'bg-white/20'
                }`}
                title="Chuyển đổi kích hoạt nhạc nền"
              >
                <div
                  className={`w-3.5 h-3.5 rounded-full bg-white shadow-xs transition-transform ${
                    bgmOnlyOnEdgeReadAloud ? 'translate-x-3.5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Reset Defaults Action */}
      <div className="flex justify-end pt-0.5">
        <button
          type="button"
          onClick={handleResetDefaults}
          className="px-2.5 py-1 text-xs font-bold text-on-surface-variant hover:text-on-surface bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 flex items-center gap-1.5 transition-all active:scale-95"
        >
          <RotateCcw size={12} />
          Khôi phục mặc định Nhạc Nền
        </button>
      </div>
    </div>
  );
}
