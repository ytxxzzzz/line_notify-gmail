# トラブルシュート
- VSCodeのデバッガにて、readlineの入力でReferenceErrorが発生して、標準入力ができない
  - 以下を参照。VSCodeのコンソールは出力専用らしいので、キー入力したければVSCodeのコンソールはダメで普通のコンソール使う必要があるらしいい
  - https://qiita.com/link_to_someone/items/2b7cb8747a34165b8c8e
  - ※このサイトにはコンソールを`externalTerminal`にせよ、とのことだったが、その値にしたらX関係風のエラーが出たので代わりに`integratedTerminal`としてみたところ、
  普通にVSCode下のターミナルに出力されたので、こっちのほうがいいかも
- 