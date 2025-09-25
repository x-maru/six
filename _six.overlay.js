(function(){
		// ====== Custom Caret (non-blinking, fixed half-width W box) ======
		function ensureCaretLayer(){
				if (window._caretLayer) return window._caretLayer;
				var layer = document.createElement('div');
				layer.id = 'caret-layer';
				layer.style.position = 'fixed';
				layer.style.pointerEvents = 'none';
				layer.style.display = 'none';
				layer.style.zIndex = 3000; // incprevより前面
				document.body.appendChild(layer);
				window._caretLayer = layer;
				// イベントで再配置
				try{
					var ed = document.getElementById('editor');
					if (ed){
						var rerender = function(){ try{ _repositionCaret(); }catch(_){ } };
						if (ed.addEventListener){ ed.addEventListener('scroll', rerender); ed.addEventListener('input', rerender); ed.addEventListener('keyup', rerender); ed.addEventListener('click', rerender); }
						else if (ed.attachEvent){ ed.attachEvent('onscroll', rerender); ed.attachEvent('oninput', rerender); ed.attachEvent('onkeyup', rerender); ed.attachEvent('onclick', rerender); }
						if (window.addEventListener) window.addEventListener('resize', rerender);
					}
				}catch(_){ }
				return layer;
		}
			function _repositionCaret(){
				var ed = document.getElementById('editor');
				if (!ed) return;
				// ヘルプ表示中やエディタが非フォーカスのときは自前キャレットを隠す
				try{
					if (window._imeComposing){ var lyr0=window._caretLayer; if(lyr0) lyr0.style.display='none'; return; }
					var help = document.getElementById('help');
					if (help && help.style.display === 'block') {
						var lyr = window._caretLayer; if (lyr) lyr.style.display = 'none';
						return;
					}
					if (document.activeElement !== ed) {
						var lyr2 = window._caretLayer; if (lyr2) lyr2.style.display = 'none';
						return;
					}
				}catch(_){ }
				var layer = ensureCaretLayer();
				var text = String(ed.value||'');
				var pos = 0; try{ pos = (typeof ed.selectionEnd==='number') ? ed.selectionEnd : (window._lastPos||0); }catch(_){ pos = 0; }
					var lh = (typeof getLineHeightPx==='function') ? getLineHeightPx(ed) : 21; if (!(lh && isFinite(lh) && lh>0)) lh = 21;
					var cw = (typeof getCharWidthPx==='function') ? getCharWidthPx(ed) : 10;
					var rc = null;
					// IE TextRange を最優先（実測座標: タブ/全角のズレを回避）
					try{
						if (ed.createTextRange){
							var tr = ed.createTextRange();
							tr.collapse(true);
							tr.move('character', Math.max(0, Math.min(text.length, pos)));
							rc = tr.getBoundingClientRect();
						}
					}catch(_){ rc = null; }
					var left, top;
					if (rc && isFinite(rc.left) && isFinite(rc.top)){
						left = rc.left; top = rc.top;
					} else {
						// フォールバック: 可視列（タブ/全角を考慮）から算出
						var lc = (typeof getLineCol==='function') ? getLineCol(text, pos) : {line:1,col:1};
						var lineStart = (typeof lineStartByNumber==='function') ? lineStartByNumber(text, lc.line) : 0;
						var prefix = text.slice(lineStart, Math.max(lineStart, Math.min(text.length, lineStart + lc.col - 1)));
						var isFW = function(ch){
							var c = ch.charCodeAt(0);
							return (
								(c>=0x1100 && c<=0x115F) || (c===0x2329||c===0x232A) ||
								(c>=0x2E80 && c<=0xA4CF) || (c>=0xAC00 && c<=0xD7A3) ||
								(c>=0xF900 && c<=0xFAFF) || (c>=0xFE10 && c<=0xFE19) ||
								(c>=0xFE30 && c<=0xFE6F) || (c>=0xFF00 && c<=0xFF60) || (c>=0xFFE0 && c<=0xFFE6)
							);
						};
						var tabstop = 8; var cols=0; for(var i=0;i<prefix.length;i++){ var ch=prefix.charAt(i); if(ch==='\t'){ var adv=tabstop-(cols%tabstop); if(adv<=0) adv=tabstop; cols+=adv; } else { cols+= isFW(ch)?2:1; } }
						var r = ed.getBoundingClientRect();
						var cs = ed.currentStyle || (window.getComputedStyle?getComputedStyle(ed,null):null);
						var padL=0,padT=0,borL=0,borT=0; try{
							padL = parseFloat((cs && (cs.paddingLeft || cs['padding-left'])) || 0) || 0;
							padT = parseFloat((cs && (cs.paddingTop  || cs['padding-top']))  || 0) || 0;
							borL = parseFloat((cs && (cs.borderLeftWidth || cs['border-left-width'])) || 0); if(!isFinite(borL)) borL = ed.clientLeft||0;
							borT = parseFloat((cs && (cs.borderTopWidth  || cs['border-top-width']))  || 0); if(!isFinite(borT)) borT = ed.clientTop ||0;
						}catch(_){ borL = ed.clientLeft||0; borT = ed.clientTop||0; }
						left = r.left + borL + padL + Math.floor(cols * cw + 0.01) - ed.scrollLeft;
						top  = r.top  + borT + padT + (lc.line - 1) * lh - ed.scrollTop;
					}
					// 左→右 赤グラデーション（不透明→半透明）、上下は rem ベース padding
					var gs = (window.THEME && THEME.caretGradientStart) ? THEME.caretGradientStart : 'rgba(255,0,0,1.0)';
					var ge = (window.THEME && THEME.caretGradientEnd)   ? THEME.caretGradientEnd   : 'rgba(255,0,0,0.1)';
					var bg = 'linear-gradient(to right, '+gs+', '+ge+')';
					var rem = (window.THEME && typeof THEME.caretPadRem==='number') ? THEME.caretPadRem : 0.1667;
					var remPx = 16; try{ var rs = window.getComputedStyle?getComputedStyle(document.documentElement):document.documentElement.currentStyle; remPx = parseFloat(rs.fontSize)||16; }catch(_){ remPx = 16; }
					var padPx = Math.max(0, rem * remPx);
					var h = Math.max(1, Math.round(lh - padPx*2));
					var shrinkRem = (window.THEME && typeof THEME.caretShrinkRem==='number') ? THEME.caretShrinkRem : 0.1111; // fallback ~2px @18px
					var shrinkPx = 0; try{ shrinkPx = shrinkRem * remPx; }catch(_){ shrinkPx = 2; }
					if (shrinkPx < 0) shrinkPx = 0; if (shrinkPx > cw - 1) shrinkPx = cw - 1; // 全消失防止
					var w = Math.max(1, Math.round(cw - shrinkPx));
					// 左端基準を保つ（Iビーム感）。右側だけ縮むので再計算不要
					layer.style.left = left + 'px';
					layer.style.top  = (top + padPx) + 'px';
					layer.style.width  = w + 'px';
					layer.style.height = h + 'px';
					layer.style.background = bg;
					layer.style.display = 'block';
		}
		window._repositionCaret = _repositionCaret;
		window.ensureCaretLayer = ensureCaretLayer;
	function ensureIncPreviewLayer(){
		if (window._incPrevLayer) return window._incPrevLayer;
		var ed = document.getElementById('editor');
		if (!ed) return null;
		var layer = document.createElement('div');
		layer.id = 'incprev-layer';
		layer.style.position = 'fixed';
		layer.style.pointerEvents = 'none';
		layer.style.display = 'none';
		layer.style.background = 'rgba(120,160,255,0.30)';
		layer.style.border = '0';
		layer.style.boxSizing = 'content-box';
	    layer.style.zIndex = 2000;
		document.body.appendChild(layer);
		if (!window._incPrevScrollBound){
			var _onIncPrevScroll = function(){ if (layer.style.display !== 'none'){ try{ _repositionIncPreviewRange(); }catch(_){ } } };
			try{ if (ed.addEventListener) ed.addEventListener('scroll', _onIncPrevScroll); else if (ed.attachEvent) ed.attachEvent('onscroll', _onIncPrevScroll); }catch(_){ }
			window._incPrevScrollBound = true;
		}
		window._incPrevLayer = layer;
		return layer;
	}

	function getCharWidthPx(ed){
		try{
			if (typeof window._charWidthPx === 'number' && window._charWidthPx > 0) return window._charWidthPx;
			var s = ed && (ed.currentStyle || (window.getComputedStyle ? window.getComputedStyle(ed, null) : null));
			var ff = s ? (s.fontFamily || s.fontfamily || 'monospace') : 'monospace';
			var fs = s ? (s.fontSize   || s.fontsize   || '21px')      : '21px';
			var ls = 0;
			try{
				var lsRaw = s && (s.letterSpacing || s['letter-spacing']);
				if (lsRaw && lsRaw !== 'normal') ls = parseFloat(lsRaw) || 0;
			}catch(_){ }
			var span = document.createElement('span');
			span.style.position    = 'absolute';
			span.style.visibility  = 'hidden';
			span.style.whiteSpace  = 'pre';
			span.style.fontFamily  = ff;
			span.style.fontSize    = fs;
			if (ls) span.style.letterSpacing = (ls + 'px');
			var count = 800;
			var sample = Array(count + 1).join('0');
			span.innerText = sample;
			document.body.appendChild(span);
			var w = span.offsetWidth / count;
			document.body.removeChild(span);
			// letter-spacing は set していれば DOM 側に反映済み
			window._charWidthPx = (w && isFinite(w) && w > 0) ? w : 8;
			return window._charWidthPx;
		}catch(_){ return 8; }
	}
    
	window._incUseTextRange = true;
	function _repositionIncPreviewRange(){
		var layer = window._incPrevLayer;
		if (!layer) return;
		var ed = document.getElementById('editor');
		if (!ed || typeof window._incPrevPos !== 'object') return;
		var lh = (typeof getLineHeightPx==='function') ? getLineHeightPx(ed) : null;
		if (!lh || !isFinite(lh) || lh <= 0) { layer.style.display = 'none'; return; }
		var line = parseInt((window._incPrevPos.line||1),10) || 1;
		var col  = parseInt((window._incPrevPos.col ||1),10) || 1;
		var len  = parseInt((window._incPrevPos.len ||0),10); if (!isFinite(len) || len < 0) len = 0;
		try{
			if (ed.createTextRange && window._incUseTextRange){
				var text = String(ed.value || "");
				var absStart = 0;
				try{ absStart = (typeof lineStartByNumber==='function') ? (lineStartByNumber(text, line) + (col - 1)) : 0; }catch(_){ absStart = 0; }
				if (absStart < 0) absStart = 0;
				if (absStart > text.length) absStart = text.length;
				var tr = ed.createTextRange();
				tr.collapse(true);
				tr.moveStart('character', absStart);
				tr.moveEnd('character', len > 0 ? len : 0);
				var rc = tr.getBoundingClientRect();
				if (rc && isFinite(rc.left) && isFinite(rc.right) && isFinite(rc.top) && isFinite(rc.bottom)){
					var left = Math.round(rc.left);
					var top  = Math.round(rc.top);
					var w    = Math.max(1, Math.round(rc.right - rc.left));
					var h    = Math.max(1, Math.round(rc.bottom - rc.top));
					layer.style.left   = left + 'px';
					layer.style.top    = top  + 'px';
					layer.style.width  = w    + 'px';
					layer.style.height = h    + 'px';
					layer.style.display = 'block';
					return;
				}
			}
		}catch(_){ }

		var cw = getCharWidthPx(ed);
		var r  = ed.getBoundingClientRect();
		var cs = ed.currentStyle || (window.getComputedStyle ? window.getComputedStyle(ed, null) : null);
		var padL=0,padT=0,borL=0,borT=0;
		try{
			padL = parseFloat((cs && (cs.paddingLeft || cs['padding-left'])) || 0) || 0;
			padT = parseFloat((cs && (cs.paddingTop  || cs['padding-top']))  || 0) || 0;
			borL = parseFloat((cs && (cs.borderLeftWidth || cs['border-left-width'])) || 0);
			borT = parseFloat((cs && (cs.borderTopWidth  || cs['border-top-width']))  || 0);
			if (!isFinite(borL)) borL = ed.clientLeft || 0;
			if (!isFinite(borT)) borT = ed.clientTop  || 0;
		}catch(_){ borL = ed.clientLeft || 0; borT = ed.clientTop || 0; }
		var contentLeft = r.left + borL + padL;
		var contentTop  = r.top  + borT + padT;
		var textAll = String(ed.value || "");
		var lineStartAbs2 = 0;
		try{ lineStartAbs2 = (typeof lineStartByNumber==='function') ? lineStartByNumber(textAll, line) : 0; }catch(_){ lineStartAbs2 = 0; }
		var absStart2 = lineStartAbs2 + (col - 1);
		if (absStart2 < 0) absStart2 = 0;
		if (absStart2 > textAll.length) absStart2 = textAll.length;
		var prefix = textAll.slice(lineStartAbs2, absStart2);
		var tabstop = 8;
		var visCols = (function(s, ts){ var c=0; for(var i=0;i<s.length;i++){ var ch=s.charAt(i); if(ch==='\t'){ var adv = ts - (c%ts); if(adv<=0) adv=ts; c+=adv; } else { c+=1; } } return c; })(prefix, tabstop);
		var startOff = Math.floor(visCols * cw + 0.01);
		var endOff   = Math.ceil((visCols + len) * cw - 0.01);
		var top  = contentTop  + (line - 1) * lh - ed.scrollTop;
		var left = contentLeft + startOff    - ed.scrollLeft;
		var wid  = Math.max(1, endOff - startOff);
		layer.style.left   = left + 'px';
		layer.style.top    = top  + 'px';
		layer.style.width  = wid  + 'px';
		layer.style.height = Math.round(lh) + 'px';
		layer.style.display = 'block';
	}

	function renderIncPreviewRange(line, col, len){
		var ed = document.getElementById('editor');
		if (!ed) return;
		ensureIncPreviewLayer();
		window._incPrevPos = { line: line, col: col, len: len };
		_repositionIncPreviewRange();
		if (window._incPrevLayer) window._incPrevLayer.style.display = 'block';
	}

	function clearIncPreview(){
		window._incPrevPos = undefined;
		if (window._incPrevLayer) window._incPrevLayer.style.display = 'none';
	}

	window.ensureIncPreviewLayer = ensureIncPreviewLayer;
	window._repositionIncPreviewRange = _repositionIncPreviewRange;
	window.renderIncPreviewRange = renderIncPreviewRange;
	window.clearIncPreview = clearIncPreview;
	window.getCharWidthPx = getCharWidthPx;
})();
