import { useState, useEffect, useRef, useMemo } from 'react';
import { useReaderSettings } from '../contexts/ReaderContext';

interface Chunk {
  pIdx: number;
  text: string;
  startOffset: number;
  length: number;
}

function highlightText(rootElement: HTMLElement, startOffset: number, length: number, className: string) {
  if (length <= 0) return;
  
  const walker = document.createTreeWalker(rootElement, NodeFilter.SHOW_TEXT, null);
  let node;
  let currentOffset = 0;
  const targetNodes = [];

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
  const { voiceUri, speechRate } = useReaderSettings();
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentChunkIndex, setCurrentChunkIndex] = useState(-1);
  const [charIndex, setCharIndex] = useState(-1);
  const [charLength, setCharLength] = useState(0);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  
  const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  
  const currentChunkIdxRef = useRef<number>(0);
  const isPlayingRef = useRef(false);
  const isPausedRef = useRef(false);
  const currentUtteranceIdRef = useRef<number | null>(null);

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
          length: text.length
        });
      }
    });
    return res;
  }, [paragraphs]);

  useEffect(() => {
    stopReading();
  }, [paragraphs]);

  const lastInteractionTime = useRef(0);

  useEffect(() => {
    const onInteraction = () => { lastInteractionTime.current = Date.now(); };
    window.addEventListener('wheel', onInteraction, {passive: true});
    window.addEventListener('touchmove', onInteraction, {passive: true});
    window.addEventListener('mousedown', onInteraction, {passive: true});
    window.addEventListener('keydown', onInteraction, {passive: true});
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
    
    // Get all paragraph div elements inside article
    const pNodes = Array.from(article.querySelectorAll(':scope > div.mb-4'));
    if (pNodes.length === 0) return;

    // Reset innerHTML for active reading changes to clear previous highlights
    pNodes.forEach((node, idx) => {
      // Restore original innerHTML to clean up injected msreadoutspans
      // Only check if there's a difference to avoid unnecessary reflows
      const origHtml = paragraphs[idx] || '';
      if (origHtml && node.innerHTML !== origHtml) {
        node.innerHTML = origHtml;
      }
    });

    if (currentChunkIndex !== -1 && chunks[currentChunkIndex]) {
      const chunk = chunks[currentChunkIndex];
      const pNode = pNodes[chunk.pIdx] as HTMLElement;

      if (pNode) {
        // Just highlight the active word
        if (charIndex >= 0 && charLength > 0) {
          const wordText = chunk.text.substring(charIndex, charIndex + charLength);
          let offset = charIndex;
          let length = charLength;
          // Match the first alphanumeric part to skip leading/trailing punctuation/spaces
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
        
        // Scroll into view logic - smoothly glide along the reader's document
        const highlight = pNode.querySelector('.msreadout-word-highlight') || pNode.querySelector('.msreadout-line-highlight');
        if (highlight && Date.now() - lastInteractionTime.current > 3000) {
          const rect = highlight.getBoundingClientRect();
          if (rect.top < 120 || rect.bottom > window.innerHeight - 120) {
            highlight.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }
      }
    }
  }, [currentChunkIndex, charIndex, charLength, paragraphs, chunks]);

  // Clean-up totally on unmount
  useEffect(() => {
    return () => {
      const article = document.querySelector('article');
      if (!article) return;
      const pNodes = Array.from(article.querySelectorAll(':scope > div.mb-4'));
      pNodes.forEach((node, idx) => {
        const origHtml = paragraphs[idx] || '';
        if (origHtml && node.innerHTML !== origHtml) {
          node.innerHTML = origHtml;
        }
      });
      stopReading();
    };
  }, [paragraphs]);

  useEffect(() => {
    if (!synth) return;

    const loadVoices = () => {
      const allVoices = synth.getVoices();
      const viVoices = allVoices.filter(v => v.lang.includes('vi') || v.lang.includes('vi-VN'));
      setVoices(viVoices);
    };

    loadVoices();
    synth.onvoiceschanged = loadVoices;

    return () => {
      isPlayingRef.current = false;
      isPausedRef.current = false;
      synth.cancel();
      synth.onvoiceschanged = null;
    };
  }, [synth]);

  const prevSettingsRef = useRef({ voiceUri, speechRate });
  const isSettingsChangingRef = useRef(false);

  const utteranceOffsetRef = useRef(0);

  useEffect(() => {
    if (prevSettingsRef.current.voiceUri !== voiceUri || prevSettingsRef.current.speechRate !== speechRate) {
      prevSettingsRef.current = { voiceUri, speechRate };
      
      if (isPlayingRef.current && synth) {
        isSettingsChangingRef.current = true;
        synth.cancel(); // Stop current playing utterance
        
        // Resume playing after a short delay to allow cancel to finish
        setTimeout(() => {
          isSettingsChangingRef.current = false;
          playChunk(currentChunkIdxRef.current, utteranceOffsetRef.current);
        }, 100);
      }
    }
  }, [voiceUri, speechRate, synth]);

  const playChunk = (index: number, startOffset: number = 0) => {
    if (!synth || !isPlayingRef.current) return;
    if (index >= chunks.length) {
      setIsPlaying(false);
      setIsPaused(false);
      isPlayingRef.current = false;
      isPausedRef.current = false;
      setCurrentChunkIndex(-1);
      currentChunkIdxRef.current = 0;
      return;
    }

    currentChunkIdxRef.current = index;
    utteranceOffsetRef.current = startOffset;
    setCurrentChunkIndex(index);
    setCharIndex(startOffset);
    setCharLength(0);
    
    const chunk = chunks[index];
    const textToSpeak = startOffset > 0 ? chunk.text.substring(startOffset) : chunk.text;
    
    if (!textToSpeak.trim()) {
      playChunk(index + 1, 0);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.rate = speechRate;
    
    const selectedVoice = voices.find(v => v.voiceURI === voiceUri) || voices[0];
    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }

    const utteranceId = Date.now() + Math.random();
    currentUtteranceIdRef.current = utteranceId;

    utterance.onboundary = (e) => {
      if (currentUtteranceIdRef.current !== utteranceId) return;
      if (e.name === 'word') {
        const absoluteIndex = startOffset + e.charIndex;
        setCharIndex(absoluteIndex);
        setCharLength(e.charLength);
        utteranceOffsetRef.current = absoluteIndex;
      }
    };

    utterance.onend = () => {
      if (currentUtteranceIdRef.current !== utteranceId) return;
      if (isPlayingRef.current && !isPausedRef.current && !isSettingsChangingRef.current) {
        playChunk(index + 1, 0);
      }
    };

    utterance.onerror = (e) => {
      if (currentUtteranceIdRef.current !== utteranceId) return;
      if (e.error !== 'canceled' && !isSettingsChangingRef.current) {
        console.error('Speech synthesis error on chunk', index, e);
        if (isPlayingRef.current && !isPausedRef.current) {
          playChunk(index + 1);
        }
      }
    };

    utterance.onpause = () => {
      if (currentUtteranceIdRef.current !== utteranceId) return;
      setIsPaused(true);
      setIsPlaying(false);
      isPausedRef.current = true;
      isPlayingRef.current = false;
    };

    utterance.onresume = () => {
      if (currentUtteranceIdRef.current !== utteranceId) return;
      setIsPaused(false);
      setIsPlaying(true);
      isPausedRef.current = false;
      isPlayingRef.current = true;
    };

    utteranceRef.current = utterance;
    synth.speak(utterance);
  };

  const startReading = () => {
    if (!synth) return;

    if (isPaused) {
      if (synth.paused) {
        synth.resume(); // Safari requires this before cancel to truly clear paused state
      }
      setIsPaused(false);
      setIsPlaying(true);
      isPausedRef.current = false;
      isPlayingRef.current = true;
      synth.cancel();
      setTimeout(() => {
        if (isPlayingRef.current && !isPausedRef.current) {
          playChunk(currentChunkIdxRef.current, utteranceOffsetRef.current);
        }
      }, 50);
      return;
    }
    
    synth.cancel();
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
    currentUtteranceIdRef.current = null; // Unbind events so onend/onerror don't skip chunks
    if (synth) {
      synth.pause(); // Standard pause (for desktop)
      setTimeout(() => {
        synth.cancel(); // Convert to cancel to avoid broken resume on mobile
      }, 10);
    }
  };

  const stopReading = () => {

    setIsPlaying(false);
    setIsPaused(false);
    isPlayingRef.current = false;
    isPausedRef.current = false;
    if (synth) synth.cancel();
    currentChunkIdxRef.current = 0;
    setCurrentChunkIndex(-1);
    setCharIndex(-1);
    setCharLength(0);
  };

  const nextSection = () => {
    if (!synth) return;
    
    // Force scroll logic to run
    lastInteractionTime.current = 0;

    if (currentChunkIdxRef.current < chunks.length - 1) {
      const nextIdx = currentChunkIdxRef.current + 1;
      currentUtteranceIdRef.current = null;
      synth.cancel();
      setIsPlaying(true);
      setIsPaused(false);
      isPlayingRef.current = true;
      isPausedRef.current = false;
      playChunk(nextIdx);
    } else {
      stopReading();
    }
  };

  const jumpToContent = (pIdx: number, textOffset: number) => {
    if (!synth) return;
    let targetIndex = chunks.findIndex(c => c.pIdx === pIdx && textOffset >= c.startOffset && textOffset < c.startOffset + c.length);
    if (targetIndex === -1) {
      targetIndex = chunks.findIndex(c => c.pIdx === pIdx);
    }
    
    if (targetIndex !== -1) {
      currentUtteranceIdRef.current = null; // Invalidate any old ones immediately
      synth.cancel();
      setIsPlaying(true);
      setIsPaused(false);
      isPlayingRef.current = true;
      isPausedRef.current = false;
      currentChunkIdxRef.current = targetIndex;
      setTimeout(() => {
        if (isPlayingRef.current && !isPausedRef.current) {
          playChunk(targetIndex, textOffset);
        }
      }, 50);
    }
  };

  return {
    isPlaying,
    isPaused,
    startReading,
    pauseReading,
    stopReading,
    nextSection,
    jumpToContent
  };
}
