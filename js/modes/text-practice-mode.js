(function (global) {
  'use strict';

  var TypingApp = (global.TypingApp = global.TypingApp || {});

  function pickRandomItems(pool, count) {
    var copy = pool.slice();
    for (var i = copy.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = copy[i];
      copy[i] = copy[j];
      copy[j] = tmp;
    }
    var result = [];
    while (result.length < count && copy.length > 0) {
      for (var k = 0; k < copy.length && result.length < count; k++) {
        result.push(copy[k]);
      }
    }
    return result;
  }

  function renderEvaluatedLineHTML(target, typed, isComposing, activeCompIdx) {
    var evalResult = TypingApp.IMEEvaluator.evaluateInput(target, typed, isComposing, activeCompIdx);
    var html = '';

    for (var i = 0; i < evalResult.chars.length; i++) {
      var ch = evalResult.chars[i];
      var cls = 'prompt-char char-' + ch.status;
      if (ch.targetChar === ' ') {
        cls += ' char-space';
      }
      var safeChar = escapeHtml(ch.targetChar);
      html += '<span class="' + cls + '">' + safeChar + '</span>';
    }

    for (var j = 0; j < evalResult.extra.length; j++) {
      var ex = evalResult.extra[j];
      var exCls = 'prompt-char char-extra char-' + ex.status;
      html += '<span class="' + exCls + '">' + escapeHtml(ex.typedChar) + '</span>';
    }

    return {
      html: html,
      evalResult: evalResult,
    };
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function TextPracticeMode(container, app, modeType) {
    this.container = container;
    this.app = app;
    this.modeType = modeType; // 'word' | 'short' | 'long'
    this.lang = app.getLanguage();

    this.wordCount = 15;
    this.shortCount = 5;
    this.passageIndex = 0;

    this.items = [];
    this.currentIndex = 0;
    this.records = [];
    this.startTime = null;
    this.finished = false;
    this.timerInterval = null;

    this.currentTyped = '';
    this.currentComposing = false;
    this.currentCompIdx = -1;
    this.imeHandle = null;

    this._startNewSet();
  }

  TextPracticeMode.prototype._getData = function () {
    return this.lang === 'en' ? TypingApp.DATA_EN : TypingApp.DATA_KO;
  };

  TextPracticeMode.prototype._buildSetItems = function () {
    var data = this._getData();
    if (this.modeType === 'word') {
      var allWords = [].concat(data.words.easy, data.words.medium, data.words.hard);
      return pickRandomItems(allWords, this.wordCount);
    }
    if (this.modeType === 'short') {
      return pickRandomItems(data.shortSentences, this.shortCount);
    }
    var passages = data.longPassages;
    var safeIdx = Math.max(0, Math.min(this.passageIndex, passages.length - 1));
    this.passageIndex = safeIdx;
    return passages[safeIdx].lines.slice();
  };

  TextPracticeMode.prototype._startNewSet = function () {
    this._destroyIme();
    this._stopHudTimer();

    this.items = this._buildSetItems();
    this.currentIndex = 0;
    this.records = [];
    this.startTime = null;
    this.finished = false;
    this.currentTyped = '';
    this.currentComposing = false;
    this.currentCompIdx = -1;

    this._render();
  };

  TextPracticeMode.prototype._destroyIme = function () {
    if (this.imeHandle) {
      this.imeHandle.destroy();
      this.imeHandle = null;
    }
  };

  TextPracticeMode.prototype._stopHudTimer = function () {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  };

  TextPracticeMode.prototype._ensureHudTimer = function () {
    var self = this;
    if (self.timerInterval) return;
    self.timerInterval = setInterval(function () {
      if (!self.finished && self.startTime) {
        self._updateHud();
      }
    }, 500);
  };

  TextPracticeMode.prototype._render = function () {
    var self = this;
    var data = self._getData();
    self.container.innerHTML = '';

    var page = document.createElement('section');
    page.className = 'practice-page text-practice-page text-practice-page--' + self.modeType;

    // 1. Top Control + HUD Card
    var topCard = document.createElement('div');
    topCard.className = 'panel-card practice-topbar';

    var controlsWrap = document.createElement('div');
    controlsWrap.className = 'practice-controls';

    if (self.modeType === 'word') {
      var wordLengths = [10, 15, 20];
      controlsWrap.appendChild(self._buildLengthPills('낱말 수', wordLengths, self.wordCount, function (val) {
        self.wordCount = val;
        self._startNewSet();
      }));
    } else if (self.modeType === 'short') {
      var shortLengths = [1, 5, 10];
      controlsWrap.appendChild(self._buildLengthPills('문장 수', shortLengths, self.shortCount, function (val) {
        self.shortCount = val;
        self._startNewSet();
      }));
    } else {
      var selectorRow = document.createElement('div');
      selectorRow.className = 'passage-selector-wrap';
      var lbl = document.createElement('label');
      lbl.className = 'control-label';
      lbl.setAttribute('for', 'long-passage-select');
      lbl.textContent = '지문 선택';
      var select = document.createElement('select');
      select.id = 'long-passage-select';
      select.className = 'passage-select';
      data.longPassages.forEach(function (p, idx) {
        var opt = document.createElement('option');
        opt.value = String(idx);
        opt.textContent = '[' + p.category + '] ' + p.title;
        if (idx === self.passageIndex) opt.selected = true;
        select.appendChild(opt);
      });
      select.addEventListener('change', function () {
        self.passageIndex = Number(select.value) || 0;
        self._startNewSet();
      });
      selectorRow.appendChild(lbl);
      selectorRow.appendChild(select);
      controlsWrap.appendChild(selectorRow);
    }

    var hudRow = document.createElement('div');
    hudRow.className = 'hud-metrics';
    hudRow.innerHTML =
      '<div class="hud-stat"><span class="hud-label">진행</span><strong class="hud-value" id="tp-progress"></strong></div>' +
      '<div class="hud-stat"><span class="hud-label">정타율</span><strong class="hud-value" id="tp-accuracy">100.0%</strong></div>' +
      '<div class="hud-stat"><span class="hud-label">오타</span><strong class="hud-value hud-value--typo" id="tp-typos">0</strong></div>' +
      '<div class="hud-stat"><span class="hud-label">타수</span><strong class="hud-value" id="tp-cpm">0 CPM</strong></div>' +
      '<div class="hud-stat"><span class="hud-label">WPM</span><strong class="hud-value" id="tp-wpm">0</strong></div>' +
      '<button type="button" class="btn btn-ghost btn-sm" id="tp-reset-btn">새 세트</button>';

    topCard.appendChild(controlsWrap);
    topCard.appendChild(hudRow);
    page.appendChild(topCard);

    // 2. Progress Bar
    var progressTrack = document.createElement('div');
    progressTrack.className = 'progress-track';
    progressTrack.innerHTML = '<div class="progress-fill" id="tp-progress-bar" style="width: 0%"></div>';
    page.appendChild(progressTrack);

    // 3. Main Practice Card
    var workCard = document.createElement('div');
    workCard.className = 'panel-card text-work-card';

    if (self.modeType === 'long') {
      var activePassage = data.longPassages[self.passageIndex];
      var passageHeader = document.createElement('div');
      passageHeader.className = 'passage-header';
      passageHeader.innerHTML =
        '<span class="passage-category-badge">' + escapeHtml(activePassage.category) + '</span>' +
        '<h2 class="passage-title">' + escapeHtml(activePassage.title) + '</h2>' +
        '<span class="passage-hint">한 줄을 끝까지 입력한 뒤 Enter 키로 다음 줄로 이동하세요.</span>';
      workCard.appendChild(passageHeader);

      var linesList = document.createElement('div');
      linesList.className = 'long-lines-container';
      linesList.id = 'tp-long-lines';
      workCard.appendChild(linesList);
    } else {
      var promptSection = document.createElement('div');
      promptSection.className = 'prompt-stage';

      var promptLabelRow = document.createElement('div');
      promptLabelRow.className = 'prompt-meta-row';
      promptLabelRow.innerHTML =
        '<span class="prompt-eyebrow">' +
        (self.modeType === 'word' ? '제시 낱말' : '제시 문장') +
        '</span>' +
        '<span class="ime-legend">' +
        '  <span class="ime-dot ime-dot--correct"></span>정타' +
        '  <span class="ime-dot ime-dot--composing"></span>조합 중' +
        '  <span class="ime-dot ime-dot--typo"></span>오타' +
        '</span>';
      promptSection.appendChild(promptLabelRow);

      var promptBox = document.createElement('div');
      promptBox.className = 'prompt-display prompt-display--' + self.modeType;
      promptBox.id = 'tp-prompt-display';
      promptSection.appendChild(promptBox);

      var inputWrap = document.createElement('div');
      inputWrap.className = 'typing-input-wrap';

      var inputEl = document.createElement('input');
      inputEl.type = 'text';
      inputEl.id = 'tp-typing-input';
      inputEl.className = 'typing-input typing-input--' + self.modeType;
      inputEl.setAttribute('autocomplete', 'off');
      inputEl.setAttribute('autocorrect', 'off');
      inputEl.setAttribute('autocapitalize', 'off');
      inputEl.setAttribute('spellcheck', 'false');
      inputEl.setAttribute('aria-label', self.lang === 'ko' ? '한글 타자 입력창' : 'English typing input');
      if (self.app && typeof self.app.applyInputMode === 'function') {
        self.app.applyInputMode(inputEl, 'next');
      }
      inputEl.placeholder =
        self.lang === 'ko'
          ? '여기에 위 글자를 똑같이 입력하고 Enter를 누르세요...'
          : 'Type the text above and press Enter...';

      var enterHint = document.createElement('div');
      enterHint.className = 'input-helper-row';
      enterHint.innerHTML =
        '<span class="input-helper-text">끝까지 입력한 뒤 <kbd>Enter</kbd> 키를 누르면 다음으로 넘어갑니다.</span>' +
        '<span class="input-char-counter" id="tp-char-counter">0 / 0</span>';

      inputWrap.appendChild(inputEl);
      inputWrap.appendChild(enterHint);
      promptSection.appendChild(inputWrap);

      var previewWrap = document.createElement('div');
      previewWrap.className = 'upcoming-preview';
      previewWrap.id = 'tp-upcoming-preview';
      promptSection.appendChild(previewWrap);

      workCard.appendChild(promptSection);
    }

    page.appendChild(workCard);
    self.container.appendChild(page);

    var resetBtn = self.container.querySelector('#tp-reset-btn');
    if (resetBtn) {
      resetBtn.addEventListener('click', function () {
        resetBtn.blur();
        self._startNewSet();
      });
    }

    self._renderActiveItem();
    self._updateHud();
  };

  TextPracticeMode.prototype._buildLengthPills = function (labelText, values, currentVal, onSelect) {
    var wrap = document.createElement('div');
    wrap.className = 'stage-pills-wrap';

    var label = document.createElement('span');
    label.className = 'control-label';
    label.textContent = labelText;
    wrap.appendChild(label);

    var group = document.createElement('div');
    group.className = 'stage-pills';

    values.forEach(function (val) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'stage-pill' + (val === currentVal ? ' is-active' : '');
      btn.textContent = val + (values[0] === 10 && values.indexOf(15) !== -1 ? '단어' : '문장');
      btn.addEventListener('click', function () {
        btn.blur();
        if (val !== currentVal) {
          onSelect(val);
        }
      });
      group.appendChild(btn);
    });

    wrap.appendChild(group);
    return wrap;
  };

  TextPracticeMode.prototype._renderActiveItem = function () {
    var self = this;
    self._destroyIme();

    if (self.modeType === 'long') {
      self._renderLongLines();
    } else {
      self._updatePromptDisplay();
      self._updateUpcomingPreview();
      var inputEl = self.container.querySelector('#tp-typing-input');
      if (inputEl) {
        if (self.app && typeof self.app.applyInputMode === 'function') {
          self.app.applyInputMode(inputEl, self.currentIndex < self.items.length - 1 ? 'next' : 'send');
        }
        self._bindImeToInput(inputEl);
        try {
          inputEl.focus({ preventScroll: true });
        } catch (err) {
          inputEl.focus();
        }
        if (typeof inputEl.scrollIntoView === 'function') {
          try {
            inputEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          } catch (err) {
            inputEl.scrollIntoView(false);
          }
        }
      }
    }
  };

  TextPracticeMode.prototype._bindImeToInput = function (inputEl) {
    var self = this;
    self.imeHandle = TypingApp.IMEEvaluator.attachIMEInput(inputEl, {
      onChange: function (value, isComposing, activeCompIdx) {
        if (self.finished) return;
        if (!self.startTime && value.length > 0) {
          self.startTime = Date.now();
          self._ensureHudTimer();
        }
        self.currentTyped = value;
        self.currentComposing = isComposing;
        self.currentCompIdx = activeCompIdx;
        self._updatePromptDisplay();
        self._updateHud();
      },
      onEnter: function (finalValue) {
        if (self.finished) return;
        self._submitCurrentItem(finalValue);
      },
    });
  };

  TextPracticeMode.prototype._renderLongLines = function () {
    var self = this;
    var linesContainer = self.container.querySelector('#tp-long-lines');
    if (!linesContainer) return;

    linesContainer.innerHTML = '';
    var activeInputEl = null;

    self.items.forEach(function (lineText, idx) {
      var row = document.createElement('div');
      row.className = 'long-line-item';

      var numBadge = document.createElement('span');
      numBadge.className = 'long-line-num';
      numBadge.textContent = String(idx + 1);
      row.appendChild(numBadge);

      var body = document.createElement('div');
      body.className = 'long-line-body';

      var targetEl = document.createElement('div');
      targetEl.className = 'prompt-display prompt-display--long';

      if (idx < self.currentIndex) {
        row.classList.add('is-completed');
        var rec = self.records[idx] || { target: lineText, typed: '' };
        var completedRender = renderEvaluatedLineHTML(rec.target, rec.typed, false, -1);
        targetEl.innerHTML = completedRender.html;
        body.appendChild(targetEl);
      } else if (idx === self.currentIndex) {
        row.classList.add('is-active');
        targetEl.id = 'tp-prompt-display';
        var activeRender = renderEvaluatedLineHTML(
          lineText,
          self.currentTyped,
          self.currentComposing,
          self.currentCompIdx
        );
        targetEl.innerHTML = activeRender.html;
        body.appendChild(targetEl);

        var inputEl = document.createElement('input');
        inputEl.type = 'text';
        inputEl.id = 'tp-typing-input';
        inputEl.className = 'typing-input typing-input--long';
        inputEl.setAttribute('autocomplete', 'off');
        inputEl.setAttribute('autocorrect', 'off');
        inputEl.setAttribute('autocapitalize', 'off');
        inputEl.setAttribute('spellcheck', 'false');
        if (self.app && typeof self.app.applyInputMode === 'function') {
          self.app.applyInputMode(inputEl, self.currentIndex < self.items.length - 1 ? 'next' : 'send');
        }
        inputEl.placeholder =
          self.lang === 'ko'
            ? '현재 줄을 입력하고 Enter를 누르세요...'
            : 'Type this line and press Enter...';
        body.appendChild(inputEl);
        activeInputEl = inputEl;
      } else {
        row.classList.add('is-upcoming');
        targetEl.textContent = lineText;
        body.appendChild(targetEl);
      }

      row.appendChild(body);
      linesContainer.appendChild(row);
    });

    if (activeInputEl) {
      self._bindImeToInput(activeInputEl);
      try {
        activeInputEl.focus({ preventScroll: true });
      } catch (err) {
        activeInputEl.focus();
      }
      if (typeof activeInputEl.scrollIntoView === 'function') {
        try {
          activeInputEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        } catch (err) {
          activeInputEl.scrollIntoView(false);
        }
      }
    }
  };

  TextPracticeMode.prototype._updatePromptDisplay = function () {
    var target = this.items[this.currentIndex] || '';
    var promptEl = this.container.querySelector('#tp-prompt-display');
    var counterEl = this.container.querySelector('#tp-char-counter');

    if (promptEl) {
      var rendered = renderEvaluatedLineHTML(
        target,
        this.currentTyped,
        this.currentComposing,
        this.currentCompIdx
      );
      promptEl.innerHTML = rendered.html;
    }

    if (counterEl) {
      counterEl.textContent = this.currentTyped.length + ' / ' + target.length;
    }
  };

  TextPracticeMode.prototype._updateUpcomingPreview = function () {
    var previewEl = this.container.querySelector('#tp-upcoming-preview');
    if (!previewEl) return;

    if (this.currentIndex + 1 >= this.items.length) {
      previewEl.innerHTML =
        '<span class="upcoming-label">안내</span>' +
        '<span class="upcoming-value">마지막 항목입니다. 입력 후 Enter를 누르면 결과 창이 표시됩니다.</span>';
      return;
    }

    if (this.modeType === 'word') {
      var nextWords = this.items.slice(this.currentIndex + 1, this.currentIndex + 6);
      previewEl.innerHTML =
        '<span class="upcoming-label">다음 낱말</span>' +
        '<div class="upcoming-chips">' +
        nextWords.map(function (w) { return '<span class="upcoming-chip">' + escapeHtml(w) + '</span>'; }).join('') +
        '</div>';
    } else {
      previewEl.innerHTML =
        '<span class="upcoming-label">다음 문장</span>' +
        '<span class="upcoming-value">' + escapeHtml(this.items[this.currentIndex + 1]) + '</span>';
    }
  };

  TextPracticeMode.prototype._updateHud = function () {
    var progressEl = this.container.querySelector('#tp-progress');
    var accuracyEl = this.container.querySelector('#tp-accuracy');
    var typosEl = this.container.querySelector('#tp-typos');
    var cpmEl = this.container.querySelector('#tp-cpm');
    var wpmEl = this.container.querySelector('#tp-wpm');
    var barEl = this.container.querySelector('#tp-progress-bar');

    var displayIdx = Math.min(this.currentIndex + 1, this.items.length);
    var unit = this.modeType === 'long' ? '줄' : '';
    if (progressEl) {
      progressEl.textContent = displayIdx + ' / ' + this.items.length + unit;
    }

    if (barEl && this.items.length > 0) {
      barEl.style.width = Math.round((this.currentIndex / this.items.length) * 100) + '%';
    }

    // Compute live accuracy & speed combining completed records + committed portion of active line
    var liveRecords = this.records.slice();
    var activeTarget = this.items[this.currentIndex] || '';
    var committedTyped = this.currentTyped;
    if (this.currentComposing && committedTyped.length > 0) {
      // Exclude actively composing character from live typo/accuracy math
      committedTyped = committedTyped.slice(0, this.currentCompIdx >= 0 ? this.currentCompIdx : committedTyped.length - 1);
    }

    if (committedTyped.length > 0) {
      var partialLen = Math.min(activeTarget.length, committedTyped.length);
      liveRecords.push({
        target: activeTarget.slice(0, partialLen),
        typed: committedTyped,
      });
    }

    var elapsedMs = this.startTime ? Date.now() - this.startTime : 0;
    var stats = TypingApp.IMEEvaluator.computeSetStats(liveRecords, elapsedMs, this.lang);

    if (accuracyEl) accuracyEl.textContent = stats.accuracy.toFixed(1) + '%';
    if (typosEl) typosEl.textContent = String(stats.typoChars);
    if (cpmEl) cpmEl.textContent = (this.startTime ? stats.cpm : 0) + ' CPM';
    if (wpmEl) wpmEl.textContent = String(this.startTime ? stats.wpm : 0);
  };

  TextPracticeMode.prototype._submitCurrentItem = function (finalTyped) {
    var target = this.items[this.currentIndex] || '';
    var typed = typeof finalTyped === 'string' ? finalTyped : this.currentTyped;

    if (typed.length < target.length) {
      var inputEl = this.container.querySelector('#tp-typing-input');
      if (inputEl) {
        inputEl.classList.remove('is-shake');
        void inputEl.offsetWidth;
        inputEl.classList.add('is-shake');
        inputEl.focus();
      }
      this.app.showToast('예시 글자를 끝까지 입력한 후 Enter 키를 눌러 주세요.');
      return;
    }

    if (!this.startTime) {
      this.startTime = Date.now();
    }

    this.records.push({
      target: target,
      typed: typed,
    });

    this.currentTyped = '';
    this.currentComposing = false;
    this.currentCompIdx = -1;
    this.currentIndex++;

    if (this.currentIndex >= this.items.length) {
      this._finishSet();
    } else {
      if (this.imeHandle) {
        this.imeHandle.reset(true);
      }
      this._renderActiveItem();
      this._updateHud();
    }
  };

  TextPracticeMode.prototype._finishSet = function () {
    var self = this;
    self.finished = true;
    self._stopHudTimer();
    self._destroyIme();

    var barEl = self.container.querySelector('#tp-progress-bar');
    if (barEl) barEl.style.width = '100%';

    var elapsedMs = self.startTime ? Date.now() - self.startTime : 1000;
    var stats = TypingApp.IMEEvaluator.computeSetStats(self.records, elapsedMs, self.lang);

    var modeNames = {
      word: '낱말 연습',
      short: '단문장 연습',
      long: '장문장 연습',
    };

    var subtitle = '';
    if (self.modeType === 'long') {
      var passages = self._getData().longPassages;
      subtitle = passages[self.passageIndex].title;
    } else {
      subtitle = (self.lang === 'ko' ? '한글 ' : '영어 ') + self.items.length + (self.modeType === 'word' ? '단어 세트' : '문장 세트');
    }

    var nextLabel = '다음 세트';
    if (self.modeType === 'long') {
      var totalPassages = self._getData().longPassages.length;
      var nextPassage = self._getData().longPassages[(self.passageIndex + 1) % totalPassages];
      nextLabel = '다음 지문 (' + nextPassage.title + ')';
    }

    self.app.showResult({
      mode: self.modeType,
      lang: self.lang,
      title: modeNames[self.modeType] + ' 완료',
      subtitle: subtitle,
      stats: stats,
      nextLabel: nextLabel,
      onRetry: function () {
        self._startNewSet();
      },
      onNext: function () {
        if (self.modeType === 'long') {
          var count = self._getData().longPassages.length;
          self.passageIndex = (self.passageIndex + 1) % count;
        }
        self._startNewSet();
      },
    });
  };

  TextPracticeMode.prototype.setLanguage = function (lang) {
    var normalized = lang === 'en' ? 'en' : 'ko';
    if (this.lang === normalized) return;
    this.lang = normalized;
    this.passageIndex = 0;
    this._startNewSet();
  };

  TextPracticeMode.prototype.destroy = function () {
    this.finished = true;
    this._stopHudTimer();
    this._destroyIme();
    this.container.innerHTML = '';
  };

  TypingApp.TextPracticeMode = TextPracticeMode;
})(window);
