import { useEffect, useRef } from "react";
import { TapTempo } from "./tap_tempo";
import styles from "./BpmPicker.module.css";

export interface BpmPickerProps {
  value: number;
  onChange: (bpm: number) => void;
}

export function BpmPicker({ value, onChange }: BpmPickerProps) {
  const tap = useRef(new TapTempo());
  const cleanupDrag = useRef<(() => void) | null>(null);

  useEffect(() => () => cleanupDrag.current?.(), []);

  const onTap = () => {
    const bpm = tap.current.tap(performance.now());
    if (bpm !== null) onChange(bpm);
  };

  const onValuePointerDown = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLDivElement).setPointerCapture?.(e.pointerId);
    const startY = e.clientY;
    const startVal = value;
    const move = (ev: PointerEvent) => {
      const dy = startY - ev.clientY;
      const next = Math.max(40, Math.min(240, startVal + Math.round(dy / 5)));
      onChange(next);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      cleanupDrag.current = null;
    };
    cleanupDrag.current?.();
    cleanupDrag.current = up;
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };

  return (
    <div className={styles.row}>
      <button type="button" className={styles.tap} onClick={onTap}>
        TAP
      </button>
      <div
        className={styles.value}
        onPointerDown={onValuePointerDown}
        role="spinbutton"
        tabIndex={0}
        aria-valuenow={value}
        aria-valuemin={40}
        aria-valuemax={240}
        aria-label="BPM"
        onKeyDown={(e) => {
          const step = e.shiftKey ? 10 : 1;
          if (e.key === "ArrowUp" || e.key === "ArrowRight") {
            e.preventDefault();
            onChange(Math.min(240, value + step));
          } else if (e.key === "ArrowDown" || e.key === "ArrowLeft") {
            e.preventDefault();
            onChange(Math.max(40, value - step));
          } else if (e.key === "Home") {
            e.preventDefault();
            onChange(40);
          } else if (e.key === "End") {
            e.preventDefault();
            onChange(240);
          }
        }}
      >
        {value}
      </div>
    </div>
  );
}
