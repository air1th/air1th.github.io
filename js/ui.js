/**
 * UI 管理器 — 星空动画 / 打字机效果 / 文本流控制 / 页面导航
 */
class UIManager {
  constructor(engine) {
    this.engine  = engine;
    this._cache  = {};

    // 打字机状态
    this._typeTimer    = null;
    this._isTyping     = false;
    this._skipTyping   = false;
    this._allTextShown = false;

    // 速度控制
    this._baseSpeed    = 28;  // 基础 ms/字
    this._speedLevel   = 1;   // 1 / 2 / 4
    this._paraPause    = 120; // 段落间停顿 ms

    // 页面历史（返回上一页）
    this._pageHistory  = [];
    this._choiceMade   = false;
    this._restoringPage = false;
    this._currentSceneBlock = null;
    this._lastRenderedChapterKey = null;
    this._activeChoicePanel = null;
    this._pendingEnding = null;

    this._initStarfield();
  }

  $(sel) { return this._cache[sel] || (this._cache[sel] = document.querySelector(sel)); }

  /* ================================================================
     星空动画（Canvas）
     ================================================================ */
  _initStarfield() {
    this._canvas = this.$('#starfield');
    this._ctx    = this._canvas.getContext('2d');
    this._stars  = [];
    this._shootingStars = [];

    this._resizeCanvas();
    window.addEventListener('resize', () => this._resizeCanvas());

    for (let i = 0; i < 200; i++) {
      this._stars.push({
        x: Math.random() * this._canvas.width, y: Math.random() * this._canvas.height,
        r: Math.random() * 1.4 + 0.3, baseAlpha: Math.random() * 0.35 + 0.48, alpha: 0,
        twinkleSpeed: Math.random() * 0.014 + 0.004, twinkleOffset: Math.random() * Math.PI * 2,
        driftX: (Math.random() - 0.5) * 0.1, driftY: -0.05 - Math.random() * 0.15, depth: Math.random()
      });
    }
    for (let i = 0; i < 15; i++) {
      this._stars.push({
        x: Math.random() * this._canvas.width, y: Math.random() * this._canvas.height,
        r: Math.random() * 0.9 + 0.9, baseAlpha: 0.8 + Math.random() * 0.18, alpha: 0,
        twinkleSpeed: Math.random() * 0.018 + 0.01, twinkleOffset: Math.random() * Math.PI * 2,
        driftX: (Math.random() - 0.5) * 0.04, driftY: -0.03 - Math.random() * 0.07, depth: 1
      });
    }
    this._animateStars();
  }

  _resizeCanvas() {
    this._canvas.width  = window.innerWidth;
    this._canvas.height = window.innerHeight;
  }

