# Emotion Diamond — 感情の輝き

Webカメラに映った顔から感情を読み取り、ダイヤモンドの輝きとして可視化するWebアプリです。
表情から「その場の空気感」をリアルタイムに表現することを目指しています。

## 仕組み

```
Webカメラ映像
  → MediaPipe Face Landmarker（52種の表情ブレンドシェイプを検出）
  → 感情推定（喜び・驚き・怒り・悲しみの4スコアに変換）
  → Three.js のダイヤモンド描画（色・輝き・動き・形に反映）
```

### 感情と輝きの対応

| 感情 | ダイヤモンドの表現 |
|------|------------------|
| 喜び | 暖かな金色。回転が速くなり、きらめきが増え、輪郭がややふくらむ |
| 驚き | 白い閃光。速い点滅と強い脈動。縦に伸びてシャープになる |
| 怒り | 赤い色。ダイヤが細かく震え、鋭く速い点滅。面が尖って軽くねじれる |
| 悲しみ | 青い色。輝度が沈み、動きが遅くなり、全体が細く沈む |
| 中立 | 淡い氷青色の穏やかな輝き。形は基準形状に戻る |

画面には感情メーター（左上）、カメラプレビュー（右上・ミラー表示）、
場の空気感ラベル（下部、例:「華やいだ空気」「張りつめた空気」）が表示されます。

## 動作環境

- Google Chrome（PC）を想定
- Webカメラ必須
- 初回起動時はインターネット接続が必要
  （MediaPipe の WASM とモデルファイルを CDN / Google のストレージから取得するため）

## セットアップと起動

```bash
npm install
npm run dev
```

Chrome で http://localhost:5173/ を開き、カメラの使用を許可してください。

### 本番ビルド

```bash
npm run build    # dist/ に出力
npm run preview  # ビルド結果をローカルで確認
```

## ファイル構成

```
index.html        画面の骨組み（感情メーター・カメラプレビュー・空気感ラベル）
src/
  main.js         カメラ起動、MediaPipe の初期化、推論ループ
  emotion.js      ブレンドシェイプ → 感情スコアの推定ロジック
  diamond.js      ダイヤモンドの形状生成・マテリアル・きらめき・感情による形状変形
  style.css       オーバーレイUIのスタイル
```

## 調整できるポイント

- **感情の反応速度**: `src/emotion.js` の `SMOOTHING`（大きいほど敏感、小さいほど滑らか）
- **感情推定の係数**: `src/emotion.js` の `_estimate()` 内の重み
  （例: 笑顔をより強く喜びに反映したい場合は `smile` の係数を上げる）
- **感情ごとの色**: `src/diamond.js` の `EMOTION_COLORS`
- **きらめきの量**: `src/diamond.js` の `SPARKLE_COUNT` と `update()` 内の `sparkleLevel`
- **ダイヤの質感**: `src/diamond.js` の `MeshPhysicalMaterial` のパラメータ
  （`transmission`=透明感、`ior`=屈折率、`envMapIntensity`=映り込みの強さ）
- **形状変化の強さ**: `src/diamond.js` の `_applyEmotionShape()` 内の各感情係数
  （`joyBulge`、`surpriseTall`、`angerSpike`、`sadnessNarrow` など）

## 使用技術

- [MediaPipe Tasks Vision](https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker) — 顔ランドマーク・表情ブレンドシェイプ検出
- [Three.js](https://threejs.org/) — ダイヤモンドの3D描画
- [Vite](https://vitejs.dev/) — 開発サーバー・ビルド

## 今後の予定

- 複数人の顔を同時に検出し、感情を合成して「場の空気」を1つの輝きで表現する
