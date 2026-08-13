import { useEffect, useRef } from "react";
import styles from "./QuantSlider.module.css";

export interface QuantSliderProps {
  value: number;                  // 0..1
  onChange: (v: number) => void;
  onCommit: (v: number) => void;
}

export function QuantSlider({ value, onChange, onCommit }: QuantSliderProps) {
  const ref = useRef<HTMLDivElement>(null);
  const valueRef = useRef(value);
  valueRef.current = value;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const handle = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      const y = Math.max(0, Math.min(rect.height, e.clientY - rect.top));
      const v = 1 - y / rect.height;
      onChange(Math.max(0, Math.min(1, v)));
    };
    const up = (e: PointerEvent) => {
      handle(e);
      onCommit(valueRef.current);
      window.removeEventListener("pointermove", handle);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", handle);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", handle);
      window.removeEventListener("pointerup", up);
    };
  }, [onChange, onCommit]);

  return (
    <div className={styles.slider}>
      <div className={styles.track} ref={ref}>
        <div className={styles.fill} style={{ height: `${Math.round(value * 100)}%` }} />
      </div>
      <div className={styles.value}>{Math.round(value * 100)}%</div>
    </div>
  );
}
