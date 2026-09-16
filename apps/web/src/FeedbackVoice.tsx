import { useEffect, useRef, useState } from 'react';
import {
  feedbackLimits,
  FeedbackAudioSchema,
  type FeedbackAudio,
} from '@fingent360/contracts';
import { Icon } from './ui';

export function VoiceFeedback({
  value,
  onChange,
  onRecording,
}: {
  value: FeedbackAudio | null;
  onChange: (value: FeedbackAudio | null) => void;
  onRecording: (active: boolean) => void;
}) {
  const [state, setState] = useState<
    'idle' | 'permission' | 'recording' | 'processing'
  >('idle');
  const [seconds, setSeconds] = useState(0),
    [error, setError] = useState('');
  const recorder = useRef<MediaRecorder | null>(null),
    stream = useRef<MediaStream | null>(null),
    nativeRecording = useRef(false),
    nativePending = useRef(false);
  const alive = useRef(true),
    generation = useRef(0),
    started = useRef(0),
    discard = useRef(false),
    encoding = useRef(false);
  const change = useRef(onChange),
    recording = useRef(onRecording);
  change.current = onChange;
  recording.current = onRecording;
  function stop(remove = false) {
    if (
      window.FingentIOS &&
      (nativeRecording.current || nativePending.current || encoding.current)
    ) {
      if (encoding.current && !remove) return;
      const bridge = window.FingentIOS;
      const request = generation.current;
      if (remove || nativePending.current) {
        generation.current++;
        nativeRecording.current = false;
        nativePending.current = false;
        encoding.current = false;
        recording.current(false);
        if (alive.current) setState('idle');
        void bridge.cancelFeedbackAudio().catch(() => {});
        return;
      }
      nativeRecording.current = false;
      encoding.current = true;
      if (alive.current) setState('processing');
      void bridge
        .stopFeedbackAudio()
        .then((raw) => {
          const audio = FeedbackAudioSchema.parse(raw);
          if (alive.current && generation.current === request)
            change.current(audio);
        })
        .catch((failure) => {
          if (alive.current && generation.current === request)
            setError(
              failure instanceof Error
                ? failure.message
                : 'Native recording was interrupted. Record again or type.',
            );
        })
        .finally(() => {
          if (generation.current === request) {
            encoding.current = false;
            recording.current(false);
            if (alive.current) setState('idle');
          }
        });
      return;
    }
    if (encoding.current && !remove) return;
    const active = recorder.current?.state === 'recording';
    if (remove || !active) generation.current++;
    discard.current = remove;
    if (active) {
      encoding.current = !remove;
      if (!remove && alive.current) setState('processing');
      recorder.current!.stop();
    }
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    if (remove || !active) {
      encoding.current = false;
      recording.current(false);
      if (alive.current) setState('idle');
    }
  }
  useEffect(() => {
    alive.current = true;
    const background = () => {
      if (document.hidden) stop();
    };
    const pause = () => stop();
    document.addEventListener('visibilitychange', background);
    window.addEventListener('f360-pause', pause);
    window.addEventListener('f360-feedback-stop-voice', pause);
    const timer = window.setInterval(() => {
      if (recorder.current?.state === 'recording' || nativeRecording.current) {
        setSeconds(Math.floor((performance.now() - started.current) / 1000));
        if (performance.now() - started.current >= feedbackLimits.audioMs)
          stop();
      }
    }, 250);
    return () => {
      alive.current = false;
      stop(true);
      clearInterval(timer);
      document.removeEventListener('visibilitychange', background);
      window.removeEventListener('f360-pause', pause);
      window.removeEventListener('f360-feedback-stop-voice', pause);
    };
  }, []);
  async function start() {
    setError('');
    discard.current = false;
    const request = ++generation.current;
    if (window.FingentIOS) {
      nativePending.current = true;
      setState('permission');
      recording.current(true);
      try {
        const result = await window.FingentIOS.startFeedbackAudio();
        if (!alive.current || generation.current !== request) {
          await window.FingentIOS.cancelFeedbackAudio();
          return;
        }
        if (!result.recording) throw Error('Native microphone did not start.');
        nativePending.current = false;
        nativeRecording.current = true;
        started.current = performance.now();
        setSeconds(0);
        setState('recording');
      } catch (failure) {
        if (alive.current && generation.current === request) {
          nativePending.current = false;
          nativeRecording.current = false;
          recording.current(false);
          setState('idle');
          setError(
            failure instanceof Error
              ? failure.message
              : 'Native microphone could not start.',
          );
        }
      }
      return;
    }
    if (
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === 'undefined'
    ) {
      setError(
        'Voice recording is unavailable here. Use HTTPS or the Android app, or type your feedback.',
      );
      return;
    }
    setState('permission');
    recording.current(true);
    try {
      const input = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });
      if (!alive.current || request !== generation.current) {
        input.getTracks().forEach((track) => track.stop());
        return;
      }
      stream.current = input;
      const type = [
        'audio/webm;codecs=opus',
        'audio/mp4',
        'audio/ogg;codecs=opus',
      ].find((value) => MediaRecorder.isTypeSupported(value));
      if (!type)
        throw Error(
          'This browser has no supported voice recording format. Please type your feedback.',
        );
      const media = new MediaRecorder(input, {
        mimeType: type,
        audioBitsPerSecond: 64000,
      });
      recorder.current = media;
      const startedAt = performance.now();
      const finish = () => {
        if (!alive.current || request !== generation.current) return;
        encoding.current = false;
        recording.current(false);
        setState('idle');
      };
      const chunks: Blob[] = [];
      let size = 0;
      media.ondataavailable = (event) => {
        if (request !== generation.current || !alive.current) return;
        if (event.data.size) {
          chunks.push(event.data);
          size += event.data.size;
        }
        if (size > feedbackLimits.audioBytes) {
          stop(true);
          setError(
            'Recording reached the size limit. Try a shorter voice note.',
          );
        }
      };
      media.onerror = () => {
        if (request !== generation.current || !alive.current) return;
        stop(true);
        setError(
          'The microphone stopped unexpectedly. Record again or type your feedback.',
        );
      };
      media.onstop = () => {
        const durationMs = Math.min(
          feedbackLimits.audioMs,
          Math.max(1, Math.round(performance.now() - startedAt)),
        );
        input.getTracks().forEach((track) => track.stop());
        if (stream.current === input) stream.current = null;
        if (!alive.current || request !== generation.current) return;
        if (discard.current || !size) {
          finish();
          return;
        }
        encoding.current = true;
        setState('processing');
        const reader = new FileReader();
        reader.onload = () => {
          if (
            alive.current &&
            request === generation.current &&
            !discard.current
          )
            change.current({
              mime: type.split(';')[0] as FeedbackAudio['mime'],
              base64: String(reader.result).split(',')[1]!,
              durationMs,
            });
          finish();
        };
        reader.onerror = () => {
          if (alive.current && request === generation.current)
            setError(
              'The recording could not be prepared. Please record again.',
            );
          finish();
        };
        reader.readAsDataURL(new Blob(chunks, { type }));
      };
      started.current = startedAt;
      setSeconds(0);
      setState('recording');
      media.start(500);
    } catch (e) {
      if (request !== generation.current || !alive.current) return;
      stop(true);
      if (alive.current)
        setError(
          e instanceof DOMException &&
            (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError')
            ? 'Microphone permission was not granted. Enable it in browser/app settings, or type your feedback.'
            : e instanceof Error
              ? e.message
              : 'Could not start the microphone.',
        );
    }
  }
  return (
    <div className="feedback-voice">
      {value && state === 'idle' ? (
        <>
          <audio
            controls
            src={`data:${value.mime};base64,${value.base64}`}
            aria-label="Recorded feedback"
          />
          <button
            type="button"
            className="text-button"
            onClick={() => onChange(null)}
          >
            Remove voice note
          </button>
        </>
      ) : state === 'idle' ? (
        <button
          type="button"
          className="feedback-record secondary"
          onClick={() => void start()}
        >
          <Icon name="microphone" /> Record voice feedback{' '}
          <small>Up to 2 minutes</small>
        </button>
      ) : (
        <div className="feedback-recording">
          <span role="status">
            {state === 'permission'
              ? 'Allow microphone access to begin…'
              : state === 'processing'
                ? 'Preparing voice note…'
                : `Recording ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`}
          </span>
          {state === 'recording' && (
            <span className="feedback-wave" aria-hidden="true">
              ▂ ▆ ▃ █ ▅ ▂
            </span>
          )}
          <button type="button" onClick={() => stop(state !== 'recording')}>
            {state === 'permission'
              ? 'Cancel microphone request'
              : state === 'processing'
                ? 'Discard voice note'
                : 'Stop recording'}
          </button>
        </div>
      )}
      <p className="feedback-hint">
        A voice note is sent as audio. You can listen to it before submitting.
      </p>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
