import styles from "./Transport.module.css";

export interface TransportProps {
  recording: boolean;
  onRec: () => void;
  onPlay: () => void;
  onStop: () => void;
}

export function Transport({ recording, onRec, onPlay, onStop }: TransportProps) {
  return (
    <div className={styles.transport}>
      <button
        type="button"
        className={`${styles.btn} ${styles.rec} ${recording ? styles.active : ""}`}
        onClick={onRec}
        aria-label="rec"
      >
        ●REC
      </button>
      <button type="button" className={styles.btn} onClick={onPlay} aria-label="play">
        ▶ PLAY
      </button>
      <button type="button" className={styles.btn} onClick={onStop} aria-label="stop">
        ■ STOP
      </button>
    </div>
  );
}
