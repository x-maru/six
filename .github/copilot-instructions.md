# Copilot Instructions for tedit (HTA Vi-like Editor)

目的: このリポジトリは Windows HTA (IE11/MSHTML + ActiveX) 上で動作する最小 Vi 風テキストエディタ `tedit` の実装。単一 HTML (hta) 内に UI / 状態管理 / キーバインド / コマンドライン処理 / Undo/Redo / 行番号レンダリングを内包する。変更は副作用の広がりに注意して局所的に行う。

## 全体構造
- 単一ファイル `tedit.hta.txt` (実行用は拡張子 `.hta` 想定) に以下を同居:
  - HTML: textarea + 行番号ガター + コマンドバー + ヘルプオーバーレイ
  - CSS: ダークテーマ / ガター / ステータスバー / 補完ポップアップ
  - JS: 主要セクション順に (1) オプション `OPT` (2) Undo/Redo スタック (3) 低レベルテキスト/行ユーティリティ (4) 語単位移動 (日本語/全角対応) (5) モード管理 NORMAL/INSERT/VISUAL (6) 編集/削除/貼付け (7) ステータス & ガター描画 (8) スクロール調整 `ensureScrolloff` (9) コマンドライン実装 `:e :e! :set :q :q! :help` (10) キーイベント分派 (11) コマンドライン補完 (ファイルシステム ActiveX) (12) init 即時実行 IIFE。
- 外部依存: ActiveX (`Scripting.FileSystemObject`, `ADODB.Stream`, `window.clipboardData`) のみ。npm 等は未使用。
- 行番号は毎フレーム再描画ではなくスクロールイベント & 可視領域計算で最小限。

## 状態/データモデル
- 編集状態: `modifiedCount`, `baselineText`, `undoStack`, `redoStack`, `insertSessionActive`。
- モード: `MODE_NORMAL/MODE_INSERT/MODE_VISUAL` と現行 `mode`。VISUAL 選択は `anchorPos`, `visActiveEnd`, `visualCol`。
- 削除/貼付け: 無名レジスタ `REG { text, linewise }` + OS クリップボード同期 (option)。
- 演算子待機: `opPending` (現状 'd' のみ) + カウント `countBuffer` + 連続削除用 `lastCmd`, `lastDeleteLinewise`, `opRepeat`。
- 語移動は日本語/全角対応 (分類: SPACE / NL / ALNUM / KANA / HAN / SYMBOL)。

## 主なユーティリティ境界
- 行/位置計算: `lineStartIndex`, `lineEndIndex`, `getLineCol`, `totalLines`, `lineStartByNumber`, `firstNonBlankPos` 等。
- 語移動: `wordLeftPos`, `wordRightPos`。
- 段落: `paragraphPrev/Next` (空行判定)。
- スクロール保持: `ensureScrolloff` (末尾行特殊処理あり)。

## 描画/更新フロー
- キー入力 → `keydown` handler (モード別分岐) → 位置/テキスト操作 → `updateStatus` & `ensureScrolloff` & `updateGutter` 呼出。
- 入力 (`input` event) で modified カウント & ガター再描画。
- ガターは可視開始行と表示行数を計算し部分 HTML を差し替え。`scrollTop%lineHeight` で Y オフセット調整。

## コマンドライン (Ex 風)
- `openCmdBar()/closeCmdBar()` と `runCommand(cmd)` が中核。
- 実装済: `:e file`, `:e! [file]` (強制再読込), `:set number/nonumber`, `:set clipboard=os|internal`, 行番号ジャンプ (`:123`), `:q`, `:q!`, `:help`, `:debugscroll`, Undo/Redo (`:u`, `:redo`).
- 未実装 (コメント記載): `:w`, `:wq`, `ZZ` など保存系。
- ファイル補完: `updateCmdCompletions()`→ ActiveX でカレント/指定ディレクトリ列挙。初回生成後はリスト固定・インデックス循環。

## キーバインド概要
- NORMAL: `h j k l w b ^ 0 $ { } gg G x d p P i v : Esc` + Emacs 互換 `Ctrl+P/N/F/B`。`Ctrl+R`=Redo。
- INSERT: 通常入力 + Esc で NORMAL、ペースト時改行 LF 正規化。
- VISUAL: 同移動 + 選択 exclusive。`visActiveEnd` でモーション方向を追跡し 0,^,$ 動作を Vim 風に調整。
- カウント: 数字連結 → モーション適用。`d` は待機→モーションで範囲削除。`dd` / `2dd` 行単位処理 (行番号ユーティリティ利用)。
- 末行移動: `G` は最終行末/改行位置ロジック。`w` / `j` は末行越え防止の特化処理あり。

## 変更時の注意
- Undo/Redo: 変更系は必ず `pushUndo(reason)` のタイミング一貫性を保つ。Redo 無効化箇所 (新規編集で redoStack クリア) を忘れない。
- ガター/スクロール: 行挿入・削除後は `updateGutter()` と `ensureScrolloff()` をセットで呼ぶ。抜けると行番号や末行表示が乱れる。
- VISUAL でのカーソルロジックは `getActivePosForDir` + `visActiveEnd` 依存。新モーションを追加する場合両方更新。
- ActiveX 例外は try/catch 必須 (HTA 例外で全体停止防止)。
- 保存機能追加時は: 文字コード UTF-8 / 改行 LF (OPT.fileformat で将来扩張) を維持し `setBaseline()` + `pushUndo('initial')` 再構築。

## 拡張ガイド例
- 保存コマンド追加: `runCommand` 内 `:w[!]` 分岐追加 → ADODB.Stream で UTF-8 出力 → `setBaseline(text)` → メッセージ表示。
- 置換演算子追加 (例 `c`): `opPending='c'` を `d` 参照で模倣し、削除後 INSERT モードへ遷移。
- 反復 `.` 実装: `lastCmd` 記録の粒度を増やし、直近編集スナップ再適用ロジックを追加。

## 開発ワークフロー
- 実行: `tedit.hta.txt` を `tedit.hta` にリネーム (または拡張子表示) しエクスプローラで起動。
- デバッグ: IE11/MSHTML の制約 (ES5 相当) を意識。最新 API (Promise 等) は未使用方針。
- ログ追加時は `showMsg()` の過剰利用でキーバインド干渉しないよう短時間表示にする。

## コードスタイル / パターン
- 関数はプレーン `function` 定義 (クラス未使用)。`var` ベース。ES6 以降機能は極力避け互換重視。
- 早期 return と低コストガードを好む。重複処理はコメントで“置換/追加”と記録（履歴的メモ）。
- 日本語コメント多数: 既存表現を維持し簡潔追加。外部依存を増やさない。

---
不足/不明点があれば指摘してください。さらに細かい領域（例: 語分類ロジック、スクロール境界調整の追加仕様）を追記可能です。