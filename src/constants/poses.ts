/**
 * プリセットポーズ定義 (Euler角 / ラジアン形式)
 * Kalidokitの出力と同じ形式で、全身のポーズを定義できます。
 */

export type EulerPose = {
  RightUpperArm?: { x: number; y: number; z: number };
  RightLowerArm?: { x: number; y: number; z: number };
  LeftUpperArm?:  { x: number; y: number; z: number };
  LeftLowerArm?:  { x: number; y: number; z: number };
  RightUpperLeg?: { x: number; y: number; z: number };
  LeftUpperLeg?:  { x: number; y: number; z: number };
  RightLowerLeg?: { x: number; y: number; z: number };
  LeftLowerLeg?:  { x: number; y: number; z: number };
  Spine?:         { x: number; y: number; z: number };
  Hips?: { 
    rotation: { x: number; y: number; z: number };
    position?: { x: number; y: number; z: number };
  };
};

const PI = Math.PI;

export const POSES: Record<string, EulerPose> = {
  // 1. T-POSE (基本)
  T_POSE: {
    RightUpperArm: { x: 0, y: 0, z: -PI * 0.5 },
    LeftUpperArm:  { x: 0, y: 0, z:  PI * 0.5 },
    RightLowerArm: { x: 0, y: 0, z: 0 },
    LeftLowerArm:  { x: 0, y: 0, z: 0 },
  },

  // 2. BANZAI (両手を真上に)
  BANZAI: {
    RightUpperArm: { x: 0, y: 0, z: -PI * 0.95 },
    LeftUpperArm:  { x: 0, y: 0, z:  PI * 0.95 },
    RightLowerArm: { x: 0, y: 0, z: 0 },
    LeftLowerArm:  { x: 0, y: 0, z: 0 },
    Spine: { x: -0.1, y: 0, z: 0 }, // 少し反る
  },

  // 3. Y_POSE (両手を斜め上)
  Y_POSE: {
    RightUpperArm: { x: 0, y: 0, z: -PI * 0.75 },
    LeftUpperArm:  { x: 0, y: 0, z:  PI * 0.75 },
    RightLowerArm: { x: 0, y: 0, z: 0 },
    LeftLowerArm:  { x: 0, y: 0, z: 0 },
  },

  // 4. R_UP (右手を上げ、左手は腰)
  R_UP: {
    RightUpperArm: { x: 0, y: 0, z: -PI * 0.9 },
    RightLowerArm: { x: 0, y: 0, z: 0 },
    LeftUpperArm:  { x: 0, y: 0.2, z: PI * 0.15 },
    LeftLowerArm:  { x: 0, y: 0.5, z: 0 },
  },

  // 5. L_UP (左手を上げ、右手は腰)
  L_UP: {
    LeftUpperArm:  { x: 0, y: 0, z:  PI * 0.9 },
    LeftLowerArm:  { x: 0, y: 0, z: 0 },
    RightUpperArm: { x: 0, y: -0.2, z: -PI * 0.15 },
    RightLowerArm: { x: 0, y: -0.5, z: 0 },
  },

  // 6. GUTS_R (右ガッツポーズ)
  GUTS_R: {
    RightUpperArm: { x: 0.3, y: -0.2, z: -PI * 0.3 },
    RightLowerArm: { x: 0, y: 0, z: -PI * 0.6 }, // 肘を曲げる
    LeftUpperArm:  { x: 0, y: 0.2, z: PI * 0.15 },
    LeftLowerArm:  { x: 0, y: 0.5, z: 0 },
  },

  // 7. GUTS_L (左ガッツポーズ)
  GUTS_L: {
    LeftUpperArm:  { x: 0.3, y: 0.2, z:  PI * 0.3 },
    LeftLowerArm:  { x: 0, y: 0, z:  PI * 0.6 },
    RightUpperArm: { x: 0, y: -0.2, z: -PI * 0.15 },
    RightLowerArm: { x: 0, y: -0.5, z: 0 },
  },

  // 8. THRUST (両手を前へ)
  THRUST: {
    RightUpperArm: { x: -PI * 0.4, y: -0.2, z: -0.1 },
    LeftUpperArm:  { x: -PI * 0.4, y: 0.2, z: 0.1 },
    RightLowerArm: { x: 0, y: 0, z: -0.2 },
    LeftLowerArm:  { x: 0, y: 0, z: 0.2 },
  },

  // 9. V_UP (V字。肘を曲げて頭の上に)
  V_UP: {
    RightUpperArm: { x: 0.2, y: 0, z: -PI * 0.6 },
    RightLowerArm: { x: 0, y: 0, z: -PI * 0.4 },
    LeftUpperArm:  { x: 0.2, y: 0, z: PI * 0.6 },
    LeftLowerArm:  { x: 0, y: 0, z: PI * 0.4 },
  },

  // 10. SQUAT (スクワットポーズ)
  SQUAT: {
    RightUpperLeg: { x: -PI * 0.3, y: 0, z: 0 },
    LeftUpperLeg:  { x: -PI * 0.3, y: 0, z: 0 },
    RightLowerLeg: { x: PI * 0.6, y: 0, z: 0 },
    LeftLowerLeg:  { x: PI * 0.6, y: 0, z: 0 },
    Hips: { rotation: { x: 0.2, y: 0, z: 0 } },
    RightUpperArm: { x: 0, y: 0, z: -PI * 0.3 },
    LeftUpperArm:  { x: 0, y: 0, z: PI * 0.3 },
  }
};
