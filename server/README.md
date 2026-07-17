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

## 実機から接続するとき

スマホと PC を同一 Wi-Fi にし、PC の LAN IP をクライアント側の
`EXPO_PUBLIC_API_BASE_URL` に設定してください（ルートの README 参照）。

Windows ファイアウォールで 3001 がブロックされていると実機から届きません。
