import type { VoiceId } from "@pocket/model";
import styles from "./VoicePicker.module.css";

export interface VoiceOption {
  id: VoiceId;
  displayName: string;
}

export interface VoicePickerProps {
  voices: VoiceOption[];
  selectedId: VoiceId;
  onChange: (id: VoiceId) => void;
}

export function VoicePicker({ voices, selectedId, onChange }: VoicePickerProps) {
  return (
    <div className={styles.list}>
      {voices.map((v) => (
        <button
          key={v.id}
          type="button"
          className={`${styles.item} ${v.id === selectedId ? styles.selected : ""}`}
          onClick={() => onChange(v.id)}
        >
          {v.displayName}
        </button>
      ))}
    </div>
  );
}
