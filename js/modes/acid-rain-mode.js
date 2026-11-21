(function (global) {
  'use strict';

  var TypingApp = (global.TypingApp = global.TypingApp || {});

  var MAX_LIVES = 5;

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function getTierMeta(level) {
    if (level <= 2) return { label: '입문', cls: 'tier-easy' };
    if (level <= 4) return { label: '초급', cls: 'tier-normal' };
    if (level <= 6) return { label: '중급', cls: 'tier-medium' };
    if (level <= 8) return { label: '고급', cls: 'tier-hard' };
    return { label: '마스터', cls: 'tier-master' };
  }

  var LEVEL_SPECS = [
    null,
    { fallSpeed: 11, spawnInterval: 4500, maxWords: 4 },
    { fallSpeed: 17, spawnInterval: 3950, maxWords: 5 },
    { fallSpeed: 25, spawnInterval: 3400, maxWords: 6 },
    { fallSpeed: 35, spawnInterval: 2900, maxWords: 8 },
    { fallSpeed: 47, spawnInterval: 2400, maxWords: 9 },
    { fallSpeed: 61, spawnInterval: 1950, maxWords: 11 },
    { fallSpeed: 77, spawnInterval: 1550, maxWords: 12 },
    { fallSpeed: 95, spawnInterval: 1200, maxWords: 14 },
    { fallSpeed: 115, spawnInterval: 900, maxWords: 15 },
    { fallSpeed: 138, spawnInterval: 650, maxWords: 16 },
  ];

  function getSpeedSpecs(level) {
    var clamped = Math.max(1, Math.min(10, Math.round(Number(level) || 1)));
    var spec = LEVEL_SPECS[clamped];
    return {
      fallSpeed: spec.fallSpeed,
      spawnInterval: spec.spawnInterval,
      maxWords: spec.maxWords,
    };
  }

  function AcidRainMode(container, app) {
    this.container = container;
    this.app = app;
    this.lang = app.getLanguage();
    this.phase = 'select'; // 'select' | 'playing' | 'gameover'

    this.selectedLevel = 1;
    this.currentLevel = 1;
    this.reachedLevel = 1;
    this.score = 0;
    this.combo = 0;
    this.clearedCount = 0;
    this.lives = MAX_LIVES;
    this.isPaused = false;
    this.lastRecordResult = null;

    this.words = [];
    this.nextWordId = 1;
    this.rafId = null;
    this.lastFrameTs = 0;
    this.spawnAccumulator = 0;
    this.currentTyped = '';
    this.imeHandle = null;

    this.render();
  }

  AcidRainMode.prototype._getData = function () {
    return this.lang === 'en' ? TypingApp.DATA_EN : TypingApp.DATA_KO;
  };

  AcidRainMode.prototype._getWordPoolForLevel = function (level) {
    var words = this._getData().words;
    if (level <= 2) return words.easy;
    if (level === 3) return words.easy.concat(words.medium.slice(0, 15));
    if (level <= 6) return words.easy.concat(words.medium);
    if (level <= 8) return words.medium.concat(words.hard);
    return words.medium.slice(20).concat(words.hard);
  };

  AcidRainMode.prototype._stopLoop = function () {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  };

  AcidRainMode.prototype._destroyIme = function () {
    if (this.imeHandle) {
      this.imeHandle.destroy();
      this.imeHandle = null;
    }
  };

  AcidRainMode.prototype.render = function () {
    if (this.phase === 'select') {
      this._renderSelectScreen();
    } else if (this.phase === 'playing') {
      this._renderGameArena();
    } else {
      this._renderGameOver();
    }
  };

  AcidRainMode.prototype._renderSelectScreen = function () {
    var self = this;
    self._stopLoop();
    self._destroyIme();
    self.container.innerHTML = '';

    var page = document.createElement('section');
    page.className = 'acid-page acid-select-page';

    var card = document.createElement('div');
    card.className = 'panel-card acid-select-card';

    var langBadgeText = self.lang === 'ko' ? '한글 단어 모드' : '영어 단어 모드';
    var activeUser = self.app && typeof self.app.getActiveUser === 'function' ? self.app.getActiveUser() : null;
    var acidRec = activeUser && activeUser.acidRain ? activeUser.acidRain[self.lang] : null;
    var recordStripHtml = acidRec
      ? '<div class="acid-personal-record">' +
        '  <span><strong>' + escapeHtml(activeUser.name) + '</strong>님의 ' + (self.lang === 'ko' ? '한글' : '영어') + ' 최고 기록</span>' +
        '  <div class="acid-personal-pills">' +
        '    <span class="acid-record-pill">최고 점수 <strong>' + (acidRec.highScore || 0).toLocaleString() + '점</strong></span>' +
        '    <span class="acid-record-pill">클리어 최고 <strong>' + (acidRec.bestClearedLevel > 0 ? acidRec.bestClearedLevel + '단계' : '미달성') + '</strong></span>' +
        '    <span class="acid-record-pill">플레이 <strong>' + (acidRec.gamesPlayed || 0) + '회</strong></span>' +
        '  </div>' +
        '</div>'
      : '';

    var headerHtml =
      '<div class="acid-select-header">' +
      '  <div>' +
      '    <span class="acid-lang-pill">' + langBadgeText + '</span>' +
      '    <h1 class="acid-title">산성비 미니게임</h1>' +
      '    <p class="acid-subtitle">하늘에서 떨어지는 단어를 바닥에 닿기 전에 입력하고 Enter를 누르세요. 단계가 높을수록 낙하 속도와 출현 주기가 빨라집니다.</p>' +
      '  </div>' +
      recordStripHtml +
      '</div>';

    card.innerHTML = headerHtml;

    var grid = document.createElement('div');
    grid.className = 'level-grid';
    grid.setAttribute('role', 'radiogroup');
    grid.setAttribute('aria-label', '난이도 1단계부터 10단계 선택');

    for (var lv = 1; lv <= 10; lv++) {
      (function (levelNum) {
        var tier = getTierMeta(levelNum);
        var specs = getSpeedSpecs(levelNum);
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'level-card ' + tier.cls + (levelNum === self.selectedLevel ? ' is-selected' : '');
        btn.dataset.level = String(levelNum);
        btn.setAttribute('aria-pressed', levelNum === self.selectedLevel ? 'true' : 'false');

        var barsHtml = '';
        for (var b = 1; b <= 5; b++) {
          var activeBars = Math.ceil(levelNum / 2);
          barsHtml += '<span class="speed-bar' + (b <= activeBars ? ' is-filled' : '') + '"></span>';
        }

        btn.innerHTML =
          '<div class="level-card-top">' +
          '  <span class="level-num">' + levelNum + '단계</span>' +
          '  <span class="level-tier-tag">' + tier.label + '</span>' +
          '</div>' +
          '<div class="level-speed-bars" title="낙하 속도: ' + specs.fallSpeed + 'px/s">' + barsHtml + '</div>' +
          '<span class="level-meta">속도 ' + specs.fallSpeed + ' · ' + (specs.spawnInterval / 1000).toFixed(2) + '초</span>';

        btn.addEventListener('click', function () {
          self.selectedLevel = levelNum;
          var allCards = grid.querySelectorAll('.level-card');
          allCards.forEach(function (el) {
            var isSel = Number(el.dataset.level) === levelNum;
            el.classList.toggle('is-selected', isSel);
            el.setAttribute('aria-pressed', isSel ? 'true' : 'false');
          });
          var startBtn = card.querySelector('#acid-start-btn');
          if (startBtn) {
            startBtn.textContent = levelNum + '단계로 게임 시작';
          }
        });

        grid.appendChild(btn);
      })(lv);
    }

    card.appendChild(grid);

    var footer = document.createElement('div');
    footer.className = 'acid-select-footer';
    footer.innerHTML =
      '<div class="acid-rules-list">' +
      '  <span>• 생명: 하트 5개 (바닥 낙하 시 1개 감소)</span>' +
      '  <span>• 10단어 제거마다 단계 자동 상승</span>' +
      '</div>' +
      '<button type="button" class="btn btn-primary btn-lg" id="acid-start-btn">' + self.selectedLevel + '단계로 게임 시작</button>';

    card.appendChild(footer);
    page.appendChild(card);
    self.container.appendChild(page);

    var startBtn = card.querySelector('#acid-start-btn');
    if (startBtn) {
      startBtn.addEventListener('click', function () {
        self._startGame();
      });
    }
  };

  AcidRainMode.prototype._startGame = function () {
    this.phase = 'playing';
    this.currentLevel = this.selectedLevel;
    this.reachedLevel = this.selectedLevel;
    this.score = 0;
    this.combo = 0;
    this.clearedCount = 0;
    this.lives = MAX_LIVES;
    this.isPaused = false;
    this.lastRecordResult = null;
    this.words = [];
    this.nextWordId = 1;
    this.currentTyped = '';
    this.lastFrameTs = 0;
    // Wait full spawn interval after the initial word so Level 1 starts comfortably
    this.spawnAccumulator = 0;

    this._renderGameArena();
    this._spawnWord();
    this._startLoop();
  };

  AcidRainMode.prototype._renderGameArena = function () {
    var self = this;
    self._destroyIme();
    self.container.innerHTML = '';

    var page = document.createElement('section');
    page.className = 'acid-page acid-arena-page';

    var shell = document.createElement('div');
    shell.className = 'panel-card acid-game-shell';

    // Top HUD
    var hud = document.createElement('div');
    hud.className = 'acid-hud';
    hud.innerHTML =
      '<div class="acid-hearts" id="acid-hearts" aria-label="남은 생명"></div>' +
      '<div class="acid-hud-stats">' +
      '  <div class="acid-stat"><span class="hud-label">단계</span><strong class="hud-value" id="acid-level-val">' + self.currentLevel + '단계</strong></div>' +
      '  <div class="acid-stat"><span class="hud-label">점수</span><strong class="hud-value" id="acid-score-val">0</strong></div>' +
      '  <div class="acid-stat"><span class="hud-label">연속</span><strong class="hud-value" id="acid-combo-val">0</strong></div>' +
      '</div>' +
      '<div class="acid-hud-actions">' +
      '  <button type="button" class="btn btn-ghost btn-sm" id="acid-pause-btn">일시정지</button>' +
      '  <button type="button" class="btn btn-ghost btn-sm" id="acid-restart-btn">재시작</button>' +
      '  <button type="button" class="btn btn-ghost btn-sm" id="acid-level-btn">단계 선택</button>' +
      '</div>';
    shell.appendChild(hud);

    // Falling Words Sky Canvas
    var sky = document.createElement('div');
    sky.className = 'acid-sky';
    sky.id = 'acid-sky';

    var dangerLine = document.createElement('div');
    dangerLine.className = 'acid-danger-line';
    dangerLine.innerHTML = '<span>바닥 방어선</span>';
    sky.appendChild(dangerLine);

    var pauseOverlay = document.createElement('div');
    pauseOverlay.className = 'acid-pause-overlay hidden';
    pauseOverlay.id = 'acid-pause-overlay';
    pauseOverlay.innerHTML =
      '<div class="acid-pause-box">' +
      '  <h3>일시정지</h3>' +
      '  <p>잠시 숨을 고르고 준비되면 계속하세요.</p>' +
      '  <button type="button" class="btn btn-primary" id="acid-resume-btn">계속하기</button>' +
      '</div>';
    sky.appendChild(pauseOverlay);

    shell.appendChild(sky);

    // Bottom Input Bar
    var inputBar = document.createElement('div');
    inputBar.className = 'acid-input-bar';

    var inputEl = document.createElement('input');
    inputEl.type = 'text';
    inputEl.id = 'acid-input';
    inputEl.className = 'typing-input acid-input';
    inputEl.setAttribute('autocomplete', 'off');
    inputEl.setAttribute('autocorrect', 'off');
    inputEl.setAttribute('autocapitalize', 'off');
    inputEl.setAttribute('spellcheck', 'false');
    if (self.app && typeof self.app.applyInputMode === 'function') {
      self.app.applyInputMode(inputEl, 'send');
    }
    inputEl.placeholder =
      self.lang === 'ko'
        ? '떨어지는 단어를 입력하고 Enter 키를 누르세요...'
        : 'Type a falling word and press Enter...';

    var submitBtn = document.createElement('button');
    submitBtn.type = 'button';
    submitBtn.className = 'btn btn-primary';
    submitBtn.id = 'acid-submit-btn';
    submitBtn.textContent = '입력';

    inputBar.appendChild(inputEl);
    inputBar.appendChild(submitBtn);
    shell.appendChild(inputBar);

    page.appendChild(shell);
    self.container.appendChild(page);

    self._renderHearts();
    self._updateGameHud();

    self.imeHandle = TypingApp.IMEEvaluator.attachIMEInput(inputEl, {
      onChange: function (value) {
        self.currentTyped = value;
        self._refreshWordMatchHighlights();
      },
      onEnter: function (finalValue) {
        if (self.phase !== 'playing' || self.isPaused) return;
        self._handleWordSubmit(finalValue);
      },
    });

    submitBtn.addEventListener('click', function () {
      if (self.phase !== 'playing' || self.isPaused) return;
      self._handleWordSubmit(inputEl.value);
    });

    var pauseBtn = shell.querySelector('#acid-pause-btn');
    var resumeBtn = shell.querySelector('#acid-resume-btn');
    var restartBtn = shell.querySelector('#acid-restart-btn');
    var levelBtn = shell.querySelector('#acid-level-btn');

    if (pauseBtn) {
      pauseBtn.addEventListener('click', function () {
        self._togglePause();
      });
    }
    if (resumeBtn) {
      resumeBtn.addEventListener('click', function () {
        self._togglePause(false);
      });
    }
    if (restartBtn) {
      restartBtn.addEventListener('click', function () {
        self._stopLoop();
        self._startGame();
      });
    }
    if (levelBtn) {
      levelBtn.addEventListener('click', function () {
        self._stopLoop();
        self.phase = 'select';
        self.render();
      });
    }

    try {
      inputEl.focus({ preventScroll: true });
    } catch (err) {
      inputEl.focus();
    }
  };

  AcidRainMode.prototype._renderHearts = function () {
    var heartsEl = this.container.querySelector('#acid-hearts');
    if (!heartsEl) return;

    var html = '';
    for (var i = 0; i < MAX_LIVES; i++) {
      var alive = i < this.lives;
      html +=
        '<span class="heart-icon ' + (alive ? 'is-alive' : 'is-lost') + '" aria-hidden="true">' +
        '<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">' +
        '<path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>' +
        '</svg>' +
        '</span>';
    }
    heartsEl.innerHTML = html;
    heartsEl.setAttribute('aria-label', '남은 생명 ' + this.lives + '개');
  };

  AcidRainMode.prototype._updateGameHud = function () {
    var levelEl = this.container.querySelector('#acid-level-val');
    var scoreEl = this.container.querySelector('#acid-score-val');
    var comboEl = this.container.querySelector('#acid-combo-val');

    if (levelEl) levelEl.textContent = this.currentLevel + '단계';
    if (scoreEl) scoreEl.textContent = this.score.toLocaleString();
    if (comboEl) comboEl.textContent = this.combo > 1 ? this.combo + ' COMBO' : String(this.combo);
  };

  AcidRainMode.prototype._togglePause = function (forceState) {
    if (this.phase !== 'playing') return;
    this.isPaused = typeof forceState === 'boolean' ? forceState : !this.isPaused;
    var overlay = this.container.querySelector('#acid-pause-overlay');
    var pauseBtn = this.container.querySelector('#acid-pause-btn');
    var inputEl = this.container.querySelector('#acid-input');

    if (overlay) {
      overlay.classList.toggle('hidden', !this.isPaused);
    }
    if (pauseBtn) {
      pauseBtn.textContent = this.isPaused ? '계속하기' : '일시정지';
    }
    if (!this.isPaused) {
      this.lastFrameTs = 0;
      if (inputEl) inputEl.focus();
    }
  };

  AcidRainMode.prototype._startLoop = function () {
    var self = this;
    self._stopLoop();
    self.lastFrameTs = 0;

    function tick(timestamp) {
      if (self.phase !== 'playing') return;

      if (!self.lastFrameTs) {
        self.lastFrameTs = timestamp;
      }
      var dt = Math.min((timestamp - self.lastFrameTs) / 1000, 0.05);
      self.lastFrameTs = timestamp;

      if (!self.isPaused) {
        self._updateFrame(dt);
      }

      if (self.phase === 'playing') {
        self.rafId = requestAnimationFrame(tick);
      }
    }

    self.rafId = requestAnimationFrame(tick);
  };

  AcidRainMode.prototype._updateFrame = function (dt) {
    var sky = this.container.querySelector('#acid-sky');
    if (!sky) return;

    var specs = getSpeedSpecs(this.currentLevel);
    this.spawnAccumulator += dt * 1000;
    if (this.spawnAccumulator >= specs.spawnInterval) {
      this.spawnAccumulator -= specs.spawnInterval;
      if (this.words.length < specs.maxWords) {
        this._spawnWord();
      }
    }

    var skyWidth = sky.clientWidth || 720;
    var skyHeight = sky.clientHeight || 420;
    var bottomLimit = skyHeight - 28;
    var lostAny = false;

    for (var i = this.words.length - 1; i >= 0; i--) {
      var w = this.words[i];
      w.y += w.speed * dt;
      var ratio = w.y / Math.max(1, bottomLimit);

      if (w.el) {
        var wordW = w.el.offsetWidth || 80;
        var maxWordX = Math.max(12, skyWidth - wordW - 12);
        if (w.x > maxWordX) {
          w.x = maxWordX;
          w.el.style.left = Math.round(w.x) + 'px';
        }
        w.el.style.transform = 'translate3d(0, ' + w.y.toFixed(1) + 'px, 0)';
        w.el.classList.toggle('is-warning', ratio >= 0.65 && ratio < 0.84);
        w.el.classList.toggle('is-danger', ratio >= 0.84);
      }

      var wordH = w.el ? w.el.offsetHeight || 34 : 34;
      if (w.y + wordH >= bottomLimit) {
        if (w.el && w.el.parentNode) {
          w.el.parentNode.removeChild(w.el);
        }
        this.words.splice(i, 1);
        this.lives = Math.max(0, this.lives - 1);
        this.combo = 0;
        lostAny = true;

        if (this.lives <= 0) {
          this._triggerGameOver();
          return;
        }
      }
    }

    if (lostAny) {
      this._renderHearts();
      this._updateGameHud();
      sky.classList.remove('is-hurt');
      void sky.offsetWidth;
      sky.classList.add('is-hurt');
    }
  };

  AcidRainMode.prototype._spawnWord = function () {
    var sky = this.container.querySelector('#acid-sky');
    if (!sky) return;

    var pool = this._getWordPoolForLevel(this.currentLevel);
    var activeTexts = {};
    this.words.forEach(function (w) {
      activeTexts[w.text.toLowerCase()] = true;
    });

    var text = pool[Math.floor(Math.random() * pool.length)];
    for (var attempt = 0; attempt < 8; attempt++) {
      var candidate = pool[Math.floor(Math.random() * pool.length)];
      if (!activeTexts[candidate.toLowerCase()]) {
        text = candidate;
        break;
      }
    }

    var specs = getSpeedSpecs(this.currentLevel);
    var variance = 0.88 + Math.random() * 0.24; // ±12%
    var speed = specs.fallSpeed * variance;

    var el = document.createElement('div');
    el.className = 'falling-word';
    el.innerHTML = escapeHtml(text);
    sky.appendChild(el);

    var skyWidth = sky.clientWidth || 720;
    var wordWidth = el.offsetWidth || 96;
    var minX = 18;
    var maxX = Math.max(minX + 10, skyWidth - wordWidth - 18);
    var x = minX + Math.random() * (maxX - minX);

    el.style.left = Math.round(x) + 'px';
    el.style.top = '0px';
    el.style.transform = 'translate3d(0, 8px, 0)';

    this.words.push({
      id: this.nextWordId++,
      text: text,
      x: Math.round(x),
      y: 8,
      speed: speed,
      el: el,
    });

    this._refreshWordMatchHighlights();
  };

  AcidRainMode.prototype._refreshWordMatchHighlights = function () {
    var typed = (this.currentTyped || '').trim();
    var isEn = this.lang === 'en';
    var typedCmp = isEn ? typed.toLowerCase() : typed;

    this.words.forEach(function (w) {
      if (!w.el) return;
      if (!typedCmp) {
        w.el.classList.remove('is-matching');
        if (w.el.textContent !== w.text) {
          w.el.textContent = w.text;
        }
        return;
      }

      var wordCmp = isEn ? w.text.toLowerCase() : w.text;
      if (wordCmp.indexOf(typedCmp) === 0) {
        w.el.classList.add('is-matching');
        var matchedPart = escapeHtml(w.text.slice(0, typed.length));
        var restPart = escapeHtml(w.text.slice(typed.length));
        w.el.innerHTML = '<span class="falling-prefix">' + matchedPart + '</span>' + restPart;
      } else {
        w.el.classList.remove('is-matching');
        if (w.el.textContent !== w.text) {
          w.el.textContent = w.text;
        }
      }
    });
  };

  AcidRainMode.prototype._handleWordSubmit = function (rawValue) {
    var inputEl = this.container.querySelector('#acid-input');
    var typed = (rawValue || '').trim();
    if (!typed) {
      if (inputEl) inputEl.focus();
      return;
    }

    var isEn = this.lang === 'en';
    var typedNorm = isEn ? typed.toLowerCase() : typed;

    var bestIdx = -1;
    var highestY = -Infinity;

    for (var i = 0; i < this.words.length; i++) {
      var w = this.words[i];
      var wordNorm = isEn ? w.text.toLowerCase() : w.text;
      if (wordNorm === typedNorm && w.y > highestY) {
        highestY = w.y;
        bestIdx = i;
      }
    }

    if (bestIdx !== -1) {
      var targetWord = this.words[bestIdx];
      this.words.splice(bestIdx, 1);

      this.combo++;
      this.clearedCount++;
      var bonusMultiplier = 1 + Math.min(this.combo - 1, 5) * 0.2;
      var gained = Math.round((10 + this.currentLevel * 5) * bonusMultiplier);
      this.score += gained;

      this._animateClearedWord(targetWord, gained);

      // Level up every 10 cleared words up to 10
      var targetLevel = Math.min(10, this.selectedLevel + Math.floor(this.clearedCount / 10));
      if (targetLevel > this.currentLevel) {
        this.currentLevel = targetLevel;
        this.reachedLevel = Math.max(this.reachedLevel, targetLevel);
        this.app.showToast('단계 상승! ' + this.currentLevel + '단계로 진입했습니다.');
      }

      this._updateGameHud();
    } else {
      this.combo = 0;
      this._updateGameHud();
      if (inputEl) {
        inputEl.classList.remove('is-shake');
        void inputEl.offsetWidth;
        inputEl.classList.add('is-shake');
      }
    }

    this.currentTyped = '';
    if (this.imeHandle) {
      this.imeHandle.reset(true);
    }
    this._refreshWordMatchHighlights();
  };

  AcidRainMode.prototype._animateClearedWord = function (wordObj, gained) {
    var sky = this.container.querySelector('#acid-sky');
    if (wordObj.el) {
      wordObj.el.style.transform = 'translate3d(0, ' + wordObj.y.toFixed(1) + 'px, 0) scale(1.18)';
      wordObj.el.classList.add('is-cleared');
      setTimeout(function () {
        if (wordObj.el && wordObj.el.parentNode) {
          wordObj.el.parentNode.removeChild(wordObj.el);
        }
      }, 240);
    }

    if (sky) {
      var popup = document.createElement('span');
      popup.className = 'score-popup';
      popup.textContent = '+' + gained;
      popup.style.left = wordObj.x + 'px';
      popup.style.top = Math.max(10, Math.round(wordObj.y)) + 'px';
      sky.appendChild(popup);
      setTimeout(function () {
        if (popup.parentNode) popup.parentNode.removeChild(popup);
      }, 650);
    }
  };

  AcidRainMode.prototype._triggerGameOver = function () {
    this._stopLoop();
    this._destroyIme();
    this.phase = 'gameover';

    var levelsCleared = Math.floor(this.clearedCount / 10);
    var clearedLevel = levelsCleared > 0 ? Math.min(10, this.selectedLevel + levelsCleared - 1) : 0;
    this.lastClearedLevel = clearedLevel;

    if (this.app && typeof this.app.recordAcidRain === 'function') {
      this.lastRecordResult = this.app.recordAcidRain({
        lang: this.lang,
        score: this.score,
        reachedLevel: this.reachedLevel,
        clearedLevel: clearedLevel,
        clearedCount: this.clearedCount,
      });
      if (typeof this.app.refreshHeaderState === 'function') {
        this.app.refreshHeaderState();
      }
      if (this.lastRecordResult && this.lastRecordResult.gradeUp && typeof this.app.showGradeUpToast === 'function') {
        this.app.showGradeUpToast(this.lastRecordResult.gradeUp);
      }
    }

    this._renderGameOver();
  };

  AcidRainMode.prototype._renderGameOver = function () {
    var self = this;
    self.container.innerHTML = '';

    var page = document.createElement('section');
    page.className = 'acid-page acid-gameover-page';

    var isNewHigh = Boolean(self.lastRecordResult && self.lastRecordResult.isNewHighScore);
    var clearedNote = self.lastClearedLevel > 0 ? self.lastClearedLevel + '단계 클리어! ' : '';
    var gradeUp = self.lastRecordResult && self.lastRecordResult.gradeUp;
    var gradeUpBannerHtml = gradeUp
      ? '<div class="grade-up-banner" role="status">' +
        '  <span class="grade-up-icon" aria-hidden="true">🎉</span>' +
        '  <div class="grade-up-copy">' +
        '    <strong>등급 승급 축하합니다!</strong>' +
        '    <div class="grade-up-badges">' +
        '      <span class="grade-badge grade-badge--xs grade-tier-' + gradeUp.from.tier + '">' + escapeHtml(gradeUp.from.label) + '</span>' +
        '      <span class="grade-arrow" aria-hidden="true">→</span>' +
        '      <span class="grade-badge grade-badge--sm grade-tier-' + gradeUp.to.tier + '">' + escapeHtml(gradeUp.to.label) + ' (' + gradeUp.to.tier + '단계)</span>' +
        '    </div>' +
        '  </div>' +
        '</div>'
      : '';

    var card = document.createElement('div');
    card.className = 'panel-card acid-gameover-card';
    card.innerHTML =
      '<div class="gameover-badges-row">' +
      '  <span class="gameover-badge">GAME OVER</span>' +
      (isNewHigh ? '  <span class="new-record-badge">🏆 최고 점수 경신!</span>' : '') +
      '</div>' +
      '<h1 class="gameover-title">Game Over</h1>' +
      '<p class="gameover-subtitle">' + clearedNote + '모든 생명을 소진했습니다. 다시 도전하여 더 높은 기록을 세워 보세요!</p>' +
      gradeUpBannerHtml +
      '<div class="gameover-stats-grid">' +
      '  <div class="gameover-stat-box">' +
      '    <span class="gameover-stat-label">최종 점수</span>' +
      '    <strong class="gameover-stat-value gameover-stat-value--score">' + self.score.toLocaleString() + '</strong>' +
      '  </div>' +
      '  <div class="gameover-stat-box">' +
      '    <span class="gameover-stat-label">도달 단계</span>' +
      '    <strong class="gameover-stat-value">' + self.reachedLevel + '단계</strong>' +
      '  </div>' +
      '  <div class="gameover-stat-box">' +
      '    <span class="gameover-stat-label">제거한 단어</span>' +
      '    <strong class="gameover-stat-value">' + self.clearedCount + '개</strong>' +
      '  </div>' +
      '</div>' +
      '<div class="gameover-actions">' +
      '  <button type="button" class="btn btn-primary btn-lg" id="acid-gameover-retry">다시하기</button>' +
      '  <button type="button" class="btn btn-secondary btn-lg" id="acid-gameover-select">난이도 선택</button>' +
      '  <button type="button" class="btn btn-ghost btn-lg" id="acid-gameover-records">내 기록 보기</button>' +
      '</div>';

    page.appendChild(card);
    self.container.appendChild(page);

    var retryBtn = card.querySelector('#acid-gameover-retry');
    var selectBtn = card.querySelector('#acid-gameover-select');
    var recordsBtn = card.querySelector('#acid-gameover-records');
    if (retryBtn) {
      retryBtn.addEventListener('click', function () {
        self._startGame();
      });
    }
    if (selectBtn) {
      selectBtn.addEventListener('click', function () {
        self.phase = 'select';
        self.render();
      });
    }
    if (recordsBtn) {
      recordsBtn.addEventListener('click', function () {
        if (self.app && typeof self.app.openRecordsModal === 'function') {
          self.app.openRecordsModal();
        }
      });
    }
  };

  AcidRainMode.prototype.setLanguage = function (lang) {
    var normalized = lang === 'en' ? 'en' : 'ko';
    if (this.lang === normalized) return;
    this.lang = normalized;

    if (this.phase === 'playing') {
      this._stopLoop();
      this._startGame();
    } else if (this.phase === 'gameover') {
      this.phase = 'select';
      this.render();
    } else {
      this.render();
    }
  };

  AcidRainMode.prototype.destroy = function () {
    this._stopLoop();
    this._destroyIme();
    this.words = [];
    this.container.innerHTML = '';
  };

  TypingApp.AcidRainMode = AcidRainMode;
})(window);
