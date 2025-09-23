// === 検索状態とヘルパ ===
var searchState = { pat: '', dir: 1 }; // dir: 1=forward, -1=backward
function doSearch(pattern, dir, fromPos, opts){
  try{
    var ed = document.getElementById('editor');
    if (!ed){ return; }
    var text = ed.value;
    var n = text.length;
    if (!pattern){ showMsg('No search pattern', 1200); return; }
    // 基準方向更新（/:? 確定時のみ）
    if (opts && opts.updateBase){
      searchState.dir = (dir >= 0) ? 1 : -1;
    }
    searchState.pat = pattern;
    var inclusive = !!(opts && opts.inclusive);
    var pos = (typeof fromPos === 'number') ? fromPos : getCaret(ed);
    // 検索前スクロール位置（可視内ヒット時の自動スクロール打消しに使用）
    var prevST = (typeof window._searchFromScrollTop === 'number') ? window._searchFromScrollTop : ed.scrollTop;
    var idx = -1;
    if (dir >= 0){
      var start = inclusive ? pos : Math.min(n, pos + 1);
      if (start < 0) start = 0;
      if (start > n) start = n;
      idx = text.indexOf(pattern, start);
      if (idx < 0) idx = text.indexOf(pattern, 0); // wrap
    }else{
      var startB = inclusive ? pos : Math.max(0, pos - 1);
      if (startB < 0) startB = 0;
      if (startB > n) startB = n;
      idx = text.lastIndexOf(pattern, startB);
      if (idx < 0) idx = text.lastIndexOf(pattern); // wrap
    }
    if (idx >= 0){
      var end = idx + pattern.length;
      setSelection(ed, idx, end);
      setCaret(ed, idx);
      updateStatus(ed);
      // 通常検索確定時のみ積極的なスクロール調整
      if (!(opts && opts.incPreview)){
        try { lastMotionDir = (dir >= 0) ? down : up; } catch(_) {}
        try { ensureScrolloff(ed); } catch(_) {}
      }
      try{ window._incLastMiss=false; window._incLastHit=true; window._incLastIdx=idx; }catch(_){ }
      // incsearch プレビュー（未確定時のハイライトと穏当なスクロール制御）
      if (opts && opts.incPreview){
        try{
          if (typeof ensureIncPreviewLayer==='function') ensureIncPreviewLayer();
          var lc = getLineCol(text, idx);
          renderIncPreviewRange(lc.line, lc.col, pattern.length);
          var lh = getLineHeightPx(ed);
          if (lh && isFinite(lh) && lh > 0){
            var barEl = document.getElementById('cmdbar');
            var OCCLUDE_H = 0;
            try{ OCCLUDE_H = (barEl && barEl.offsetHeight) ? barEl.offsetHeight|0 : 64; }catch(_){ OCCLUDE_H = 64; }
            if (!isFinite(OCCLUDE_H) || OCCLUDE_H <= 0) OCCLUDE_H = 64;
            var visibleH = ed.clientHeight - OCCLUDE_H;
            if (visibleH < lh) visibleH = lh;
            // 検索開始時のスクロール基準で可視範囲判定
            var startLine = Math.floor(prevST / lh) + 1;
            var visLines  = Math.max(1, Math.ceil(visibleH / lh));
            var endLine   = startLine + visLines - 1;
            var hitLine   = getLineCol(text, idx).line;
            var withinView = (hitLine >= startLine && hitLine <= endLine);
            if (withinView){
              // 自動スクロールを打消し、プレビューは維持
              // ただし、最下段付近でステータスバーに隠れそうなら少し持ち上げる
              try{
                var hitTopPx = (hitLine-1) * lh;
                var viewBottomPx = prevST + visibleH;
                if (hitTopPx + lh > viewBottomPx){
                  var lift = (hitTopPx + lh) - viewBottomPx + Math.ceil(OCCLUDE_H * 0.6);
                  ed.scrollTop = Math.max(0, Math.min(ed.scrollHeight - ed.clientHeight, prevST + lift));
                }else{
                  ed.scrollTop = prevST;
                }
              }catch(_){ ed.scrollTop = prevST; }
            }else{
              // 穏当な into-view（センタリングではなく最小限）
              try{
                var targetTop = Math.max(0, Math.min(ed.scrollHeight - ed.clientHeight, Math.floor((hitLine-1)*lh - (visibleH*0.3))));
                ed.scrollTop = targetTop;
              }catch(_){ }
            }
          }
        }catch(_){}
      }else{
        // 確定検索は既存のスクロール調整
        ensureScrolloff(ed);
      }
      return;
    }
    // 未ヒット: incsearch 中は静かに終了（復帰してメッセージ抑止）
    if (opts && opts.incPreview){
      try{ window._incLastMiss = true; }catch(_){}
      try{ window._incLastIdx = undefined; }catch(_){ }
      try{ window._incLastHit=false; }catch(_){ }
      try{ clearIncPreview(); }catch(_){}
      try{
        if (typeof window._searchFromPos === 'number'){
          var L = ed.value.length;
          setCaret(ed, Math.max(0, Math.min(L, window._searchFromPos)));
          updateStatus(ed);
        }
        if (typeof window._searchFromScrollTop === 'number'){
          ed.scrollTop = window._searchFromScrollTop;
        }
      }catch(_){}
      return;
    }
    // 通常検索（確定）時のみメッセージ表示
    showMsg('Pattern not found: ' + pattern, 1400);
  }catch(_){}
}

