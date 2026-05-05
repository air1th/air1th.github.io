/**
 * 存档管理模块 — Save / Load / Export / Import
 * 基于 localStorage，支持导出 / 导入 JSON 文件
 */
const StorageManager = (() => {
  const KEY = 'shijianzhixin_saves';
  const MAX  = 9;

  function _read() {
    try { const r = localStorage.getItem(KEY); return r ? JSON.parse(r) : {}; }
    catch (_) { return {}; }
  }
  function _write(obj) {
    try { localStorage.setItem(KEY, JSON.stringify(obj)); }
    catch (e) { console.error('存档写入失败:', e); }
  }

  /* ---- 公开 API ---- */

  function getAllSlots() {
    const saves = _read();
    const slots = [];
    for (let i = 0; i < MAX; i++) {
      const d = saves[`slot_${i}`];
      slots.push(d ? { id: i, ...d, isEmpty: false } : { id: i, isEmpty: true });
    }
    return slots;
  }

  function save(slotIndex, state) {
    const saves = _read();
    saves[`slot_${slotIndex}`] = {
      currentScene:  state.currentScene,
      flags:         state.flags,
      affection:     state.affection,
      history:       state.history,
      chapterHistory:state.chapterHistory,
      playTime:      state.playTime + (Date.now() - (state._startSnapshot || Date.now())),
      savedAt:       Date.now(),
      savedAtStr:    new Date().toLocaleString('zh-CN'),
      chapterTitle:  state.chapterTitle || '',
      description:   (state.description || '').substring(0, 40)
    };
    _write(saves);
  }

  function load(slotIndex) {
    return _read()[`slot_${slotIndex}`] || null;
  }

  function remove(slotIndex) {
    const s = _read();
    delete s[`slot_${slotIndex}`];
    _write(s);
  }

  function autoSave(state) {
    const saves = _read();
    saves['auto'] = {
      currentScene:  state.currentScene,
      flags:         state.flags,
      affection:     state.affection,
      history:       state.history,
      chapterHistory:state.chapterHistory,
      playTime:      state.playTime + (Date.now() - (state._startSnapshot || Date.now())),
      savedAt:       Date.now(),
      savedAtStr:    new Date().toLocaleString('zh-CN'),
      chapterTitle:  state.chapterTitle || '',
      description:   (state.description || '').substring(0, 40)
    };
    _write(saves);
  }

  function loadAutoSave() { return _read()['auto'] || null; }

  function exportAll() {
    const data = JSON.stringify(_read(), null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `时痕之心_存档_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function importSave(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result);
          if (typeof data !== 'object' || Array.isArray(data)) throw new Error();
          const current = _read();
          _write({ ...current, ...data });
          resolve(Object.keys(data).length);
        } catch (_) { reject(new Error('存档文件格式错误')); }
      };
      reader.onerror = () => reject(new Error('文件读取失败'));
      reader.readAsText(file);
    });
  }

  /* ---- 结局收集 ---- */
  const ENDING_KEY = 'shijianzhixin_endings';

  function collectEnding(endingData) {
    const endings = getCollectedEndings();
    // 避免重复收集同一个结局
    if (!endings.find(e => e.id === endingData.id)) {
      endings.push({ ...endingData, collectedAt: Date.now(), collectedAtStr: new Date().toLocaleString('zh-CN') });
      try { localStorage.setItem(ENDING_KEY, JSON.stringify(endings)); }
      catch (e) { console.error('结局收集写入失败:', e); }
    }
  }

  function getCollectedEndings() {
    try { const r = localStorage.getItem(ENDING_KEY); return r ? JSON.parse(r) : []; }
    catch (_) { return []; }
  }

  function getEndingCount() {
    return getCollectedEndings().length;
  }

  return { getAllSlots, save, load, remove, autoSave, loadAutoSave, exportAll, importSave, MAX,
           collectEnding, getCollectedEndings, getEndingCount };
})();
