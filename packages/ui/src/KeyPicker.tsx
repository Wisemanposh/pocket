import type { KeyCenter, PitchClass } from "@pocket/model";
import styles from "./KeyPicker.module.css";

const NOTE_NAMES = ["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"];

export interface KeyPickerProps {
  value: KeyCenter;
  onChange: (k: KeyCenter) => void;
}

export function KeyPicker({ value, onChange }: KeyPickerProps) {
  return (
    <>
      <div className={styles.grid}>
        {NOTE_NAMES.map((n, i) => {
          const selected = value.root === (i as PitchClass);
          return (
            <button
              key={n}
              type="button"
              className={`${styles.root} ${selected ? styles.selected : ""}`}
              onClick={() => onChange({ root: i as PitchClass, mode: value.mode })}
            >
              {n}
            </button>
          );
        })}
      </div>
      <div className={styles.modes}>
        <button
          type="button"
          className={`${styles.modeBtn} ${value.mode === "major" ? styles.selected : ""}`}
          onClick={() => onChange({ ...value, mode: "major" })}
        >
          MAJ
        </button>
        <button
          type="button"
          className={`${styles.modeBtn} ${value.mode === "minor" ? styles.selected : ""}`}
          onClick={() => onChange({ ...value, mode: "minor" })}
        >
          MIN
        </button>
      </div>
    </>
  );
}
