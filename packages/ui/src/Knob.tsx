import { useRef, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import styles from "./Knob.module.css";

export interface KnobProps {
  label: string;
  value: number;       // 0..1
  onChange?: (value: number) => void;
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function Knob({ label, value, onChange }: KnobProps) {
  const drag = useRef<{ pointerId: number; y: number; value: number } | null>(null);
  const safeValue = clamp(value);
  const angle = (safeValue - 0.5) * 270;
  const style = { ["--angle" as string]: `${angle}deg` } as CSSProperties;

  const updateFromKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!onChange) return;
    const step = e.shiftKey ? 0.01 : 0.05;
    let next: number | null = null;
    if (e.key === "ArrowUp" || e.key === "ArrowRight") next = safeValue + step;
    else if (e.key === "ArrowDown" || e.key === "ArrowLeft") next = safeValue - step;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = 1;
    if (next === null) return;
    e.preventDefault();
    onChange(clamp(next));
  };

  const updateFromPointer = (e: PointerEvent<HTMLDivElement>) => {
    if (!onChange || !drag.current || drag.current.pointerId !== e.pointerId) return;
    if (!Number.isFinite(e.clientY)) return;
    onChange(clamp(drag.current.value + (drag.current.y - e.clientY) / 120));
  };

  return (
    <div className={styles.cell}>
      <div
        className={`${styles.knob} ${onChange ? styles.interactive : ""}`}
        style={style}
        role="slider"
        tabIndex={onChange ? 0 : -1}
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(safeValue * 100)}
        onKeyDown={updateFromKey}
        onPointerDown={(e) => {
          if (!onChange || (e.pointerType === "mouse" && e.button !== 0)) return;
          if (!Number.isFinite(e.clientY)) return;
          e.preventDefault();
          e.currentTarget.setPointerCapture?.(e.pointerId);
          drag.current = { pointerId: e.pointerId, y: e.clientY, value: safeValue };
        }}
        onPointerMove={updateFromPointer}
        onPointerUp={(e) => {
          updateFromPointer(e);
          if (drag.current?.pointerId === e.pointerId) drag.current = null;
        }}
        onPointerCancel={(e) => {
          if (drag.current?.pointerId === e.pointerId) drag.current = null;
        }}
      />
      <div className={styles.label}>{label}</div>
    </div>
  );
}
