export interface StereoTrack {
  left: Float32Array;
  right: Float32Array;
  gain: number;
}

export function mixStereoTracks(tracks: StereoTrack[]): {
  left: Float32Array;
  right: Float32Array;
} {
  const length = tracks.reduce(
    (longest, track) => Math.max(longest, track.left.length, track.right.length),
    0
  );
  const left = new Float32Array(length);
  const right = new Float32Array(length);
  for (const track of tracks) {
    const gain = Number.isFinite(track.gain) ? Math.max(0, Math.min(2, track.gain)) : 1;
    for (let index = 0; index < track.left.length; index++) {
      const sample = track.left[index]!;
      if (Number.isFinite(sample)) left[index] += sample * gain;
    }
    for (let index = 0; index < track.right.length; index++) {
      const sample = track.right[index]!;
      if (Number.isFinite(sample)) right[index] += sample * gain;
    }
  }
  for (let index = 0; index < length; index++) {
    left[index] = Math.max(-1, Math.min(1, left[index]!));
    right[index] = Math.max(-1, Math.min(1, right[index]!));
  }
  return { left, right };
}
