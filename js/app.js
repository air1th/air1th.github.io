/**
 * 终焉：时痕之心 — 应用入口
 */
(() => {
  const engine = new GameEngine(SCENES, CHAPTERS);
  const ui     = new UIManager(engine);

  /* ================================================================
     引擎事件 → UI
     ================================================================ */
  engine.on('sceneChange', ({ scene }) => {
    ui.renderScene(scene);
  });

  engine.on('autoSave', (state) => { StorageManager.autoSave(state); });

  engine.on('stateRestored', () => {
    ui.resetReadingFlow();
    ui.hideTitleScreen();
  });

  engine.on('choiceMade', () => {
    // 选择后更新返回按钮状态
    ui._updateBackButton();
  });

  /* ================================================================
     按钮绑定
     ================================================================ */
  function bindAll() {
    // ---- 标题画面 ----
    document.querySelector('#btn-start').addEventListener('click', () => {
      ui.resetReadingFlow();
      ui.hideTitleScreen();
      engine.goTo('prologue_1');
    });
    document.querySelector('#btn-load').addEventListener('click', () => {
      const auto = StorageManager.loadAutoSave();
      if (auto) {
        ui.resetReadingFlow();
        engine.restoreState(auto);
      } else {
        ui.showSaveLoad('load');
      }
    });
    document.querySelector('#btn-endings').addEventListener('click', () => {
      ui.showEndingGallery();
    });
    document.querySelector('#btn-about').addEventListener('click', () => {
      ui.showAbout();
    });

    // ---- 顶部工具栏 ----
    // 返回按钮
    document.querySelector('#back-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      ui.goBack();
    });

    // 速度倍率按钮
    document.querySelector('#speed-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      ui.cycleSpeed();
    });

    // ---- 菜单 ----
    const menuBtn  = document.querySelector('#menu-btn');
    const menuDrop = document.querySelector('#menu-dropdown');

    menuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = !menuDrop.classList.contains('hidden');
      if (open) { menuDrop.classList.add('hidden'); menuBtn.classList.remove('active'); }
      else      { menuDrop.classList.remove('hidden'); menuBtn.classList.add('active'); }
    });
    document.addEventListener('click', () => {
      menuDrop.classList.add('hidden'); menuBtn.classList.remove('active');
    });

    document.querySelector('#mu-save').addEventListener('click', () => {
      menuDrop.classList.add('hidden'); menuBtn.classList.remove('active');
      ui.showSaveLoad('save');
    });
    document.querySelector('#mu-load').addEventListener('click', () => {
      menuDrop.classList.add('hidden'); menuBtn.classList.remove('active');
      ui.showSaveLoad('load');
    });
    document.querySelector('#mu-settings').addEventListener('click', () => {
      menuDrop.classList.add('hidden'); menuBtn.classList.remove('active');
      ui.showSettings();
    });
    document.querySelector('#mu-return').addEventListener('click', () => {
      menuDrop.classList.add('hidden'); menuBtn.classList.remove('active');
      ui.showConfirm('返回标题', '确定要返回标题画面吗？当前进度将自动保存。', () => {
        StorageManager.autoSave(engine.getSaveState());
        window.location.reload();
      });
    });

    // ---- 关于面板 ----
    document.querySelector('#about-close').addEventListener('click', () => {
      ui.closeAllOverlays();
    });

    // ---- 自动存档提示 ----
    document.querySelector('#autosave-continue').addEventListener('click', () => {
      ui._confirmAutoSaveContinue();
    });
    document.querySelector('#autosave-new').addEventListener('click', () => {
      ui._rejectAutoSave();
    });

    // ---- 结局画面 ----
    document.querySelector('#ending-restart').addEventListener('click', () => {
      window.location.reload();
    });
    document.querySelector('#ending-back').addEventListener('click', () => {
      ui._returnFromEnding();
    });

    // ---- 结局收集 ----
    document.querySelector('#endings-close').addEventListener('click', () => {
      ui.closeAllOverlays();
    });
    document.querySelector('#ending-detail-close').addEventListener('click', () => {
      ui.closeAllOverlays();
    });

    // ---- 存档/读档标签页 ----
    document.querySelector('#tab-save').addEventListener('click', () => ui.showSaveLoad('save'));
    document.querySelector('#tab-load').addEventListener('click', () => ui.showSaveLoad('load'));

    // ---- 设置面板：文字速度 ----
    document.querySelector('#settings-overlay').querySelectorAll('.speed-options button').forEach(btn => {
      btn.addEventListener('click', () => {
        const parent = btn.parentElement;
        parent.querySelectorAll('button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        ui.setTextSpeed(parseInt(btn.dataset.speed));
      });
    });

    // ---- 设置面板：字号 ----
    document.querySelector('#settings-overlay').querySelectorAll('.size-options button').forEach(btn => {
      btn.addEventListener('click', () => {
        const parent = btn.parentElement;
        parent.querySelectorAll('button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        ui.setFontSize(btn.dataset.size);
      });
    });
  }

  /* ================================================================
     键盘快捷键
     ================================================================ */
  function bindKeyboard() {
    document.addEventListener('keydown', (e) => {
      // 选项快捷键 1/2/3
      const keyMap = { '1': 0, '2': 1, '3': 2, a: 0, b: 1, c: 2, A: 0, B: 1, C: 2 };
      if (Object.prototype.hasOwnProperty.call(keyMap, e.key) && engine.hasChoices()) {
        const idx = keyMap[e.key];
        const scene = engine.currentScene();
        if (scene?.choices && scene.choices[idx]) {
          if (engine.isChoiceLocked && engine.isChoiceLocked(idx)) return;
          const panel = document.querySelector('.choice-panel.active');
          if (panel && panel.classList.contains('active')) {
            e.preventDefault();
            panel.querySelectorAll('.choice-btn')[idx]?.click();
          }
        }
      }
      // Backspace → 返回上一页
      if (e.key === 'Backspace' && !e.target.closest('input,textarea')) {
        e.preventDefault();
        ui.goBack();
      }
    });
  }

  /* ================================================================
     启动
     ================================================================ */
  function init() {
    bindAll();
    bindKeyboard();
    ui.showTitleScreen();
    ui.init();
    document.querySelector('#ending-overlay').classList.remove('active');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
