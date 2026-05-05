export const BPM = 120;

export type AnimationType = 
| 'fadeIn' | 'fadeInUp' | 'fadeInDown' | 'bounceIn' 
| 'scaleUp' | 'slideFromLeft' | 'slideFromRight' 
| 'typewriter' | 'wave' | 'glitch' | 'explode';

export type MarkerType = 'Ripple' | 'Stream' | 'Lock' | 'Silhouette';

export interface TargetAngle {
  x: number;
  y: number;
  z: number;
}

export class MarkerTarget {
  hitTime: number;
  x: number; // 0.0 to 1.0 (normalized screen x)
  y: number; // 0.0 to 1.0 (normalized screen y)
  targetLimb: 'leftWrist' | 'rightWrist' | 'fullBody';
  type: MarkerType;
  duration?: number;
  name: string;
  targetAngles?: { leftArm?: TargetAngle; rightArm?: TargetAngle };

  constructor(
    hitTime: number,
    x: number,
    y: number,
    targetLimb: 'leftWrist' | 'rightWrist' | 'fullBody',
    name: string,
    type: MarkerType = 'Ripple',
    duration?: number,
    targetAngles?: { leftArm?: TargetAngle; rightArm?: TargetAngle }
  ) {
    this.hitTime = hitTime;
    this.x = x;
    this.y = y;
    this.targetLimb = targetLimb;
    this.name = name;
    this.type = type;
    this.duration = duration;
    this.targetAngles = targetAngles;
  }
}

export class Lyric {
  time: number;
  duration: number;
  text: string;
  animation: AnimationType;
  style: string;
  isChorus: boolean;

  constructor(
    time: number,
    duration: number,
    text: string,
    animation: AnimationType = 'fadeInUp',
    style: string = 'modern',
    isChorus: boolean = false
  ) {
    this.time = time;
    this.duration = duration;
    this.text = text;
    this.animation = animation;
    this.style = style;
    this.isChorus = isChorus;
  }
}

// =============================================
// ダンエボ風ポーズ定義（全16種類）
// =============================================
const P = {
  // 両手を高く上げる（万歳）
  BANZAI:        { leftArm: { x: 0, y: 0, z: -2.8 }, rightArm: { x: 0, y: 0, z: 2.8 } },
  // Yの字
  Y_POSE:        { leftArm: { x: 0, y: 0, z: -2.0 }, rightArm: { x: 0, y: 0, z: 2.0 } },
  // 両腕を水平に広げるT
  T_WIDE:        { leftArm: { x: 0, y: 0, z: -1.57 }, rightArm: { x: 0, y: 0, z: 1.57 } },
  // 右手だけ高く上げる
  R_UP:          { leftArm: { x: 0, y: 0, z: -0.3 }, rightArm: { x: 0, y: 0, z: 2.6 } },
  // 左手だけ高く上げる
  L_UP:          { leftArm: { x: 0, y: 0, z: -2.6 }, rightArm: { x: 0, y: 0, z: 0.3 } },
  // 右手を斜め上
  R_DIAG_UP:     { leftArm: { x: 0, y: 0, z: -0.5 }, rightArm: { x: 0, y: 0, z: 2.1 } },
  // 左手を斜め上
  L_DIAG_UP:     { leftArm: { x: 0, y: 0, z: -2.1 }, rightArm: { x: 0, y: 0, z: 0.5 } },
  // 右手を下ろして左手を上げる（クロス）
  CROSS_RL:      { leftArm: { x: 0, y: 0, z: -2.4 }, rightArm: { x: 0, y: 0, z: 0.4 } },
  // 逆クロス（左下・右上）
  CROSS_LR:      { leftArm: { x: 0, y: 0, z: -0.4 }, rightArm: { x: 0, y: 0, z: 2.4 } },
  // ガッツポーズ（右手強く上）
  GUTS_R:        { leftArm: { x: 0.3, y: 0, z: -0.4 }, rightArm: { x: -0.5, y: 0, z: 2.7 } },
  // ガッツポーズ（左手強く上）
  GUTS_L:        { leftArm: { x: -0.5, y: 0, z: -2.7 }, rightArm: { x: 0.3, y: 0, z: 0.4 } },
  // 右斜め下に出す
  R_POINT_DOWN:  { leftArm: { x: 0, y: 0, z: -1.0 }, rightArm: { x: 0, y: 0, z: 0.8 } },
  // 左斜め下に出す
  L_POINT_DOWN:  { leftArm: { x: 0, y: 0, z: -0.8 }, rightArm: { x: 0, y: 0, z: 1.0 } },
  // 両手を斜め上広げ（ジャンプ前）
  V_UP:          { leftArm: { x: 0, y: 0, z: -2.3 }, rightArm: { x: 0, y: 0, z: 2.3 } },
  // 両手を前に出す（スラスト）
  THRUST:        { leftArm: { x: 1.2, y: 0, z: -0.6 }, rightArm: { x: 1.2, y: 0, z: 0.6 } },
  // 右肘を引く（引きポーズ）
  PULL_R:        { leftArm: { x: 0, y: 0, z: -1.2 }, rightArm: { x: -0.8, y: 0.5, z: 1.8 } },
};

