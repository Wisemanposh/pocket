import { useRef, useState } from "react";
import type { GridDivision } from "@pocket/model";
import { QuantSlider } from "./QuantSlider";
import styles from "./TimeStrip.module.css";

export interface TimeStripProps {
  metroOn: boolean;
  quantStrength: number;
  gridDivision: GridDivision;
  onToggleMetro: () => void;
  onCycleQuant: () => void;
  onCycleGrid: () => void;
  onQuantChange: (v: number) => void;
  onQuantCommit: (v: number) => void;
}

function formatQuant(strength: number): string {
  if (strength <= 0) return "OFF";
  return `${Math.round(strength * 100)}%`;
}

export function TimeStrip({
  metroOn, quantStrength, gridDivision,
  onToggleMetro, onCycleQuant, onCycleGrid,
  onQuantChange, onQuantCommit,
}: TimeStripProps) {
  const [slider, setSlider] = useState(false);
  const downPos = useRef({ x: 0, y: 0 });
  const longPress = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onPointerDown = (e: React.PointerEvent) => {
    downPos.current = { x: e.clientX, y: e.clientY };
    longPress.current = setTimeout(() => setSlider(true), 300);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const dx = Math.abs(e.clientX - downPos.current.x);
    const dy = Math.abs(e.clientY - downPos.current.y);
    if (dx + dy > 8 && longPress.current) {
      clearTimeout(longPress.current);
      longPress.current = null;
    }
  };
  const onPointerUp = () => {
    if (longPress.current) {
      clearTimeout(longPress.current);
      longPress.current = null;
      onCycleQuant();
    }
  };

  return (
    <div className={styles.strip}>
      <button
        type="button"
        className={`${styles.chip} ${metroOn ? styles.metroOn : ""}`}
        onClick={onToggleMetro}
        aria-label={`metro ${metroOn ? "on" : "off"}`}
      >
        ♩ METRO
      </button>
      <div style={{ position: "relative" }}>
        <button
          type="button"
          className={styles.chip}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          aria-label={`quant ${formatQuant(quantStrength)}`}
        >
          QUANT {formatQuant(quantStrength)}
        </button>
        {slider && (
          <QuantSlider
            value={quantStrength}
            onChange={onQuantChange}
            onCommit={(v) => { onQuantCommit(v); setSlider(false); }}
          />
        )}
      </div>
      <button
        type="button"
        className={styles.chip}
        onClick={onCycleGrid}
        aria-label={`grid ${gridDivision}`}
      >
        GRID {gridDivision}
      </button>
    </div>
  );
}
