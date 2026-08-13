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
      <span
        className={cls}
        onClick={clickable ? () => onClickField!("transport") : undefined}
      >{transport}</span>
      <span
        className={cls}
        onClick={clickable ? () => onClickField!("key") : undefined}
      >{key2}</span>
      <span
        className={cls}
        onClick={clickable ? () => onClickField!("voice") : undefined}
      >{voice}</span>
    </div>
  );
}