export const DEMO_MARKERS: MarkerTarget[] = [
  // ======= 序盤 (t=1〜6秒) =======
  // t=1.0: Ripple ウォームアップ
  new MarkerTarget(1.0, 0.8, 0.3, 'rightWrist', "Warm-R", 'Ripple'),

  // t=2.0: Yの字ポーズ
  new MarkerTarget(2.0, 0.5, 0.5, 'fullBody', "Y-Pose", 'Silhouette', undefined, P.Y_POSE),

  // t=3.5: 右だけ上げる
  new MarkerTarget(3.5, 0.5, 0.5, 'fullBody', "R-Up", 'Silhouette', undefined, P.R_UP),

  // t=5.0: 左だけ上げる
  new MarkerTarget(5.0, 0.5, 0.5, 'fullBody', "L-Up", 'Silhouette', undefined, P.L_UP),

  // ======= 中盤前半 (t=6〜10秒) =======
  // t=6.5: Ripple 右手
  new MarkerTarget(6.5, 0.85, 0.5, 'rightWrist', "Hit-R", 'Ripple'),

  // t=7.5: 万歳ポーズ
  new MarkerTarget(7.5, 0.5, 0.5, 'fullBody', "Banzai", 'Silhouette', undefined, P.BANZAI),

  // t=9.0: ガッツポーズ右
  new MarkerTarget(9.0, 0.5, 0.5, 'fullBody', "Guts-R", 'Silhouette', undefined, P.GUTS_R),

  // t=10.5: 右斜め上
  new MarkerTarget(10.5, 0.5, 0.5, 'fullBody', "R-Diag", 'Silhouette', undefined, P.R_DIAG_UP),

  // ======= 中盤後半 (t=11〜14秒) =======
  // t=12.0: Ripple 両手同時
  new MarkerTarget(12.0, 0.15, 0.4, 'leftWrist',  "Strike-L", 'Ripple'),
  new MarkerTarget(12.0, 0.85, 0.4, 'rightWrist', "Strike-R", 'Ripple'),

  // t=12.5: 左斜め上
  new MarkerTarget(12.5, 0.5, 0.5, 'fullBody', "L-Diag", 'Silhouette', undefined, P.L_DIAG_UP),

  // t=13.5: クロスRL
  new MarkerTarget(13.5, 0.5, 0.5, 'fullBody', "Cross-RL", 'Silhouette', undefined, P.CROSS_RL),

  // ======= 後半 (t=14〜17秒) =======
  // t=14.5: T字ワイド
  new MarkerTarget(14.5, 0.5, 0.5, 'fullBody', "T-Wide", 'Silhouette', undefined, P.T_WIDE),

  // t=15.5: ガッツポーズ左
  new MarkerTarget(15.5, 0.5, 0.5, 'fullBody', "Guts-L", 'Silhouette', undefined, P.GUTS_L),

  // t=16.5: Ripple 両手
  new MarkerTarget(16.5, 0.1, 0.3, 'leftWrist',  "Finish-L", 'Ripple'),
  new MarkerTarget(16.5, 0.9, 0.3, 'rightWrist', "Finish-R", 'Ripple'),

  // t=17.5: Vアップで締め
  new MarkerTarget(17.5, 0.5, 0.5, 'fullBody', "V-Up", 'Silhouette', undefined, P.V_UP),
];

export const DEMO_LYRICS = [
  new Lyric(0.5,  1.5, "ARE YOU READY?", "bounceIn",      "modern", true),
  new Lyric(2.0,  1.0, "Y-POSE!",        "explode",       "neon"),
  new Lyric(3.5,  1.0, "RIGHT!",         "slideFromRight","modern"),
  new Lyric(5.0,  1.0, "LEFT!",          "slideFromLeft", "modern"),
  new Lyric(7.5,  1.0, "BANZAI!!",       "bounceIn",      "neon",   true),
  new Lyric(9.0,  1.0, "GUTS!",          "glitch",        "modern"),
  new Lyric(10.5, 1.0, "NICE!",          "slideFromRight","modern"),
  new Lyric(12.5, 1.0, "GO GO GO!",      "explode",       "neon"),
  new Lyric(13.5, 1.0, "CROSS!",         "glitch",        "neon"),
  new Lyric(14.5, 1.0, "SPREAD!",        "wave",          "modern"),
  new Lyric(15.5, 1.0, "GUTS LEFT!",     "bounceIn",      "neon"),
  new Lyric(17.5, 2.0, "PERFECT!!",      "explode",       "modern", true),
];

