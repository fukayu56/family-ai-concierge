# Family AI Concierge API（ローカル）

Expo アプリから呼ぶバックエンドです。OpenAI Structured Outputs 経由でおでかけプランを返します。

## 起動方法

```bash
cd server
npm install
# server/.env に OPENAI_API_KEY を設定
npm run dev
```

起動すると `http://localhost:3001` で待ち受けます。

## エンドポイント

- `GET /health` … 疎通確認 `{ "ok": true }`
- `POST /api/recommendations` … strict 3プラン + 任意の `relaxedPlans` を返す

## 本番（Render 等）

本番では `npm run build` → `npm run start:prod` を想定しています。

環境変数（例）

- `OPENAI_API_KEY`（必須）
- `PORT`（Render が自動で設定することが多い。コードは `process.env.PORT` を優先します）
- `ALLOWED_ORIGINS`（CORS 許可 Origin のカンマ区切り）
  - 例: `https://your-eas-domain.com,http://localhost:8081`

注意:
- CORS は無条件許可ではなく、`ALLOWED_ORIGINS` に一致した Origin のみ許可します（完全一致、scheme+host+port）。
- クライアント側へ OPENAI APIキーは送らないでください（サーバーのみ利用します）。

## 実機から接続するとき

スマホと PC を同一 Wi-Fi にし、PC の LAN IP をクライアント側の
`EXPO_PUBLIC_API_BASE_URL` に設定してください（ルートの README 参照）。

Windows ファイアウォールで 3001 がブロックされていると実機から届きません。
