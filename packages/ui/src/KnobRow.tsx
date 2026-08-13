import { Knob } from "./Knob";
import styles from "./KnobRow.module.css";

export function KnobRow() {
  // Static defaults for v0.1 — wires to engine in v0.3.
  return (
    <div className={styles.row}>
      <Knob label="SHAPE" value={0.5} />
      <Knob label="FILTER" value={1} />
      <Knob label="ATTACK" value={0.1} />
      <Knob label="RELEASE" value={0.3} />
    </div>
  );
}
