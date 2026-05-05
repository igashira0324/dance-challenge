import type { EulerPose } from '../constants/poses';

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export type PoseFeatures = Record<string, Vector3>;

export type MarkerType = 'Ripple' | 'Stream' | 'Lock' | 'Silhouette';

export class MarkerTarget {
  hitTime: number;
  x: number;
  y: number;
  targetLimb: 'leftWrist' | 'rightWrist' | 'fullBody';
  type: MarkerType;
  id: string;
  duration?: number;
  name: string;
  targetPoseVectors?: PoseFeatures;
  targetEulerPose?: EulerPose;

  constructor(
    hitTime: number,
    x: number,
    y: number,
    targetLimb: 'leftWrist' | 'rightWrist' | 'fullBody',
    name: string,
    type: MarkerType = 'Ripple',
    duration?: number,
    targetPoseVectors?: PoseFeatures,
    targetEulerPose?: EulerPose
  ) {
    this.hitTime = hitTime;
    this.x = x;
    this.y = y;
    this.targetLimb = targetLimb;
    this.name = name;
    this.type = type;
    this.id = `${hitTime.toFixed(2)}-${targetLimb}-${name.replace(/\s+/g, '-')}`;
    this.duration = duration;
    this.targetPoseVectors = targetPoseVectors;
    this.targetEulerPose = targetEulerPose;
  }
}

export type AnimationType = 
| 'fadeIn' | 'fadeInUp' | 'fadeInDown' | 'bounceIn' 
| 'scaleUp' | 'slideFromLeft' | 'slideFromRight' 
| 'typewriter' | 'wave' | 'glitch' | 'explode';

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
