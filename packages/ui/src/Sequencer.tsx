import styles from "./Sequencer.module.css";

export interface SequencerProps {
  laneLabels: string[];
  selectedLane: number;
  grid: boolean[][];
  currentStep: number;
  running: boolean;
  onSelectLane: (lane: number) => void;
  onToggleStep: (lane: number, step: number) => void;
  onToggleRunning: () => void;
  onClear: () => void;
}

export function Sequencer({
  laneLabels,
  selectedLane,
  grid,
  currentStep,
  running,
  onSelectLane,
  onToggleStep,
  onToggleRunning,
  onClear,
}: SequencerProps) {
  return (
    <section className={styles.panel} aria-label="step sequencer">
      <div className={styles.lanes}>
        {laneLabels.map((label, lane) => (
          <button
            type="button"
            key={`${label}-${lane}`}
            className={`${styles.lane} ${lane === selectedLane ? styles.selected : ""}`}
            aria-label={`sequence lane ${label}`}
            aria-pressed={lane === selectedLane}
            onClick={() => onSelectLane(lane)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className={styles.steps}>
        {Array.from({ length: 16 }, (_, step) => {
          const enabled = grid[selectedLane]?.[step] ?? false;
          return (
            <button
              type="button"
              key={step}
              className={`${styles.step} ${enabled ? styles.enabled : ""} ${currentStep === step ? styles.playing : ""}`}
              aria-label={`step ${step + 1}`}
              aria-pressed={enabled}
              onClick={() => onToggleStep(selectedLane, step)}
            >
              {step + 1}
            </button>
          );
        })}
      </div>
      <div className={styles.controls}>
        <button
          type="button"
          className={`${styles.run} ${running ? styles.running : ""}`}
          aria-label={running ? "stop sequence" : "start sequence"}
          onClick={onToggleRunning}
        >
          {running ? "■ STOP SEQ" : "▶ START SEQ"}
        </button>
        <button type="button" className={styles.clear} onClick={onClear}>CLEAR</button>
        <span>1/16 · 1 BAR</span>
      </div>
    </section>
  );
}
