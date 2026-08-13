import styles from "./ModeTabs.module.css";

export type Mode = "CHRD" | "SEQ" | "TAPE" | "FX";

export interface ModeTabsProps {
  active: Mode;
  enabled?: Mode[];
  onSelect?: (m: Mode) => void;
}

const ALL: Mode[] = ["CHRD", "SEQ", "TAPE", "FX"];

export function ModeTabs({ active, enabled = ["CHRD"], onSelect }: ModeTabsProps) {
  return (
    <div className={styles.tabs}>
      {ALL.map((m) => {
        const isEnabled = enabled.includes(m);
        const isActive = m === active;
        return (
          <button
            key={m}
            type="button"
            className={`${styles.tab} ${isActive ? styles.active : ""} ${isEnabled ? "" : styles.disabled}`}
            disabled={!isEnabled}
            onClick={() => isEnabled && onSelect?.(m)}
          >
            {m}
          </button>
        );
      })}
    </div>
  );
}
