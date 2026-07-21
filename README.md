# Family AI Concierge

家族のおでかけを、条件と個性から提案する Expo + Express アプリです。

## 公開構成（Vercel 単独）

Render / EAS Hosting は使いません。

```
Vercel（同一プロジェクト・同一 Origin）
├─ Expo Web 静的配信（dist/）
│  ├─ /
│  ├─ /destinations
│  ├─ /family
│  └─ その他 Expo Router 静的ルート
└─ Express Vercel Function（api/index.ts）
   ├─ /health
   ├─ /api/spots
   └─ /api/recommendations
```

- OpenAI APIキーは **Vercel のサーバー環境変数 `OPENAI_API_KEY` のみ**
- クライアントに `EXPO_PUBLIC_OPENAI_API_KEY` 等は **絶対に置かない**
- 本番 Web は同一 Origin の `/api/*` を相対URLで呼びます

---

## ローカル起動

### 1. 依存関係

リポジトリは npm workspaces（`server`）です。ルートで一度入れます。

```bash
npm ci
# または初回: npm install
```

### 2. API サーバー（PC）

```bash
cd server
# server/.env に OPENAI_API_KEY=... を設定
npm run start
# またはルートから: npm run server:start
```

確認:

```bash
curl http://localhost:3001/health
# => {"ok":true}
```

### 3. Expo アプリ

```bash
npx expo start
# Web: npx expo start --web
```

- **同じ PC のブラウザ:** 未設定時は `http://localhost:3001` に接続
- **本番相当の静的出力:** `npx expo export --platform web`（出力: `dist/`）

### 4. 操作フロー

1. ホームで参加者を選ぶ  
2. 「おでかけ条件」で時間・予算・天気などを入力  
3. 「AIにプランを作ってもらう」  
4. 行先リストで訪問・評価を記録  

---

## 実機からAPIへ接続する（ローカル開発）

物理デバイスでは `localhost` はスマホ自身を指すため、**PC の LAN IP** が必要です。

1. PC とスマホを同じ Wi-Fi に接続  
2. PC の IPv4 を確認（例: `ipconfig`）  
3. ルートに `.env` を作成:

```env
EXPO_PUBLIC_API_BASE_URL=http://192.168.x.x:3001
```

4. Expo を再起動  

API URL の解決は `src/constants/api.ts` のみです。

優先順位:

1. `EXPO_PUBLIC_API_BASE_URL` が有効なら使用  
2. 本番 Web ビルド（`NODE_ENV=production`）は同一 Origin の相対URL  
3. ローカル開発は `http://localhost:3001`  

---

## Vercel デプロイ

### Dashboard 設定値（正確）

| 項目 | 値 |
|------|-----|
| Framework Preset | Other |
| Root Directory | `.`（リポジトリルート） |
| Build Command | `npx expo export --platform web` |
| Output Directory | `dist` |
| Install Command | `npm ci` |
| Node.js | 20.x 以上推奨 |

`vercel.json` が同梱されているため、Dashboard 未入力でもファイル設定が使われます。矛盾する場合は `vercel.json` を正としてください。

### 登録する環境変数

| 変数 | 必須 | 説明 |
|------|------|------|
| `OPENAI_API_KEY` | **必須** | サーバー Function のみ。Production / Preview に設定 |
| `EXPO_PUBLIC_API_BASE_URL` | **不要（本番）** | 同一 Origin のため未設定でよい |
| `ALLOWED_ORIGINS` | 任意 | 追加の CORS Origin（カンマ区切り）。未設定でも Vercel ホストとローカル既定を許可 |
| `OPENAI_MODEL` | 任意 | 既定 `gpt-4o-mini` |
| `NODE_ENV` | 通常不要 | Vercel が設定 |

### Preview / Production

1. GitHub リポジトリを Vercel に Import  
2. 上記設定と `OPENAI_API_KEY` を登録  
3. Deploy  
4. Preview URL または Production URL で確認  

CLI を使う場合は、アカウントログインが必要です（このリポジトリではログイン操作は手動）。

```bash
# ログインが必要になったらここで停止し、ユーザー操作へ
npx vercel
npx vercel --prod
```

### Function timeout

- `/api/recommendations` は OpenAI を最大3回呼ぶため時間がかかります（数十秒〜2分程度）
- `vercel.json` で Hobby 上限の **`maxDuration: 300`（秒）** を `api/index.ts` に設定しています
- タイムアウト時はクライアント既存のエラー表示（再試行）を利用します

### スポットデータ bundle 漏れの確認

デプロイ後:

```bash
curl https://<your-app>.vercel.app/api/spots
```

- `meta.total` が **247** 前後であること  
- `sample-*` id が無いこと  
- `?city=刈谷市` で **25** 件前後であること  

ローカル同等チェック:

```bash
cd server
npx tsx src/validation/runProductionSpotsCheck.ts
```

### デプロイ後の確認

1. `GET /health` → `{"ok":true}`  
2. `GET /api/spots` → 247件前後  
3. スマホブラウザで Web を開く（3タブ操作）  
4. `/family` を直接開く・再読み込みしても 404 にならない（Expo 静的HTML）  
5. AI提案 → plans 3件  
6. 訪問評価の保存・リロード後の永続化  

### 障害時の確認ポイント

| 症状 | 確認 |
|------|------|
| `/api/spots` が 0件 | Function の `includeFiles` / データパス。Vercel ログの mapper error |
| AI提案が 500 | `OPENAI_API_KEY` が Production/Preview に入っているか |
| CORS エラー | 本番同一 Origin なら通常不要。ローカルは `ALLOWED_ORIGINS` / 既定 localhost:8081 |
| 504 / timeout | OpenAI 遅延。`maxDuration` と結果画面の再試行 |
| 画面再読み込み 404 | Expo 静的ルート未生成。`npx expo export --platform web` のルート一覧を確認 |
| `/api/unknown` が HTML | rewrite が API を SPA に吸っていないか（現行は API 先に rewrite） |

### AsyncStorage

Web ではブラウザ storage に永続化されます。リロード後も家族・履歴が残る想定です。

---

## Get started（テンプレート）

1. Install dependencies: `npm install`  
2. Start the app: `npx expo start`  

## Learn more

- [Expo documentation](https://docs.expo.dev/)  
- [Expo Router](https://docs.expo.dev/router/introduction/)  
- [Vercel Express](https://vercel.com/docs/frameworks/backend/express)  
