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