  _animateStars() {
    const { width, height } = this._canvas;
    const ctx = this._ctx;
    ctx.clearRect(0, 0, width, height);

    const g = ctx.createRadialGradient(width*.3, height*.4, 0, width*.5, height*.5, Math.max(width,height)*.8);
    g.addColorStop(0, 'rgba(24,20,52,.16)'); g.addColorStop(.5, 'rgba(6,6,15,0)'); g.addColorStop(1, 'rgba(6,6,15,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, width, height);

    const t = Date.now() * 0.001;
    for (const s of this._stars) {
      s.x += s.driftX; s.y += s.driftY;
      if (s.x < -5) s.x = width + 5; if (s.x > width + 5) s.x = -5;
      if (s.y < -5) s.y = height + 5; if (s.y > height + 5) s.y = -5;
      s.alpha = s.baseAlpha + Math.sin(t * s.twinkleSpeed * 20 + s.twinkleOffset) * 0.22;
      s.alpha = Math.max(0.07, Math.min(1, s.alpha));
      if (s.r > 0.8) {
        ctx.save();
        ctx.shadowColor = `rgba(201,169,110,${s.alpha * 0.35})`;
        ctx.shadowBlur = 8;
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI*2);
        ctx.fillStyle = `rgba(245,240,225,${s.alpha})`; ctx.fill();
        ctx.restore();
        continue;
      }
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI*2);
      ctx.fillStyle = `rgba(238,230,214,${s.alpha})`; ctx.fill();
      if (s.alpha > 0.55) {
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r*2.5, 0, Math.PI*2);
        ctx.fillStyle = `rgba(201,169,110,${s.alpha*.18})`; ctx.fill();
      }
    }

    if (Math.random() < 0.004) {
      this._shootingStars.push({
        x: Math.random()*width*.8, y: Math.random()*height*.5,
        len: 50+Math.random()*90, speed: 7+Math.random()*11, life: 1,
        angle: Math.PI*.25+Math.random()*.15
      });
    }
    for (let i = this._shootingStars.length-1; i >= 0; i--) {
      const m = this._shootingStars[i];
      m.x += Math.cos(m.angle)*m.speed; m.y += Math.sin(m.angle)*m.speed; m.life -= .025;
      if (m.life <= 0) { this._shootingStars.splice(i,1); continue; }
      const ex = m.x - Math.cos(m.angle)*m.len, ey = m.y - Math.sin(m.angle)*m.len;
      const g2 = ctx.createLinearGradient(m.x, m.y, ex, ey);
      g2.addColorStop(0, `rgba(255,242,208,${m.life})`); g2.addColorStop(1, 'rgba(255,242,208,0)');
      ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.lineTo(ex, ey);
      ctx.strokeStyle = g2; ctx.lineWidth = 1.2; ctx.stroke();
    }
    requestAnimationFrame(() => this._animateStars());
  }

  /* ================================================================
     初始化
     ================================================================ */
  init() {
    this._bindEvents();
    this._checkAutoSave();
  }

  _bindEvents() {
    this.$('#game-screen').addEventListener('click', (e) => {
      if (e.target.closest('.choice-panel') || e.target.closest('#top-bar') ||
          e.target.closest('#menu-dropdown') || e.target.closest('#save-load-overlay') ||
          e.target.closest('#settings-overlay') ||
          e.target.closest('#about-overlay') || e.target.closest('#autosave-overlay') ||
          e.target.closest('#endings-overlay') || e.target.closest('#ending-detail-overlay') ||
          e.target.closest('#ending-overlay')) return;
      this._handleClick();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault(); this._handleClick();
      }
      if (e.key === 'Escape') { this.closeAllOverlays(); }
    });

    this.$('#sl-close').addEventListener('click', () => this.closeAllOverlays());
    this.$('#save-load-overlay').addEventListener('click', (e) => {
      if (e.target === this.$('#save-load-overlay')) this.closeAllOverlays();
    });
    this.$('#about-overlay').addEventListener('click', (e) => {
      if (e.target === this.$('#about-overlay')) this.closeAllOverlays();
    });
    this.$('#autosave-overlay').addEventListener('click', (e) => {
      if (e.target === this.$('#autosave-overlay')) this.closeAllOverlays();
    });
    this.$('#endings-overlay').addEventListener('click', (e) => {
      if (e.target === this.$('#endings-overlay')) this.closeAllOverlays();
    });
    this.$('#ending-detail-overlay').addEventListener('click', (e) => {
      if (e.target === this.$('#ending-detail-overlay')) this.closeAllOverlays();
    });
    this.$('#settings-close').addEventListener('click', () => this.closeAllOverlays());
    this.$('#btn-export').addEventListener('click', () => StorageManager.exportAll());
    this.$('#btn-import').addEventListener('click', () => this.$('#import-file').click());
    this.$('#import-file').addEventListener('change', (e) => this._handleImport(e));
  }

  /* ================================================================
     标题画面
     ================================================================ */
  showTitleScreen() {
    this.$('#title-screen').classList.remove('hidden');
    this.$('#game-screen').classList.add('hidden');
  }
  hideTitleScreen() {
    this.$('#title-screen').classList.add('hidden');
    this.$('#game-screen').classList.remove('hidden');
  }

  resetReadingFlow() {
    this._clearTyping();
    this._clearNovelText();
    this._pageHistory = [];
    this._choiceMade = false;
    this._restoringPage = false;
    this._currentSceneBlock = null;
    this._lastRenderedChapterKey = null;
    this._activeChoicePanel = null;
    this._pendingEnding = null;
    this.$('#continue-hint').classList.remove('visible');
    this.$('#ending-overlay').classList.remove('active');
    this.closeAllOverlays();
    this._updateBackButton();
  }

  /* ================================================================
     场景渲染 — 打字机效果
     ================================================================ */
  renderScene(scene) {
    if (!scene) return;
    this._clearTyping();

    if (this._restoringPage) {
      this._restoringPage = false;
      this._updateReaderChrome(scene);
      this._updateBackButton();
      return;
    }
    this._restoringPage = false;

    this._allTextShown = false;
    this._currentLines = scene.lines || [];
    this._currentLineIdx  = 0;
    this._currentCharIdx  = 0;
    this._currentParaEl   = null;
    this._currentSceneBlock = this._createSceneBlock(scene);

    if (this._activeChoicePanel) {
      this._activeChoicePanel.classList.remove('active');
    }
    this.$('#continue-hint').classList.remove('visible');
    this._updateReaderChrome(scene);

    // 结局：先打完文字，显示继续提示，用户点击后再弹窗
    if (scene.type === 'ending') {
      this._typewriteAll(() => {
        this._pendingEnding = scene;
        this.$('#continue-hint').classList.add('visible');
      });
      return;
    }

    // 开始打字
    this._typewriteAll(() => {
      if (scene.choices) {
        this._showChoices(scene.choices, scene.choicePrompt);
      } else {
        this.$('#continue-hint').classList.add('visible');
      }
    });

    // 更新返回按钮可见性
    this._updateBackButton();
  }

  _clearNovelText() {
    this.$('#novel-text').innerHTML = '';
    this.$('#novel-container').scrollTop = 0;
  }

  _clearTyping() {
    if (this._typeTimer) { clearTimeout(this._typeTimer); this._typeTimer = null; }
    this._isTyping   = false;
    this._skipTyping = false;
  }

  _createSceneBlock(scene) {
    const container = this.$('#novel-text');
    const chapterKey = this._chapterKey(scene);
    if (chapterKey && chapterKey !== this._lastRenderedChapterKey) {
      container.appendChild(this._createChapterHeading(scene));
      this._lastRenderedChapterKey = chapterKey;
    }

    const block = document.createElement('section');
    block.className = 'scene-block';
    block.dataset.sceneId = scene.id || '';
    container.appendChild(block);
    this._scrollToBottom();
    return block;
  }

  _chapterKey(scene) {
    if (!scene || scene.chapter == null) return '';
    return `${scene.chapter}|${scene.chapterTitle || ''}`;
  }

  _createChapterHeading(scene) {
    const heading = document.createElement('section');
    const isPrologue = scene.chapter === 0;
    heading.className = `chapter-heading${isPrologue ? ' prologue' : ''}`;

    const kicker = document.createElement('span');
    kicker.className = 'chapter-kicker';
    kicker.textContent = this._chapterLabel(scene);

    const title = document.createElement('span');
    title.className = 'chapter-title';
    title.textContent = scene.chapterTitle || '';

    if (!isPrologue) heading.appendChild(kicker);
    heading.appendChild(title);
    return heading;
  }

  _chapterLabel(scene) {
    const map = ['零','一','二','三','四','五','六','七','八','九','十','十一','十二','十三'];
    if (!scene || scene.chapter == null || scene.chapter === 0) return '序幕';
    return `第${map[scene.chapter] || scene.chapter}章`;
  }

  _updateReaderChrome(scene) {
    const label = this.$('#reader-chapter-label');
    if (label) label.textContent = this._chapterLabel(scene);
  }

  _initReaderMeters() {
    document.querySelectorAll('.meter-dots').forEach((box) => {
      box.innerHTML = '';
      for (let i = 0; i < 4; i++) {
        box.appendChild(document.createElement('span'));
      }
    });
    this._renderReaderMeters();
  }

  _renderReaderMeters() {
    const affection = this.engine.getAffection ? this.engine.getAffection() : {};
    document.querySelectorAll('.reader-meter').forEach((meter) => {
      const role = meter.dataset.role;
      const value = Math.max(0, Math.min(4, affection[role] || 0));
      meter.querySelectorAll('.meter-dots span').forEach((dot, idx) => {
        dot.classList.toggle('active', idx < value);
      });
    });
  }

  /* ================================================================
     打字机核心
     ================================================================ */
  _typewriteAll(onComplete) {
    this._isTyping   = true;
    this._skipTyping = false;
    const container = this._currentSceneBlock?.isConnected ? this._currentSceneBlock : this.$('#novel-text');
    const lines = this._currentLines;

    const typeNext = () => {
      // 跳过模式：立即显示全部剩余内容
      if (this._skipTyping) {
        let startIdx = this._currentLineIdx;
        // 补完当前段落
        if (this._currentParaEl && this._currentLineIdx < lines.length) {
          const curLine = lines[this._currentLineIdx];
          const curText = typeof curLine === 'string' ? curLine : curLine.text;
          this._currentParaEl.textContent = curText;
          this._currentParaEl.style.opacity = '1';
          this._currentParaEl.style.transform = 'translateY(0)';
          startIdx = this._currentLineIdx + 1;
        }
        // 创建剩余段落
        for (let i = startIdx; i < lines.length; i++) {
          const line = lines[i];
          const el = this._createParagraph(line);
          el.style.opacity = '1';
          el.style.transform = 'translateY(0)';
          el.textContent = typeof line === 'string' ? line : line.text;
          container.appendChild(el);
        }
        this._currentLineIdx = lines.length;
        this._currentParaEl = null;
        this._isTyping = false;
        this._allTextShown = true;
        this._scrollToBottom();
        if (onComplete) onComplete();
        return;
      }

      // 所有行完成
      if (this._currentLineIdx >= lines.length) {
        this._isTyping = false;
        this._allTextShown = true;
        if (onComplete) onComplete();
        return;
      }

      const line = lines[this._currentLineIdx];
      const text = typeof line === 'string' ? line : line.text;

      // 创建段落元素
      if (!this._currentParaEl) {
        this._currentParaEl = this._createParagraph(line);
        this._currentParaEl.textContent = '';
        container.appendChild(this._currentParaEl);
        this._currentParaEl.style.opacity = '1';
        this._currentParaEl.style.transform = 'translateY(0)';
        this._currentCharIdx = 0;
        this._scrollToBottom();
      }

      // 逐字输出
      if (this._currentCharIdx < text.length) {
        this._currentParaEl.textContent += text[this._currentCharIdx];
        this._currentCharIdx++;
        this._scrollToBottom();
        const delay = this._baseSpeed / this._speedLevel;
        this._typeTimer = setTimeout(typeNext, delay);
      } else {
        // 当前段落完成，进入下一段
        this._currentParaEl = null;
        this._currentLineIdx++;
        this._typeTimer = setTimeout(typeNext, this._paraPause);
      }
    };

    typeNext();
  }

  _createParagraph(line) {
    const el = document.createElement('p');
    el.className = 'novel-paragraph';
    if (typeof line === 'object') {
      if (line.speaker) el.classList.add('dialogue');
      if (line.noIndent) el.classList.add('no-indent');
    }
    el.style.opacity = '0';
    el.style.transform = 'translateY(14px)';
    return el;
  }

  _scrollToBottom() {
    const box = this.$('#novel-container');
    requestAnimationFrame(() => {
      box.scrollTo({ top: box.scrollHeight, behavior: 'smooth' });
    });
  }

  /* ================================================================
     点击处理：第一下跳过动画 → 第二下推进
     ================================================================ */
  _handleClick() {
    // 正在打字 → 跳过，全部显示
    if (this._isTyping) {
      this._skipTyping = true;
      return;
    }

    // 有选项 → 不响应点击
    if (this.engine.hasChoices()) return;

    // 结局场景：文字已全部显示，点击后弹出结局浮窗
    if (this.engine.isEnding()) {
      if (this._pendingEnding) {
        this._showEnding(this._pendingEnding);
        this._pendingEnding = null;
        this.$('#continue-hint').classList.remove('visible');
      }
      return;
    }

    // 全部文字已显示 → 推进到下一页
    if (this._allTextShown) {
      this._advanceScene();
    }
  }

  /** 将当前页推入历史（含好感度/旗标快照） */
  _pushPageHistory() {
    const scene = this.engine.currentScene();
    if (!scene) return;
    this._pageHistory.push({
      sceneId: this.engine.state.currentScene,
      html: this.$('#novel-text').innerHTML,
      scrollTop: this.$('#novel-container').scrollTop,
      chapterKey: this._lastRenderedChapterKey,
      affection: { ...this.engine.state.affection },
      flags: { ...this.engine.state.flags }
    });
    if (this._pageHistory.length > 60) this._pageHistory.shift();
  }

  _advanceScene() {
    this._pushPageHistory();

    this.$('#continue-hint').classList.remove('visible');
    const advanced = this.engine.advance();
    if (!advanced) {
      const sc = this.engine.currentScene();
      if (sc?.type === 'ending') {
        this._pendingEnding = sc;
        this.$('#continue-hint').classList.add('visible');
      }
    }
  }

  /* ================================================================
     返回上一页
     ================================================================ */
  goBack() {
    if (this._pageHistory.length === 0) return;

    this._clearTyping();

    const prev = this._pageHistory.pop();
    // 恢复引擎状态
    this.engine.state.currentScene = prev.sceneId;
    // 恢复好感度与旗标（撤销选择带来的变化）
    if (prev.affection) this.engine.state.affection = { ...prev.affection };
    if (prev.flags)     this.engine.state.flags     = { ...prev.flags };
    // 同步裁剪引擎历史
    const histIdx = this.engine.state.history.lastIndexOf(prev.sceneId);
    if (histIdx >= 0) {
      this.engine.state.history = this.engine.state.history.slice(0, histIdx);
    }

    // 恢复 HTML
    this._restoringPage = true;
    this.$('#novel-text').innerHTML = prev.html;
    this._currentSceneBlock = null;
    this.$('#novel-container').scrollTop = prev.scrollTop || 0;
    this._allTextShown = true;
    this._isTyping = false;
    this._lastRenderedChapterKey = prev.chapterKey || this._chapterKey(this.engine.currentScene());

    const scene = this.engine.currentScene();
    this.$('#continue-hint').classList.remove('visible');
    this._updateReaderChrome(scene);

    if (scene?.type === 'ending') {
      this._pendingEnding = scene;
      this.$('#continue-hint').classList.add('visible');
    } else if (scene?.choices) {
      // 重新渲染选项面板（恢复事件绑定）
      const existing = this.$('#novel-text').querySelector('.choice-panel');
      if (existing) existing.remove();
      this._showChoices(scene.choices, scene.choicePrompt);
    } else {
      this.$('#continue-hint').classList.add('visible');
    }

    this._updateBackButton();
  }

  _updateBackButton() {
    const btn = this.$('#back-btn');
    if (this._pageHistory.length > 0 && !this.engine.isEnding()) {
      btn.classList.remove('hidden');
    } else {
      btn.classList.add('hidden');
    }
  }

  /* ================================================================
     选项面板
     ================================================================ */
  _showChoices(choices, prompt) {
    if (this._activeChoicePanel?.isConnected && !this._activeChoicePanel.classList.contains('resolved')) {
      this._activeChoicePanel.remove();
    }

    const panel = document.createElement('div');
    panel.className = 'choice-panel';

    const promptEl = document.createElement('p');
    promptEl.className = 'choice-prompt';
    promptEl.textContent = prompt || '——';
    panel.appendChild(promptEl);

    choices.forEach((ch, idx) => {
      const btn = document.createElement('button');
      btn.className = 'choice-btn';
      const key = this._choiceKey(idx);
      btn.dataset.choiceIndex = String(idx);
      btn.innerHTML = `<span class="choice-key">${key}</span><span class="choice-text"></span>`;
      btn.querySelector('.choice-text').textContent = this._cleanChoiceText(ch.text, key);

      // 好感度门槛检查：不足则锁定选项
      const locked = this.engine.isChoiceLocked ? this.engine.isChoiceLocked(idx) : false;
      if (locked) {
        btn.classList.add('locked');
        btn.title = '好感度不足，无法选择';
      }

      btn.addEventListener('click', () => {
        if (panel.classList.contains('resolved')) return;
        if (btn.classList.contains('locked')) return;
        // 将当前选项场景存入历史，以便回退时能回到此处
        this._pushPageHistory();
        const summary = document.createElement('div');
        summary.className = 'choice-summary';
        summary.innerHTML = `
          <span class="choice-summary-key">${key}</span>
          <span class="choice-summary-text"></span>
        `;
        summary.querySelector('.choice-summary-text').textContent = this._cleanChoiceText(ch.text, key);
        panel.classList.add('resolved');
        panel.classList.remove('active');
        panel.replaceChildren(summary);
        this.$('#continue-hint').classList.remove('visible');
        this._activeChoicePanel = null;
        this._updateBackButton();
        this.engine.choose(idx);
      });
      panel.appendChild(btn);
    });

    (this._currentSceneBlock?.isConnected ? this._currentSceneBlock : this.$('#novel-text')).appendChild(panel);
    this._activeChoicePanel = panel;
    this.$('#continue-hint').classList.remove('visible');
    this._updateBackButton();
    requestAnimationFrame(() => {
      panel.classList.add('active');
      this._scrollToBottom();
    });
  }

  _choiceKey(idx) {
    return 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[idx] || String(idx + 1);
  }

  _cleanChoiceText(text, key) {
    return String(text || '').replace(new RegExp(`^\\s*${key}\\s*[.．、]\\s*`), '');
  }

  /* ================================================================
     结局
     ================================================================ */
  _showEnding(scene) {
    this.$('#ending-type').textContent  = scene.endingType || '结局';
    this.$('#ending-title').textContent = scene.endingTitle || '';
    this.$('#ending-text').textContent  = scene.endingText || '';
    this.$('#continue-hint').classList.remove('visible');
    this.$('#ending-overlay').classList.add('active');

    // 收集结局
    StorageManager.collectEnding({
      id: scene.id || '',
      type: scene.endingType || '',
      title: scene.endingTitle || '',
      text: scene.endingText || ''
    });

    // 记录返回节点：寻找最后一个有选项的场景
    this._endingReturnPoint = null;
    const history = this.engine.state.history;
    for (let i = history.length - 1; i >= 0; i--) {
      const s = this.engine.getScene(history[i]);
      if (s && s.choices) {
        this._endingReturnPoint = history[i];
        break;
      }
    }
    // 如果没找到选项节点，退回到最近的非结局场景
    if (!this._endingReturnPoint) {
      for (let i = history.length - 1; i >= 0; i--) {
        const s = this.engine.getScene(history[i]);
        if (s && s.type !== 'ending') {
          this._endingReturnPoint = history[i];
          break;
        }
      }
    }
  }

  /** 从结局返回上一个选择节点 */
  _returnFromEnding() {
    if (!this._endingReturnPoint) return;
    const returnPoint = this._endingReturnPoint;
    this._endingReturnPoint = null;

    // 裁剪 engine 历史到返回节点之前
    const history = this.engine.state.history;
    const idx = history.indexOf(returnPoint);
    if (idx >= 0) {
      this.engine.state.history = history.slice(0, idx);
    }
    this.engine.state.currentScene = returnPoint;

    // 重置 UI 并渲染
    this.$('#ending-overlay').classList.remove('active');
    this._clearNovelText();
    this._pageHistory = [];
    this._currentSceneBlock = null;
    this._lastRenderedChapterKey = null;
    this._activeChoicePanel = null;
    this._pendingEnding = null;
    this._allTextShown = false;
    this._updateBackButton();
    this.renderScene(this.engine.currentScene());
  }

  /** 显示结局收集画廊 */
  showEndingGallery() {
    const endings = StorageManager.getCollectedEndings();
    const grid = this.$('#endings-grid');
    grid.innerHTML = '';

    if (endings.length === 0) {
      grid.innerHTML = '<p class="endings-empty">尚未收集任何结局</p>';
    } else {
      endings.forEach((e) => {
        const card = document.createElement('div');
        card.className = 'ending-card';
        card.innerHTML = `
          <span class="ending-card-type">${e.type || '结局'}</span>
          <span class="ending-card-title">${e.title || ''}</span>
          <span class="ending-card-time">${e.collectedAtStr || ''}</span>
        `;
        card.addEventListener('click', () => {
          this._showEndingDetail(e);
        });
        grid.appendChild(card);
      });
    }

    this.$('#endings-overlay').classList.add('active');
  }

  _showEndingDetail(ending) {
    this.$('#ending-detail-type').textContent = ending.type || '结局';
    this.$('#ending-detail-title').textContent = ending.title || '';
    this.$('#ending-detail-text').textContent = ending.text || '';
    this.$('#ending-detail-overlay').classList.add('active');
  }

  /* ================================================================
     存档 / 读档
     ================================================================ */
  showSaveLoad(mode) {
    this._saveMode = mode;
    this.$('#sl-title').textContent = mode === 'save' ? '保存进度' : '读取存档';
    this.$('#tab-save').classList.toggle('active', mode === 'save');
    this.$('#tab-load').classList.toggle('active', mode === 'load');
    this._renderSlots();
    this.$('#save-load-overlay').classList.add('active');
  }

  _renderSlots() {
    const grid  = this.$('#sl-grid');
    const slots = StorageManager.getAllSlots();
    grid.innerHTML = '';

    slots.forEach((slot) => {
      const card = document.createElement('div');
      card.className = 'slot-card' + (slot.isEmpty ? ' empty' : '');

      if (slot.isEmpty) {
        card.textContent = `— 空 ${slot.id + 1} —`;
        card.addEventListener('click', () => {
          if (this._saveMode === 'save') {
            StorageManager.save(slot.id, this.engine.getSaveState());
            this._renderSlots();
          }
        });
      } else {
        card.innerHTML = `
          <span class="slot-id">存档 ${slot.id + 1}</span>
          <span class="slot-chapter">${slot.chapterTitle || '未知章节'}</span>
          <span class="slot-desc">${slot.description || ''}</span>
          <span class="slot-time">${slot.savedAtStr || ''}</span>
          <button class="slot-delete" data-slot="${slot.id}">&times;</button>
        `;
        card.addEventListener('click', (e) => {
          if (e.target.classList.contains('slot-delete')) return;
          if (this._saveMode === 'save') {
            StorageManager.save(slot.id, this.engine.getSaveState());
            this._renderSlots();
          } else {
            const data = StorageManager.load(slot.id);
            if (data) { this.engine.restoreState(data); this.closeAllOverlays(); }
          }
        });
        card.querySelector('.slot-delete').addEventListener('click', (e) => {
          e.stopPropagation();
          StorageManager.remove(slot.id);
          this._renderSlots();
        });
      }
      grid.appendChild(card);
    });
  }

  /* ================================================================
     设置
     ================================================================ */
  showSettings() {
    this.$('#settings-overlay').classList.add('active');
    const speedBtns = this.$('#settings-overlay').querySelectorAll('.speed-options button');
    speedBtns.forEach(b => {
      b.classList.remove('active');
      if (parseInt(b.dataset.speed) === this._getSpeedLevel()) b.classList.add('active');
    });
  }
  _getSpeedLevel() {
    const map = { 80:1, 60:2, 45:3, 30:4, 18:5 };
    return map[this._baseSpeed] || 3;
  }

  /* ================================================================
     辅助
     ================================================================ */
  closeAllOverlays() {
    this.$('#save-load-overlay').classList.remove('active');
    this.$('#settings-overlay').classList.remove('active');
    this.$('#about-overlay').classList.remove('active');
    this.$('#autosave-overlay').classList.remove('active');
    this.$('#endings-overlay').classList.remove('active');
    this.$('#ending-detail-overlay').classList.remove('active');
    this.$('#confirm-overlay').classList.remove('active');
    this.$('#menu-dropdown').classList.add('hidden');
    this.$('#menu-btn').classList.remove('active');
  }

  _handleImport(e) {
    const file = e.target.files[0];
    if (!file) return;
    StorageManager.importSave(file).then(count => {
      alert(`成功导入 ${count} 个存档`);
      this._renderSlots();
    }).catch(err => alert(err.message));
    e.target.value = '';
  }

  _checkAutoSave() {
    const auto = StorageManager.loadAutoSave();
    if (auto) {
      this._autoSaveData = auto;
      this.$('#autosave-chapter').textContent = '章节：' + (auto.chapterTitle || '未知');
      this.$('#autosave-time').textContent = '保存时间：' + (auto.savedAtStr || '');
      this.$('#autosave-overlay').classList.add('active');
    }
  }

  /** 确认继续阅读（自动存档） */
  _confirmAutoSaveContinue() {
    const data = this._autoSaveData;
    if (!data) return;
    this._autoSaveData = null;
    this.$('#autosave-overlay').classList.remove('active');
    this.resetReadingFlow();
    this.hideTitleScreen();
    this.engine.restoreState(data);
  }

  /** 拒绝继续阅读，从头开始 */
  _rejectAutoSave() {
    this._autoSaveData = null;
    this.$('#autosave-overlay').classList.remove('active');
  }

  /** 显示关于面板 */
  showAbout() {
    this.$('#about-overlay').classList.add('active');
  }

  /** 显示确认对话框（替代浏览器 confirm） */
  showConfirm(title, message, onConfirm) {
    this.$('#confirm-title').textContent = title || '提示';
    this.$('#confirm-message').textContent = message || '';
    this.$('#confirm-overlay').classList.add('active');
    // 克隆节点以移除旧的事件绑定
    const okBtn = this.$('#confirm-ok');
    const cancelBtn = this.$('#confirm-cancel');
    const newOk = okBtn.cloneNode(true);
    const newCancel = cancelBtn.cloneNode(true);
    okBtn.parentNode.replaceChild(newOk, okBtn);
    cancelBtn.parentNode.replaceChild(newCancel, cancelBtn);
    const close = () => { this.$('#confirm-overlay').classList.remove('active'); };
    newOk.addEventListener('click', () => { close(); if (onConfirm) onConfirm(); });
    newCancel.addEventListener('click', close);
    // 点击遮罩关闭
    this.$('#confirm-overlay').addEventListener('click', (e) => {
      if (e.target === this.$('#confirm-overlay')) close();
    });
  }

  /* ================================================================
     速度控制 API
     ================================================================ */
  /** 切换打字速度倍率：1x → 2x → 4x → 1x */
  cycleSpeed() {
    const levels = [1, 2, 4];
    const idx = levels.indexOf(this._speedLevel);
    this._speedLevel = levels[(idx + 1) % levels.length];
    this.$('#speed-label').textContent = '×' + this._speedLevel;
    if (this._speedLevel > 1) {
      this.$('#speed-btn').classList.add('active');
    } else {
      this.$('#speed-btn').classList.remove('active');
    }
  }

  /** 设置基础文字速度（设置面板用） */
  setTextSpeed(level) {
    const speeds = { 1: 80, 2: 60, 3: 45, 4: 30, 5: 18 };
    this._baseSpeed = speeds[level] || 45;
  }

  /** 设置字号 */
  setFontSize(size) {
    const sizes = { small: '15px', medium: '17px', large: '20px' };
    const lh    = { small: '1.9',  medium: '2.1',  large: '2.25' };
    document.documentElement.style.setProperty('--novel-font-size', sizes[size] || '17px');
    document.documentElement.style.setProperty('--novel-line-height', lh[size] || '2.1');
  }

  /* 暴露状态 */
  get isRevealing() { return this._isTyping; }
  get allTextShown() { return this._allTextShown; }
}
