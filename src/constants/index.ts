export const BPM = 120;

export type AnimationType = 
| 'fadeIn' | 'fadeInUp' | 'fadeInDown' | 'bounceIn' 
| 'scaleUp' | 'slideFromLeft' | 'slideFromRight' 
| 'typewriter' | 'wave' | 'glitch' | 'explode';

export type MarkerType = 'Ripple' | 'Stream' | 'Lock' | 'Silhouette';

export interface PoseAngles {
  leftArmElbow?: number;
  rightArmElbow?: number;
  leftShoulderLift?: number;
  rightShoulderLift?: number;
  leftArmOpen?: number;
  rightArmOpen?: number;
}

export class MarkerTarget {
  hitTime: number;
  x: number; // 0.0 to 1.0 (normalized screen x)
  y: number; // 0.0 to 1.0 (normalized screen y)
  targetLimb: 'leftWrist' | 'rightWrist' | 'fullBody';
  type: MarkerType;
  duration?: number;
  name: string;
  targetPoseAngles?: PoseAngles;

  constructor(
    hitTime: number,
    x: number,
    y: number,
    targetLimb: 'leftWrist' | 'rightWrist' | 'fullBody',
    name: string,
    type: MarkerType = 'Ripple',
    duration?: number,
    targetPoseAngles?: PoseAngles
  ) {
    this.hitTime = hitTime;
    this.x = x;
    this.y = y;
    this.targetLimb = targetLimb;
    this.name = name;
    this.type = type;
    this.duration = duration;
    this.targetPoseAngles = targetPoseAngles;
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
// ダンエボ風ポーズ定義 (Joint Angle Basis)
// 角度はラジアン: 3.14 = 180度, 1.57 = 90度
// =============================================
const P: Record<string, PoseAngles> = {
  // 両手を高く上げる（万歳）: 肘は伸びている(3.14), 肩は真上(3.14)
  BANZAI: { 
    leftArmElbow: 3.0, rightArmElbow: 3.0, 
    leftShoulderLift: 2.8, rightShoulderLift: 2.8 
  },
  // Yの字: 肘は伸びている(3.14), 肩は斜め上(2.3)
  Y_POSE: { 
    leftArmElbow: 3.0, rightArmElbow: 3.0, 
    leftShoulderLift: 2.3, rightShoulderLift: 2.3 
  },
  // T字ワイド: 肘は伸びている(3.14), 肩は水平(1.57)
  T_WIDE: { 
    leftArmElbow: 3.0, rightArmElbow: 3.0, 
    leftShoulderLift: 1.5, rightShoulderLift: 1.5 
  },
  // 右手だけ上げる: 右肩(2.8), 左肩(0.3)
  R_UP: { 
    leftArmElbow: 3.0, rightArmElbow: 3.0, 
    leftShoulderLift: 0.3, rightShoulderLift: 2.8 
  },
  // 左手だけ上げる
  L_UP: { 
    leftArmElbow: 3.0, rightArmElbow: 3.0, 
    leftShoulderLift: 2.8, rightShoulderLift: 0.3 
  },
  // ガッツポーズ右: 肘を曲げている(1.2), 肩を上げている(2.0)
  GUTS_R: { 
    leftArmElbow: 3.0, rightArmElbow: 1.2, 
    leftShoulderLift: 0.3, rightShoulderLift: 2.0 
  },
  // ガッツポーズ左
  GUTS_L: { 
    leftArmElbow: 1.2, rightArmElbow: 3.0, 
    leftShoulderLift: 2.0, rightShoulderLift: 0.3 
  },
  // 両手を前に出す（スラスト）: 肘は伸びている, 肩は前（開き角が小さくなる）
  THRUST: { 
    leftArmElbow: 3.0, rightArmElbow: 3.0, 
    leftArmOpen: 0.5, rightArmOpen: 0.5 
  },
  // Vアップ: 肩は斜め上, 肘は少し曲がっている
  V_UP: { 
    leftArmElbow: 2.5, rightArmElbow: 2.5, 
    leftShoulderLift: 2.5, rightShoulderLift: 2.5 
  },
};

export const DEMO_MARKERS: MarkerTarget[] = [
  // ======= 序盤 (t=1〜6秒) =======
  new MarkerTarget(1.0, 0.8, 0.3, 'rightWrist', "Warm-R", 'Ripple'),
  new MarkerTarget(2.0, 0.5, 0.5, 'fullBody', "Y-Pose", 'Silhouette', undefined, P.Y_POSE),
  new MarkerTarget(3.5, 0.5, 0.5, 'fullBody', "R-Up", 'Silhouette', undefined, P.R_UP),
  new MarkerTarget(5.0, 0.5, 0.5, 'fullBody', "L-Up", 'Silhouette', undefined, P.L_UP),

  // ======= 中盤前半 (t=6〜10秒) =======
  new MarkerTarget(6.5, 0.85, 0.5, 'rightWrist', "Hit-R", 'Ripple'),
  new MarkerTarget(7.5, 0.5, 0.5, 'fullBody', "Banzai", 'Silhouette', undefined, P.BANZAI),
  new MarkerTarget(9.0, 0.5, 0.5, 'fullBody', "Guts-R", 'Silhouette', undefined, P.GUTS_R),
  new MarkerTarget(10.5, 0.5, 0.5, 'fullBody', "T-Wide", 'Silhouette', undefined, P.T_WIDE),

  // ======= 中盤後半 (t=11〜14秒) =======
  new MarkerTarget(12.0, 0.15, 0.4, 'leftWrist',  "Strike-L", 'Ripple'),
  new MarkerTarget(12.0, 0.85, 0.4, 'rightWrist', "Strike-R", 'Ripple'),
  new MarkerTarget(13.0, 0.5, 0.5, 'fullBody', "Thrust", 'Silhouette', undefined, P.THRUST),

  // ======= 後半 (t=14〜17秒) =======
  new MarkerTarget(14.5, 0.5, 0.5, 'fullBody', "T-Wide", 'Silhouette', undefined, P.T_WIDE),
  new MarkerTarget(15.5, 0.5, 0.5, 'fullBody', "Guts-L", 'Silhouette', undefined, P.GUTS_L),
  new MarkerTarget(16.5, 0.1, 0.3, 'leftWrist',  "Finish-L", 'Ripple'),
  new MarkerTarget(16.5, 0.9, 0.3, 'rightWrist', "Finish-R", 'Ripple'),
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

