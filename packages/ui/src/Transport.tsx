import styles from "./Transport.module.css";

export interface TransportProps {
  recording: boolean;
  canPlay?: boolean;
  canStop?: boolean;
  onRec: () => void;
  onPlay: () => void;
  onStop: () => void;
}

export function Transport({ recording, canPlay = true, canStop = true, onRec, onPlay, onStop }: TransportProps) {
  return (
    <div className={styles.transport}>
      <button
        type="button"
        className={`${styles.btn} ${styles.rec} ${recording ? styles.active : ""}`}
        onClick={onRec}
        aria-label="rec"
        disabled={recording}
      >
        ●REC
      </button>
      <button type="button" className={styles.btn} onClick={onPlay} aria-label="play" disabled={!canPlay}>
        ▶ PLAY
      </button>
      <button type="button" className={styles.btn} onClick={onStop} aria-label="stop" disabled={!canStop}>
        ■ STOP
      </button>
    </div>
  );
}
