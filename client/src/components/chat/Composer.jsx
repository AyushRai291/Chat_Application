import React, { useCallback, useEffect, useRef, useState } from "react";
import { useChat } from "../../context/ChatContext";
import { uploadService } from "../../services/uploadService";
import Spinner from "../ui/Spinner";
import { formatRecordingTime, useVoiceRecorder } from "./useVoiceRecorder";
import AttachmentPreview from "./composer/AttachmentPreview";
import {
  AttachIcon,
  MicIcon,
  SendIcon,
  StopIcon,
} from "./composer/ComposerIcons";
import ReplyPreviewBar from "./composer/ReplyPreviewBar";
import VoicePreview from "./composer/VoicePreview";

const TYPING_DEBOUNCE_MS = 1200;
const MAX_TEXTAREA_HEIGHT = 120;

export default function Composer() {
  const {
    sendMessage,
    selectedConversation,
    replyTarget,
    clearReplyTarget,
    startTyping,
    stopTyping,
  } = useChat();

  const [text, setText] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const {
    recording,
    recordedFile,
    recordedUrl,
    recordingSeconds,
    recordingError,
    startRecording,
    stopRecording,
    clearRecording,
  } = useVoiceRecorder();
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const isTypingRef = useRef(false);
  const stopTimerRef = useRef(null);
  const sentFromTouchRef = useRef(false);

  const conversationId = selectedConversation?._id;

  const resizeTextarea = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = "auto";

    const nextHeight = Math.min(textarea.scrollHeight, MAX_TEXTAREA_HEIGHT);
    textarea.style.height = `${nextHeight}px`;
    textarea.style.overflowY =
      textarea.scrollHeight > MAX_TEXTAREA_HEIGHT ? "auto" : "hidden";
  }, []);

  const clearStopTimer = useCallback(() => {
    if (stopTimerRef.current) {
      clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }
  }, []);

  const emitStop = useCallback(() => {
    if (!isTypingRef.current || !conversationId) return;

    stopTyping(conversationId);
    isTypingRef.current = false;
  }, [conversationId, stopTyping]);

  const emitStart = useCallback(() => {
    if (isTypingRef.current || !conversationId) return;

    startTyping(conversationId);
    isTypingRef.current = true;
  }, [conversationId, startTyping]);

  const scheduleStop = useCallback(() => {
    clearStopTimer();

    stopTimerRef.current = setTimeout(() => {
      emitStop();
    }, TYPING_DEBOUNCE_MS);
  }, [clearStopTimer, emitStop]);

  useEffect(() => {
    return () => {
      clearStopTimer();

      if (isTypingRef.current && conversationId) {
        stopTyping(conversationId);
        isTypingRef.current = false;
      }
    };
  }, [clearStopTimer, conversationId, stopTyping]);

  useEffect(() => {
    resizeTextarea();
  }, [resizeTextarea, text]);

  useEffect(() => {
    if (!replyTarget || !conversationId) return;

    const timer = window.setTimeout(() => {
      textareaRef.current?.focus();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [replyTarget, conversationId]);

  useEffect(() => {
    if (!selectedFile || !selectedFile.type.startsWith("image/")) {
      setFilePreviewUrl("");
      return undefined;
    }

    const previewUrl = URL.createObjectURL(selectedFile);
    setFilePreviewUrl(previewUrl);

    return () => URL.revokeObjectURL(previewUrl);
  }, [selectedFile]);

  const handleChange = (event) => {
    const value = event.target.value;
    setText(value);

    if (!conversationId) return;

    if (!value.trim()) {
      clearStopTimer();
      emitStop();
      return;
    }

    emitStart();
    scheduleStop();
  };

  const clearSelectedFile = () => {
    setSelectedFile(null);
    setUploadError("");

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0] || null;

    clearRecording();
    setSelectedFile(file);
    setUploadError("");
  };

  const handleSend = async () => {
    const cleanText = text.trim();
    const fileToSend = selectedFile || recordedFile;
    if (
      (!cleanText && !fileToSend) ||
      uploading ||
      recording ||
      !conversationId
    ) {
      return;
    }

    const oldReplyTarget = replyTarget;
    const oldSelectedFile = fileToSend;

    clearStopTimer();
    emitStop();

    let attachment = null;

    if (oldSelectedFile) {
      setUploading(true);
      setUploadError("");

      try {
        attachment = await uploadService.uploadAttachment({
          file: oldSelectedFile,
          conversationId,
        });
      } catch (err) {
        setUploadError(
          err?.response?.data?.message || err?.message || "File upload failed.",
        );
        setUploading(false);
        textareaRef.current?.focus({ preventScroll: true });
        return;
      } finally {
        setUploading(false);
      }
    }

    setText("");
    clearReplyTarget();
    clearSelectedFile();
    clearRecording();
    requestAnimationFrame(resizeTextarea);

    await sendMessage({
      text: cleanText,
      replyTo: oldReplyTarget?._id || null,
      attachments: attachment ? [attachment] : [],
    });

    requestAnimationFrame(resizeTextarea);
    textareaRef.current?.focus({ preventScroll: true });
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    handleSend();
  };

  const preventSendBlur = (event) => {
    if ((!text.trim() && !selectedFile) || uploading) return;
    event.preventDefault();
  };

  const handleSendTouchEnd = (event) => {
    if ((!text.trim() && !selectedFile) || uploading) return;

    event.preventDefault();
    sentFromTouchRef.current = true;
    handleSend();

    window.setTimeout(() => {
      sentFromTouchRef.current = false;
    }, 250);
  };

  const handleSendClick = () => {
    if (sentFromTouchRef.current) return;
    handleSend();
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  const handleBlur = () => {
    clearStopTimer();
    emitStop();
  };

  if (!selectedConversation) return null;
  const hasSendableContent = Boolean(
    text.trim() || selectedFile || recordedFile,
  );
  const isBusy = uploading;

  return (
    <div className="aurora-composer">
      <ReplyPreviewBar
        replyTarget={replyTarget}
        onCancel={clearReplyTarget}
      />

      <form className="aurora-composer__form" onSubmit={handleSubmit}>
        <AttachmentPreview
          selectedFile={selectedFile}
          filePreviewUrl={filePreviewUrl}
          onRemove={clearSelectedFile}
        />

        <VoicePreview
          recordedFile={recordedFile}
          recordedUrl={recordedUrl}
          onRemove={clearRecording}
        />

        {uploadError && (
          <p className="aurora-composer__error" role="alert">
            {uploadError}
          </p>
        )}

        {recordingError && (
          <p className="aurora-composer__error" role="alert">
            {recordingError}
          </p>
        )}

        <div className="aurora-composer__box">
          <input
            ref={fileInputRef}
            type="file"
            className="aurora-composer__file-input"
            onChange={handleFileChange}
            aria-label="Attach file"
          />

          <button
            type="button"
            className="aurora-composer__attach"
            onClick={() => fileInputRef.current?.click()}
            aria-label="Attach file"
            title="Attach file"
            disabled={isBusy}
          >
            <AttachIcon />
          </button>

          <button
            type="button"
            className="aurora-composer__mic"
            onClick={recording ? stopRecording : startRecording}
            aria-label={recording ? "Stop recording" : "Record voice message"}
            title={recording ? "Stop recording" : "Record voice message"}
            disabled={isBusy}
            data-recording={recording ? "true" : undefined}
          >
            {recording ? <StopIcon /> : <MicIcon />}
          </button>

          <textarea
            id="aurora-composer-input"
            ref={textareaRef}
            className="aurora-composer__textarea"
            value={text}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            placeholder={
              recording
                ? `Recording ${formatRecordingTime(recordingSeconds)}...`
                : "Write a message..."
            }
            aria-label="Type a message"
            rows={1}
          />

          <button
            type="button"
            className="aurora-composer__send"
            disabled={!hasSendableContent || isBusy}
            aria-label="Send message"
            title="Send message"
            onMouseDown={preventSendBlur}
            onTouchStart={preventSendBlur}
            onTouchEnd={handleSendTouchEnd}
            onClick={handleSendClick}
          >
            {isBusy ? <Spinner size={16} color="#fff" /> : <SendIcon />}
          </button>
        </div>

        <p className="aurora-composer__hint">
          {recording
            ? `Recording ${formatRecordingTime(recordingSeconds)} · tap stop to preview`
            : "Enter to send · Shift + Enter for new line"}
        </p>
      </form>
    </div>
  );
}
