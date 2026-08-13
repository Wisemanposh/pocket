import { useState } from "react";
import { Pad } from "./Pad";
import styles from "./MelodyPadRow.module.css";

export interface MelodyPadRowProps {
  labels: string[];
  litIndex?: number;
  onPress: (index: number) => void;
  onRelease: (index: number) => void;
}

export function MelodyPadRow({ labels, litIndex, onPress, onRelease }: MelodyPadRowProps) {
  const [litPositions, setLitPositions] = useState<Set<number>>(() => new Set());
  return (
    <div className={styles.row}>
      {labels.map((label, i) => (
        <Pad
          key={`${label}-${i}`}
          label={label}
          lit={litIndex === i || litPositions.has(i)}
          onPress={() => {
            setLitPositions((current) => new Set(current).add(i));
            onPress(i);
          }}
          onRelease={() => {
            setLitPositions((current) => {
              const next = new Set(current);
              next.delete(i);
              return next;
            });
            onRelease(i);
          }}
        />
      ))}
    </div>
  );
}
