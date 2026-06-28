import { useCallback, useEffect, useRef, useState } from "react";

export function useVoiceRecorder() {
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);

  const [recording, setRecording] = useState(false);
  const [recordedFile, setRecordedFile] = useState(null);
  const [recordedUrl, setRecordedUrl] = useState("");
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordingError, setRecordingError] = useState("");

  const clearRecording = useCallback(() => {
    setRecordedFile(null);
    setRecordingError("");
    setRecordingSeconds(0);

    setRecordedUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return "";
    });
  }, []);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startRecording = useCallback(async () => {
    if (recording) return;

    clearRecording();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const mimeType = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "";

      const recorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : undefined,
      );

      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data?.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });

        if (blob.size > 0) {
          const file = new File([blob], `voice-${Date.now()}.webm`, {
            type: blob.type || "audio/webm",
          });

          const url = URL.createObjectURL(file);
          setRecordedFile(file);
          setRecordedUrl(url);
        }

        chunksRef.current = [];
        stopStream();
        stopTimer();
        setRecording(false);
      };

      recorder.start();
      setRecording(true);
      setRecordingSeconds(0);

      timerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      setRecordingError(
        err?.message || "Microphone permission denied or unavailable.",
      );
      setRecording(false);
      stopStream();
      stopTimer();
    }
  }, [clearRecording, recording, stopStream, stopTimer]);

  const stopRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;

    if (!recorder || recorder.state === "inactive") {
      setRecording(false);
      stopStream();
      stopTimer();
      return;
    }

    recorder.stop();
  }, [stopStream, stopTimer]);

  const cancelRecording = useCallback(() => {
    chunksRef.current = [];

    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.onstop = null;
      recorder.stop();
    }

    setRecording(false);
    stopStream();
    stopTimer();
    clearRecording();
  }, [clearRecording, stopStream, stopTimer]);

  useEffect(() => {
    return () => {
      cancelRecording();
      setRecordedUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return "";
      });
    };
  }, [cancelRecording]);

  return {
    recording,
    recordedFile,
    recordedUrl,
    recordingSeconds,
    recordingError,
    startRecording,
    stopRecording,
    cancelRecording,
    clearRecording,
  };
}

export function formatRecordingTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;

  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}