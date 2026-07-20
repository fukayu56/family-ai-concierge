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

## Get started（テンプレート）

1. Install dependencies: `npm install`
2. Start the app: `npx expo start`

In the output, you'll find options to open the app in a development build, Android emulator, iOS simulator, or Expo Go.

## Learn more

- [Expo documentation](https://docs.expo.dev/)
- [Expo Router](https://docs.expo.dev/router/introduction/)
