import { Knob } from "./Knob";
import styles from "./KnobRow.module.css";

export interface KnobValues {
  shape: number;
  filter: number;
  attack: number;
  release: number;
}

export interface KnobRowProps {
  values: KnobValues;
  onChange: (name: keyof KnobValues, value: number) => void;
}

export function KnobRow({ values, onChange }: KnobRowProps) {
  return (
    <div className={styles.row}>
      <Knob label="SHAPE" value={values.shape} onChange={(value) => onChange("shape", value)} />
      <Knob label="FILTER" value={values.filter} onChange={(value) => onChange("filter", value)} />
      <Knob label="ATTACK" value={values.attack} onChange={(value) => onChange("attack", value)} />
      <Knob label="RELEASE" value={values.release} onChange={(value) => onChange("release", value)} />
    </div>
  );
}
