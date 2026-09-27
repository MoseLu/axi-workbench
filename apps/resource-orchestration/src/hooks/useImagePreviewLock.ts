import { useEffect } from "react";

export interface ImagePreviewLockOptions {
  /** Whether the preview overlay is currently mounted. */
  open: boolean;
  onClose: () => void;
  onMove: (delta: number) => void;
}

/**
 * Lock document scroll and route Escape / ArrowLeft / ArrowRight keypresses
 * while the image preview modal is open. Safe under React 19 StrictMode
 * because each effect captures `previousOverflow` afresh and restores it.
 */
export const useImagePreviewLock = ({ open, onClose, onMove }: ImagePreviewLockOptions): void => {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft") onMove(-1);
      if (event.key === "ArrowRight") onMove(1);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose, onMove]);
};
