# AI Dance Challenge 🕺✨

MediaPipe Pose と 3D VRM を活用した、高精度な次世代リズムダンスゲームエンジン。

## 🌟 特徴

- **3D Metric Vector 判定**: 従来の 2D 角度判定ではなく、3D 空間上のベクトルを利用した高精度なポーズ合致判定。カメラの距離や角度に依存しません。
- **VRM シルエットガイド**: 楽曲に合わせて動く VRM モデルをシルエットとして表示。`SkeletonUtils.clone` による高速・低メモリなレンダリング。
- **グラスモーフィズム HUD**: モダンで視認性の高いユーザーインターフェース。
- **リアルタイム・フィードバック**: コンボ、判定（PERFECT / GOOD）、エフェクトによる爽快なプレイ体験。
- **デバッグ & キャリブレーション**: `Alt+C` で現在のポーズをベクトルデータとして瞬時にキャプチャ可能。

## 🚀 クイックスタート (Windows)

1. **RUN_GAME.bat** をダブルクリックします。
2. 自動的に依存関係がインストールされ、開発サーバーが起動します。
3. ブラウザで `http://localhost:5173` を開きます。

## 🛠 技術スタック

- **Core**: React + Vite + TypeScript
- **Pose Detection**: MediaPipe Pose (Task Vision)
- **3D Rendering**: Three.js + @pixiv/three-vrm
- **Animation**: Framer Motion
- **Audio**: Web Audio API

## 📐 アーキテクチャ解説

判定エンジンの詳細については、`architecture_overview.md` を参照してください。

### ボディ・ローカル座標系
ユーザーの肩と腰の位置から独自の 3D 基底ベクトルを生成。これにより、ユーザーが部屋のどこにいても、どの向きを向いていても、ポーズを正確に評価できます。

### 類似度計算
ターゲットポーズ（正規化ベクトル）とユーザーのポーズの内積（Cosine Similarity）を計算。
- **0.85 以上**: PERFECT
- **0.65 以上**: GOOD

## 📸 新しいポーズの追加方法

1. アプリを起動し、カメラの前でポーズを取ります。
2. `Alt + C` キーを押します。
3. ブラウザのコンソールに出力された JSON データをコピーします。
4. `src/constants/index.ts` の `DEMO_MARKERS` に貼り付けます。

## 📜 ライセンス

MIT License
