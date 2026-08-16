import styles from "./TapeMode.module.css";

export interface TapeTrackView {
  id: number;
  name: string;
  durationSeconds: number | null;
  volume: number;
  muted: boolean;
  solo: boolean;
}

export interface TapeModeProps {
  tracks: TapeTrackView[];
  activeTrackId: number;
  onArm: (trackId: number) => void;
  onMute: (trackId: number) => void;
  onSolo: (trackId: number) => void;
  onVolume: (trackId: number, volume: number) => void;
  onClear: (trackId: number) => void;
}

function durationLabel(seconds: number | null): string {
  if (seconds === null) return "EMPTY";
  return `${seconds.toFixed(1)}s`;
}

export function TapeMode({
  tracks,
  activeTrackId,
  onArm,
  onMute,
  onSolo,
  onVolume,
  onClear,
}: TapeModeProps) {
  return (
    <section className={styles.panel} aria-label="tape tracks">
      <div className={styles.heading}>
        <span>4-TRACK TAPE</span>
        <span>REC WRITES TO ARMED</span>
      </div>
      <div className={styles.tracks}>
        {tracks.map((track) => {
          const armed = track.id === activeTrackId;
          return (
            <div className={`${styles.track} ${armed ? styles.armed : ""}`} key={track.id}>
              <button
                type="button"
                className={styles.arm}
                aria-label={`arm ${track.name}`}
                aria-pressed={armed}
                onClick={() => onArm(track.id)}
              >
                <span className={styles.trackNumber}>T{track.id}</span>
                <span>{track.name}</span>
              </button>
              <div className={styles.lane} aria-label={`${track.name} ${durationLabel(track.durationSeconds)}`}>
                {track.durationSeconds === null ? (
                  <span className={styles.empty}>— NO TAKE —</span>
                ) : (
                  <span
                    className={styles.region}
                    style={{ width: `${Math.max(20, Math.min(100, track.durationSeconds * 12))}%` }}
                  >
                    {durationLabel(track.durationSeconds)}
                  </span>
                )}
              </div>
              <button
                type="button"
                className={`${styles.toggle} ${track.muted ? styles.on : ""}`}
                aria-label={`mute ${track.name}`}
                aria-pressed={track.muted}
                onClick={() => onMute(track.id)}
              >
                M
              </button>
              <button
                type="button"
                className={`${styles.toggle} ${track.solo ? styles.on : ""}`}
                aria-label={`solo ${track.name}`}
                aria-pressed={track.solo}
                onClick={() => onSolo(track.id)}
              >
                S
              </button>
              <input
                className={styles.volume}
                type="range"
                min={0}
                max={1.25}
                step={0.05}
                value={track.volume}
                aria-label={`volume ${track.name}`}
                onChange={(event) => onVolume(track.id, Number(event.currentTarget.value))}
              />
              <button
                type="button"
                className={styles.clear}
                aria-label={`clear ${track.name}`}
                disabled={track.durationSeconds === null}
                onClick={() => onClear(track.id)}
              >
                ×
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
