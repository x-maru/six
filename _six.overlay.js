(function(){
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
					var wRect = Math.max(1, Math.round(rc.right - rc.left));
					var w = wRect;
					var h = Math.max(1, rc.bottom - rc.top);
					layer.style.left   = rc.left + 'px';
					layer.style.top    = rc.top  + 'px';
					layer.style.width  = w + 'px';
					layer.style.height = h + 'px';
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
