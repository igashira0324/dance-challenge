import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRM } from '@pixiv/three-vrm';

class VRMService {
  private loader: GLTFLoader;
  private scene: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private renderer: THREE.WebGLRenderer | null = null;
  private currentVrm: VRM | null = null;
  
  // シルエット用のVRM (左右2体)
  private silhouetteTargetL: VRM | null = null;
  private silhouetteTargetR: VRM | null = null;

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

  private _applySilhouetteMaterial(vrm: VRM) {
    vrm.scene.traverse((obj) => {
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

    // 読み込み開始前にシーンから既存のものを即座に削除（古い参照が残らないようにする）
    this.clearCurrentFromScene();

    console.log(`Starting load VRM (ID: ${loadId}): ${url}`);
    
    // 全てパラレルでロード（高速化）
    const [vrm, silL, silR] = await Promise.all([
      this._loadSingleVrm(url),
      this._loadSingleVrm(url),
      this._loadSingleVrm(url)
    ]);

    // もしロード中に次のロードが始まっていたら、この結果は捨てる
    if (loadId !== this.currentLoadId) {
      console.log(`Aborting load VRM (ID: ${loadId}) - newer load started.`);
      // 念のためリソースを解放（VRMの破棄は本来複雑だがここでは簡易的に）
      return vrm; 
    }

    vrm.scene.rotation.y = Math.PI;
    vrm.scene.visible = true;

    this._applySilhouetteMaterial(silL);
    this._applySilhouetteMaterial(silR);
    silL.scene.rotation.y = Math.PI;
    silR.scene.rotation.y = Math.PI;
    silL.scene.visible = false;
    silR.scene.visible = false;

    if (this.scene) {
      this.scene.add(vrm.scene);
      this.scene.add(silL.scene);
      this.scene.add(silR.scene);
    }
    
    this.currentVrm = vrm;
    this.silhouetteTargetL = silL;
    this.silhouetteTargetR = silR;
    
    console.log(`Successfully loaded VRM (ID: ${loadId})`);
    return vrm;
  }

  private clearCurrentFromScene() {
    if (!this.scene) return;
    
    if (this.currentVrm) {
      this.scene.remove(this.currentVrm.scene);
      this.currentVrm = null;
    }
    if (this.silhouetteTargetL) {
      this.scene.remove(this.silhouetteTargetL.scene);
      this.silhouetteTargetL = null;
    }
    if (this.silhouetteTargetR) {
      this.scene.remove(this.silhouetteTargetR.scene);
      this.silhouetteTargetR = null;
    }

    // 念のためシーン全体を走査して古いアバターが残っていないか確認
    // (ReactのHot Reload等でIDがズレた場合に備える)
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
   * PoseAngles型からVRMのボーン回転を推定して適用する (シルエット用)
   */
  applyPoseFromPoseAngles(vrm: VRM, angles: any, lerpAmount = 1.0) {
    if (!vrm || !vrm.humanoid || !angles) return;

    const setRot = (boneName: string, x: number, y: number, z: number) => {
      const bone = vrm.humanoid?.getNormalizedBoneNode(boneName as any);
      if (!bone) return;
      const targetQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z));
      bone.quaternion.slerp(targetQuat, lerpAmount);
    };

    // --- 左腕 ---
    if (angles.leftShoulderLift !== undefined) {
      // 挙上角度: 下(0) -> 水平(1.57) -> 上(3.14)
      // VRM T-Pose(1.57相当)基準での回転: 下=+1.5, 水平=0, 上=-1.5
      const lift = angles.leftShoulderLift;
      const rotZ = 1.57 - lift; 
      
      let rotY = 0;
      if (angles.leftArmOpen !== undefined) {
        // 開き角: 前(1.57) -> 横(3.14)
        // VRM T-Pose(3.14相当)基準: 前=+1.57, 横=0
        rotY = 3.14 - angles.leftArmOpen;
      }
      setRot('leftUpperArm', 0, rotY, rotZ);
    }

    if (angles.leftArmElbow !== undefined) {
      // 肘の曲げ: 直線(3.14) -> 90度(1.57)
      // VRM基準: 直線=0, 90度=-1.57
      const bend = 3.14 - angles.leftArmElbow;
      setRot('leftLowerArm', 0, 0, -bend);
    }

    // --- 右腕 ---
    if (angles.rightShoulderLift !== undefined) {
      const lift = angles.rightShoulderLift;
      const rotZ = -(1.57 - lift); // 右はZ軸反転
      
      let rotY = 0;
      if (angles.rightArmOpen !== undefined) {
        rotY = -(3.14 - angles.rightArmOpen);
      }
      setRot('rightUpperArm', 0, rotY, rotZ);
    }

    if (angles.rightArmElbow !== undefined) {
      const bend = 3.14 - angles.rightArmElbow;
      setRot('rightLowerArm', 0, 0, bend); // 右はZ軸反転
    }
  }

  /**
   * シルエットの位置や不透明度を更新する (ダンエボ高速版)
   */
  updateSilhouettes(activeSilhouette: { marker: any; timeToHit: number } | null) {
    if (!this.silhouetteTargetL || !this.silhouetteTargetR) return;

    if (!activeSilhouette) {
      this.silhouetteTargetL.scene.visible = false;
      this.silhouetteTargetR.scene.visible = false;
      return;
    }

    const { marker, timeToHit } = activeSilhouette;
    // ダンエボ参考: 1.2秒前に出現、最初の0.5秒(1.2秒前から0.7秒前まで)は画面端で待機（プレビュー）、残り0.7秒で画面外から中央へ飛んでくる
    const FLY_TIME = 0.7;
    const WAIT_TIME = 0.5;
    
    // 飛行アニメーションの進行度 (0: 待機状態 または 0.7秒前, 1: 合致時)
    const progress = timeToHit > FLY_TIME 
      ? 0 
      : Math.max(0, Math.min(1, 1 - timeToHit / FLY_TIME));

    // 表示をオンにする
    this.silhouetteTargetL.scene.visible = true;
    this.silhouetteTargetR.scene.visible = true;

    // ターゲットポーズを取らせる（即時反映）
    if (marker.targetPoseAngles) {
      this.applyPoseFromPoseAngles(this.silhouetteTargetL, marker.targetPoseAngles, 1.0);
      this.applyPoseFromPoseAngles(this.silhouetteTargetR, marker.targetPoseAngles, 1.0);
    }

    // 左右(x = -1.2, 1.2)から中央(x = 0.0)に飛んでくる（待機画面が見えるように初期位置を-1.2に設定）
    const eased = 1 - Math.pow(1 - progress, 4);
    const startX_L = -1.2;
    const startX_R = 1.2;
    const targetX = 0.0;
    const currentX_L = startX_L + (targetX - startX_L) * eased;
    const currentX_R = startX_R + (targetX - startX_R) * eased;

    this.silhouetteTargetL.scene.position.x = currentX_L;
    this.silhouetteTargetL.scene.position.y = 0;
    this.silhouetteTargetL.scene.position.z = 0;

    this.silhouetteTargetR.scene.position.x = currentX_R;
    this.silhouetteTargetR.scene.position.y = 0;
    this.silhouetteTargetR.scene.position.z = 0;

    // 不透明度: 出現時に素早くフェードインし、待機中は表示し続け、合致直前で少し透過、その後フェードアウト
    let opacity = 0;
    if (timeToHit > FLY_TIME) {
      // 待機フェーズ(1.2 ~ 0.7): 最初の0.2秒でフェードイン
      const waitProgress = 1 - (timeToHit - FLY_TIME) / WAIT_TIME; // 0 (1.2秒前) to 1 (0.7秒前)
      opacity = waitProgress < 0.4 ? (waitProgress / 0.4) * 0.85 : 0.85;
    } else if (timeToHit > 0) {
      // 飛行フェーズ(0.7 ~ 0)
      if (progress < 0.85) {
        opacity = 0.85;
      } else {
        opacity = 0.85 - (progress - 0.85) / 0.15 * 0.35; // 到達直前でわずかに透過
      }
    } else {
      // 経過後(0 ~ -0.5): リザルト用にフェードアウト
      opacity = Math.max(0, 0.5 - (Math.abs(timeToHit) / 0.3) * 0.5);
    }

    // マテリアルの透明度を更新
    const setOpacity = (sil: VRM) => {
      sil.scene.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const material = (obj as THREE.Mesh).material as THREE.Material;
          material.opacity = opacity;
        }
      });
    };
    
    setOpacity(this.silhouetteTargetL);
    setOpacity(this.silhouetteTargetR);
  }


  update(vrm: VRM, delta: number) {
    vrm.update(delta);
    if (this.silhouetteTargetL) this.silhouetteTargetL.update(delta);
    if (this.silhouetteTargetR) this.silhouetteTargetR.update(delta);
    
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }
}

export const vrmService = new VRMService();

