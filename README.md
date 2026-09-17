# CHICKEN DRAW

React / Vinext のオンライン対戦カードゲームです。ゲーム状態は Node.js の API と PostgreSQL で共有します。Cloudflare Workers / D1 は使用しません。

## ローカル起動

1. PostgreSQL（Neon、Supabase、Render など）でデータベースを作成し、接続文字列を用意します。
2. PowerShellでプロジェクトフォルダを開き、`$env:DATABASE_URL="postgresql://ユーザー:パスワード@ホスト/DB?sslmode=require"` を実行します。
3. `npm install` → `npm run dev` の順に実行し、表示された localhost URL を開きます。

DB の `rooms`、`presence`、`card_hover` テーブルは初回APIアクセス時に自動作成されます。本番ではDB接続文字列を環境変数 `DATABASE_URL` として登録してください。

`DATABASE_URL` がない開発環境では、確認用にプロセス内の一時ストアを使用します。開発サーバーを再起動するとルーム状態は消えます。本番環境では `DATABASE_URL` が必須です。

## 公開

Node.js を実行できるホスティング（Render、Railway、Fly.io、VPS など）にこのリポジトリを接続し、Build command を `npm run build`、Start command を `npm start` に設定します。環境変数に `DATABASE_URL` を追加すれば公開できます。Vercelを使う場合はVinextのNode実行方式に対応した設定が必要なため、まずはNode常駐プロセスを提供するホスティングを推奨します。

## 無料枠について

無料枠は各サービスの容量・転送量・実行時間・休止条件があり、24時間無制限ではありません。Neon等の無料PostgreSQLは小規模な2〜5人対戦の検証には向きますが、アクセスが増えたら利用量をダッシュボードで確認してください。Render等の無料Webサービスは一定時間アクセスがないとスリープする場合があります。

## 確認

2台のブラウザで同じ公開URLを開き、同じルームコードに参加して、ルーム作成・カード操作・観戦状態が双方に反映されることを確認します。接続エラーはホスティングのログと `DATABASE_URL` の値（パスワードを除くホスト・DB名）を確認してください。
