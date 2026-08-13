import { Pad } from "./Pad";
import styles from "./MelodyPadRow.module.css";

export interface MelodyPadRowProps {
  labels: string[];
  litIndex?: number;
  onPress: (index: number) => void;
  onRelease: (index: number) => void;
}

export function MelodyPadRow({ labels, litIndex, onPress, onRelease }: MelodyPadRowProps) {
  return (
    <div className={styles.row}>
      {labels.map((label, i) => (
        <Pad
          key={`${label}-${i}`}
          label={label}
          lit={litIndex === i}
          onPress={() => onPress(i)}
          onRelease={() => onRelease(i)}
        />
      ))}
    </div>
  );
}
