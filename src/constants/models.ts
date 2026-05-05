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

export const BUILTIN_MODELS: BuiltinModel[] = [
  {
    id: 'default',
    label: 'V_Miku (by 602e)',
    url: '/default.vrm',
    author: '602e',
  },
  {
    id: 'v_miku_full',
    label: 'V_Miku_full (by 602e)',
    url: '/V_Miku_full.vrm',
    author: '602e',
  },
  {
    id: 'snow_caesar',
    label: 'Snow Miku (by Caesar)',
    url: '/139171007668622842.vrm',
    author: 'Caesar',
  },
  {
    id: 'miku_alt',
    label: 'Hatsune Miku Alt',
    url: '/3040148004813337719.vrm',
    author: 'Unknown'
  },
];
