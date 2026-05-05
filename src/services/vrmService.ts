import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRM } from '@pixiv/three-vrm';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { PoseFeatures } from '../utils/poseUtils';

class VRMService {
  private loader: GLTFLoader;
  private scene: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private renderer: THREE.WebGLRenderer | null = null;
  private currentVrm: VRM | null = null;
  
  // シルエット用のScene (左右2体)
  private silhouetteL: THREE.Group | null = null;
  private silhouetteR: THREE.Group | null = null;

  private currentLoadId = 0;

  constructor() {
    this.loader = new GLTFLoader();
    this.loader.register((parser) => {
      return new VRMLoaderPlugin(parser);
    });
  }

  init(canvas: HTMLCanvasElement) {
    if (this.renderer) return;

    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);

    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(40.0, window.innerWidth / window.innerHeight, 0.1, 20.0);
    this.camera.position.set(0.0, 1.0, 5.0);
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

  async loadVRM(url: string): Promise<VRM> {
    const loadId = ++this.currentLoadId;
    this.clearCurrentFromScene();

    console.log(`Starting load VRM (ID: ${loadId}): ${url}`);
    
    // 1体だけロード
    const vrm = await this._loadSingleVrm(url);

    if (loadId !== this.currentLoadId) {
      return vrm; 
    }

    vrm.scene.rotation.y = Math.PI;
    vrm.scene.visible = true;

    // クローンを作成（SkeletonUtils.clone はボーンの階層構造を正しくクローンする）
    this.silhouetteL = SkeletonUtils.clone(vrm.scene) as THREE.Group;
    this.silhouetteR = SkeletonUtils.clone(vrm.scene) as THREE.Group;

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

  /**
   * ベクトル形式のポーズ特徴をアバターのボーンに適用する
   * @param target VRMインスタンス または THREE.Group (シルエット)
   * @param features PoseFeatures
   */
  applyVectorPose(target: VRM | THREE.Group, features: PoseFeatures, lerpAmount = 1.0) {
    const isVrm = (target as any).humanoid !== undefined;
    
    // VRMの正規化ボーンは、デフォルトで子が+X方向（左腕）や-X方向（右腕）にある
    // ここでは単純化のため、各ボーンの「デフォルト方向」を定義してそこからの回転を求める
    const apply = (boneName: string, featureKey: string, defaultDir: THREE.Vector3) => {
      let bone: THREE.Object3D | null = null;
      if (isVrm) {
        bone = (target as VRM).humanoid.getNormalizedBoneNode(boneName as any);
      } else {
        // クローンされたSceneから名前で検索（VRMのボーン名はObject3D.nameに保持されている）
        (target as THREE.Group).traverse(obj => {
          if (obj.name.toLowerCase().includes(boneName.toLowerCase())) bone = obj;
        });
      }
      if (!bone || !features[featureKey]) return;

      const targetVec = new THREE.Vector3(features[featureKey].x, features[featureKey].y, features[featureKey].z);
      
      // キャラクターは+Zを向いている（rotation.y = PI）ため、
      // 外部からのベクトル（カメラ視点/ワールド）をキャラのローカル空間に合わせる
      // 簡易的に：ワールド -> ローカル (y軸180度回転済み想定)
      targetVec.x *= -1;
      targetVec.z *= -1;

      const quat = new THREE.Quaternion().setFromUnitVectors(defaultDir, targetVec.normalize());
      bone.quaternion.slerp(quat, lerpAmount);
    };

    const RIGHT = new THREE.Vector3(-1, 0, 0); // キャラから見て右 (-X)
    const LEFT = new THREE.Vector3(1, 0, 0);   // キャラから見て左 (+X)
    const DOWN = new THREE.Vector3(0, -1, 0);

    apply('leftUpperArm', 'leftUpperArm', LEFT);
    apply('leftLowerArm', 'leftLowerArm', LEFT);
    apply('rightUpperArm', 'rightUpperArm', RIGHT);
    apply('rightLowerArm', 'rightLowerArm', RIGHT);
  }

  /**
   * シルエットの位置や不透明度を更新する (ダンエボ高速版)
   */
  updateSilhouettes(activeSilhouette: { marker: any; timeToHit: number } | null) {
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
    if (marker.targetPoseVectors) {
      this.applyVectorPose(this.silhouetteL, marker.targetPoseVectors, 1.0);
      this.applyVectorPose(this.silhouetteR, marker.targetPoseVectors, 1.0);
    }

    const eased = 1 - Math.pow(1 - progress, 4);
    const startX_L = -1.5;
    const startX_R = 1.5;
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

