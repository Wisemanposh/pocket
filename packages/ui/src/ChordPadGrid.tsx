import { useState } from "react";
import { Pad } from "./Pad";
import styles from "./ChordPadGrid.module.css";

export interface ChordPadGridProps {
  mode: "major" | "minor";
  /** Called with the music-theory degree (0..6) and whether to add a 7th. */
  onPress: (degree: number, seventh: boolean) => void;
  onRelease: (degree: number, seventh: boolean) => void;
}

const LABELS: Record<"major" | "minor", ReadonlyArray<{ label: string; degree: number; seventh: boolean }>> = {
  major: [
    { label: "I", degree: 0, seventh: false },
    { label: "ii", degree: 1, seventh: false },
    { label: "iii", degree: 2, seventh: false },
    { label: "IV", degree: 3, seventh: false },
    { label: "V", degree: 4, seventh: false },
    { label: "vi", degree: 5, seventh: false },
    { label: "viio", degree: 6, seventh: false },
    { label: "V7", degree: 4, seventh: true },
  ],
  minor: [
    { label: "i", degree: 0, seventh: false },
    { label: "iio", degree: 1, seventh: false },
    { label: "III", degree: 2, seventh: false },
    { label: "iv", degree: 3, seventh: false },
    { label: "v", degree: 4, seventh: false },
    { label: "VI", degree: 5, seventh: false },
    { label: "VII", degree: 6, seventh: false },
    { label: "V7", degree: 4, seventh: true },
  ],
};

export function ChordPadGrid({ mode, onPress, onRelease }: ChordPadGridProps) {
  const items = LABELS[mode];
  // Lit state is owned here so V and V7 (which share degree=4) light independently.
  const [litPositions, setLitPositions] = useState<Set<number>>(() => new Set());
  return (
    <div className={styles.grid}>
      {items.map(({ label, degree, seventh }, i) => (
        <Pad
          key={`${label}-${i}`}
          label={label}
          lit={litPositions.has(i)}
          variant="chord"
          onPress={() => {
            setLitPositions((current) => new Set(current).add(i));
            onPress(degree, seventh);
          }}
          onRelease={() => {
            setLitPositions((current) => {
              const next = new Set(current);
              next.delete(i);
              return next;
            });
            onRelease(degree, seventh);
          }}
        />
      ))}
    </div>
  );
}
