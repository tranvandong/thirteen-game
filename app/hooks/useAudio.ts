import { useEffect, useRef, useCallback } from "react";

export function useAudio(url: string, volume = 0.5) {
  const audioContextRef = useRef<AudioContext | null>(null);
  const bufferRef = useRef<AudioBuffer | null>(null);

  useEffect(() => {
    const context = new AudioContext();
    audioContextRef.current = context;

    fetch(url)
      .then((res) => res.arrayBuffer())
      .then((arrayBuffer) => context.decodeAudioData(arrayBuffer))
      .then((buffer) => {
        bufferRef.current = buffer;
      });

    return () => {
      context.close();
    };
  }, [url]);

  const play = useCallback(async () => {
    const context = audioContextRef.current;
    const buffer = bufferRef.current;

    if (!context || !buffer) return;

    // Chrome/Safari yêu cầu resume sau khi user tương tác
    if (context.state === "suspended") {
      await context.resume();
    }

    const source = context.createBufferSource();
    source.buffer = buffer;

    const gain = context.createGain();
    gain.gain.value = volume;

    source.connect(gain);
    gain.connect(context.destination);

    source.start(0);
  }, [volume]);

  return { play };
}