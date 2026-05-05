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

import { PoseFeatures } from '../utils/poseUtils';

export class MarkerTarget {
  hitTime: number;
  x: number; // 0.0 to 1.0 (normalized screen x)
  y: number; // 0.0 to 1.0 (normalized screen y)
  targetLimb: 'leftWrist' | 'rightWrist' | 'fullBody';
  type: MarkerType;
  id: number; // Added unique ID for tracking
  duration?: number;
  name: string;
  targetPoseAngles?: PoseAngles;
  targetPoseVectors?: PoseFeatures;

  constructor(
    hitTime: number,
    x: number,
    y: number,
    targetLimb: 'leftWrist' | 'rightWrist' | 'fullBody',
    name: string,
    type: MarkerType = 'Ripple',
    duration?: number,
    targetPoseAngles?: PoseAngles,
    targetPoseVectors?: PoseFeatures
  ) {
    this.hitTime = hitTime;
    this.x = x;
    this.y = y;
    this.targetLimb = targetLimb;
    this.name = name;
    this.type = type;
    this.id = hitTime; // Use hitTime as ID for now
    this.duration = duration;
    this.targetPoseAngles = targetPoseAngles;
    this.targetPoseVectors = targetPoseVectors;
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
const V: Record<string, PoseFeatures> = {
  T_POSE: {
    leftUpperArm: { x: 1, y: 0, z: 0 },
    leftLowerArm: { x: 1, y: 0, z: 0 },
    rightUpperArm: { x: -1, y: 0, z: 0 },
    rightLowerArm: { x: -1, y: 0, z: 0 }
  },
  BANZAI: {
    leftUpperArm: { x: 0.2, y: 0.98, z: 0 },
    leftLowerArm: { x: 0.2, y: 0.98, z: 0 },
    rightUpperArm: { x: -0.2, y: 0.98, z: 0 },
    rightLowerArm: { x: -0.2, y: 0.98, z: 0 }
  },
  Y_POSE: {
    leftUpperArm: { x: 0.7, y: 0.7, z: 0 },
    leftLowerArm: { x: 0.7, y: 0.7, z: 0 },
    rightUpperArm: { x: -0.7, y: 0.7, z: 0 },
    rightLowerArm: { x: -0.7, y: 0.7, z: 0 }
  },
  R_UP: {
    leftUpperArm: { x: 0.5, y: -0.86, z: 0 },
    rightUpperArm: { x: -0.2, y: 0.98, z: 0 }
  }
};

export const DEMO_MARKERS: MarkerTarget[] = [
  // ======= 序盤 (t=1〜6秒) =======
  new MarkerTarget(1.0, 0.8, 0.3, 'rightWrist', "Warm-R", 'Ripple'),
  new MarkerTarget(2.0, 0.5, 0.5, 'fullBody', "Y-Pose", 'Silhouette', undefined, undefined, V.Y_POSE),
  new MarkerTarget(3.5, 0.5, 0.5, 'fullBody', "R-Up", 'Silhouette', undefined, undefined, V.R_UP),
  new MarkerTarget(5.0, 0.5, 0.5, 'fullBody', "L-Up", 'Silhouette', undefined, undefined, V.BANZAI),

  // ======= 中盤前半 (t=6〜10秒) =======
  new MarkerTarget(6.5, 0.85, 0.5, 'rightWrist', "Hit-R", 'Ripple'),
  new MarkerTarget(7.5, 0.5, 0.5, 'fullBody', "Banzai", 'Silhouette', undefined, undefined, V.BANZAI),
  new MarkerTarget(9.0, 0.5, 0.5, 'fullBody', "Guts-R", 'Silhouette', undefined, undefined, V.Y_POSE),
  new MarkerTarget(10.5, 0.5, 0.5, 'fullBody', "T-Wide", 'Silhouette', undefined, undefined, V.T_POSE),

  // ======= 中盤後半 (t=11〜14秒) =======
  new MarkerTarget(12.0, 0.15, 0.4, 'leftWrist',  "Strike-L", 'Ripple'),
  new MarkerTarget(12.0, 0.85, 0.4, 'rightWrist', "Strike-R", 'Ripple'),
  new MarkerTarget(13.0, 0.5, 0.5, 'fullBody', "Thrust", 'Silhouette', undefined, undefined, V.T_POSE),

  // ======= 後半 (t=14〜17秒) =======
  new MarkerTarget(14.5, 0.5, 0.5, 'fullBody', "T-Wide", 'Silhouette', undefined, undefined, V.T_POSE),
  new MarkerTarget(15.5, 0.5, 0.5, 'fullBody', "Guts-L", 'Silhouette', undefined, undefined, V.BANZAI),
  new MarkerTarget(16.5, 0.1, 0.3, 'leftWrist',  "Finish-L", 'Ripple'),
  new MarkerTarget(16.5, 0.9, 0.3, 'rightWrist', "Finish-R", 'Ripple'),
  new MarkerTarget(17.5, 0.5, 0.5, 'fullBody', "V-Up", 'Silhouette', undefined, undefined, V.Y_POSE),
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

