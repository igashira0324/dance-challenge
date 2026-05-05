import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRM } from '@pixiv/three-vrm';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { MarkerTarget, PoseFeatures } from '../types/game';
import type { EulerPose } from '../constants/poses';
import type { PoseCorrection } from '../constants/models';

class VRMService {
  private loader: GLTFLoader;
  private scene: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private renderer: THREE.WebGLRenderer | null = null;
  private currentVrm: VRM | null = null;
  
  private silhouetteL: THREE.Group | null = null;
  private silhouetteR: THREE.Group | null = null;
  
  // humanoidName -> THREE ObjectName
  private humanoidBoneNameMap = new Map<string, string>();
  // THREE ObjectName -> Object3D (cloned)
  private silhouetteLBones = new Map<string, THREE.Object3D>();
  private silhouetteRBones = new Map<string, THREE.Object3D>();

  private currentLoadId = 0;
  private _eulerPoseDebugDone = false;
  private currentRestPoseCorrection: PoseCorrection = {};

  constructor() {
    this.loader = new GLTFLoader();
    this.loader.register((parser) => {
      return new VRMLoaderPlugin(parser);
    });
  }

  init(canvas: HTMLCanvasElement) {
    if (this.renderer) return;

    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);

    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(40.0, window.innerWidth / window.innerHeight, 0.1, 20.0);
    this.camera.position.set(0.0, 1.0, 3.3); // Closer for 1.5x zoom
    this.camera.lookAt(0, 0.85, 0);

    const light = new THREE.DirectionalLight(0xffffff, Math.PI);
    light.position.set(1.0, 1.0, 1.0).normalize();
    this.scene.add(light);
    
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(ambientLight);

