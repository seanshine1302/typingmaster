(function (global) {
  'use strict';

  var TypingApp = (global.TypingApp = global.TypingApp || {});

  var SET_LENGTH = 30;
  var SHIFT_CODES = { ShiftLeft: true, ShiftRight: true };
  var IGNORED_CODES = {
    ShiftLeft: true,
    ShiftRight: true,
    ControlLeft: true,
    ControlRight: true,
    AltLeft: true,
    AltRight: true,
    MetaLeft: true,
    MetaRight: true,
    CapsLock: true,
    Tab: true,
    Escape: true,
    Enter: true,
    Backspace: true,
    ContextMenu: true,
  };

  function shuffleArray(arr) {
    var copy = arr.slice();
    for (var i = copy.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = copy[i];
      copy[i] = copy[j];
      copy[j] = tmp;
    }
    return copy;
  }

  function buildSequence(chars, count) {
    if (!chars || chars.length === 0) return [];
    var seq = [];
    while (seq.length < count) {
      var batch = shuffleArray(chars);
      if (seq.length > 0 && batch.length > 1 && batch[0] === seq[seq.length - 1]) {
        var swapTmp = batch[0];
        batch[0] = batch[batch.length - 1];
        batch[batch.length - 1] = swapTmp;
      }
      for (var i = 0; i < batch.length && seq.length < count; i++) {
        seq.push(batch[i]);
      }
    }
    return seq;
  }

  function PositionMode(container, app) {
    this.container = container;
    this.app = app;
    this.lang = app.getLanguage();
    this.stageId = 'home';
    this.sequence = [];
    this.currentIndex = 0;
    this.correctCount = 0;
    this.typoCount = 0;
    this.correctKeystrokes = 0;
    this.startTime = null;
    this.finished = false;
    this.paused = false;
    this.heldShifts = new Set();
    this.virtualShifts = new Set();
    this.keyboardView = null;
    this.tipMessage = '';
    this.capsLockOn = false;
    this.timerInterval = null;

    this._onKeyDown = this._handleKeyDown.bind(this);
    this._onKeyUp = this._handleKeyUp.bind(this);
    this._onWindowBlur = this._handleWindowBlur.bind(this);

    this._init();
  }

  PositionMode.prototype._getData = function () {
    return this.lang === 'en' ? TypingApp.DATA_EN : TypingApp.DATA_KO;
  };

  PositionMode.prototype._getStages = function () {
    return this._getData().positionStages;
  };

  PositionMode.prototype._getCurrentStage = function () {
    var stages = this._getStages();
    for (var i = 0; i < stages.length; i++) {
      if (stages[i].id === this.stageId) return stages[i];
    }
    return stages[0];
  };

  PositionMode.prototype._init = function () {
    this._bindEvents();
    this._startNewSet();
  };

  PositionMode.prototype._bindEvents = function () {
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('blur', this._onWindowBlur);
  };

  PositionMode.prototype._unbindEvents = function () {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('blur', this._onWindowBlur);
  };

  PositionMode.prototype._startNewSet = function () {
    var stage = this._getCurrentStage();
    this.stageId = stage.id;
    this.sequence = buildSequence(stage.chars, SET_LENGTH);
    this.currentIndex = 0;
    this.correctCount = 0;
    this.typoCount = 0;
    this.correctKeystrokes = 0;
    this.startTime = null;
    this.finished = false;
    this.paused = false;
    this.tipMessage = '';
    this.heldShifts.clear();
    this.virtualShifts.clear();
    this._stopHudTimer();

    this._renderLayout();
    this._updateTargetDisplay();
    this._updateHud();
  };

  PositionMode.prototype._stopHudTimer = function () {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  };

  PositionMode.prototype._ensureHudTimer = function () {
    var self = this;
    if (self.timerInterval) return;
    self.timerInterval = setInterval(function () {
      if (!self.finished && !self.paused && self.startTime) {
        self._updateHud();
      }
    }, 500);
  };

  PositionMode.prototype._renderLayout = function () {
    var self = this;
    var stages = self._getStages();
    var currentStage = self._getCurrentStage();

    if (self.keyboardView && typeof self.keyboardView.destroy === 'function') {
      self.keyboardView.destroy();
      self.keyboardView = null;
    }

    self.container.innerHTML = '';

    var page = document.createElement('section');
    page.className = 'practice-page position-page';

    // Top control bar: stage pills + stats HUD
    var topCard = document.createElement('div');
    topCard.className = 'panel-card practice-topbar';

    var stageGroup = document.createElement('div');
    stageGroup.className = 'stage-pills';
    stageGroup.setAttribute('role', 'tablist');
    stageGroup.setAttribute('aria-label', '자리 연습 단계');

    stages.forEach(function (st) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'stage-pill' + (st.id === currentStage.id ? ' is-active' : '');
      btn.dataset.stage = st.id;
      btn.textContent = st.label;
      btn.addEventListener('click', function () {
        btn.blur();
        if (self.stageId !== st.id) {
          self.stageId = st.id;
          self._startNewSet();
        }
      });
      stageGroup.appendChild(btn);
    });

    var hudRow = document.createElement('div');
    hudRow.className = 'hud-metrics';
    hudRow.innerHTML =
      '<div class="hud-stat"><span class="hud-label">진행</span><strong class="hud-value" id="pos-progress">1 / ' + SET_LENGTH + '</strong></div>' +
      '<div class="hud-stat"><span class="hud-label">정타율</span><strong class="hud-value" id="pos-accuracy">100.0%</strong></div>' +
      '<div class="hud-stat"><span class="hud-label">속도</span><strong class="hud-value" id="pos-cpm">0 CPM</strong></div>' +
      '<button type="button" class="btn btn-ghost btn-sm" id="pos-reset-btn">다시 시작</button>';

    topCard.appendChild(stageGroup);
    topCard.appendChild(hudRow);

    var stageDesc = document.createElement('p');
    stageDesc.className = 'stage-description';
    stageDesc.textContent = currentStage.description;
    topCard.appendChild(stageDesc);

    page.appendChild(topCard);

    // Progress bar
    var progressTrack = document.createElement('div');
    progressTrack.className = 'progress-track';
    progressTrack.innerHTML = '<div class="progress-fill" id="pos-progress-bar" style="width: 0%"></div>';
    page.appendChild(progressTrack);

    // Target Prompt + Guidance Card
    var promptCard = document.createElement('div');
    promptCard.className = 'panel-card position-prompt-card';
    promptCard.innerHTML =
      '<div class="position-target-row">' +
      '  <div class="target-char-showcase">' +
      '    <span class="target-char-eyebrow" id="pos-target-eyebrow">현재 글자</span>' +
      '    <div class="target-char-box" id="pos-target-box" aria-live="polite"></div>' +
      '    <span class="shift-required-badge hidden" id="pos-shift-badge">Shift 조합 입력</span>' +
      '  </div>' +
      '  <div class="position-queue-wrap">' +
      '    <span class="queue-label">다음 글자</span>' +
      '    <div class="position-queue" id="pos-queue"></div>' +
      '  </div>' +
      '</div>' +
      '<div class="finger-guide-banner" id="pos-guide-banner">' +
      '  <div class="finger-badges-row" id="pos-finger-badges"></div>' +
      '  <p class="finger-guide-text" id="pos-guide-text"></p>' +
      '  <p class="finger-tip-text hidden" id="pos-tip-text"></p>' +
      '</div>';

    page.appendChild(promptCard);

    // Virtual Keyboard + Two Hands Guide Card
    var kbCard = document.createElement('div');
    kbCard.className = 'panel-card keyboard-panel';
    page.appendChild(kbCard);

    self.container.appendChild(page);

    var resetBtn = self.container.querySelector('#pos-reset-btn');
    if (resetBtn) {
      resetBtn.addEventListener('click', function () {
        resetBtn.blur();
        self._startNewSet();
      });
    }

    self.keyboardView = new TypingApp.KeyboardView(kbCard, {
      lang: self.lang,
      onKeyClick: function (keyDef) {
        self._handleVirtualKeyClick(keyDef);
      },
    });
  };

  PositionMode.prototype._getCurrentTargetInfo = function () {
    if (this.currentIndex >= this.sequence.length) return null;
    var ch = this.sequence[this.currentIndex];
    return TypingApp.KeyboardConfig.resolveTargetChar(ch, this.lang);
  };

  PositionMode.prototype._updateTargetDisplay = function () {
    var targetInfo = this._getCurrentTargetInfo();
    var box = this.container.querySelector('#pos-target-box');
    var shiftBadge = this.container.querySelector('#pos-shift-badge');
    var queueEl = this.container.querySelector('#pos-queue');
    var badgesEl = this.container.querySelector('#pos-finger-badges');
    var guideTextEl = this.container.querySelector('#pos-guide-text');
    var tipTextEl = this.container.querySelector('#pos-tip-text');

    if (!targetInfo || !box) return;

    box.textContent = targetInfo.char;
    box.classList.toggle('is-shift-char', targetInfo.needsShift);
    if (shiftBadge) {
      shiftBadge.classList.toggle('hidden', !targetInfo.needsShift);
    }

    if (queueEl) {
      queueEl.innerHTML = '';
      var previewEnd = Math.min(this.sequence.length, this.currentIndex + 7);
      for (var i = this.currentIndex + 1; i < previewEnd; i++) {
        var pill = document.createElement('span');
        pill.className = 'queue-char';
        pill.textContent = this.sequence[i];
        queueEl.appendChild(pill);
      }
      if (this.currentIndex + 1 >= this.sequence.length) {
        var endNote = document.createElement('span');
        endNote.className = 'queue-done-note';
        endNote.textContent = '마지막 글자입니다';
        queueEl.appendChild(endNote);
      }
    }

    if (badgesEl) {
      if (targetInfo.needsShift) {
        badgesEl.innerHTML =
          '<span class="finger-pill finger-pill--shift">' +
          '  <span class="finger-pill-dot"></span>' +
          targetInfo.shiftFinger.nameKo + ' · ' + targetInfo.shiftSideLabel +
          '</span>' +
          '<span class="finger-plus" aria-hidden="true">+</span>' +
          '<span class="finger-pill finger-pill--target">' +
          '  <span class="finger-pill-dot"></span>' +
          targetInfo.finger.nameKo + ' · ' + targetInfo.baseLabel +
          '</span>';
      } else {
        badgesEl.innerHTML =
          '<span class="finger-pill finger-pill--target">' +
          '  <span class="finger-pill-dot"></span>' +
          targetInfo.finger.nameKo + ' · ' + targetInfo.baseLabel +
          '</span>';
      }
    }

    if (guideTextEl) {
      guideTextEl.textContent = targetInfo.guideText;
    }

    if (tipTextEl) {
      var notice = this.tipMessage;
      if (!notice && this.lang === 'en' && this.capsLockOn) {
        notice = 'Caps Lock이 켜져 있습니다. 대소문자 정확도를 위해 Caps Lock을 꺼 주세요.';
      }
      if (notice) {
        tipTextEl.textContent = notice;
        tipTextEl.classList.remove('hidden');
      } else {
        tipTextEl.textContent = '';
        tipTextEl.classList.add('hidden');
      }
    }

    if (this.keyboardView) {
      this.keyboardView.highlightTarget(targetInfo);
    }
  };

  PositionMode.prototype._updateHud = function () {
    var progressEl = this.container.querySelector('#pos-progress');
    var accuracyEl = this.container.querySelector('#pos-accuracy');
    var cpmEl = this.container.querySelector('#pos-cpm');
    var barEl = this.container.querySelector('#pos-progress-bar');

    var displayStep = Math.min(this.currentIndex + 1, this.sequence.length);
    if (progressEl) {
      progressEl.textContent = displayStep + ' / ' + this.sequence.length;
    }

    var totalAttempts = this.correctCount + this.typoCount;
    var accuracy = totalAttempts > 0 ? Number(((this.correctCount / totalAttempts) * 100).toFixed(1)) : 100;
    if (accuracyEl) {
      accuracyEl.textContent = accuracy.toFixed(1) + '%';
    }

    var cpm = 0;
    if (this.startTime && this.correctKeystrokes > 0) {
      var elapsedMin = Math.max((Date.now() - this.startTime) / 60000, 1 / 600);
      cpm = Math.round(this.correctKeystrokes / elapsedMin);
    }
    if (cpmEl) {
      cpmEl.textContent = cpm + ' CPM';
    }

    if (barEl && this.sequence.length > 0) {
      var pct = Math.round((this.currentIndex / this.sequence.length) * 100);
      barEl.style.width = pct + '%';
    }
  };

  PositionMode.prototype._getCombinedShifts = function () {
    var combined = new Set(this.heldShifts);
    this.virtualShifts.forEach(function (code) {
      combined.add(code);
    });
    return combined;
  };

  PositionMode.prototype._handleVirtualKeyClick = function (keyDef) {
    if (this.finished || this.paused) return;

    if (SHIFT_CODES[keyDef.code]) {
      if (this.virtualShifts.has(keyDef.code)) {
        this.virtualShifts.delete(keyDef.code);
        this.keyboardView.setPressedKey(keyDef.code, false);
      } else {
        this.virtualShifts.add(keyDef.code);
        this.keyboardView.setPressedKey(keyDef.code, true);
      }
      return;
    }

    if (IGNORED_CODES[keyDef.code] || keyDef.isModifier) return;

    var combinedShifts = this._getCombinedShifts();
    var syntheticEvent = {
      code: keyDef.code,
      shiftKey: combinedShifts.size > 0,
    };

    this._evaluateKeyPress(syntheticEvent, combinedShifts);

    this.virtualShifts.forEach(function (code) {
      this.keyboardView.setPressedKey(code, false);
    }, this);
    this.virtualShifts.clear();
  };

  PositionMode.prototype._handleKeyDown = function (e) {
    if (this.finished || this.paused) return;
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    var profileOv = document.getElementById('profile-overlay');
    var resultOv = document.getElementById('result-overlay');
    var dashOv = document.getElementById('dashboard-overlay');
    if (
      (profileOv && !profileOv.classList.contains('hidden')) ||
      (resultOv && !resultOv.classList.contains('hidden')) ||
      (dashOv && !dashOv.classList.contains('hidden'))
    ) {
      return;
    }

    if (typeof e.getModifierState === 'function') {
      this.capsLockOn = e.getModifierState('CapsLock');
    }

    var resolved = TypingApp.KeyboardConfig.resolveEventCode(e);
    var code = resolved.code;
    if (!code) return;

    if (SHIFT_CODES[code]) {
      this.heldShifts.add(code);
      if (this.keyboardView) {
        this.keyboardView.setPressedKey(code, true);
      }
      return;
    }

    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (IGNORED_CODES[code]) return;

    if (!TypingApp.KeyboardConfig.KEY_BY_CODE[code]) return;
    if (code === 'Space') {
      e.preventDefault();
    }
    if (e.repeat) return;

    if (this.keyboardView) {
      this.keyboardView.setPressedKey(code, true);
    }

    this._evaluateKeyPress(e, this._getCombinedShifts());
  };

  PositionMode.prototype._handleKeyUp = function (e) {
    var resolved = TypingApp.KeyboardConfig.resolveEventCode(e);
    var code = resolved.code;
    if (!code) return;

    if (SHIFT_CODES[code]) {
      this.heldShifts.delete(code);
    }
    if (this.keyboardView) {
      this.keyboardView.setPressedKey(code, false);
    }
  };

  PositionMode.prototype._handleWindowBlur = function () {
    this.heldShifts.clear();
    this.virtualShifts.clear();
    if (this.keyboardView) {
      this.keyboardView.clearAllPressed();
    }
  };

  PositionMode.prototype._evaluateKeyPress = function (event, shifts) {
    var targetInfo = this._getCurrentTargetInfo();
    if (!targetInfo) return;

    if (!this.startTime) {
      this.startTime = Date.now();
      this._ensureHudTimer();
    }

    var resolved = TypingApp.KeyboardConfig.resolveEventCode(event);
    var resolvedCode = resolved.code || event.code;
    var result = TypingApp.KeyboardConfig.matchesPhysicalKey(event, targetInfo, shifts);

    if (result.matched) {
      this.correctCount++;
      this.correctKeystrokes += targetInfo.needsShift ? 2 : 1;

      if (this.keyboardView) {
        if (resolvedCode) this.keyboardView.flashFeedback(resolvedCode, true);
        if (targetInfo.needsShift && targetInfo.shiftCode) {
          this.keyboardView.flashFeedback(targetInfo.shiftCode, true);
        }
      }

      if (targetInfo.needsShift && !result.usedRecommendedShift) {
        this.tipMessage =
          '좋아요! 다음에는 반대쪽 손 ' + targetInfo.shiftFinger.nameKo + '로 ' + targetInfo.shiftSideLabel + '를 눌러 보세요.';
      } else {
        this.tipMessage = '';
      }

      this.currentIndex++;

      if (this.currentIndex >= this.sequence.length) {
        this._finishSet();
      } else {
        this._updateTargetDisplay();
        this._updateHud();
      }
    } else {
      this.typoCount++;
      if (this.keyboardView && resolvedCode) {
        this.keyboardView.flashFeedback(resolvedCode, false);
      }

      var box = this.container.querySelector('#pos-target-box');
      if (box) {
        box.classList.remove('is-shake');
        void box.offsetWidth;
        box.classList.add('is-shake');
      }

      if (resolvedCode === targetInfo.code && targetInfo.needsShift) {
        this.tipMessage = targetInfo.shiftSideLabel + ' 키를 함께 누른 상태에서 입력해야 합니다.';
      } else if (resolvedCode === targetInfo.code && !targetInfo.needsShift) {
        this.tipMessage = 'Shift 키를 누르지 않고 입력해야 하는 글자입니다.';
      } else {
        this.tipMessage = targetInfo.guideText;
      }

      this._updateTargetDisplay();
      this._updateHud();
    }
  };

  PositionMode.prototype._finishSet = function () {
    var self = this;
    self.finished = true;
    self._stopHudTimer();
    self._updateHud();

    var barEl = self.container.querySelector('#pos-progress-bar');
    if (barEl) barEl.style.width = '100%';

    var elapsedMs = self.startTime ? Date.now() - self.startTime : 1000;
    var elapsedMinutes = Math.max(elapsedMs / 60000, 1 / 600);
    var totalAttempts = self.correctCount + self.typoCount;
    var accuracy = totalAttempts > 0 ? Number(((self.correctCount / totalAttempts) * 100).toFixed(1)) : 100;
    var typoRate = Number((100 - accuracy).toFixed(1));
    var cpm = Math.round(self.correctKeystrokes / elapsedMinutes);
    var wpm = Math.round(cpm / 5);

    var stage = self._getCurrentStage();
    var stages = self._getStages();
    var stageIdx = stages.findIndex(function (s) { return s.id === stage.id; });
    var nextStage = stages[(stageIdx + 1) % stages.length];

    self.app.showResult({
      mode: 'position',
      lang: self.lang,
      title: '자리 연습 완료 — ' + stage.label,
      subtitle: self.lang === 'ko' ? '한글 두벌식 자판 연습 결과입니다.' : '영문 QWERTY 자판 연습 결과입니다.',
      stats: {
        correctChars: self.correctCount,
        typoChars: self.typoCount,
        totalChars: totalAttempts,
        accuracy: accuracy,
        typoRate: typoRate,
        cpm: cpm,
        wpm: wpm,
        elapsedSeconds: Math.max(1, Math.round(elapsedMs / 1000)),
      },
      nextLabel: '다음 단계 (' + nextStage.label + ')',
      onRetry: function () {
        self._startNewSet();
      },
      onNext: function () {
        self.stageId = nextStage.id;
        self._startNewSet();
      },
    });
  };

  PositionMode.prototype.setLanguage = function (lang) {
    var normalized = lang === 'en' ? 'en' : 'ko';
    if (this.lang === normalized) return;
    this.lang = normalized;
    this._startNewSet();
  };

  PositionMode.prototype.destroy = function () {
    this.finished = true;
    this._stopHudTimer();
    this._unbindEvents();
    if (this.keyboardView && typeof this.keyboardView.destroy === 'function') {
      this.keyboardView.destroy();
      this.keyboardView = null;
    }
    this.container.innerHTML = '';
  };

  TypingApp.PositionMode = PositionMode;
})(window);
