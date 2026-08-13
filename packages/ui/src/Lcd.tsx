import styles from "./Lcd.module.css";

export type LcdField = "transport" | "key" | "voice";

export interface LcdProps {
  transport: string;
  key2: string;
  voice: string;
  onClickField?: (f: LcdField) => void;
}

export function Lcd({ transport, key2, voice, onClickField }: LcdProps) {
  const clickable = !!onClickField;
  const cls = clickable ? `${styles.field} ${styles.clickable}` : styles.field;
  return (
    <div className={styles.lcd}>
      <button
        type="button"
        className={cls}
        disabled={!clickable}
        onClick={() => onClickField?.("transport")}
      >{transport}</button>
      <button
        type="button"
        className={cls}
        disabled={!clickable}
        onClick={() => onClickField?.("key")}
      >{key2}</button>
      <button
        type="button"
        className={cls}
        disabled={!clickable}
        onClick={() => onClickField?.("voice")}
      >{voice}</button>
    </div>
  );
}
