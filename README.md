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
