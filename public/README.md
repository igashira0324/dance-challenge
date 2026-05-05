# VRM Asset Placement / VRMファイルの配置について

This project does **NOT** include VRM models in the repository due to redistribution restrictions. To run the application, you need to provide your own VRM files.

本プロジェクトには、再配布制限の関係上、VRMモデルファイルは含まれていません。アプリを動作させるには、ご自身でモデルファイルを用意する必要があります。

## 📂 Instructions / 設定手順

1.  Place your default VRM file as `public/default.vrm`.
    *   `public/default.vrm` として、デフォルトで使用したいVRMファイルを配置してください。
2.  (Optional) You can add more models to `public/` and register them in `src/components/PhotoBooth.tsx`'s `BUILTIN_MODELS` array.
    *   （任意）他にもモデルを追加したい場合は、`public/` フォルダにファイルを置き、`src/components/PhotoBooth.tsx` の `BUILTIN_MODELS` 配列に追記してください。
3.  Alternatively, you can upload any `.vrm` file directly from the application's UI using the **"CUSTOM VRM"** button.
    *   または、アプリ画面上の「CUSTOM VRM」ボタンから、お手持ちの `.vrm` ファイルを直接アップロードして使用することも可能です。

## ⚠️ Important Note / 注意点

*   Please ensure you have the rights or license to use the VRM models you provide.
*   同梱・使用するVRMモデルについては、各モデル作者の利用規約（ライセンス）を必ず確認し、遵守してください。
