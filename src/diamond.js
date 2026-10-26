import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

// 感情ごとのダイヤモンドの色
const EMOTION_COLORS = {
  joy: new THREE.Color("#ffc966"),
  surprise: new THREE.Color("#ffffff"),
  anger: new THREE.Color("#ff3b30"),
  sadness: new THREE.Color("#3d6bff"),
  neutral: new THREE.Color("#bfe0ff"),
};

const SPARKLE_COUNT = 60;
const clamp01 = (v) => Math.min(1, Math.max(0, v));

/**
 * ブリリアントカット風のジオメトリを生成する。
 * テーブル(上面) → クラウン → ガードル → パビリオン(下の尖り) の
 * リングを半ステップずらしながら繋いでファセットを作る。
 */
function createDiamondGeometry(segments = 16) {
  const step = (Math.PI * 2) / segments;

  const ring = (radius, y, angleOffset) => {
    const pts = [];
    for (let i = 0; i < segments; i++) {
      const a = i * step + angleOffset;
      pts.push([Math.cos(a) * radius, y, Math.sin(a) * radius]);
    }
    return pts;
  };

  const table = ring(0.45, 0.5, 0);
  const crown = ring(0.85, 0.32, step / 2);
  const girdle = ring(1.0, 0.18, 0);
  const culet = [0, -0.85, 0];

  const positions = [];
  const band = (upper, lower) => {
    for (let i = 0; i < segments; i++) {
      const u0 = upper[i];
      const u1 = upper[(i + 1) % segments];
      const l0 = lower[i];
      const l1 = lower[(i + 1) % segments];
      positions.push(...u0, ...l0, ...u1);
      positions.push(...u1, ...l0, ...l1);
    }
  };

  // テーブル面(扇状)
  for (let i = 0; i < segments; i++) {
    positions.push(0, table[0][1], 0);
    positions.push(...table[(i + 1) % segments]);
    positions.push(...table[i]);
  }

  band(table, crown);
  band(crown, girdle);

  // パビリオン(ガードル → キューレットの一点)
  for (let i = 0; i < segments; i++) {
    positions.push(...girdle[i]);
    positions.push(...culet);
    positions.push(...girdle[(i + 1) % segments]);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3)
  );
  geometry.computeVertexNormals(); // 非インデックスなのでフラットな法線になる
  return geometry;
}

