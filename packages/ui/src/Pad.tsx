import { useEffect, useRef } from "react";
import styles from "./Pad.module.css";

export interface PadProps {
  label: string;
  lit?: boolean;
  variant?: "default" | "chord";
  onPress: () => void;
  onRelease: () => void;
}

export function Pad({ label, lit, variant = "default", onPress, onRelease }: PadProps) {
  const activePointers = useRef(new Set<number>());
  const keyboardActive = useRef(false);
  const onPressRef = useRef(onPress);
  const onReleaseRef = useRef(onRelease);
  onPressRef.current = onPress;
  onReleaseRef.current = onRelease;

  const releaseIfIdle = () => {
    if (activePointers.current.size === 0 && !keyboardActive.current) {
      onReleaseRef.current();
    }
  };

  useEffect(() => {
    const releaseAll = () => {
      const wasActive = activePointers.current.size > 0 || keyboardActive.current;
      activePointers.current.clear();
      keyboardActive.current = false;
      if (wasActive) onReleaseRef.current();
    };
    window.addEventListener("blur", releaseAll);
    const releaseWhenHidden = () => {
      if (document.hidden) releaseAll();
    };
    document.addEventListener("visibilitychange", releaseWhenHidden);
    return () => {
      window.removeEventListener("blur", releaseAll);
      document.removeEventListener("visibilitychange", releaseWhenHidden);
      releaseAll();
    };
  }, []);

  const cls = [
    styles.pad,
    variant === "chord" ? styles.chord : "",
    lit ? styles.lit : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type="button"
      className={cls}
      onPointerDown={(e) => {
        if (e.pointerType === "mouse" && e.button !== 0) return;
        e.preventDefault();
        // jsdom (test env) lacks setPointerCapture — guard so component is testable.
        e.currentTarget.setPointerCapture?.(e.pointerId);
        const wasIdle = activePointers.current.size === 0 && !keyboardActive.current;
        activePointers.current.add(e.pointerId);
        if (wasIdle) onPressRef.current();
      }}
      onPointerUp={(e) => {
        if (!activePointers.current.delete(e.pointerId)) return;
        releaseIfIdle();
      }}
      onPointerCancel={(e) => {
        if (!activePointers.current.delete(e.pointerId)) return;
        releaseIfIdle();
      }}
      onKeyDown={(e) => {
        if ((e.key !== " " && e.key !== "Enter") || e.repeat || keyboardActive.current) return;
        e.preventDefault();
        const wasIdle = activePointers.current.size === 0;
        keyboardActive.current = true;
        if (wasIdle) onPressRef.current();
      }}
      onKeyUp={(e) => {
        if ((e.key !== " " && e.key !== "Enter") || !keyboardActive.current) return;
        e.preventDefault();
        keyboardActive.current = false;
        releaseIfIdle();
      }}
      onBlur={() => {
        if (!keyboardActive.current) return;
        keyboardActive.current = false;
        releaseIfIdle();
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {label}
    </button>
  );
}
