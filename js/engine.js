/**
 * 游戏引擎 — 状态管理 / 场景导航 / 选择处理 / 条件分支
 */
class GameEngine {
  constructor(scenes, chapters) {
    this.scenes   = scenes;
    this.chapters = chapters;
    this.state    = this._initialState();
    this._hooks   = {};
  }

  _initialState() {
    return {
      currentScene:   'prologue_start',
      flags:          {},
      affection:      { duan: 0, mu: 0, jiang: 0, muJingYan: 0, qixiaYing: 0 },
      history:        [],
      chapterHistory: [],
      playTime:       0,
      _startSnapshot: Date.now()
    };
  }

  /* ---- 事件钩子 ---- */
  on(event, fn) { (this._hooks[event] ||= []).push(fn); }
  _emit(event, data) { (this._hooks[event] || []).forEach(fn => fn(data)); }

  /* ---- 场景操作 ---- */
  getScene(id)   { return this.scenes[id || this.state.currentScene] || null; }
  currentScene() { return this.getScene(); }

  goTo(sceneId) {
    if (!this.scenes[sceneId]) { console.error(`场景不存在: ${sceneId}`); return; }
    this.state.history.push(this.state.currentScene);
    if (this.state.history.length > 60) this.state.history.shift();
    this.state.currentScene = sceneId;

    const sc = this.scenes[sceneId];
    if (sc.chapter != null) {
      const last = this.state.chapterHistory[this.state.chapterHistory.length - 1];
      if (!last || last.chapter !== sc.chapter) {
        this.state.chapterHistory.push({ chapter: sc.chapter, title: sc.chapterTitle || '' });
      }
    }
    this._emit('sceneChange', { scene: sc, sceneId });

    // 自动存档（节流：至少间隔 3 秒）
    const now = Date.now();
    if (!this._lastAutoSave || now - this._lastAutoSave >= 3000) {
      this._lastAutoSave = now;
      this._emit('autoSave', this.getSaveState());
    }
  }

  advance() {
    const sc = this.currentScene();
    if (!sc || sc.choices) return false;
    if (sc.condNext) {
      for (const c of sc.condNext) { if (this._check(c.when)) { this.goTo(c.next); return true; } }
    }
    if (sc.next) { this.goTo(sc.next); return true; }
    return false;
  }

  choose(idx) {
    const sc = this.currentScene();
    if (!sc?.choices || !sc.choices[idx]) return false;
    const ch = sc.choices[idx];

    // 好感度门槛检查
    if (ch.requireAffection) {
      for (const [key, min] of Object.entries(ch.requireAffection)) {
        if ((this.state.affection[key] || 0) < min) return false;
      }
    }

    if (ch.affection) Object.entries(ch.affection).forEach(([k, v]) => this.state.affection[k] = (this.state.affection[k] || 0) + v);
    if (ch.setFlag)  this.state.flags[ch.setFlag] = true;
    if (ch.flags)    Object.entries(ch.flags).forEach(([k, v]) => this.state.flags[k] = v);

    this._emit('choiceMade', { choice: ch, index: idx });
    if (ch.nextScene) { this.goTo(ch.nextScene); return true; }
    return false;
  }

  /** 检查某个选项是否因好感度不足而被锁定 */
  isChoiceLocked(choiceIdx) {
    const sc = this.currentScene();
    if (!sc?.choices || !sc.choices[choiceIdx]) return false;
    const ch = sc.choices[choiceIdx];
    if (!ch.requireAffection) return false;
    for (const [key, min] of Object.entries(ch.requireAffection)) {
      if ((this.state.affection[key] || 0) < min) return true;
    }
    return false;
  }

  back() {
    if (!this.state.history.length) return false;
    this.state.currentScene = this.state.history.pop();
    this._emit('sceneChange', { scene: this.currentScene(), sceneId: this.state.currentScene });
    return true;
  }

  hasChoices() { return !!this.currentScene()?.choices; }
  isEnding()   { return this.currentScene()?.type === 'ending'; }

  /* ---- 条件评估 ---- */
  _check(cond) {
    if (!cond) return true;
    if (cond.flag     && !this.state.flags[cond.flag])     return false;
    if (cond.notFlag  &&  this.state.flags[cond.notFlag])  return false;
    if (cond.affection && (this.state.affection[cond.affection] || 0) < (cond.min || 0)) return false;
    if (cond.affectionMax && (this.state.affection[cond.affectionMax] || 0) >= (cond.max || 999)) return false;
    return true;
  }

  /* ---- 存档相关 ---- */
  getSaveState() {
    const sc = this.currentScene();
    let desc = '';
    if (sc?.lines?.length) {
      const l = sc.lines[0];
      desc = (typeof l === 'string' ? l : (l.speaker ? `【${l.speaker}】${l.text}` : l.text)).substring(0, 40);
    }
    return {
      currentScene:   this.state.currentScene,
      flags:          { ...this.state.flags },
      affection:      { ...this.state.affection },
      history:        [...this.state.history],
      chapterHistory: [...this.state.chapterHistory],
      playTime:       this.state.playTime,
      _startSnapshot: this.state._startSnapshot,
      chapterTitle:   sc?.chapterTitle || '',
      description:    desc
    };
  }

  restoreState(data) {
    this.state.currentScene    = data.currentScene;
    this.state.flags           = { ...data.flags };
    this.state.affection       = { ...data.affection };
    this.state.history         = [...(data.history || [])];
    this.state.chapterHistory  = [...(data.chapterHistory || [])];
    this.state.playTime        = data.playTime || 0;
    this.state._startSnapshot  = Date.now();
    this._emit('stateRestored', {});
    this._emit('sceneChange', { scene: this.currentScene(), sceneId: this.state.currentScene });
  }

  getAffection() { return { ...this.state.affection }; }
  getChapterInfo() {
    const sc = this.currentScene();
    return sc ? { chapter: sc.chapter, title: sc.chapterTitle || '' } : null;
  }
}
