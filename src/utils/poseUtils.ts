/**
 * Vector3 definition
 */
export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

/**
 * 3つの点 A, B, C から、頂点 B における角度（ラジアン）を計算する
 * (肩-肘-手首 など)
 */
export function computeJointAngle(a: Vector3, b: Vector3, c: Vector3): number {
  const ba = { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
  const bc = { x: c.x - b.x, y: c.y - b.y, z: c.z - b.z };

  const dot = ba.x * bc.x + ba.y * bc.y + ba.z * bc.z;
  const magBA = Math.sqrt(ba.x ** 2 + ba.y ** 2 + ba.z ** 2);
  const magBC = Math.sqrt(bc.x ** 2 + bc.y ** 2 + bc.z ** 2);

  if (magBA === 0 || magBC === 0) return 0;

  // 内積から角度を求める
  return Math.acos(Math.min(1, Math.max(-1, dot / (magBA * magBC))));
}

/**
 * ランドマーク配列から主要な関節角度を抽出する
 */
export function extractKeyJointAngles(landmarks: any[]) {
  if (!landmarks || landmarks.length < 25) return null;

  return {
    // 左腕: 肩(11)-肘(13)-手首(15)
    leftArmElbow: computeJointAngle(landmarks[11], landmarks[13], landmarks[15]),
    // 右腕: 肩(12)-肘(14)-手首(16)
    rightArmElbow: computeJointAngle(landmarks[12], landmarks[14], landmarks[16]),
    // 左肩の挙上: 腰(23)-肩(11)-肘(13)
    leftShoulderLift: computeJointAngle(landmarks[23], landmarks[11], landmarks[13]),
    // 右肩の挙上: 腰(24)-肩(12)-肘(14)
    rightShoulderLift: computeJointAngle(landmarks[24], landmarks[12], landmarks[14]),
    // 左腕の開き: 右肩(12)-左肩(11)-左肘(13)
    leftArmOpen: computeJointAngle(landmarks[12], landmarks[11], landmarks[13]),
    // 右腕の開き: 左肩(11)-右肩(12)-右肘(14)
    rightArmOpen: computeJointAngle(landmarks[11], landmarks[12], landmarks[14]),
  };
}

/**
 * 2つの角度セットの差異を計算する
 */
export function compareAngles(userAngles: any, targetAngles: any): number {
  if (!userAngles || !targetAngles) return 999;

  let diff = 0;
  let count = 0;

  for (const key in targetAngles) {
    if (userAngles[key] !== undefined && targetAngles[key] !== undefined) {
      diff += Math.abs(userAngles[key] - targetAngles[key]);
      count++;
    }
  }

  return count > 0 ? diff / count : 999;
}
