import styles from "./Pad.module.css";

export interface PadProps {
  label: string;
  lit?: boolean;
  variant?: "default" | "chord";
  onPress: () => void;
  onRelease: () => void;
}

export function Pad({ label, lit, variant = "default", onPress, onRelease }: PadProps) {
  const cls = [
    styles.pad,
    variant === "chord" ? styles.chord : "",
    lit ? styles.lit : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type="button"
      className={cls}
      onPointerDown={(e) => {
        // jsdom (test env) lacks setPointerCapture — guard so component is testable.
        e.currentTarget.setPointerCapture?.(e.pointerId);
        onPress();
      }}
      onPointerUp={onRelease}
      onPointerCancel={onRelease}
    >
      {label}
    </button>
  );
}
