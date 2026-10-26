import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import { EmotionEstimator, MOOD_LABELS } from "./emotion.js";
import { DiamondScene } from "./diamond.js";

const MEDIAPIPE_WASM =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

const video = document.getElementById("camera");
const statusEl = document.getElementById("status");
const moodEl = document.getElementById("mood");
const meterFills = {};
for (const meter of document.querySelectorAll(".meter")) {
  meterFills[meter.dataset.emotion] = meter.querySelector(".fill");
}

const setStatus = (text) => {
  statusEl.textContent = text;
};

async function setupCamera() {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { width: 640, height: 480 },
    audio: false,
  });
  video.srcObject = stream;
  await new Promise((resolve) => (video.onloadedmetadata = resolve));
  await video.play();
}

async function setupLandmarker() {
  const fileset = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM);
  return FaceLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
    outputFaceBlendshapes: true,
    runningMode: "VIDEO",
    numFaces: 10,
  });
}

async function main() {
  try {
    setStatus("カメラを起動しています…");
    await setupCamera();

    setStatus("顔認識モデルを読み込んでいます…");
    const landmarker = await setupLandmarker();
    setStatus("");

    const estimator = new EmotionEstimator();
    const diamond = new DiamondScene(document.getElementById("stage"));

    let lastVideoTime = -1;
    let lastBlendshapes = null;
    let faceCount = 0;
    let lastFrameTime = performance.now();

    const loop = () => {
      const now = performance.now();
      const dt = Math.min((now - lastFrameTime) / 1000, 0.1);
      lastFrameTime = now;

      // 新しいビデオフレームが来たときだけ推論する
      if (video.currentTime !== lastVideoTime) {
        lastVideoTime = video.currentTime;
        const result = landmarker.detectForVideo(video, now);
        faceCount = result.faceLandmarks?.length ?? 0;
        lastBlendshapes = result.faceBlendshapes?.[0] ?? null;
      }

      const scores = estimator.update(lastBlendshapes);

      for (const [key, fill] of Object.entries(meterFills)) {
        fill.style.width = `${Math.round(scores[key] * 100)}%`;
      }
      moodEl.textContent = lastBlendshapes
        ? MOOD_LABELS[estimator.dominant()]
        : "顔が見つかりません";

      diamond.update(dt, scores, faceCount);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  } catch (err) {
    console.error(err);
    setStatus(
      err.name === "NotAllowedError"
        ? "カメラへのアクセスが許可されませんでした。ブラウザの設定を確認してください。"
        : `エラーが発生しました: ${err.message}`
    );
  }
}

main();
