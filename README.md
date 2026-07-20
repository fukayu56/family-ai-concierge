# Family AI Concierge

家族のおでかけを、条件と個性から提案する Expo + Express アプリです。

## 明日の実利用クイックスタート

### 1. API サーバーを起動（PC）

```bash
cd server
npm install
# server/.env に OPENAI_API_KEY=... を設定済みであること
npm run start
```

別ターミナルで確認:

```bash
curl http://localhost:3001/health
```

`{"ok":true}` が返れば OK。

### 2. Expo アプリを起動

```bash
npm install
npx expo start
```

- **同じ PC のブラウザ（Web）:** 追加設定なし（`http://localhost:3001`）
- **スマートフォン実機:** 下記「実機からAPIへ接続する」を実施

### 3. 操作フロー

1. ホームで参加者を選ぶ  
2. 「おでかけ条件」で時間・予算・天気などを入力  
3. 「AIにプランを作ってもらう」  
4. おすすめプラン（厳守）と「条件を少し広げると」を確認  

---

## 実機からAPIへ接続する

物理デバイスでは `localhost` はスマホ自身を指すため、**PC の LAN IP** が必要です。

### 手順

1. PC とスマホを **同じ Wi-Fi** に接続する  
2. Windows で PC の IPv4 を確認する（例）:

   ```powershell
   ipconfig
   ```

   `ワイヤレス LAN アダプター` などの **IPv4 アドレス**（例: `192.168.1.23`）を控える。  
   ※ IP は環境ごとに異なるため、決め打ちしない。

3. プロジェクトルートに `.env` を作成（`.env.example` をコピー可）:

   ```env
   EXPO_PUBLIC_API_BASE_URL=http://192.168.x.x:3001
   ```

   `192.168.x.x` を自分の PC の IPv4 に置き換える。

4. **Expo を再起動**（環境変数は起動時に読み込まれます）:

   ```bash
   npx expo start
   ```

5. スマホのブラウザで先に疎通確認（任意）:

   `http://<PCのIPv4>:3001/health`

6. Expo Go / 開発ビルドでアプリを開き、条件入力 → 提案まで確認する。

### Windows ファイアウォール

実機から `/health` がタイムアウトする場合:

1. Windows セキュリティ → ファイアウォール → 詳細設定  
2. 「受信の規則」でポート **3001**（TCP）を許可する  
3. または一時的に Node / `tsx` の受信を許可する  

同一 Wi-Fi・正しい IP・3001 開放の3点を確認してください。

API URL は `src/constants/api.ts` の1か所のみです。未設定時は `http://localhost:3001` にフォールバックします。

---

## Web公開（Render + EAS Hosting）準備

この項目は「公開手順の前提条件」と「必要な設定値」をまとめたものです。
以降のデプロイ実行（Render/EAS へのログイン操作や、デプロイ予約）は行いません。

### Render（Express APIサーバー）

Express API サーバーは `server/` 配下をデプロイします。

Render 設定（例）

Root Directory:
`server`

Build Command:
`npm ci`

Start Command:
`npm run start:prod`

Health Check Path:
`/health`

Render の環境変数

- `OPENAI_API_KEY`（必須、サーバーのみ）
- `PORT`（Render が自動で設定することが多い。コードは `process.env.PORT` を優先します）
- `ALLOWED_ORIGINS`（必須推奨。カンマ区切りで、アクセス元の Origin を指定）
  - 例: `https://your-eas-domain.com,http://localhost:8081`

注意:
- CORS は無条件許可ではなく、`ALLOWED_ORIGINS` に一致した Origin のみ許可します（完全一致、scheme+host+port）。
- クライアント（Expo Web）へ OpenAI APIキーは一切置きません。
- 公開URL（EAS Hosting のドメイン）を変更する場合は、`ALLOWED_ORIGINS` と `EXPO_PUBLIC_API_BASE_URL` の両方を更新してください。

### EAS Hosting（Expo Web）

Expo Web は `app.json` の `web.output: "static"` のため、EAS Hosting へ静的配信します。

EAS 側で設定する環境変数

- `EXPO_PUBLIC_API_BASE_URL`（必須）
  - 値: Render の API ベースURL（例: `https://your-render-api.onrender.com`）
  - 末尾スラッシュ有無はコード側で吸収します

注意:
- `EXPO_PUBLIC_` が付くのは公開前提の変数のみです。`OPENAI_API_KEY` は絶対に EAS 側に置きません。

### リロード時の 404（Expo Router）

`web.output: "static"` ではルートごとの `index.html` が生成されます。
ただし、ホスティング設定によっては `/destinations` 等へ直接アクセスしたときに 404 になることがあります。
デプロイ後にスマホブラウザで「各タブの画面まで移動 -> その画面を再読み込み」を行い、必要ならホスティング側の SPA fallback / rewrite 設定を追加してください。

### AsyncStorage 永続化

このアプリの永続化は `@react-native-async-storage/async-storage` を使用しています。
Web ではブラウザのストレージ（localStorage）に保存されるため、リロード後もデータが残る想定です。

### デプロイ後の動作確認（推奨）

- スマホブラウザで Web を開く（ホーム/行先リスト/家族の 3タブが操作できる）
- 各タブの画面を再読み込みして 404 が起きないことを確認
- 参加者選択 → AI 提案 → 行先リスト表示 → 訪問記録保存 → リロード後も表示が残ることを確認

## Get started（テンプレート）

1. Install dependencies: `npm install`
2. Start the app: `npx expo start`

In the output, you'll find options to open the app in a development build, Android emulator, iOS simulator, or Expo Go.

## Learn more

- [Expo documentation](https://docs.expo.dev/)
- [Expo Router](https://docs.expo.dev/router/introduction/)
