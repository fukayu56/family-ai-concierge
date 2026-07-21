# Family AI Concierge API

Expo アプリから呼ぶバックエンドです。OpenAI Structured Outputs 経由でおでかけプランを返します。

本番では **Vercel Function**（リポジトリルートの `api/index.ts`）として、Expo Web と同じ Vercel プロジェクトに同居します。Render は使いません。

## 起動方法（ローカル）

```bash
cd server
npm install   # ルートで workspaces 利用時はルートの npm ci で可
# server/.env に OPENAI_API_KEY を設定
npm run start
# または npm run start:prod（build 後）
```

起動すると `http://localhost:3001`（`0.0.0.0`）で待ち受けます。

構成:

- `src/app.ts` … Express app（routes / middleware）。`export default app`
- `src/index.ts` … ローカル用 `app.listen` のみ
- リポジトリ `api/index.ts` … Vercel が import するエントリ

## エンドポイント

- `GET /health` … 疎通確認 `{ "ok": true }`
- `GET /api/spots` … 行先リスト用スポット
- `POST /api/recommendations` … strict 3プラン + 任意の `relaxedPlans`

## 環境変数

- `OPENAI_API_KEY`（必須）
- `PORT`（ローカル既定 3001。Vercel ではプラットフォームが管理）
- `ALLOWED_ORIGINS`（任意。CORS 追加 Origin。カンマ区切り）

注意:

- OpenAI キーはサーバーのみ。クライアントへ送らない  
- 本番ログでは Prompt 全文・レスポンス JSON 全文を出しません  

## 実機から接続するとき（ローカル）

スマホと PC を同一 Wi-Fi にし、PC の LAN IP をクライアント側の
`EXPO_PUBLIC_API_BASE_URL` に設定してください（ルートの README 参照）。