/** きらめき用の放射グラデーションテクスチャを生成 */
function createSparkleTexture() {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  const grad = ctx.createRadialGradient(
    size / 2, size / 2, 0,
    size / 2, size / 2, size / 2
  );
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.25, "rgba(255,255,255,0.6)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

export class DiamondScene {
  constructor(container) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color("#06070d");

    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    this.camera.position.set(0, 0.35, 4.2);
    this.camera.lookAt(0, 0, 0);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

    this.material = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      metalness: 0,
      roughness: 0.018,
      transmission: 0.9,
      thickness: 1.8,
      ior: 2.4,
      envMapIntensity: 1.6,
      clearcoat: 1,
      clearcoatRoughness: 0.02,
      emissive: 0xffffff,
      emissiveIntensity: 0.04,
      side: THREE.DoubleSide,
    });
    this.geometry = createDiamondGeometry();
    this.basePositions = Float32Array.from(this.geometry.attributes.position.array);
    this.diamond = new THREE.Mesh(this.geometry, this.material);
    this.diamondGroup = new THREE.Group();
    this.diamondGroup.add(this.diamond);
    this.scene.add(this.diamondGroup);

    this.keyLight = new THREE.PointLight(0xffffff, 30);
    this.keyLight.position.set(3, 4, 3);
    this.scene.add(this.keyLight);

    this.rimLight = new THREE.PointLight(0xbfd4ff, 12);
    this.rimLight.position.set(-3, -1, -2);
    this.scene.add(this.rimLight);

    this.glintLight = new THREE.PointLight(0xffffff, 0, 6.5);
    this.glintLight.position.set(0, 1.2, 2.8);
    this.scene.add(this.glintLight);

    this.scene.add(new THREE.AmbientLight(0x223044, 1.5));

    // きらめきスプライト群
    this.sparkleColor = new THREE.Color("#ffffff");
    const texture = createSparkleTexture();
    this.sparkles = [];
    for (let i = 0; i < SPARKLE_COUNT; i++) {
      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: texture,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          transparent: true,
          opacity: 0,
        })
      );
      // ダイヤ表面付近のランダムな位置
      const dir = new THREE.Vector3()
        .randomDirection()
        .multiplyScalar(0.7 + Math.random() * 0.6);
      sprite.position.copy(dir);
      sprite.userData = {
        phase: Math.random() * Math.PI * 2,
        speed: 1.5 + Math.random() * 4,
        size: 0.1 + Math.random() * 0.25,
        burst: 0.35 + Math.random() * 0.65,
      };
      this.diamond.add(sprite);
      this.sparkles.push(sprite);
    }

    this.targetColor = EMOTION_COLORS.neutral.clone();
    this.surfaceColor = new THREE.Color();
    this.flashColor = new THREE.Color();
    this.emissiveColor = new THREE.Color();
    this.elapsed = 0;

    this._resize();
    window.addEventListener("resize", () => this._resize());
  }

  _resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  _applyEmotionShape(dt, e, t) {
    const positionAttr = this.geometry.getAttribute("position");
    const positions = positionAttr.array;
    const response = Math.min(1, 0.08 + dt * 7.5);

    for (let i = 0; i < positions.length; i += 3) {
      const bx = this.basePositions[i];
      const by = this.basePositions[i + 1];
      const bz = this.basePositions[i + 2];

      const radius = Math.hypot(bx, bz);
      const angle = Math.atan2(bz, bx);
      const crownMask = clamp01((by - 0.08) / 0.45);
      const pavilionMask = clamp01((-by - 0.02) / 0.8);
      const girdleMask = 1 - Math.min(1, Math.abs(by - 0.16) / 0.42);

      const joyBulge = e.joy * (0.1 + crownMask * 0.14 + girdleMask * 0.06);
      const joyWave = e.joy * Math.sin(angle * 4 + t * 2.6) * 0.035 * (0.3 + crownMask);

      const surpriseTall = e.surprise * (0.18 + crownMask * 0.18 + pavilionMask * 0.12);
      const surprisePinch = e.surprise * (0.12 * crownMask + 0.05 * girdleMask);

      const angerSpike =
        e.anger *
        Math.sin(angle * 8 + t * (7 + e.anger * 5)) *
        (0.09 * girdleMask + 0.05 * crownMask);
      const angerTwist = e.anger * Math.sin(angle * 4 + t * 5) * 0.06 * crownMask;

      const sadnessSink = e.sadness * (0.12 + pavilionMask * 0.16 + crownMask * 0.08);
      const sadnessNarrow = e.sadness * (0.08 + crownMask * 0.1 + pavilionMask * 0.04);

      const radialScale =
        1 +
        joyBulge +
        joyWave -
        surprisePinch -
        sadnessNarrow +
        angerSpike;
      const yScale = 1 + surpriseTall - e.sadness * 0.18;
      const twist = angerTwist + e.surprise * 0.03 * crownMask;

      const cosTwist = Math.cos(twist);
      const sinTwist = Math.sin(twist);
      const rx = bx * cosTwist - bz * sinTwist;
      const rz = bx * sinTwist + bz * cosTwist;

      const tx = rx * radialScale;
      const ty =
        by * yScale +
        e.joy * crownMask * 0.06 -
        sadnessSink +
        angerSpike * radius * 0.18;
      const tz = rz * radialScale;

      positions[i] += (tx - positions[i]) * response;
      positions[i + 1] += (ty - positions[i + 1]) * response;
      positions[i + 2] += (tz - positions[i + 2]) * response;
    }

    positionAttr.needsUpdate = true;
    this.geometry.computeVertexNormals();
  }

  /**
   * @param {number} dt 前フレームからの秒数
   * @param {{joy:number,surprise:number,anger:number,sadness:number}} e
   * @param {number} faceCount 検出した顔の数
   */
  update(dt, e, faceCount = 1) {
    this.elapsed += dt;
    const t = this.elapsed;

    // 感情の強さ(覚醒度)と、最も強い感情の色
    const arousal = Math.min(1, e.joy + e.surprise * 1.2 + e.anger * 1.1);

    let dominant = "neutral";
    let bestScore = 0.18; // 感情ラベルと同じ中立判定の閾値
    for (const [emotion, score] of Object.entries(e)) {
      if (score > bestScore) {
        dominant = emotion;
        bestScore = score;
      }
    }
    this.targetColor.copy(EMOTION_COLORS[dominant]);

    // 回転: 喜び・驚きで速く、悲しみで遅く。怒りは細かく震える。
    const spin = 0.25 + e.joy * 1.2 + e.surprise * 0.8 - e.sadness * 0.18;
    this.diamond.rotation.y += spin * dt;
    this.diamond.rotation.x =
      Math.sin(t * 0.6) * 0.08 + (Math.random() - 0.5) * e.anger * 0.06;
    this.diamond.rotation.z = (Math.random() - 0.5) * e.anger * 0.06;

    // 鼓動のようなスケール。覚醒度が高いほど速く大きく脈打つ。
    const pulse = 1 + Math.sin(t * (1.5 + arousal * 6)) * (0.01 + arousal * 0.04);
    this.diamond.scale.setScalar(pulse);

    // 形状: 感情によって輪郭が変形する
    this._applyEmotionShape(dt, e, t);

    // 明るさ: 悲しみで沈み、覚醒で輝く
    const brightness = 1 + arousal * 1.6 - e.sadness * 0.7;
    const shimmer =
      Math.pow(Math.max(0, Math.sin(t * (3.5 + arousal * 8))), 4) *
      (0.35 + arousal * 1.4 + e.surprise * 0.8);
    const sweep = Math.sin(t * (1.2 + e.joy * 1.5) + e.anger * 0.8);
    const flash = brightness + shimmer * 1.8;

    this.flashColor.copy(this.targetColor).offsetHSL(
      e.joy * 0.045 + e.surprise * 0.09 - e.anger * 0.075 - e.sadness * 0.03,
      0.12 + e.joy * 0.2 + e.surprise * 0.28 + e.anger * 0.08,
      0.05 + shimmer * 0.16 + e.joy * 0.07 + e.surprise * 0.1
    );
    this.surfaceColor
      .copy(this.targetColor)
      .lerp(this.flashColor, Math.min(1, 0.28 + shimmer * 0.68 + e.surprise * 0.14));
    this.emissiveColor
      .copy(this.flashColor)
      .offsetHSL(
        e.surprise * 0.025 - e.anger * 0.02,
        0.06 + e.surprise * 0.08,
        0.04 + shimmer * 0.12
      );

    this.material.color.lerp(this.surfaceColor, 0.2);
    this.material.emissive.lerp(this.emissiveColor, 0.24);
    this.sparkleColor.lerp(this.flashColor, 0.24);

    this.material.envMapIntensity = Math.max(0.45, 1.25 * flash);
    this.material.emissiveIntensity = 0.03 + shimmer * 0.18 + e.surprise * 0.08;
    this.keyLight.intensity = Math.max(6, 22 * brightness + shimmer * 26);
    this.rimLight.intensity = Math.max(4, 9 + brightness * 5 + shimmer * 10);
    this.glintLight.intensity = 10 + arousal * 26 + shimmer * 65;
    this.glintLight.position.set(
      Math.cos(t * 1.8 + e.surprise * 1.5) * (2.1 + e.joy * 0.8),
      0.7 + Math.sin(t * 2.4) * 0.9,
      2.2 + sweep * 1.6
    );

    // きらめき: 喜び・驚きで増え、怒りは鋭く速い点滅
    const sparkleLevel =
      0.16 + e.joy * 1.0 + e.surprise * 1.15 + e.anger * 0.55 - e.sadness * 0.08;
    const flickerSpeed = 1.2 + e.anger * 3.6 + e.surprise * 2.1 + e.joy * 0.8;
    const burstLevel = Math.max(0, Math.sin(t * (8 + e.surprise * 10) + arousal * 3));
    for (const s of this.sparkles) {
      const { phase, speed, size, burst } = s.userData;
      const wave = Math.sin(t * speed * flickerSpeed + phase);
      const twinkleBase = Math.pow(Math.max(0, wave), 8) * Math.min(1, sparkleLevel);
      const burstFlash =
        Math.pow(burstLevel, 10) * burst * (0.2 + e.surprise * 0.9 + e.joy * 0.35);
      const twinkle = Math.min(1.35, twinkleBase * (1.2 + shimmer) + burstFlash);
      s.material.opacity = Math.min(1, twinkle);
      s.material.color.copy(this.sparkleColor);
      s.scale.setScalar(size * (0.45 + twinkle * 1.9));
    }

    this._syncDiamonds(faceCount);
    this.renderer.render(this.scene, this.camera);
  }

  _syncDiamonds(faceCount) {
    this.diamondGroup.visible = faceCount > 0;
    const count = Math.max(1, faceCount);
    while (this.diamondGroup.children.length < count) {
      this.diamondGroup.add(this.diamond.clone());
    }
    while (this.diamondGroup.children.length > count) {
      this.diamondGroup.remove(this.diamondGroup.children.at(-1));
    }

    // 複数人のときは、全てのダイヤが画面内に収まるよう横に並べる。
    const height = 2 * this.camera.position.z * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    this.diamondGroup.scale.setScalar(
      count === 1 ? 1 : Math.min(1, (height * this.camera.aspect) / (count * 2.8), height / 3)
    );
    this.diamondGroup.children.forEach((diamond, index) => {
      diamond.position.x = (index - (count - 1) / 2) * 2.8;
      if (diamond === this.diamond) return;
      diamond.rotation.copy(this.diamond.rotation);
      diamond.scale.copy(this.diamond.scale);
      diamond.children.forEach((sparkle, i) => {
        sparkle.scale.copy(this.sparkles[i].scale);
      });
    });
  }
}
