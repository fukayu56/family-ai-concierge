# Family AI Concierge API（ローカル）

Expo アプリから呼ぶバックエンドです。OpenAI API はまだ接続していません。

## 起動方法

```bash
cd server
npm install
npm run dev
```

起動すると `http://localhost:3001` で待ち受けます。

## エンドポイント

- `GET /health` … 疎通確認
- `POST /api/recommendations` … ダミーのおすすめプラン3件を返す
