import { useState, useEffect, useRef, useMemo } from 'react';
import { useReaderConfigStore } from '../stores/useReaderConfigStore';
import { TTSService, DEFAULT_VIENEU_SERVER_URL } from '../services/ttsService';
import { useTTSStore } from '../features/reader/stores/useTTSStore';

interface Chunk {
  pIdx: number;
  text: string;
  startOffset: number;
  length: number;
}

function highlightText(rootElement: HTMLElement, startOffset: number, length: number, className: string) {
  if (length <= 0) return;

  const walker = document.createTreeWalker(rootElement, NodeFilter.SHOW_TEXT, null);
  let node: Node | null;
  let currentOffset = 0;
  const targetNodes: { node: Node; nodeStart: number }[] = [];

  while ((node = walker.nextNode())) {
    const nodeLen = node.nodeValue?.length || 0;
    if (currentOffset + nodeLen > startOffset && currentOffset < startOffset + length) {
      targetNodes.push({
        node,
        nodeStart: currentOffset,
      });
    }
    currentOffset += nodeLen;
    if (currentOffset >= startOffset + length) break;
  }

  targetNodes.forEach(({ node, nodeStart }) => {
    if (!node.nodeValue) return;
    const nodeLen = node.nodeValue.length;
    const overlapStart = Math.max(0, startOffset - nodeStart);
    const overlapEnd = Math.min(nodeLen, startOffset + length - nodeStart);

    const beforeText = node.nodeValue.substring(0, overlapStart);
    const highlightTxt = node.nodeValue.substring(overlapStart, overlapEnd);
    const afterText = node.nodeValue.substring(overlapEnd);

    const fragment = document.createDocumentFragment();
    if (beforeText) fragment.appendChild(document.createTextNode(beforeText));

    const mark = document.createElement('msreadoutspan');
    mark.className = className;
    mark.textContent = highlightTxt;
    fragment.appendChild(mark);

    if (afterText) fragment.appendChild(document.createTextNode(afterText));

    node.parentNode?.replaceChild(fragment, node);
  });
}

