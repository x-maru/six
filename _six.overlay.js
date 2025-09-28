(function(){
	// ====== list (制御/不可視文字のオーバーレイ表示) ======
	function ensureListLayer(){
		if (window._listLayer) return window._listLayer;
		var lyr=document.createElement('div');
		lyr.id='list-layer';
		lyr.style.position='fixed';
		lyr.style.pointerEvents='none';
		lyr.style.zIndex=40; // cmdbar(50) より下
		lyr.style.whiteSpace='pre';
		lyr.style.display='none';
		document.body.appendChild(lyr);
		// 直接スクロール/入力でも再描画（caret-layer 経由イベントが飛ばないケース対策）
		try{
			var ed=document.getElementById('editor');
			if(ed && !ed._listBound){
				var reb=function(){ try{ if(window.OPT && OPT.list) scheduleListLayerRender(false); }catch(_){ } };
				var rebForce=function(){ try{ if(window.OPT && OPT.list) scheduleListLayerRender(true); }catch(_){ } };
				if(ed.addEventListener){
					ed.addEventListener('scroll', reb);
					ed.addEventListener('keyup', reb);
					ed.addEventListener('click', reb);
					// INSERT 中の文字入力（追加/削除） は即時再描画
					ed.addEventListener('input', rebForce);
				}
				else if(ed.attachEvent){
					ed.attachEvent('onscroll', reb);
					ed.attachEvent('onkeyup', reb);
					ed.attachEvent('onclick', reb);
					ed.attachEvent('oninput', rebForce);
				}
				ed._listBound=true;
			}
		}catch(_){ }
		return (window._listLayer=lyr);
	}

	// 高頻度スクロール時は描画を遅延し直前の 1 回にまとめる (j 連打など)
	var _listRenderTimer=null, _lastListRenderAt=0;
	var _listLastSig=null; // 前回描画時の状態シグネチャ（スクロール・サイズ・変更カウンタ等）
	function scheduleListLayerRender(force){
		var ed=document.getElementById('editor');
		if(force){ if(_listRenderTimer){ clearTimeout(_listRenderTimer); _listRenderTimer=null; } _renderListLayer(); return; }
		// 変更が無ければスキップ（キャレット移動のみでチラつき防止）
		try{
			if(ed && window.OPT && OPT.list){
				var sig=[ed.scrollTop, ed.scrollLeft, ed.clientWidth, ed.clientHeight, (window.modifiedCount||0), 1].join('|');
				if(sig===_listLastSig) return; // 状態不変 → 再描画不要
				_listLastSig=sig; // 先に記録（短時間に多重イベントでも一度だけスケジュール）
			}
		}catch(_){ }
		var now=+new Date();
		// 直近描画から一定時間(70ms)未満なら再スケジューリングのみ
		var delay=70;
		if(_listRenderTimer){ clearTimeout(_listRenderTimer); }
		// 待機中は一旦非表示（スクロール中の残像を消す）
		try{ if(window._listLayer) window._listLayer.style.display='none'; }catch(_){ }
		_listRenderTimer=setTimeout(function(){ _listRenderTimer=null; _renderListLayer(); _lastListRenderAt=+new Date(); }, delay);
	}
	function _renderListLayer(){
		try{
			if(!window.OPT || !OPT.list){ var ll=window._listLayer; if(ll) ll.style.display='none'; return; }
			var ed=document.getElementById('editor'); if(!ed) return;
			var text=String(ed.value||'');
			var lh=(typeof getLineHeightPx==='function')?getLineHeightPx(ed):21; if(!(lh>0)) lh=21;
			var cw=(typeof getCharWidthPx==='function')?getCharWidthPx(ed):10;
			var r=ed.getBoundingClientRect();
			var cs=ed.currentStyle || (window.getComputedStyle?getComputedStyle(ed,null):null);
			var padL=0,padT=0,borL=0,borT=0; try{
				padL=parseFloat((cs && (cs.paddingLeft||cs['padding-left']))||0)||0;
				padT=parseFloat((cs && (cs.paddingTop ||cs['padding-top']))||0)||0;
				borL=parseFloat((cs && (cs.borderLeftWidth||cs['border-left-width']))||0); if(!isFinite(borL)) borL=ed.clientLeft||0;
				borT=parseFloat((cs && (cs.borderTopWidth ||cs['border-top-width']))||0); if(!isFinite(borT)) borT=ed.clientTop ||0;
			}catch(_){ borL=ed.clientLeft||0; borT=ed.clientTop||0; }
			// 表示開始行を先に求める（後続の TextRange 補正で利用）
			var viewH=ed.clientHeight;
			var firstLine=Math.floor(ed.scrollTop / lh)+1;
			// 基準行(最初の可視行) の実座標を TextRange で取得 (縦方向ドリフト防止)
			var baseLeft=r.left + borL + padL, baseTop=r.top + borT + padT;
			try{
				if(ed.createTextRange && typeof lineStartByNumber==='function'){
					var firstAbs0=lineStartByNumber(text, firstLine);
					if(firstAbs0>=0){ var tr0=ed.createTextRange(); tr0.collapse(true); tr0.move('character', firstAbs0); var rc0=tr0.getBoundingClientRect(); if(rc0 && isFinite(rc0.left) && isFinite(rc0.top)){ baseLeft=rc0.left; baseTop=rc0.top; } }
				}
			}catch(_){ }
			var visibleLines=Math.ceil(viewH / lh)+1; var lastLine=firstLine+visibleLines;
			var tabstop=8; var ctrlColor=(window.THEME && THEME.listControlColor)||'#8ad0ff';
			// 全角幅測定（1回キャッシュ）
			function getFW(){
					if(typeof window._fwCharWidth==='number' && window._fwCharWidth>0) return window._fwCharWidth;
					try{
						var span=document.createElement('span');
						span.style.position='absolute'; span.style.visibility='hidden'; span.style.whiteSpace='pre';
						span.style.fontFamily = cs ? (cs.fontFamily||cs['font-family']||'monospace') : 'monospace';
						span.style.fontSize   = cs ? (cs.fontSize  ||cs['font-size']  ||'16px') : '16px';
						var count=100; span.innerHTML = Array(count+1).join('あ');
						document.body.appendChild(span);
						var w = span.offsetWidth / count; document.body.removeChild(span);
						window._fwCharWidth = (w&&isFinite(w)&&w>0)?w:(cw*2);
						return window._fwCharWidth;
					}catch(_){ window._fwCharWidth = cw*2; return window._fwCharWidth; }
				}
			var fw = getFW();
			function isFW(ch){ var c=ch.charCodeAt(0); return (
					(c>=0x1100&&c<=0x115F)||(c>=0x2E80&&c<=0xA4CF)||(c>=0xAC00&&c<=0xD7A3)||
					(c>=0xF900&&c<=0xFAFF)||(c>=0xFE10&&c<=0xFE6F)||(c>=0xFF00&&c<=0xFF60)||(c>=0xFFE0&&c<=0xFFE6)
				); }
			var out=[];
			for(var ln=firstLine; ln<lastLine; ln++){
				var lineStart=(typeof lineStartByNumber==='function')?lineStartByNumber(text, ln):0;
					if(lineStart<0 || lineStart>=text.length){ if(lineStart>=text.length) break; }
				var lineEnd=(typeof lineEndIndex==='function')?lineEndIndex(text,lineStart):text.length;
				var raw=text.slice(lineStart,lineEnd);
				var hasNL=(lineEnd < text.length && text.charAt(lineEnd)=='\n');
				var pixelX=0; var col=0; var adv=0; var precisePx=0; var visColsToPx=function(vc){ return vc * cw; };
				var spaces=[]; // {idx, x}
				var sym=[];    // {x, html}
				for(var i=0;i<raw.length;i++){
					var ch=raw.charAt(i);
						// six 拡張: 全角空白 (U+3000) は常時可視化（TAB 同様）記号は U+25A2 '▢'
					if(ch==='\u3000'){
						var fwGlyph=(THEME && THEME.fullwidthSpaceGlyph)||'▢';
						var fwFont=(THEME && THEME.fullwidthSpaceFont)||'';
						var fwSizePct=(THEME && THEME.fullwidthSpaceFontSizePct)||100;
						var extraStyle='color:'+ctrlColor+';';
						if(fwFont) extraStyle+='font-family:'+fwFont+';';
						if(fwSizePct && fwSizePct!==100) extraStyle+='font-size:'+fwSizePct+'%;line-height:1;';
						sym.push({ posAbs: lineStart + i, html:'<span style="'+extraStyle+'">'+fwGlyph+'</span>' });
						// 幅計算: 全角 2cols 相当（視覚列+2, ピクセルは fw ）
						col += 2; precisePx += fw; pixelX = visColsToPx(col); continue;
					}
					if(ch==='\t'){
						adv=tabstop - (col % tabstop); if(adv<=0) adv=tabstop;
						sym.push({ posAbs: lineStart + i, html:'<span style="color:'+ctrlColor+'">▸</span>' });
						col += adv; precisePx += adv * cw; pixelX = visColsToPx(col); continue;
						}
					if(ch===' '){
						spaces.push({ idx:i, posAbs: lineStart + i });
						col += 1; precisePx += cw; pixelX = visColsToPx(col); continue;
						}
						// 通常文字
					var wcol = isFW(ch)?2:1; col += wcol; precisePx += isFW(ch)?fw:cw; pixelX = visColsToPx(col);
					}
					// 連続末尾スペースを抽出
				if(spaces.length){
					var lastNonSpaceIndex = raw.length - 1;
					for(var k=raw.length-1;k>=0;k--){ var ch2=raw.charAt(k); if(ch2!==' ' && ch2!=='\u3000' && ch2!=='\t'){ lastNonSpaceIndex = k; break; } }
					for(var sidx=spaces.length-1; sidx>=0; sidx--){
						var sp=spaces[sidx]; if(sp.idx>lastNonSpaceIndex){ sym.push({ posAbs: sp.posAbs, html:'<span style="color:'+ctrlColor+'">·</span>' }); }
						else break;
					}
					}
				if(hasNL){
					// 改行種別判定: raw の直後の文字( lineEnd 時点 ) とその1つ先
					var nlColor=(window.THEME && THEME.newlineColorLF)||ctrlColor;
					try{
						var c1=text.charAt(lineEnd); // 期待: '\n' または '\r'
						var c2=text.charAt(lineEnd+1);
						if(c1==='\r' && c2==='\n') nlColor = (THEME.newlineColorCRLF||nlColor);
						else if(c1==='\r') nlColor = (THEME.newlineColorCR||nlColor);
						else /* c1==='\n' */ nlColor = (THEME.newlineColorLF||nlColor);
					}catch(_){ }
					sym.push({ posAbs: lineEnd, html:'<span style="color:'+nlColor+'">↲</span>' });
				}

				// TextRange 実測で x を補正
				if(ed.createTextRange && sym.length){
					for(var si0=0; si0<sym.length; si0++){
						var sm=sym[si0];
						if(typeof sm.posAbs==='number'){
							try{
								var trm=ed.createTextRange();
								trm.collapse(true);
								trm.move('character', sm.posAbs);
								var rcm=trm.getBoundingClientRect();
								if(rcm && isFinite(rcm.left)) sm._x = rcm.left - baseLeft;
							}catch(_){ }
						}
					}
				}
					// 行コンテナ生成
				// 行の top は TextRange で個別実測（フォールバックは行番号 * lh）
				var relTop=(function(){
					try{
						if(ed.createTextRange){ var trl=ed.createTextRange(); trl.collapse(true); trl.move('character', lineStart); var rcl=trl.getBoundingClientRect(); if(rcl && isFinite(rcl.top)) { var v=rcl.top - baseTop; var ideal=(ln-firstLine)*lh; if(Math.abs(v-ideal)>lh*0.6) return ideal; return v; } }
					}catch(_){ }
					return (ln-firstLine)*lh;
				})();
				var lineHTML='<div style="position:absolute;left:0;top:'+relTop+'px;height:'+lh+'px;width:100%;">';
				for(var si=0; si<sym.length; si++){
					var s=sym[si]; var px = (typeof s._x==='number')?s._x:(s.x||0); lineHTML+='<span style="position:absolute;left:'+Math.round(px)+'px;top:0;line-height:'+lh+'px;">'+s.html+'</span>';
				}
				lineHTML+='</div>';
				out.push(lineHTML);
				}
			var lyr=ensureListLayer();
			// 実描画後の最終シグネチャを更新（スクロールやサイズが描画中に変わっていた場合）
			try{ _listLastSig=[ed.scrollTop, ed.scrollLeft, ed.clientWidth, ed.clientHeight, (window.modifiedCount||0), 1].join('|'); }catch(_){ }
			var fnt=(cs && (cs.fontFamily||cs['font-family']))||'monospace';
			var fsz=(cs && (cs.fontSize||cs['font-size']))||'16px';
			lyr.style.left=baseLeft+'px';
			lyr.style.top =baseTop +'px';
			lyr.style.width=(ed.clientWidth)+'px';
			lyr.style.height=(viewH)+'px';
			lyr.style.fontFamily=fnt;
			lyr.style.fontSize=fsz;
			lyr.innerHTML=out.join('');
			lyr.style.display='block';
		}catch(_){ }
	}
	function _refreshListLayer(force){ try{ if(window.OPT && OPT.list){ scheduleListLayerRender(!!force); } }catch(_){ } }
	window._renderListLayer=_renderListLayer;
	window._refreshListLayer=_refreshListLayer;
	window.scheduleListLayerRender=scheduleListLayerRender;
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
						var rerender = function(){ try{ _repositionCaret(); }catch(_){ } try{ _refreshListLayer(); }catch(_){ } };
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