    window.addEventListener('resize', this.onResize);
  }

  private onResize = () => {
    if (this.camera && this.renderer) {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
  };

  setPosition(x: number, y: number, z: number) {
    if (this.currentVrm) {
      this.currentVrm.scene.position.set(x, y, z);
    }
  }

  setRotation(y: number) {
    if (this.currentVrm) {
      this.currentVrm.scene.rotation.y = y;
    }
  }

  takeScreenshot(): string | null {
    if (!this.renderer || !this.scene || !this.camera) return null;
    this.renderer.render(this.scene, this.camera);
    return this.renderer.domElement.toDataURL('image/png');
  }

  private async _loadSingleVrm(url: string): Promise<VRM> {
    return new Promise((resolve, reject) => {
      this.loader.load(url, (gltf: GLTF) => {
        resolve(gltf.userData.vrm as VRM);
      }, undefined, reject);
    });
  }

  private _applySilhouetteMaterial(scene: THREE.Group) {
    scene.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh;
        mesh.material = new THREE.MeshBasicMaterial({
          color: 0x00ff66,
          transparent: true,
          opacity: 0.5,
          depthWrite: false,
          blending: THREE.AdditiveBlending
        });
      }
    });
  }

  async loadVRM(url: string, options: { 
    restPoseCorrection?: PoseCorrection,
  } = {}): Promise<VRM> {
    const loadId = ++this.currentLoadId;
    this.clearCurrentFromScene();

    this.currentRestPoseCorrection = options.restPoseCorrection ?? {};

    console.log(`Starting load VRM (ID: ${loadId}): ${url}`);
    
    // 1体だけロード
    const vrm = await this._loadSingleVrm(url);

    if (loadId !== this.currentLoadId) {
      return vrm; 
    }

    const isVrm0 = vrm.meta?.metaVersion === '0';
    vrm.scene.rotation.y = isVrm0 ? Math.PI : 0;
    vrm.scene.visible = true;

    // Apply rest pose correction if any
    this.applyRestPoseCorrection(vrm, 1.0);
    vrm.update(0);

    // ボーン名のマッピングを保存
    this.humanoidBoneNameMap.clear();
    const HUMANOID_BONES = [
      'leftUpperArm', 'leftLowerArm', 'rightUpperArm', 'rightLowerArm',
      'leftUpperLeg', 'leftLowerLeg', 'rightUpperLeg', 'rightLowerLeg',
      'spine', 'hips'
    ];
    for (const name of HUMANOID_BONES) {
      const node = vrm.humanoid.getNormalizedBoneNode(name as any);
      if (node) {
        this.humanoidBoneNameMap.set(name, node.name);
        console.log(`[VRM] Bone mapping: ${name} -> ${node.name}`);
      } else {
        console.warn(`[VRM] Bone NOT FOUND: ${name}`);
      }
    }

    // クローンを作成
    this.silhouetteL = SkeletonUtils.clone(vrm.scene) as THREE.Group;
    this.silhouetteR = SkeletonUtils.clone(vrm.scene) as THREE.Group;

    this.silhouetteLBones.clear();
    this.silhouetteRBones.clear();
    this.silhouetteL.traverse(obj => this.silhouetteLBones.set(obj.name, obj));
    this.silhouetteR.traverse(obj => this.silhouetteRBones.set(obj.name, obj));

    // Debug: verify silhouette bone lookup
    console.log(`[VRM] Silhouette L bones count: ${this.silhouetteLBones.size}`);
    for (const [humanoidName, threeName] of this.humanoidBoneNameMap.entries()) {
      const found = this.silhouetteLBones.has(threeName);
      if (!found) {
        console.warn(`[VRM] Silhouette L missing bone: ${humanoidName} -> ${threeName}`);
      }
    }

    this._applySilhouetteMaterial(this.silhouetteL);
    this._applySilhouetteMaterial(this.silhouetteR);
    
    this.silhouetteL.visible = false;
    this.silhouetteR.visible = false;

    if (this.scene) {
      this.scene.add(vrm.scene);
      this.scene.add(this.silhouetteL);
      this.scene.add(this.silhouetteR);
    }
    
    this.currentVrm = vrm;
    
    console.log(`Successfully loaded VRM and cloned silhouettes (ID: ${loadId})`);
    return vrm;
  }

  private clearCurrentFromScene() {
    if (!this.scene) return;
    
    if (this.currentVrm) {
      this.scene.remove(this.currentVrm.scene);
      this.currentVrm = null;
    }
    if (this.silhouetteL) {
      this.scene.remove(this.silhouetteL);
      this.silhouetteL = null;
    }
    if (this.silhouetteR) {
      this.scene.remove(this.silhouetteR);
      this.silhouetteR = null;
    }

    this.scene.children.forEach(child => {
      if (child.name === 'VRM' || child.userData?.vrm) {
        this.scene?.remove(child);
      }
    });
  }

  private applyRestPoseCorrection(vrm: VRM, lerpAmount = 1.0) {
    if (!vrm?.humanoid || !this.currentRestPoseCorrection) return;

    for (const [boneName, rot] of Object.entries(this.currentRestPoseCorrection)) {
      const bone = vrm.humanoid.getNormalizedBoneNode(boneName as any);
      if (!bone || !rot) continue;

      const correctionEuler = new THREE.Euler(
        (rot.x ?? 0),
        (rot.y ?? 0),
        (rot.z ?? 0)
      );

      const correctionQuat = new THREE.Quaternion().setFromEuler(correctionEuler);
      bone.quaternion.slerp(correctionQuat, lerpAmount);
    }
  }

  resetToCorrectedPose(vrm: VRM) {
    if (!vrm?.humanoid) return;
    vrm.humanoid.resetNormalizedPose();
    this.applyRestPoseCorrection(vrm, 1.0);
    vrm.update(0);
  }

  applyPose(vrm: VRM, pose: any, lerpAmountParam = 0.3) {
    if (!pose || !vrm) return;
    
    let rigRotation = (
      name: string,
      rotation: { x: number, y: number, z: number },
      dampener = 1,
      lerpAmount = lerpAmountParam
    ) => {
      if (!vrm || !vrm.humanoid) return;
      const part = vrm.humanoid.getNormalizedBoneNode(name as any);
      if (!part) return;

      const euler = new THREE.Euler(
        rotation.x * dampener,
        rotation.y * dampener,
        rotation.z * dampener
      );
      const quaternion = new THREE.Quaternion().setFromEuler(euler);
      part.quaternion.slerp(quaternion, lerpAmount);
    };

    if (pose.RightUpperArm) rigRotation('rightUpperArm', pose.RightUpperArm);
    if (pose.RightLowerArm) rigRotation('rightLowerArm', pose.RightLowerArm);
    if (pose.LeftUpperArm) rigRotation('leftUpperArm', pose.LeftUpperArm);
    if (pose.LeftLowerArm) rigRotation('leftLowerArm', pose.LeftLowerArm);
    if (pose.RightHand) rigRotation('rightHand', pose.RightHand);
    if (pose.LeftHand) rigRotation('leftHand', pose.LeftHand);
    if (pose.RightUpperLeg) rigRotation('rightUpperLeg', pose.RightUpperLeg);
    if (pose.RightLowerLeg) rigRotation('rightLowerLeg', pose.RightLowerLeg);
    if (pose.LeftUpperLeg) rigRotation('leftUpperLeg', pose.LeftUpperLeg);
    if (pose.LeftLowerLeg) rigRotation('leftLowerLeg', pose.LeftLowerLeg);

    if (pose.Hips) {
      if (pose.Hips.rotation) rigRotation('hips', pose.Hips.rotation);
    }

    if (pose.Spine) rigRotation('spine', pose.Spine);
  }

  private faceState: Record<string, number> = {};

  applyFaceFromBlendshapes(vrm: VRM, blendshapes: Array<{ categoryName: string; score: number }>) {
    if (!vrm || !vrm.expressionManager || !blendshapes) return;

    const map: Record<string, number> = {};
    for (const b of blendshapes) map[b.categoryName] = b.score;

    const sLerp = (name: string, target: number, k = 0.4) => {
      if (isNaN(target)) return;
      const prev = this.faceState[name] ?? 0;
      const cur = prev + (target - prev) * k;
      this.faceState[name] = cur;
      vrm.expressionManager?.setValue(name, cur);
    };

    const adjust = (v: number) => Math.max(0, Math.min(1, (v - 0.35) * 1.6));
    sLerp('blinkLeft',  adjust(map['eyeBlinkLeft']  ?? 0));
    sLerp('blinkRight', adjust(map['eyeBlinkRight'] ?? 0));

    // Improved vowel mapping for natural expressions
    const jawOpen = map['jawOpen'] ?? 0;
    const smileL = map['mouthSmileLeft'] ?? 0;
    const smileR = map['mouthSmileRight'] ?? 0;
    const funnel = map['mouthFunnel'] ?? 0;
    const pucker = map['mouthPucker'] ?? 0;
    const stretchL = map['mouthStretchLeft'] ?? 0;
    const stretchR = map['mouthStretchRight'] ?? 0;

    sLerp('aa', jawOpen * 1.2);
    sLerp('ih', jawOpen * 0.3 + smileL + smileR);
    sLerp('ou', funnel + pucker * 0.5);
    sLerp('ee', smileL + smileR - jawOpen * 0.3 + (stretchL + stretchR) * 0.2);
    sLerp('oh', funnel * 0.5 + jawOpen * 0.7);

    // Optional: look direction (commented out as per review suggestion to potentially enable later)
    // sLerp('lookUp',   map['eyeLookUpLeft']   ?? 0);
    // sLerp('lookDown', map['eyeLookDownLeft'] ?? 0);
  }

  applyEulerPose(target: VRM | THREE.Group, pose: EulerPose, lerpAmount = 1.0) {
    const isVrm = (target as any).humanoid !== undefined;
    const bones = target === this.silhouetteL ? this.silhouetteLBones :
                  target === this.silhouetteR ? this.silhouetteRBones : null;

    let applied = 0;
    let missed = 0;

    const set = (humanoidName: string, rot: {x:number,y:number,z:number}) => {
      let bone: THREE.Object3D | null = null;
      if (isVrm) {
        bone = (target as VRM).humanoid.getNormalizedBoneNode(humanoidName as any);
      } else {
        const threeName = this.humanoidBoneNameMap.get(humanoidName);
        if (threeName && bones) {
          bone = bones.get(threeName) || null;
        }
      }
      if (!bone) {
        missed++;
        return;
      }
      applied++;
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rot.x, rot.y, rot.z));
      // For silhouettes, directly copy the quaternion for instant pose application
      if (!isVrm) {
        bone.quaternion.copy(q);
      } else {
        bone.quaternion.slerp(q, lerpAmount);
      }
    };

    if (pose.RightUpperArm) set('rightUpperArm', pose.RightUpperArm);
    if (pose.RightLowerArm) set('rightLowerArm', pose.RightLowerArm);
    if (pose.LeftUpperArm)  set('leftUpperArm',  pose.LeftUpperArm);
    if (pose.LeftLowerArm)  set('leftLowerArm',  pose.LeftLowerArm);
    if (pose.RightUpperLeg) set('rightUpperLeg', pose.RightUpperLeg);
    if (pose.LeftUpperLeg)  set('leftUpperLeg',  pose.LeftUpperLeg);
    if (pose.RightLowerLeg) set('rightLowerLeg', pose.RightLowerLeg);
    if (pose.LeftLowerLeg)  set('leftLowerLeg',  pose.LeftLowerLeg);
    if (pose.Spine)         set('spine',         pose.Spine);
    if (pose.Hips?.rotation) set('hips',         pose.Hips.rotation);

    // Debug log on first call to verify bone resolution
    if (!this._eulerPoseDebugDone) {
      this._eulerPoseDebugDone = true;
      console.log(`[applyEulerPose] isVrm=${isVrm}, applied=${applied}, missed=${missed}, pose keys=${Object.keys(pose).join(',')}`);
      if (missed > 0) {
        console.warn(`[applyEulerPose] ${missed} bones not found! Check humanoidBoneNameMap.`);
        console.log('[applyEulerPose] Available bone map:', Object.fromEntries(this.humanoidBoneNameMap));
        if (bones) {
          console.log('[applyEulerPose] Available silhouette bones:', [...bones.keys()].slice(0, 20));
        }
      }
    }
  }

  applyHands(vrm: VRM, hands: { left: any, right: any }) {
    if (!vrm || !vrm.humanoid) return;

    const applyHand = (side: 'left' | 'right', pose: any) => {
      if (!pose) return;
      
      const prefix = side === 'left' ? 'left' : 'right';
      const bones = [
        'ThumbProximal', 'ThumbIntermediate', 'ThumbDistal',
        'IndexProximal', 'IndexIntermediate', 'IndexDistal',
        'MiddleProximal', 'MiddleIntermediate', 'MiddleDistal',
        'RingProximal', 'RingIntermediate', 'RingDistal',
        'LittleProximal', 'LittleIntermediate', 'LittleDistal'
      ];

      for (const boneName of bones) {
        const fullBoneName = prefix + boneName;
        const rotation = pose[boneName];
        if (rotation) {
          const node = vrm.humanoid.getNormalizedBoneNode(fullBoneName as any);
          if (node) {
            // Smoother hand movement
            node.quaternion.slerp(new THREE.Quaternion().setFromEuler(new THREE.Euler(rotation.x, rotation.y, rotation.z)), 0.7);
          }
        }
      }
    };

    if (hands.left) applyHand('left', hands.left);
    if (hands.right) applyHand('right', hands.right);
  }

  /**
   * ベクトル形式のポーズ特徴をアバターのボーンに適用する
   * @param target VRMインスタンス または THREE.Group (シルエット)
   * @param features PoseFeatures
   */
  applyVectorPose(target: VRM | THREE.Group, features: PoseFeatures, lerpAmount = 1.0) {
    const isVrm = (target as any).humanoid !== undefined;
    const bones = target === this.silhouetteL ? this.silhouetteLBones : 
                  target === this.silhouetteR ? this.silhouetteRBones : null;

    const applyWorld = (boneName: string, featureKey: string, defaultDir: THREE.Vector3) => {
      let bone: THREE.Object3D | null = null;
      if (isVrm) {
        bone = (target as VRM).humanoid.getNormalizedBoneNode(boneName as any);
      } else {
        const threeName = this.humanoidBoneNameMap.get(boneName);
        if (threeName && bones) bone = bones.get(threeName) || null;
      }

      if (!bone || !features[featureKey]) return;

      // ターゲットのワールド方向ベクトル
      const targetWorldDir = new THREE.Vector3(features[featureKey].x, features[featureKey].y, features[featureKey].z);
      
      // キャラクターは+Zを向いている (rotation.y = PI) ため、ワールドベクトルをローカル空間にミラー/補正
      targetWorldDir.x *= -1;
      targetWorldDir.z *= -1;

      // 1. ターゲットのワールド回転（Quaternion）を計算
      const targetWorldQuat = new THREE.Quaternion().setFromUnitVectors(defaultDir, targetWorldDir.normalize());

      // 2. 親のワールド回転を取得して逆転させ、ローカル回転に変換
      bone.parent?.updateWorldMatrix(true, false);
      const parentWorldQuat = new THREE.Quaternion();
      bone.parent?.getWorldQuaternion(parentWorldQuat);

      const localQuat = parentWorldQuat.invert().multiply(targetWorldQuat);
      
      // 3. 適用
      bone.quaternion.slerp(localQuat, lerpAmount);
      
      // 4. 即時更新（親子関係の同期を保証）
      bone.updateMatrix();
      bone.updateMatrixWorld(true);
    };

    const RIGHT = new THREE.Vector3(-1, 0, 0); // キャラから見て右 (-X)
    const LEFT = new THREE.Vector3(1, 0, 0);   // キャラから見て左 (+X)

    // 上腕 -> 前腕の順で適用（親子関係のため）
    applyWorld('leftUpperArm', 'leftUpperArm', LEFT);
    applyWorld('leftLowerArm', 'leftLowerArm', LEFT);
    applyWorld('rightUpperArm', 'rightUpperArm', RIGHT);
    applyWorld('rightLowerArm', 'rightLowerArm', RIGHT);
  }

  /**
   * シルエットの位置や不透明度を更新する (ダンエボ高速版)
   */
  updateSilhouettes(activeSilhouette: { marker: MarkerTarget; timeToHit: number } | null) {
    if (!this.silhouetteL || !this.silhouetteR) return;

    if (!activeSilhouette) {
      this.silhouetteL.visible = false;
      this.silhouetteR.visible = false;
      return;
    }

    const { marker, timeToHit } = activeSilhouette;
    const FLY_TIME = 0.7;
    const WAIT_TIME = 0.5;
    
    const progress = timeToHit > FLY_TIME 
      ? 0 
      : Math.max(0, Math.min(1, 1 - timeToHit / FLY_TIME));

    this.silhouetteL.visible = true;
    this.silhouetteR.visible = true;

    // ターゲットポーズを取らせる
    if (marker.targetEulerPose) {
      this.applyEulerPose(this.silhouetteL, marker.targetEulerPose, 1.0);
      this.applyEulerPose(this.silhouetteR, marker.targetEulerPose, 1.0);
    } else if (marker.targetPoseVectors) {
      this.applyVectorPose(this.silhouetteL, marker.targetPoseVectors, 1.0);
      this.applyVectorPose(this.silhouetteR, marker.targetPoseVectors, 1.0);
    }

    const eased = 1 - Math.pow(1 - progress, 4);
    const startX_L = -3.5;
    const startX_R = 3.5;
    const targetX = 0.0;
    const currentX_L = startX_L + (targetX - startX_L) * eased;
    const currentX_R = startX_R + (targetX - startX_R) * eased;

    this.silhouetteL.position.set(currentX_L, 0, 0);
    this.silhouetteR.position.set(currentX_R, 0, 0);
    
    this.silhouetteL.rotation.y = Math.PI;
    this.silhouetteR.rotation.y = Math.PI;

    let opacity = 0;
    if (timeToHit > FLY_TIME) {
      const waitProgress = 1 - (timeToHit - FLY_TIME) / WAIT_TIME;
      opacity = waitProgress < 0.4 ? (waitProgress / 0.4) * 0.85 : 0.85;
    } else if (timeToHit > 0) {
      opacity = progress < 0.85 ? 0.85 : 0.85 - (progress - 0.85) / 0.15 * 0.35;
    } else {
      opacity = Math.max(0, 0.5 - (Math.abs(timeToHit) / 0.3) * 0.5);
    }

    const setOpacity = (scene: THREE.Group) => {
      scene.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const material = (obj as THREE.Mesh).material as THREE.Material;
          material.opacity = opacity;
        }
      });
    };
    
    setOpacity(this.silhouetteL);
    setOpacity(this.silhouetteR);
  }

  update(vrm: VRM, delta: number) {
    vrm.update(delta);
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }
}

export const vrmService = new VRMService();
