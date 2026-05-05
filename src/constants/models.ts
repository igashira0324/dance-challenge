export type BuiltinModel = {
  id: string;
  label: string;
  url: string;
  author?: string;
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
    author: 'Ppgrules945'
  },
  {
    id: 'sakura_ppg',
    label: 'Sakura Miku (by Ppgrules945)',
    url: '/831740847908447423.vrm',
    author: 'Ppgrules945'
  },
  {
    id: 'snow_ppg',
    label: 'Snow Miku 2 (by Ppgrules945)',
    url: '/734209068825969914.vrm',
    author: 'Ppgrules945'
  },
  {
    id: 'miku_alt',
    label: 'Hatsune Miku Alt',
    url: '/3040148004813337719.vrm',
    author: 'Unknown'
  },
];
