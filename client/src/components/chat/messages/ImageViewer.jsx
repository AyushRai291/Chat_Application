import React, { useEffect } from "react";
import { createPortal } from "react-dom";

export default function ImageViewer({ image, onClose }) {
  useEffect(() => {
    if (!image) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [image, onClose]);

  if (!image) return null;

  return createPortal(
    <div
      className="aurora-image-viewer"
      role="dialog"
      aria-modal="true"
      aria-label="Image preview"
      onClick={onClose}
    >
      <div
        className="aurora-image-viewer__topbar"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="aurora-image-viewer__title">{image.name}</p>

        <div className="aurora-image-viewer__actions">
          <a
            href={image.url}
            target="_blank"
            rel="noreferrer"
            className="aurora-image-viewer__btn"
          >
            Open
          </a>

          <a
            href={image.url}
            download={image.name}
            className="aurora-image-viewer__btn"
          >
            Download
          </a>

          <button
            type="button"
            className="aurora-image-viewer__close"
            onClick={onClose}
            aria-label="Close image preview"
          >
            {"\u00D7"}
          </button>
        </div>
      </div>

      <div className="aurora-image-viewer__stage">
        <img
          src={image.url}
          alt={image.name}
          className="aurora-image-viewer__img"
          onClick={(event) => event.stopPropagation()}
        />
      </div>
    </div>,
    document.body,
  );
}
