/**
 * Vector3 definition and Math utilities
 */
import { MarkerTarget } from '../constants';

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export type PoseFeatures = Record<string, Vector3>;

function sub(a: Vector3, b: Vector3): Vector3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function norm(v: Vector3): Vector3 {
  const mag = Math.sqrt(v.x ** 2 + v.y ** 2 + v.z ** 2);
  return mag === 0 ? { x: 0, y: 0, z: 0 } : { x: v.x / mag, y: v.y / mag, z: v.z / mag };
}

function cross(a: Vector3, b: Vector3): Vector3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x
  };
}

function dot(a: Vector3, b: Vector3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function mid(a: Vector3, b: Vector3): Vector3 {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 };
}

/**
 * 体ローカル座標系（Basis）を構築する
 * Up: 腰中点 -> 肩中点
 * Right: 肩間 (Upと直交化)
 * Forward: Up cross Right
 */
export function buildBodyFrame(landmarks: any[]) {
  const ls = landmarks[11], rs = landmarks[12], lh = landmarks[23], rh = landmarks[24];
  const shoulderMid = mid(ls, rs);
  const hipMid = mid(lh, rh);
  
  const up = norm(sub(shoulderMid, hipMid));
  const tempRight = norm(sub(rs, ls));
  const fwd = norm(cross(tempRight, up));
  const right = norm(cross(up, fwd));

  return { origin: shoulderMid, basis: [right, up, fwd] }; // [X, Y, Z]
}

/**
 * ベクトルを体ローカル座標系に変換する
 */
function toLocal(v: Vector3, basis: Vector3[]): Vector3 {
  return {
    x: dot(v, basis[0]),
    y: dot(v, basis[1]),
    z: dot(v, basis[2])
  };
}

/**
 * ランドマークから正規化されたポーズ特徴（単位ベクトル群）を抽出する
 */
export function extractPoseFeatures(landmarks: any[]): PoseFeatures | null {
  if (!landmarks || landmarks.length < 25) return null;

  const frame = buildBodyFrame(landmarks);
  const { basis } = frame;

  // 各セグメントのベクトル（ワールド）
  const segments = {
    leftUpperArm: sub(landmarks[13], landmarks[11]),
    leftLowerArm: sub(landmarks[15], landmarks[13]),
    rightUpperArm: sub(landmarks[14], landmarks[12]),
    rightLowerArm: sub(landmarks[16], landmarks[14]),
  };

  // ローカル単位ベクトルに変換
  const features: PoseFeatures = {};
  for (const [key, vec] of Object.entries(segments)) {
    features[key] = toLocal(norm(vec), basis);
  }

  return features;
}

/**
 * 2つのポーズ特徴の類似度を計算する (1.0 = 完全一致, 0.0 = 垂直, -1.0 = 反転)
 */
export function calculatePoseSimilarity(user: PoseFeatures, target: PoseFeatures): number {
  let scoreSum = 0;
  let count = 0;

  for (const key in target) {
    if (user[key] && target[key]) {
      const s = dot(user[key], target[key]);
      // 0.0〜1.0 にクランプ（逆方向は 0 扱い）
      scoreSum += Math.max(0, s);
      count++;
    }
  }

  return count > 0 ? scoreSum / count : 0;
}

export function checkPoseMatch(
  worldLandmarks: any[], 
  imageLandmarks: any[], 
  target: MarkerTarget,
  videoAspectRatio: number = 1.0
): { result: 'PERFECT' | 'GOOD' | 'MISS', similarity: number } {
  if (!worldLandmarks || worldLandmarks.length === 0) return { result: 'MISS', similarity: 0 };

  // --- Silhouette Pose Matching (3D Vector Basis) ---
  if (target.type === 'Silhouette') {
    if (!target.targetPoseVectors) return { result: 'MISS', similarity: 0 };
    
    const correctedLandmarks = worldLandmarks.map(lm => ({
      ...lm,
      x: -lm.x 
    }));

    const userFeatures = extractPoseFeatures(correctedLandmarks);
    if (!userFeatures) return { result: 'MISS', similarity: 0 };

    const similarity = calculatePoseSimilarity(userFeatures, target.targetPoseVectors);
    
    // ダンエボ風しきい値調整
    if (similarity > 0.86) return { result: 'PERFECT', similarity }; 
    if (similarity > 0.65) return { result: 'GOOD', similarity };
    return { result: 'MISS', similarity };
  }

  // --- Ripple Hand Matching (2D Screen Basis) ---
  if (target.type === 'Ripple') {
    if (!imageLandmarks || imageLandmarks.length === 0) return { result: 'MISS', similarity: 0 };

    const correctedLandmarks = imageLandmarks.map(lm => ({
      ...lm,
      x: 1.0 - lm.x 
    }));

    const leftWrist = correctedLandmarks[15] ?? correctedLandmarks[13];
    const rightWrist = correctedLandmarks[16] ?? correctedLandmarks[14];
    const hand = target.targetLimb === 'leftWrist' ? leftWrist : rightWrist;

    if (hand) {
      // アスペクト比を考慮して距離を計算 (横長の歪みを補正)
      const dx = (hand.x - target.x) * videoAspectRatio;
      const dy = (hand.y - target.y);
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 0.12) return { result: 'PERFECT', similarity: 1.0 - dist };
      if (dist < 0.22) return { result: 'GOOD', similarity: 1.0 - dist };
    }
    return { result: 'MISS', similarity: 0 };
  }

  return { result: 'MISS', similarity: 0 }; 
}
