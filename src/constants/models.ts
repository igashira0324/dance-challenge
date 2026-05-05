import type { VRMHumanBoneName } from '@pixiv/three-vrm';

export type BoneEuler = {
  x?: number;
  y?: number;
  z?: number;
};

export type PoseCorrection = Partial<Record<VRMHumanBoneName, BoneEuler>>;

export type BuiltinModel = {
  id: string;
  label: string;
  url: string;
  author?: string;
  photoBoothIdlePose?: PoseCorrection;
  enablePhotoBoothBodyTracking?: boolean;
};

export const DEFAULT_MODEL_ID = 'default';

const PPG_PHOTO_BOOTH_IDLE_POSE: PoseCorrection = {
  leftUpperArm:  { x: 0.1, z: -2.75 },
  rightUpperArm: { x: 0.1, z:  2.75 },
};

export const BUILTIN_MODELS: BuiltinModel[] = [
  {
    id: 'default',
    label: 'V_Miku (by 602e)',
    url: '/default.vrm',
    author: '602e',
  },
  {
    id: 'sn_miku',
    label: 'sn_式初音ミク (by sn_)',
    url: '/7002965447371409404.vrm',
    author: 'sn_',
  },
  {
    id: 'snow_caesar',
    label: 'Snow Miku (by Caesar)',
    url: '/139171007668622842.vrm',
    author: 'Caesar',
  },
  {
    id: 'miku_ppg',
    label: 'Hatsune Miku (by Ppgrules945)',
    url: '/9199676059820251883.vrm',
    author: 'Ppgrules945',
    photoBoothIdlePose: PPG_PHOTO_BOOTH_IDLE_POSE,
    enablePhotoBoothBodyTracking: false,
  },
  {
    id: 'sakura_ppg',
    label: 'Sakura Miku (by Ppgrules945)',
    url: '/831740847908447423.vrm',
    author: 'Ppgrules945',
    photoBoothIdlePose: PPG_PHOTO_BOOTH_IDLE_POSE,
    enablePhotoBoothBodyTracking: false,
  },
  {
    id: 'snow_ppg',
    label: 'Snow Miku 2 (by Ppgrules945)',
    url: '/734209068825969914.vrm',
    author: 'Ppgrules945',
    photoBoothIdlePose: PPG_PHOTO_BOOTH_IDLE_POSE,
    enablePhotoBoothBodyTracking: false,
  },
  {
    id: 'miku_alt',
    label: 'Hatsune Miku Alt',
    url: '/3040148004813337719.vrm',
    author: 'Unknown'
  },
];
