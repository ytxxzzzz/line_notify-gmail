# 概要
本リポジトリは、以下の２つのCloudFunctionsと、ローカルPCでの実行を想定した１つのツールを格納する。
- Cloud Functions
  - Gmailをwatch(監視)する関数
    - エントリポイント
      - watchGmailHandler(index.ts)
    - GmailのWatchAPIにて、Gmailの特定ラベルに来たメールを監視する
    - WatchAPIは、メールが来たらGCPのPubSubへメッセージを送信する仕様
    - また、WatchAPIのレスポンスにはWatchした時点のGmailのhistoryIdが格納されている
    - そのhistoryIdをGCSへ保存する
  - Gmailでメール受信したら、Line通知する関数
    - エントリポイント
      - notifyGmailHandler(index.ts)
    - PubSubで受けたメッセージを処理する関数
    - メッセージには、メール受信した時点のGmailのhistoryIdが格納されている
    - Watchした時点のhistoryIdと受信時にPubSubメッセージから取得したhistoryIdの間のメールが受信したメールということになる。
    - そのメールを特定し、本文をLine通知する。
- ツール
  - GSuiteのクレデンシャルとトークンをKMSで暗号化＆BASE64エンコードし、コンソールに出力するツール
    - ソースファイル名
      - generate-encrypted-credentials.ts
    - コンソールに出力された暗号化済みBASE64文字列を `.env` に保存することで、CloudFunctionの２つがクレデンシャルを取得して動作する仕組みとなっている。
    - ツール実行の際に、OAuth認証のためにWebブラウザを利用する動きとなることに注意。
    - ツールが動作すると、コンソールにURLが表示されるので、そのURLにアクセスし、指示通りにGoogleアカウントでログインするとOAuth認証完了となり、暗号化BASE64化済みトークンが取得できる。

## GmailAPIの参考情報
- WatchAPIを利用してGMail監視するQiita記事
  - https://qiita.com/asamas/items/c0cc2c44a80a52c788be#fn2
  - https://qiita.com/1ulce/items/672ae85d8c23bd9c478e
- ただし、これら２つはWatchAPIの核心には至っていない模様。
- 記事にあるが、PubSubに来るhistoryIdのメールをそのまま見ても空振りするので値を60引い他値でメールを検索するなどの荒技となっている。
- ネットを漁っていたら、以下の情報がありこちらが正しそう。
  - https://codeday.me/jp/qa/20190317/377709.html
- 現在、この情報の信憑性を調べ中。

# 環境構築
- credentialを作成する
  - GCPで`APIs & Services`-`Credentials`の画面を開く
  - `create credentials`の`Help me Choose`でウィザードによるCredential作成を
  - `Which API are you using?`に`Gmail API`を選択
  - `APIのコール場所`で`Other UI(CLI)`を選択
  - データ種類で`User Data`をチェック
  - Credentialの名前をつけて(例：gmail-notifyなど)作成する
  - credentialのファイルがダウンロードできるので、ダウンロードする
  - ダウンロードしたCredentialを本リポジトリをClnoneしたフォルダのトップに保存する
    - ファイル名は`client_id.json`とする
      - →そうしないと.gitignoreされない。**★★★Githubにこのファイルをアップするのは非常に危険★★★**
- kms
  - https://www.apps-gcp.com/kms-with-functions/

- kms暗号化の際のgcloud ログイン
  - `gcloud auth login`だけだと、OAuthで許可したクレデンシャルを一部のサービスでは使ってくれないみたい→今回だとkmsの暗号化には使ってくれず。`GOOGLE_APPLICATION_CREDENTIALS`を設定しろというエラーが出た。
  - 代わりに`gcloud auth application-default login`で行くと使われる。

- kms 暗号化、復号の参考
  - https://cloud.google.com/kms/docs/encrypt-decrypt?hl=ja

# トラブルシュート
- VSCodeのデバッガにて、readlineの入力でReferenceErrorが発生して、標準入力ができない
  - 以下を参照。VSCodeのコンソールは出力専用らしいので、キー入力したければVSCodeのコンソールはダメで普通のコンソール使う必要があるらしいい
  - https://qiita.com/link_to_someone/items/2b7cb8747a34165b8c8e
  - ※このサイトにはコンソールを`externalTerminal`にせよ、とのことだったが、その値にしたらX関係風のエラーが出たので代わりに`integratedTerminal`としてみたところ、
  普通にVSCode下のターミナルに出力されたので、こっちのほうがいいかも

# Cloud Functions　CLIデプロイの例
まだ環境変数設定が書けていないが、それ以外は大丈夫そう
## Gmailをwatchする関数
```
gcloud functions deploy watch-gmail --trigger-resource watch-gmail-scheduler-topic --trigger-event google.pubsub.topic.publish --stage-bucket ytxxzzzz-cloud-functions --entry-point watchGmailHandler --runtime nodejs8
```

## Gmailでメール受信したら、Line通知する関数
```
gcloud functions deploy notify-gmail --trigger-resource gmail-notify-topic --trigger-event google.pubsub.topic.publish --stage-bucket ytxxzzzz-cloud-functions --entry-point notifyGmailHandler --runtime nodejs8
```

# 参考
- nodejsのGCSライブラリリファレンス
https://googleapis.dev/nodejs/storage/latest/File.html#download
