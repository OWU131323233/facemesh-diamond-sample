// 音声はブラウザ内で解析し、音量と音量の変化を補助情報として使う。
export class VoiceAnalyzer {
  constructor() {
    this.context = null;
    this.stream = null;
    this.level = 0;
    this.variation = 0;
  }

  async start() {
    try {
      // ボタン操作の直後に開始し、ブラウザの自動再生制限に対応する。
      this.context = new AudioContext();
      await this.context.resume();
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      this.source = this.context.createMediaStreamSource(this.stream);
      this.analyser = this.context.createAnalyser();
      this.analyser.fftSize = 2048;
      this.source.connect(this.analyser);
      this.samples = new Float32Array(this.analyser.fftSize);
    } catch (error) {
      this.stop();
      throw error;
    }
  }

  update(dt) {
    if (!this.stream || this.context.state !== "running" ||
        !this.stream.getAudioTracks().some((track) => track.readyState === "live" && !track.muted)) {
      this.level = 0;
      this.variation = 0;
      return 0;
    }
    this.analyser.getFloatTimeDomainData(this.samples);
    const rms = Math.sqrt(
      this.samples.reduce((sum, value) => sum + value * value, 0) / this.samples.length
    );
    // 小さな環境音を除き、補正の強さを0〜1に収める。
    const level = Math.min(1, Math.max(0, (rms - 0.02) / 0.13));
    const response = 1 - Math.exp(-dt * 8);
    const change = Math.abs(level - this.level);
    this.variation += (change - this.variation) * response;
    this.level += (level - this.level) * response;
    return Math.min(1, this.level * 0.8 + this.variation * 0.2);
  }

  stop() {
    this.stream?.getTracks().forEach((track) => track.stop());
    this.source?.disconnect();
    if (this.context && this.context.state !== "closed") {
      this.context.close().catch(() => {});
    }
    this.stream = null;
    this.context = null;
    this.level = 0;
    this.variation = 0;
  }
}
