import { useEffect, useRef, useState } from 'react';
import { Mic, Square } from 'lucide-react';

export function AudioRecorder({ onRecorded, onMessage }: { onRecorded: (file: File) => void; onMessage: (message: string) => void }) {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);

  const cleanup = () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };

  useEffect(() => cleanup, []);

  const stop = () => {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
  };

  const start = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      onMessage('当前浏览器不支持直接录音，可以选择已有语音文件');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const preferred = MediaRecorder.isTypeSupported?.('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : '';
      const recorder = new MediaRecorder(stream, preferred ? { mimeType: preferred } : undefined);
      chunksRef.current = [];
      streamRef.current = stream;
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => event.data.size && chunksRef.current.push(event.data);
      recorder.onstop = () => {
        const type = recorder.mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type });
        onRecorded(new File([blob], `雪梨-语音-${Date.now()}.webm`, { type }));
        setRecording(false);
        cleanup();
      };
      recorder.start();
      setSeconds(0);
      setRecording(true);
      timerRef.current = window.setInterval(() => {
        setSeconds((value) => {
          if (value >= 299) stop();
          return value + 1;
        });
      }, 1000);
    } catch {
      cleanup();
      onMessage('没有获得麦克风权限，录音未开始');
    }
  };

  return <button className={`record-button ${recording ? 'recording' : ''}`} type="button" onClick={recording ? stop : start} aria-label={recording ? '停止录音' : '开始录音'}>
    {recording ? <Square size={16} /> : <Mic size={18} />}
    <span>{recording ? `停止 ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}` : '直接录音'}</span>
  </button>;
}