export function useReadAloud(paragraphs: string[]) {
  const voiceUri = useReaderConfigStore((state) => state.voiceUri);
  const speechRate = useReaderConfigStore((state) => state.speechRate);
  const ttsEngine = useReaderConfigStore((state) => state.ttsEngine || 'vieneu');
  const vieneuServerUrl = useReaderConfigStore((state) => state.vieneuServerUrl || DEFAULT_VIENEU_SERVER_URL);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentChunkIndex, setCurrentChunkIndex] = useState(-1);
  const [charIndex, setCharIndex] = useState(-1);
  const [charLength, setCharLength] = useState(0);

  // Sync state with global useTTSStore
  useEffect(() => {
    useTTSStore.setState({
      isPlaying,
      isPaused,
      currentParagraphIndex: currentChunkIndex,
      currentCharIndex: charIndex,
      currentCharLength: charLength,
    });
  }, [isPlaying, isPaused, currentChunkIndex, charIndex, charLength]);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const activeAudioUrlRef = useRef<string | null>(null);
  const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const currentChunkIdxRef = useRef<number>(0);
  const isPlayingRef = useRef(false);
  const isPausedRef = useRef(false);
  const playSessionIdRef = useRef<number>(0);

  const chunks = useMemo(() => {
    const res: Chunk[] = [];
    paragraphs.forEach((html, pIdx) => {
      if (!html) return;
      const tmp = document.createElement('div');
      tmp.innerHTML = html;
      const text = tmp.textContent || tmp.innerText || '';

      if (text.trim()) {
        res.push({
          pIdx,
          text: text,
          startOffset: 0,
          length: text.length,
        });
      }
    });
    return res;
  }, [paragraphs]);

  const stopAudioPlayer = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      audioRef.current = null;
    }
    if (activeAudioUrlRef.current) {
      TTSService.revokeAudioUrl(activeAudioUrlRef.current);
      activeAudioUrlRef.current = null;
    }
  };

  const stopReading = () => {
    setIsPlaying(false);
    setIsPaused(false);
    isPlayingRef.current = false;
    isPausedRef.current = false;
    playSessionIdRef.current += 1;

    stopAudioPlayer();
    if (synth) synth.cancel();

    currentChunkIdxRef.current = 0;
    setCurrentChunkIndex(-1);
    setCharIndex(-1);
    setCharLength(0);
  };

  useEffect(() => {
    stopReading();
  }, [paragraphs]);

  const lastInteractionTime = useRef(0);

  useEffect(() => {
    const onInteraction = () => {
      lastInteractionTime.current = Date.now();
    };
    window.addEventListener('wheel', onInteraction, { passive: true });
    window.addEventListener('touchmove', onInteraction, { passive: true });
    window.addEventListener('mousedown', onInteraction, { passive: true });
    window.addEventListener('keydown', onInteraction, { passive: true });
    return () => {
      window.removeEventListener('wheel', onInteraction);
      window.removeEventListener('touchmove', onInteraction);
      window.removeEventListener('mousedown', onInteraction);
      window.removeEventListener('keydown', onInteraction);
    };
  }, []);

  // Handle Highlighting directly on the ReaderScreen DOM elements
  useEffect(() => {
    const article = document.querySelector('article');
    if (!article) return;

    const pNodes = Array.from(article.querySelectorAll(':scope > div.mb-4'));
    if (pNodes.length === 0) return;

    pNodes.forEach((node, idx) => {
      const origHtml = paragraphs[idx] || '';
      if (origHtml && node.innerHTML !== origHtml) {
        node.innerHTML = origHtml;
      }
    });

    if (currentChunkIndex !== -1 && chunks[currentChunkIndex]) {
      const chunk = chunks[currentChunkIndex];
      const pNode = pNodes[chunk.pIdx] as HTMLElement;

      if (pNode) {
        if (charIndex >= 0 && charLength > 0) {
          const wordText = chunk.text.substring(charIndex, charIndex + charLength);
          let offset = charIndex;
          let length = charLength;
          const match = wordText.match(/[^\s.,!?:;'"(){}\[\]“”‘’\-–—]+/);
          if (match && match.index !== undefined) {
            offset = charIndex + match.index;
            length = match[0].length;
          } else {
            length = 0;
          }

          highlightText(
            pNode,
            chunk.startOffset + offset,
            length,
            'msreadout-word-highlight bg-yellow-400 text-black box-decoration-clone rounded-sm px-0.5 mx-[-2px]'
          );
        }

        const highlight =
          pNode.querySelector('.msreadout-word-highlight') || pNode.querySelector('.msreadout-line-highlight');
        if (highlight && Date.now() - lastInteractionTime.current > 3000) {
          const rect = highlight.getBoundingClientRect();
          if (rect.top < 120 || rect.bottom > window.innerHeight - 120) {
            highlight.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }
      }
    }
  }, [currentChunkIndex, charIndex, charLength, paragraphs, chunks]);

  useEffect(() => {
    return () => {
      stopReading();
    };
  }, []);

  const playChunkViaBrowser = (index: number, startOffset: number = 0, sessionId: number) => {
    if (!synth || !isPlayingRef.current || playSessionIdRef.current !== sessionId) return;
    if (index >= chunks.length) {
      stopReading();
      return;
    }

    currentChunkIdxRef.current = index;
    setCurrentChunkIndex(index);
    setCharIndex(startOffset);
    setCharLength(0);

    const chunk = chunks[index];
    const textToSpeak = startOffset > 0 ? chunk.text.substring(startOffset) : chunk.text;

    if (!textToSpeak.trim()) {
      playChunkViaBrowser(index + 1, 0, sessionId);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.rate = speechRate;

    const voices = synth.getVoices();
    const selectedVoice = voices.find((v) => v.voiceURI === voiceUri || v.name === voiceUri);
    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }

    utterance.onboundary = (e) => {
      if (playSessionIdRef.current !== sessionId) return;
      if (e.name === 'word') {
        setCharIndex(startOffset + e.charIndex);
        setCharLength(e.charLength);
      }
    };

    utterance.onend = () => {
      if (playSessionIdRef.current !== sessionId) return;
      if (isPlayingRef.current && !isPausedRef.current) {
        playChunk(index + 1, 0);
      }
    };

    utterance.onerror = (e) => {
      if (playSessionIdRef.current !== sessionId) return;
      if (e.error === 'canceled') return;
      console.warn('Browser SpeechSynthesis error:', e.error);
      if (isPlayingRef.current && !isPausedRef.current) {
        playChunk(index + 1, 0);
      }
    };

    utteranceRef.current = utterance;
    synth.speak(utterance);
  };

  const playChunkViaVieNeu = async (index: number, sessionId: number) => {
    if (!isPlayingRef.current || playSessionIdRef.current !== sessionId) return;
    if (index >= chunks.length) {
      stopReading();
      return;
    }

    currentChunkIdxRef.current = index;
    setCurrentChunkIndex(index);
    setCharIndex(0);
    setCharLength(chunks[index].text.length);

    const chunk = chunks[index];

    if (!chunk.text.trim()) {
      playChunkViaVieNeu(index + 1, sessionId);
      return;
    }

    try {
      stopAudioPlayer();
      const activeVoice = voiceUri || 'Minh Quân';
      const blob = await TTSService.synthesizeSpeech(chunk.text, activeVoice, speechRate, vieneuServerUrl);

      if (playSessionIdRef.current !== sessionId || !isPlayingRef.current) return;

      const audioUrl = TTSService.createAudioUrl(blob);
      activeAudioUrlRef.current = audioUrl;

      const audio = new Audio(audioUrl);
      audio.playbackRate = speechRate;
      audioRef.current = audio;

      audio.onended = () => {
        if (playSessionIdRef.current !== sessionId) return;
        TTSService.revokeAudioUrl(audioUrl);
        activeAudioUrlRef.current = null;
        if (isPlayingRef.current && !isPausedRef.current) {
          playChunk(index + 1, 0);
        }
      };

      audio.onerror = (err) => {
        console.warn('VieNeu Audio playback error, falling back to browser voice:', err);
        TTSService.revokeAudioUrl(audioUrl);
        activeAudioUrlRef.current = null;
        if (playSessionIdRef.current === sessionId) {
          playChunkViaBrowser(index, 0, sessionId);
        }
      };

      await audio.play();
    } catch (err) {
      console.warn('VieNeu TTS Synthesis failed, fallback to browser voice:', err);
      if (playSessionIdRef.current === sessionId) {
        playChunkViaBrowser(index, 0, sessionId);
      }
    }
  };

  const playChunk = (index: number, startOffset: number = 0) => {
    const sessionId = playSessionIdRef.current;
    if (ttsEngine === 'browser') {
      playChunkViaBrowser(index, startOffset, sessionId);
    } else {
      playChunkViaVieNeu(index, sessionId);
    }
  };

  const startReading = () => {
    const newSessionId = playSessionIdRef.current + 1;
    playSessionIdRef.current = newSessionId;

    if (isPaused) {
      setIsPaused(false);
      setIsPlaying(true);
      isPlayingRef.current = true;
      isPausedRef.current = false;

      if (audioRef.current) {
        audioRef.current.play().catch(() => playChunk(currentChunkIdxRef.current));
      } else {
        playChunk(currentChunkIdxRef.current);
      }
      return;
    }

    stopAudioPlayer();
    if (synth) synth.cancel();

    setIsPlaying(true);
    setIsPaused(false);
    isPlayingRef.current = true;
    isPausedRef.current = false;

    if (currentChunkIdxRef.current >= chunks.length) {
      currentChunkIdxRef.current = 0;
    }
    playChunk(currentChunkIdxRef.current);
  };

  const pauseReading = () => {
    setIsPlaying(false);
    setIsPaused(true);
    isPlayingRef.current = false;
    isPausedRef.current = true;

    if (audioRef.current) {
      audioRef.current.pause();
    }
    if (synth) {
      synth.pause();
    }
  };

  const nextSection = () => {
    lastInteractionTime.current = 0;
    if (currentChunkIdxRef.current < chunks.length - 1) {
      const nextIdx = currentChunkIdxRef.current + 1;
      stopAudioPlayer();
      if (synth) synth.cancel();

      setIsPlaying(true);
      setIsPaused(false);
      isPlayingRef.current = true;
      isPausedRef.current = false;
      playChunk(nextIdx);
    } else {
      stopReading();
    }
  };

  const prevSection = () => {
    lastInteractionTime.current = 0;
    if (currentChunkIdxRef.current > 0) {
      const prevIdx = currentChunkIdxRef.current - 1;
      stopAudioPlayer();
      if (synth) synth.cancel();

      setIsPlaying(true);
      setIsPaused(false);
      isPlayingRef.current = true;
      isPausedRef.current = false;
      playChunk(prevIdx);
    } else {
      stopReading();
    }
  };

  const jumpToContent = (pIdx: number, textOffset: number = 0) => {
    let targetIndex = chunks.findIndex(
      (c) => c.pIdx === pIdx && textOffset >= c.startOffset && textOffset < c.startOffset + c.length
    );
    if (targetIndex === -1) {
      targetIndex = chunks.findIndex((c) => c.pIdx === pIdx);
    }

    if (targetIndex !== -1) {
      stopAudioPlayer();
      if (synth) synth.cancel();

      setIsPlaying(true);
      setIsPaused(false);
      isPlayingRef.current = true;
      isPausedRef.current = false;
      currentChunkIdxRef.current = targetIndex;
      playChunk(targetIndex, textOffset);
    }
  };

  return {
    isPlaying,
    isPaused,
    currentChunkIndex,
    startReading,
    pauseReading,
    stopReading,
    nextSection,
    prevSection,
    jumpToContent,
  };
}
