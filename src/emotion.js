// MediaPipe Face Landmarker のブレンドシェイプ(52種)から
// 4つの基本感情と無表情（平常）のスコア (0〜1) を推定する。

const clamp01 = (v) => Math.min(1, Math.max(0, v));

// 指数移動平均の係数。大きいほど反応が速く、小さいほど滑らか。
const SMOOTHING = 0.15;

export class EmotionEstimator {
  constructor() {
    this.scores = { joy: 0, surprise: 0, anger: 0, sadness: 0, neutral: 1 };
  }

  /**
   * @param {object|null} blendshapes FaceLandmarkerResult.faceBlendshapes[0]
   *   顔が検出されなかったフレームは null を渡すと中立へ戻っていく。
   * @param {number} voiceActivity 音声による補正の強さ (0〜1)。未使用時は0。
   */
  update(blendshapes, voiceActivity = 0) {
    const raw = blendshapes
      ? this._estimate(blendshapes)
      : { joy: 0, surprise: 0, anger: 0, sadness: 0 };

    // 音声は感情の種類を決めず、表情の強さを最大30%補正する。
    const voiceGain = 1 + clamp01(voiceActivity) * 0.3;
    for (const key of Object.keys(raw)) raw[key] = clamp01(raw[key] * voiceGain);

    // 他の感情が弱いほど、無表情（平常）のスコアを高くする。
    raw.neutral = 1 - Math.max(...Object.values(raw));

    for (const key of Object.keys(this.scores)) {
      this.scores[key] += (raw[key] - this.scores[key]) * SMOOTHING;
    }
    return this.scores;
  }

  _estimate(blendshapes) {
    const b = {};
    for (const c of blendshapes.categories) b[c.categoryName] = c.score;
    const avg = (...names) =>
      names.reduce((sum, n) => sum + (b[n] ?? 0), 0) / names.length;

    const smile = avg("mouthSmileLeft", "mouthSmileRight");
    const frown = avg("mouthFrownLeft", "mouthFrownRight");
    const browDown = avg("browDownLeft", "browDownRight");
    const browUp = avg("browOuterUpLeft", "browOuterUpRight");
    const eyeWide = avg("eyeWideLeft", "eyeWideRight");
    const cheek = avg("cheekSquintLeft", "cheekSquintRight");
    const sneer = avg("noseSneerLeft", "noseSneerRight");

    return {
      joy: clamp01(smile * 1.4 + cheek * 0.3),
      surprise: clamp01(eyeWide * 0.9 + browUp * 0.6 + (b.jawOpen ?? 0) * 0.5 - smile * 0.4),
      anger: clamp01(browDown * 1.1 + sneer * 0.5 - smile * 0.6),
      sadness: clamp01(frown * 1.2 + (b.browInnerUp ?? 0) * 0.35 - smile * 0.8),
    };
  }

  /** 最も強い感情。どれも弱ければ neutral。 */
  dominant(threshold = 0.18) {
    let best = "neutral";
    let bestScore = threshold;
    for (const [key, score] of Object.entries(this.scores)) {
      if (key !== "neutral" && score > bestScore) {
        best = key;
        bestScore = score;
      }
    }
    return best;
  }
}

export const MOOD_LABELS = {
  joy: "華やいだ空気",
  surprise: "ハッとした空気",
  anger: "張りつめた空気",
  sadness: "沈んだ空気",
  neutral: "無表情（平常）",
};
