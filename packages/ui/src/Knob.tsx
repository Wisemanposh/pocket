import type { CSSProperties } from "react";
import styles from "./Knob.module.css";

export interface KnobProps {
  label: string;
  value: number;       // 0..1
}

export function Knob({ label, value }: KnobProps) {
  const angle = (value - 0.5) * 270;
  const style = { ["--angle" as string]: `${angle}deg` } as CSSProperties;
  return (
    <div className={styles.cell}>
      <div className={styles.knob} style={style} />
      <div className={styles.label}>{label}</div>
    </div>
  );
}
