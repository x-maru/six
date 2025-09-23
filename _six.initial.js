// 安全イベントバインダを最初に用意（: での未定義回避）
if (typeof window._safeAdd !== 'function'){
  window._safeAdd = function(node, type, handler, capture){
    try{
      if (!node) return;
      if (node.addEventListener) node.addEventListener(type, handler, !!capture);
      else if (node.attachEvent) node.attachEvent('on'+type, handler);
      else node['on'+type] = handler;
    }catch(_){ }
  };
}
// IMEは既定の確定処理を基本許可（IE/MSHTML向けに介入最小化）
window._IME_ALLOW_DEFAULT = true;

// 編集モード定数と現在モード（NORMAL/INSERT/VISUAL）
if (typeof window.MODE_NORMAL==='undefined') window.MODE_NORMAL = 'NORMAL';
if (typeof window.MODE_INSERT==='undefined') window.MODE_INSERT = 'INSERT';
if (typeof window.MODE_VISUAL==='undefined') window.MODE_VISUAL = 'VISUAL';
if (typeof window.mode==='undefined') window.mode = window.MODE_NORMAL;
// VISUAL 状態関連
if (typeof window.anchorPos==='undefined') window.anchorPos = null;
if (typeof window.visActiveEnd==='undefined') window.visActiveEnd = null; // 'start' or 'end'
if (typeof window.visualCol==='undefined') window.visualCol = null; // 列保持

// PATCH: define symbols used unquoted in motion blocks (w/b 等の互換用)
// 既に存在する場合は上書きしない（HTA/IE11 想定）
try{ if (typeof d==='undefined')     { window.d='d'; } }catch(_){ var d='d'; }
try{ if (typeof up==='undefined')    { window.up='up'; } }catch(_){ var up='up'; }
try{ if (typeof down==='undefined')  { window.down='down'; } }catch(_){ var down='down'; }
try{ if (typeof left==='undefined')  { window.left='left'; } }catch(_){ var left='left'; }
try{ if (typeof right==='undefined') { window.right='right'; } }catch(_){ var right='right'; }

// （置換）Undo 定義ブロック（modifiedCount ～ doUndo まで）を Redo 対応版に差し替え
var modifiedCount = 0;           // 0 = クリーン (>0 = 変更あり)
var baselineText = '';           // 保存/読込直後の内容
var UNDO_MAX = 200;
var undoStack = [];
var redoStack = [];              // ★追加
var insertSessionActive = false;
