import { Knob } from "./Knob";
import styles from "./FxPanel.module.css";

export interface FxPanelValues {
  reverb: number;
  delay: number;
  saturation: number;
  wow: number;
}

export interface FxPanelProps {
  values: FxPanelValues;
  onChange: (name: keyof FxPanelValues, value: number) => void;
}

export function FxPanel({ values, onChange }: FxPanelProps) {
  return (
    <section className={styles.panel} aria-label="master effects">
      <div className={styles.heading}>
        <span>MASTER BUS</span>
        <span>PRINTS TO TAPE</span>
      </div>
      <div className={styles.grid}>
        <Knob label="REVERB" value={values.reverb} onChange={(value) => onChange("reverb", value)} />
        <Knob label="DELAY" value={values.delay} onChange={(value) => onChange("delay", value)} />
        <Knob label="SAT" value={values.saturation} onChange={(value) => onChange("saturation", value)} />
        <Knob label="WOW" value={values.wow} onChange={(value) => onChange("wow", value)} />
      </div>
      <p className={styles.note}>DELAY SYNC 3/16 · SAT SOFT CLIP · WOW DUAL-LFO</p>
    </section>
  );
}
