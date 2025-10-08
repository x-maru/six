 /* END DND_OPEN_IE10_HTA */
(function(){
  if (typeof updateStatus !== 'function') return;
  var _origUpdateStatus = updateStatus;
  window.updateStatus = function(){
    try{ _origUpdateStatus.apply(this, arguments); }catch(_){ }
    try{
      var el = document.getElementById('filename'); if(!el) return;
      var isNoPath=false, nameShown='[No Name]', bprefix='';
      if (typeof Buffers==='object' && typeof Buffers.current==='number' && Buffers.current>=0){
        var b = Buffers.list && Buffers.list[Buffers.current];
        if (b){
          bprefix = '[' + b.id + '] ';
          isNoPath = !b.path;
          if (isNoPath){
            nameShown = (b.dispName && String(b.dispName)) || '[No Name]';
          } else {
            nameShown = (window._currentFile && String(window._currentFile)) || '[No Name]';
          }
        }
      } else {
        nameShown = (window._currentFile && String(window._currentFile)) || '[No Name]';
        isNoPath = !window._currentFile;
      }
      el.innerText = bprefix + nameShown;
            var col = '#ddd';
            if (isNoPath){
              if (typeof b !== 'undefined' && b && b.dispName) col = 'DarkCyan';
              else col = '#e28';
            }
            try{ el.style.color = col; }catch(_){ }
    }catch(_){ }
  };
})();

// 起動後少し遅延してネイティブキャレット隠蔽クラスを再適用（初期レンダ／フォーカス競合対策）
(function(){
  try{
    setTimeout(function(){
      try{
        var ed=document.getElementById('editor');
        if(ed){
          if((' '+ed.className+' ').indexOf(' hide-native-caret ')<0){ ed.className += ' hide-native-caret'; }
          if (typeof window._repositionCaret==='function') window._repositionCaret();
        }
      }catch(_){ }
    }, 80);
  }catch(_){ }
})();

// 起動直後 list オーバーレイが初回操作まで描画されない問題への対処:
// editor レイアウト確定後に複数回強制描画 (TextRange が安定するまで再試行)
(function(){
  try{
    var tries=0;
    function kick(){
      tries++;
      try{
        if(window.OPT && OPT.list && typeof window.scheduleListLayerRender==='function'){
          // force=true で即時描画（queue を待たない）
          try{ window.scheduleListLayerRender(true); }catch(_){ }
          // TextRange 位置がまだ不安定なら次のフレームでもう一度
        }
      }catch(_){ }
      if(tries<5){ setTimeout(kick, tries===1?40:(tries===2?90:160)); }
    }
    setTimeout(kick, 20); // editor 初期化完了後すぐ
  }catch(_){ }
})();

