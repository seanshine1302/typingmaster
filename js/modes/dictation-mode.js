(function (global) {
  'use strict';

  var TypingApp = (global.TypingApp = global.TypingApp || {});

  var PUNCT_RE = /[.,?!'"~:;()\-]/;
  var EN_ALPHA_RE = /[A-Za-z]/;
  var KO_CHAR_RE = /[가-힣ㄱ-ㅎㅏ-ㅣ]/;
  var CUSTOM_SETS_STORAGE_KEY = 'typingmaster_dictation_sets_v1';

  var LEVEL_META = [
    { id: 'all', label: '전체' },
    { id: 'easy', label: '초급(짧은 문장)' },
    { id: 'medium', label: '중급(일상·맞춤법)' },
    { id: 'hard', label: '고급(긴 문장·심화)' },
  ];

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

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

  function isPureLanguageSentence(sentence, lang) {
    var s = String(sentence || '').trim();
    if (!s) return false;
    if (lang === 'ko') {
      return !EN_ALPHA_RE.test(s) && KO_CHAR_RE.test(s);
    }
    return !KO_CHAR_RE.test(s) && EN_ALPHA_RE.test(s);
  }

  function dedupePureSentences(list, lang) {
    var seen = Object.create(null);
    var out = [];
    for (var i = 0; i < list.length; i++) {
      var s = String(list[i] || '').trim();
      if (!s || seen[s]) continue;
      if (!isPureLanguageSentence(s, lang)) continue;
      seen[s] = true;
      out.push(s);
    }
    return out;
  }

  function buildPoolForLevel(lang, level) {
    var data = lang === 'en' ? TypingApp.DATA_EN : TypingApp.DATA_KO;
    if (!data) return [];

    var levels = data.dictationLevels || {};
    var easyRaw = (levels.easy || []).slice();
    var mediumRaw = (levels.medium || []).slice();
    var hardRaw = (levels.hard || []).slice();

    if (Array.isArray(data.dictationSentences)) {
      easyRaw = easyRaw.concat(data.dictationSentences);
    }

    if (Array.isArray(data.shortSentences)) {
      for (var i = 0; i < data.shortSentences.length; i++) {
        var s = data.shortSentences[i];
        if (s.length <= 28) {
          easyRaw.push(s);
        } else {
          mediumRaw.push(s);
        }
      }
    }

    if (Array.isArray(data.longPassages)) {
      for (var p = 0; p < data.longPassages.length; p++) {
        var lines = data.longPassages[p] && data.longPassages[p].lines;
        if (Array.isArray(lines)) {
          hardRaw = hardRaw.concat(lines);
        }
      }
    }

    var easy = dedupePureSentences(easyRaw, lang);
    var medium = dedupePureSentences(mediumRaw, lang);
    var hard = dedupePureSentences(hardRaw, lang);

    if (level === 'easy') return easy;
    if (level === 'medium') return medium;
    if (level === 'hard') return hard;
    return dedupePureSentences([].concat(easy, medium, hard), lang);
  }

  function getGradeMeta(gradeId) {
    var grades = TypingApp.DATA_KO && Array.isArray(TypingApp.DATA_KO.dictationGrades)
      ? TypingApp.DATA_KO.dictationGrades
      : [];
    for (var i = 0; i < grades.length; i++) {
      if (grades[i].id === gradeId) return grades[i];
    }
    return null;
  }

  function buildPoolForGrade(gradeId) {
    var meta = getGradeMeta(gradeId);
    if (!meta || !Array.isArray(meta.sentences)) return [];
    return dedupePureSentences(meta.sentences, 'ko');
  }

  function loadLocalCustomSets() {
    try {
      var raw = global.localStorage ? global.localStorage.getItem(CUSTOM_SETS_STORAGE_KEY) : null;
      if (!raw) return [];
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  }

  function saveLocalCustomSets(sets) {
    try {
      if (global.localStorage) {
        global.localStorage.setItem(CUSTOM_SETS_STORAGE_KEY, JSON.stringify(sets || []));
      }
    } catch (_) {
      // ignore quota errors
    }
  }

  function normalizeCustomSet(raw) {
    if (!raw || typeof raw !== 'object') return null;
    var id = String(raw.id || '').trim();
    var title = String(raw.title || '').trim().slice(0, 40);
    var lang = raw.lang === 'en' ? 'en' : 'ko';
    var sentences = Array.isArray(raw.sentences) ? dedupePureSentences(raw.sentences, lang) : [];
    if (!id || !title || !sentences.length) return null;
    return {
      id: id,
      title: title,
      lang: lang,
      sentences: sentences,
      createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date().toISOString(),
    };
  }

  /**
   * Align target and typed strings using Levenshtein DP to pinpoint
   * exact character, spacing, and punctuation differences.
   */
  function evaluateDictation(target, typed) {
    var a = String(target || '');
    var b = String(typed || '');
    var n = a.length;
    var m = b.length;

    var dp = [];
    for (var i = 0; i <= n; i++) {
      dp[i] = new Array(m + 1);
      dp[i][0] = i;
    }
    for (var j = 0; j <= m; j++) {
      dp[0][j] = j;
    }

    for (var r = 1; r <= n; r++) {
      for (var c = 1; c <= m; c++) {
        if (a[r - 1] === b[c - 1]) {
          dp[r][c] = dp[r - 1][c - 1];
        } else {
          dp[r][c] = Math.min(
            dp[r - 1][c - 1] + 1,
            dp[r - 1][c] + 1,
            dp[r][c - 1] + 1
          );
        }
      }
    }

    var ops = [];
    var x = n;
    var y = m;
    while (x > 0 || y > 0) {
      if (x > 0 && y > 0 && a[x - 1] === b[y - 1]) {
        ops.push({ type: 'match', targetChar: a[x - 1], typedChar: b[y - 1] });
        x--;
        y--;
      } else if (x > 0 && y > 0 && dp[x][y] === dp[x - 1][y - 1] + 1) {
        ops.push({ type: 'replace', targetChar: a[x - 1], typedChar: b[y - 1] });
        x--;
        y--;
      } else if (x > 0 && dp[x][y] === dp[x - 1][y] + 1) {
        ops.push({ type: 'missing', targetChar: a[x - 1], typedChar: '' });
        x--;
      } else {
        ops.push({ type: 'extra', targetChar: '', typedChar: b[y - 1] });
        y--;
      }
    }
    ops.reverse();

    var matchCount = 0;
    var spaceErrors = 0;
    var punctErrors = 0;
    var charErrors = 0;
    var missingPeriod = false;

    for (var k = 0; k < ops.length; k++) {
      var op = ops[k];
      if (op.type === 'match') {
        matchCount++;
        continue;
      }
      var isSpace = op.targetChar === ' ' || op.typedChar === ' ';
      var isPunct = PUNCT_RE.test(op.targetChar) || PUNCT_RE.test(op.typedChar);

      if (op.type === 'missing' && op.targetChar === '.') {
        missingPeriod = true;
      }

      if (isSpace) {
        spaceErrors++;
      } else if (isPunct) {
        punctErrors++;
      } else {
        charErrors++;
      }
    }

    var denom = Math.max(n, m, 1);
    var accuracy = Number(((matchCount / denom) * 100).toFixed(1));
    var isExact = a === b;

    return {
      isExact: isExact,
      accuracy: accuracy,
      matchCount: matchCount,
      totalOps: denom,
      errorCount: denom - matchCount,
      spaceErrors: spaceErrors,
      punctErrors: punctErrors,
      charErrors: charErrors,
      missingPeriod: missingPeriod,
      ops: ops,
    };
  }

  function renderComparisonHTML(ops) {
    var typedHtml = '';
    var targetHtml = '';

    for (var i = 0; i < ops.length; i++) {
      var op = ops[i];
      if (op.type === 'match') {
        var safe = escapeHtml(op.targetChar);
        typedHtml += '<span class="dict-char dict-char--ok">' + safe + '</span>';
        targetHtml += '<span class="dict-char dict-char--ok">' + safe + '</span>';
      } else if (op.type === 'replace') {
        var tIsSpace = op.targetChar === ' ';
        var yIsSpace = op.typedChar === ' ';
        var tIsPunct = PUNCT_RE.test(op.targetChar);
        var yIsPunct = PUNCT_RE.test(op.typedChar);

        typedHtml +=
          '<span class="dict-char ' +
          (yIsSpace ? 'dict-char--space-err' : yIsPunct ? 'dict-char--punct-err' : 'dict-char--wrong') +
          '">' +
          (yIsSpace ? '␣' : escapeHtml(op.typedChar)) +
          '</span>';

        targetHtml +=
          '<span class="dict-char ' +
          (tIsSpace ? 'dict-char--space-miss' : tIsPunct ? 'dict-char--punct-miss' : 'dict-char--miss') +
          '">' +
          (tIsSpace ? '␣' : escapeHtml(op.targetChar)) +
          '</span>';
      } else if (op.type === 'missing') {
        var mIsSpace = op.targetChar === ' ';
        var mIsPunct = PUNCT_RE.test(op.targetChar);
        targetHtml +=
          '<span class="dict-char ' +
          (mIsSpace ? 'dict-char--space-miss' : mIsPunct ? 'dict-char--punct-miss' : 'dict-char--miss') +
          '" title="빠뜨린 부분">' +
          (mIsSpace ? '␣' : escapeHtml(op.targetChar)) +
          '</span>';
      } else if (op.type === 'extra') {
        var eIsSpace = op.typedChar === ' ';
        var eIsPunct = PUNCT_RE.test(op.typedChar);
        typedHtml +=
          '<span class="dict-char ' +
          (eIsSpace ? 'dict-char--space-err' : eIsPunct ? 'dict-char--punct-err' : 'dict-char--extra') +
          '" title="불필요하게 입력한 부분">' +
          (eIsSpace ? '␣' : escapeHtml(op.typedChar)) +
          '</span>';
      }
    }

    return {
      typedHtml: typedHtml,
      targetHtml: targetHtml,
    };
  }

  function DictationMode(container, app) {
    this.container = container;
    this.app = app;
    this.lang = app.getLanguage();
    this.sentenceCount = 5;
    this.level = 'all'; // 'all' | 'easy' | 'medium' | 'hard'
    this.grade = null;  // 'g1' ~ 'g6' (Korean elementary presets)

    this.shuffleQueues = Object.create(null);
    this.customSets = loadLocalCustomSets()
      .map(normalizeCustomSet)
      .filter(Boolean);
    this.activeCustomSet = null;
    this.isSetModalOpen = false;
    this.modalError = '';
    this.unsubDictationSets = null;

    this.speechSupported = Boolean(global.speechSynthesis && typeof global.SpeechSynthesisUtterance === 'function');
    this.speechRate = 0.9;
    this.autoPlay = true;
    this.showHint = false;
    this.isSpeaking = false;
    this.voices = [];

    this.items = [];
    this.currentIndex = 0;
    this.records = [];
    this.currentEval = null;
    this.currentTyped = '';

    this.startTime = null;
    this.itemStartTime = null;
    this.timerInterval = null;
    this.autoSpeakTimer = null;
    this.finished = false;

    this._onKeyDown = this._handleGlobalKeyDown.bind(this);
    this._onFirebaseReady = this._connectFirebaseSets.bind(this);
    document.addEventListener('keydown', this._onKeyDown);
    global.addEventListener('typingapp:firebase-ready', this._onFirebaseReady);

    this._loadVoices();
    this._connectFirebaseSets();
    this._startNewSet();
  }

  DictationMode.prototype._connectFirebaseSets = function () {
    var self = this;
    var bridge = TypingApp.FirebaseBridge;
    if (!bridge || !bridge.ready || typeof bridge.subscribeDictationSets !== 'function') return;
    if (this.unsubDictationSets) return;

    this.unsubDictationSets = bridge.subscribeDictationSets(
      function (remoteList) {
        var normalized = (remoteList || []).map(normalizeCustomSet).filter(Boolean);
        normalized.sort(function (a, b) {
          return String(b.createdAt).localeCompare(String(a.createdAt));
        });
        self.customSets = normalized;
        saveLocalCustomSets(normalized);

        if (self.activeCustomSet) {
          var updated = null;
          for (var i = 0; i < normalized.length; i++) {
            if (normalized[i].id === self.activeCustomSet.id) {
              updated = normalized[i];
              break;
            }
          }
          if (updated) {
            self.activeCustomSet = updated;
          }
        }

        if (self.isSetModalOpen) {
          self._render();
        }
      },
      function (err) {
        console.warn('[DictationMode] dictation_sets 구독 오류:', err);
      }
    );
  };

  DictationMode.prototype._drawFromShuffleQueue = function (pool, count, queueKey) {
    if (!pool || !pool.length) return [];
    var targetCount = Math.min(count, pool.length);
    var queue = this.shuffleQueues[queueKey];
    if (!Array.isArray(queue)) {
      queue = [];
    }

    var drawn = [];
    var drawnSet = Object.create(null);

    while (drawn.length < targetCount) {
      if (queue.length === 0) {
        // Refill queue with shuffled pool, avoiding immediate duplicates within this draw
        var remainingCandidates = [];
        var alreadyDrawn = [];
        for (var i = 0; i < pool.length; i++) {
          if (drawnSet[pool[i]]) alreadyDrawn.push(pool[i]);
          else remainingCandidates.push(pool[i]);
        }
        queue = shuffleArray(remainingCandidates).concat(shuffleArray(alreadyDrawn));
      }
      var nextItem = queue.shift();
      if (!drawnSet[nextItem]) {
        drawn.push(nextItem);
        drawnSet[nextItem] = true;
      }
    }

    this.shuffleQueues[queueKey] = queue;
    return drawn;
  };

  DictationMode.prototype._getActivePoolInfo = function () {
    if (this.activeCustomSet) {
      var customPool = dedupePureSentences(this.activeCustomSet.sentences, this.activeCustomSet.lang);
      return {
        pool: customPool,
        queueKey: 'custom:' + this.activeCustomSet.id,
        count: Math.min(this.sentenceCount, customPool.length),
      };
    }
    if (this.lang === 'ko' && this.grade) {
      var gradePool = buildPoolForGrade(this.grade);
      return {
        pool: gradePool,
        queueKey: 'grade:' + this.grade,
        count: Math.min(this.sentenceCount, gradePool.length),
      };
    }
    var pool = buildPoolForLevel(this.lang, this.level);
    return {
      pool: pool,
      queueKey: this.lang + ':' + this.level,
      count: Math.min(this.sentenceCount, pool.length),
    };
  };

  DictationMode.prototype._loadVoices = function () {
    var self = this;
    if (!this.speechSupported) return;
    try {
      this.voices = global.speechSynthesis.getVoices() || [];
      if (typeof global.speechSynthesis.addEventListener === 'function') {
        this._onVoicesChanged = function () {
          self.voices = global.speechSynthesis.getVoices() || [];
        };
        global.speechSynthesis.addEventListener('voiceschanged', this._onVoicesChanged);
      }
    } catch (_) {
      this.voices = [];
    }
  };

  DictationMode.prototype._pickVoice = function () {
    if (!this.voices || !this.voices.length) return null;
    var activeLang = this.activeCustomSet ? this.activeCustomSet.lang : this.lang;
    var prefix = activeLang === 'ko' ? 'ko' : 'en';
    var exact = activeLang === 'ko' ? 'ko-kr' : 'en-us';
    var fallback = null;
    for (var i = 0; i < this.voices.length; i++) {
      var v = this.voices[i];
      var vLang = String(v.lang || '').toLowerCase();
      if (vLang === exact) return v;
      if (!fallback && vLang.indexOf(prefix) === 0) fallback = v;
    }
    return fallback;
  };

  DictationMode.prototype._stopSpeech = function () {
    if (this.autoSpeakTimer) {
      clearTimeout(this.autoSpeakTimer);
      this.autoSpeakTimer = null;
    }
    if (this.speechSupported) {
      try {
        global.speechSynthesis.cancel();
      } catch (_) {
        // ignore
      }
    }
    this.isSpeaking = false;
    this._updateSpeechUI();
  };

  DictationMode.prototype._speakCurrent = function () {
    var self = this;
    var target = this.items[this.currentIndex];
    if (!target) return;

    if (!this.speechSupported) {
      this.app.showToast('이 브라우저는 음성 합성을 지원하지 않습니다.');
      return;
    }

    this._stopSpeech();

    try {
      var activeLang = this.activeCustomSet ? this.activeCustomSet.lang : this.lang;
      var utter = new global.SpeechSynthesisUtterance(target);
      utter.lang = activeLang === 'ko' ? 'ko-KR' : 'en-US';
      utter.rate = this.speechRate;
      var voice = this._pickVoice();
      if (voice) utter.voice = voice;

      utter.onstart = function () {
        self.isSpeaking = true;
        self._updateSpeechUI();
      };
      utter.onend = function () {
        self.isSpeaking = false;
        self._updateSpeechUI();
      };
      utter.onerror = function () {
        self.isSpeaking = false;
        self._updateSpeechUI();
      };

      this.isSpeaking = true;
      this._updateSpeechUI();
      global.speechSynthesis.speak(utter);
    } catch (_) {
      this.isSpeaking = false;
      this._updateSpeechUI();
      this.app.showToast('음성을 재생하는 중 오류가 발생했습니다.');
    }
  };

  DictationMode.prototype._updateSpeechUI = function () {
    var btn = this.container.querySelector('#dict-speak-btn');
    var statusEl = this.container.querySelector('#dict-speech-status');
    if (btn) {
      btn.classList.toggle('is-speaking', this.isSpeaking);
      var labelEl = btn.querySelector('.dict-speak-label');
      if (labelEl) {
        labelEl.textContent = this.isSpeaking ? '읽어주는 중...' : '문장 다시 듣기';
      }
    }
    if (statusEl) {
      statusEl.textContent = this.isSpeaking
        ? '잘 듣고 띄어쓰기와 문장부호까지 받아 적어 보세요.'
        : '소리를 듣고 아래 입력창에 문장을 받아 적으세요. (Alt+R 다시 듣기)';
    }
  };

  DictationMode.prototype._startNewSet = function () {
    this._stopSpeech();
    this._stopHudTimer();

    var info = this._getActivePoolInfo();
    this.items = this._drawFromShuffleQueue(info.pool, info.count, info.queueKey);
    this.currentIndex = 0;
    this.records = [];
    this.currentEval = null;
    this.currentTyped = '';
    this.startTime = null;
    this.itemStartTime = null;
    this.finished = false;

    this._render();
    this._scheduleAutoSpeak();
  };

  DictationMode.prototype._scheduleAutoSpeak = function () {
    var self = this;
    if (!this.autoPlay || !this.speechSupported || this.isSetModalOpen) return;
    if (this.autoSpeakTimer) clearTimeout(this.autoSpeakTimer);
    this.autoSpeakTimer = setTimeout(function () {
      self.autoSpeakTimer = null;
      if (!self.finished && !self.currentEval && !self.isSetModalOpen) {
        self._speakCurrent();
      }
    }, 260);
  };

  DictationMode.prototype._startHudTimer = function () {
    var self = this;
    if (this.timerInterval) return;
    this.timerInterval = setInterval(function () {
      self._updateHud();
    }, 300);
  };

  DictationMode.prototype._stopHudTimer = function () {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  };

  DictationMode.prototype._updateHud = function () {
    var elapsedEl = this.container.querySelector('#dict-hud-time');
    if (elapsedEl) {
      var secs = this.startTime ? Math.floor((Date.now() - this.startTime) / 1000) : 0;
      var mm = String(Math.floor(secs / 60)).padStart(2, '0');
      var ss = String(secs % 60).padStart(2, '0');
      elapsedEl.textContent = mm + ':' + ss;
    }

    var accEl = this.container.querySelector('#dict-hud-acc');
    if (accEl) {
      if (this.records.length === 0) {
        accEl.textContent = '-';
      } else {
        var sum = 0;
        for (var i = 0; i < this.records.length; i++) sum += this.records[i].accuracy;
        accEl.textContent = (sum / this.records.length).toFixed(1) + '%';
      }
    }
  };

  DictationMode.prototype._submitCurrent = function () {
    var inputEl = this.container.querySelector('#dict-input');
    var rawVal = inputEl ? inputEl.value : this.currentTyped;
    var trimmedCheck = rawVal.trim();

    if (!trimmedCheck) {
      this.app.showToast('먼저 들은 문장을 입력해 주세요.');
      if (inputEl) inputEl.focus();
      return;
    }

    if (!this.startTime) {
      this.startTime = Date.now();
      this._startHudTimer();
    }

    var target = this.items[this.currentIndex];
    var result = evaluateDictation(target, rawVal);
    this.currentTyped = rawVal;
    this.currentEval = result;

    this.records.push({
      target: target,
      typed: rawVal,
      accuracy: result.accuracy,
      isExact: result.isExact,
      spaceErrors: result.spaceErrors,
      punctErrors: result.punctErrors,
      charErrors: result.charErrors,
      matchCount: result.matchCount,
      totalOps: result.totalOps,
      elapsedMs: this.itemStartTime ? Date.now() - this.itemStartTime : 0,
    });

    this._stopSpeech();
    this._render();
    this._updateHud();
  };

  DictationMode.prototype._goNext = function () {
    if (this.currentIndex + 1 < this.items.length) {
      this.currentIndex++;
      this.currentEval = null;
      this.currentTyped = '';
      this.itemStartTime = Date.now();
      this._render();
      this._scheduleAutoSpeak();
    } else {
      this._finishSet();
    }
  };

  DictationMode.prototype._finishSet = function () {
    this.finished = true;
    this._stopSpeech();
    this._stopHudTimer();

    var totalAcc = 0;
    var exactCount = 0;
    var totalSpaceErr = 0;
    var totalPunctErr = 0;
    var totalMatch = 0;
    var totalChars = 0;
    var totalTypedLen = 0;

    for (var i = 0; i < this.records.length; i++) {
      var r = this.records[i];
      totalAcc += r.accuracy;
      if (r.isExact) exactCount++;
      totalSpaceErr += r.spaceErrors;
      totalPunctErr += r.punctErrors;
      totalMatch += r.matchCount;
      totalChars += r.totalOps;
      totalTypedLen += r.typed.length;
    }

    var avgAccuracy = this.records.length ? Number((totalAcc / this.records.length).toFixed(1)) : 0;
    var typoRate = Number(Math.max(0, 100 - avgAccuracy).toFixed(1));
    var elapsedSec = this.startTime ? Math.max(1, Math.round((Date.now() - this.startTime) / 1000)) : 1;
    var elapsedMin = Math.max(elapsedSec / 60, 0.05);
    var activeLang = this.activeCustomSet ? this.activeCustomSet.lang : this.lang;

    var cpm = Math.round((totalTypedLen / elapsedMin) * (activeLang === 'ko' ? 2.2 : 1));
    var wpm = Math.round(totalTypedLen / 5 / elapsedMin);

    var subtitle =
      this.items.length +
      '문장 중 ' +
      exactCount +
      '문장 완벽 일치 · 띄어쓰기 오류 ' +
      totalSpaceErr +
      '건 · 문장부호 오류 ' +
      totalPunctErr +
      '건';

    var self = this;
    this.app.showResultModal({
      mode: 'dictation',
      lang: activeLang,
      title: this.activeCustomSet ? '문제집 완료: ' + this.activeCustomSet.title : '받아쓰기 완료!',
      subtitle: subtitle,
      stats: {
        accuracy: avgAccuracy,
        typoRate: typoRate,
        cpm: cpm,
        wpm: wpm,
        correctChars: totalMatch,
        typoChars: Math.max(0, totalChars - totalMatch),
        elapsedSeconds: elapsedSec,
      },
      nextLabel: '새 문장 풀기',
      onRetry: function () {
        self._startNewSet();
      },
      onNext: function () {
        self._startNewSet();
      },
    });
  };

  DictationMode.prototype._handleGlobalKeyDown = function (e) {
    if (this.finished) return;
    if (e.key === 'Escape' && this.isSetModalOpen) {
      this.isSetModalOpen = false;
      this.modalError = '';
      this._render();
      return;
    }
    if (!this.isSetModalOpen && e.altKey && (e.key === 'r' || e.key === 'R' || e.code === 'KeyR')) {
      e.preventDefault();
      this._speakCurrent();
    }
  };

  DictationMode.prototype._saveCustomSet = function (title, lang, rawText) {
    var cleanTitle = String(title || '').trim().slice(0, 40);
    if (!cleanTitle) {
      this.modalError = '문제집 제목을 입력해 주세요.';
      this._render();
      return;
    }

    var lines = String(rawText || '')
      .split(/\r?\n/)
      .map(function (l) {
        return l.trim();
      })
      .filter(Boolean);

    if (!lines.length) {
      this.modalError = '줄바꿈으로 구분된 문장을 최소 1개 이상 입력해 주세요.';
      this._render();
      return;
    }

    var filtered = dedupePureSentences(lines, lang);
    if (!filtered.length) {
      this.modalError =
        lang === 'ko'
          ? '한글 문제집에는 영어 알파벳이 포함되지 않은 순수 한글 문장만 저장할 수 있습니다.'
          : '영어 문제집에는 한글이 포함되지 않은 순수 영어 문장만 저장할 수 있습니다.';
      this._render();
      return;
    }

    var skipped = lines.length - filtered.length;
    var newSet = {
      id: 'dset_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6),
      title: cleanTitle,
      lang: lang,
      sentences: filtered,
      createdAt: new Date().toISOString(),
    };

    this.customSets = [newSet].concat(this.customSets);
    saveLocalCustomSets(this.customSets);

    var bridge = TypingApp.FirebaseBridge;
    if (bridge && bridge.ready && typeof bridge.upsertDictationSet === 'function') {
      bridge.upsertDictationSet(newSet).catch(function (err) {
        console.warn('[DictationMode] Firestore 문제집 저장 실패:', err);
      });
    }

    this.modalError = '';
    this.isSetModalOpen = false;
    this.activeCustomSet = newSet;
    this.app.showToast(
      skipped > 0
        ? '문제집 저장 완료 (' + filtered.length + '문장, 언어 혼용/중복 ' + skipped + '줄 제외)'
        : '문제집 "' + newSet.title + '" (' + filtered.length + '문장)을 저장했습니다.'
    );
    this._startNewSet();
  };

  DictationMode.prototype._deleteCustomSet = function (setId) {
    this.customSets = this.customSets.filter(function (s) {
      return s.id !== setId;
    });
    saveLocalCustomSets(this.customSets);

    if (this.activeCustomSet && this.activeCustomSet.id === setId) {
      this.activeCustomSet = null;
      this._startNewSet();
    }

    var bridge = TypingApp.FirebaseBridge;
    if (bridge && bridge.ready && typeof bridge.deleteDictationSet === 'function') {
      bridge.deleteDictationSet(setId).catch(function (err) {
        console.warn('[DictationMode] Firestore 문제집 삭제 실패:', err);
      });
    }

    this.app.showToast('문제집을 삭제했습니다.');
    this._render();
  };

  DictationMode.prototype._buildHintText = function (target) {
    var words = target.trim().split(/\s+/).length;
    var lastChar = target.slice(-1);
    var punctNote = PUNCT_RE.test(lastChar) ? ' · 끝 문장부호 포함' : '';
    return '총 ' + target.length + '자 · ' + words + '어절' + punctNote;
  };

  DictationMode.prototype._renderFeedbackHTML = function () {
    if (!this.currentEval) return '';
    var ev = this.currentEval;
    var comp = renderComparisonHTML(ev.ops);

    var badges = [];
    if (ev.isExact) {
      badges.push('<span class="dict-badge dict-badge--ok">완벽해요! 띄어쓰기와 문장부호까지 정확합니다.</span>');
    } else {
      if (ev.missingPeriod) {
        badges.push('<span class="dict-badge dict-badge--punct">마침표(.)를 빠뜨렸어요</span>');
      } else if (ev.punctErrors > 0) {
        badges.push('<span class="dict-badge dict-badge--punct">문장부호 ' + ev.punctErrors + '곳 확인</span>');
      }
      if (ev.spaceErrors > 0) {
        badges.push('<span class="dict-badge dict-badge--space">띄어쓰기 ' + ev.spaceErrors + '곳 확인</span>');
      }
      if (ev.charErrors > 0) {
        badges.push('<span class="dict-badge dict-badge--wrong">글자 오타 ' + ev.charErrors + '자</span>');
      }
    }

    var isLast = this.currentIndex + 1 >= this.items.length;

    return (
      '<div class="dict-feedback-card ' + (ev.isExact ? 'is-exact' : 'has-errors') + '">' +
      '  <div class="dict-feedback-head">' +
      '    <div class="dict-feedback-badges">' + badges.join('') + '</div>' +
      '    <span class="dict-feedback-acc">일치율 <strong>' + ev.accuracy.toFixed(1) + '%</strong></span>' +
      '  </div>' +
      '  <div class="dict-compare-grid">' +
      '    <div class="dict-compare-row">' +
      '      <span class="dict-compare-label">내가 쓴 답</span>' +
      '      <div class="dict-compare-text">' + comp.typedHtml + '</div>' +
      '    </div>' +
      '    <div class="dict-compare-row">' +
      '      <span class="dict-compare-label">정답 문장</span>' +
      '      <div class="dict-compare-text">' + comp.targetHtml + '</div>' +
      '    </div>' +
      '  </div>' +
      '  <div class="dict-feedback-actions">' +
      '    <span class="dict-legend"><i class="legend-dot legend-dot--space"></i> ␣ 띄어쓰기 차이 · <i class="legend-dot legend-dot--punct"></i> 문장부호 · <i class="legend-dot legend-dot--wrong"></i> 글자 오타</span>' +
      '    <button type="button" class="btn btn-primary" id="dict-next-btn">' +
      (isLast ? '최종 결과 보기 (Enter)' : '다음 문장 (Enter)') +
      '    </button>' +
      '  </div>' +
      '</div>'
    );
  };

  DictationMode.prototype._renderSetModalHTML = function () {
    if (!this.isSetModalOpen) return '';
    var bridgeReady = Boolean(TypingApp.FirebaseBridge && TypingApp.FirebaseBridge.ready);
    var listHtml = '';

    if (!this.customSets.length) {
      listHtml = '<p class="dict-empty-sets">저장된 나만의 문제집이 아직 없습니다. 아래에서 새 문제집을 만들어 보세요.</p>';
    } else {
      listHtml = this.customSets
        .map(function (setObj) {
          var isCurrent = this.activeCustomSet && this.activeCustomSet.id === setObj.id;
          return (
            '<div class="dict-set-item ' + (isCurrent ? 'is-active' : '') + '">' +
            '  <div class="dict-set-info">' +
            '    <div class="dict-set-title-row">' +
            '      <span class="dict-set-lang-tag">' + (setObj.lang === 'en' ? '영어' : '한글') + '</span>' +
            '      <strong class="dict-set-name">' + escapeHtml(setObj.title) + '</strong>' +
            '      <span class="dict-set-count">' + setObj.sentences.length + '문장</span>' +
            '    </div>' +
            '  </div>' +
            '  <div class="dict-set-actions">' +
            '    <button type="button" class="btn btn-primary btn-sm dict-use-set-btn" data-set-id="' + escapeHtml(setObj.id) + '">시험 보기</button>' +
            '    <button type="button" class="btn btn-ghost btn-sm dict-del-set-btn" data-set-id="' + escapeHtml(setObj.id) + '">삭제</button>' +
            '  </div>' +
            '</div>'
          );
        }, this)
        .join('');
    }

    return (
      '<div class="dict-modal-backdrop" id="dict-modal-backdrop">' +
      '  <div class="dict-modal" role="dialog" aria-modal="true" aria-labelledby="dict-modal-title">' +
      '    <div class="dict-modal-head">' +
      '      <div>' +
      '        <h2 class="dict-modal-title" id="dict-modal-title">나만의 받아쓰기 문제집</h2>' +
      '        <p class="dict-modal-sub">' +
      (bridgeReady
        ? '클라우드(Firestore)와 실시간 동기화되어 PC·태블릿·스마트폰 어디서든 불러올 수 있습니다.'
        : '현재 로컬 저장소에 저장됩니다.') +
      '</p>' +
      '      </div>' +
      '      <button type="button" class="modal-close-btn" id="dict-modal-close" aria-label="창 닫기">✕</button>' +
      '    </div>' +
      '    <div class="dict-modal-body">' +
      '      <div class="dict-modal-section">' +
      '        <h3 class="section-heading">저장된 문제집 (' + this.customSets.length + '개)</h3>' +
      '        <div class="dict-set-list">' + listHtml + '</div>' +
      '      </div>' +
      '      <form class="dict-modal-section dict-new-set-form" id="dict-new-set-form">' +
      '        <h3 class="section-heading">새 문제집 직접 입력</h3>' +
      '        <div class="dict-form-row">' +
      '          <input type="text" class="typing-input dict-set-title-input" id="dict-set-title-input" maxlength="40" placeholder="문제집 제목 (예: 3학년 받아쓰기 1단원)..." />' +
      '          <select class="dict-set-lang-select" id="dict-set-lang-select" aria-label="문제집 언어">' +
      '            <option value="ko" ' + (this.lang === 'ko' ? 'selected' : '') + '>한글</option>' +
      '            <option value="en" ' + (this.lang === 'en' ? 'selected' : '') + '>영어</option>' +
      '          </select>' +
      '        </div>' +
      '        <textarea class="typing-input dict-set-textarea" id="dict-set-textarea" rows="5" placeholder="줄바꿈(Enter)으로 구분해 여러 문장을 한 번에 붙여넣으세요.&#10;예)&#10;오늘 날씨가 정말 맑고 따뜻합니다.&#10;할 수 있다고 믿으면 절반은 이룬 것입니다."></textarea>' +
      (this.modalError ? '<p class="form-error-msg">' + escapeHtml(this.modalError) + '</p>' : '') +
      '        <div class="dict-form-footer">' +
      '          <button type="submit" class="btn btn-primary">저장하고 바로 시험 보기</button>' +
      '        </div>' +
      '      </form>' +
      '    </div>' +
      '  </div>' +
      '</div>'
    );
  };

  DictationMode.prototype._render = function () {
    var target = this.items[this.currentIndex] || '';
    var progressPct = Math.round(((this.currentIndex + (this.currentEval ? 1 : 0)) / Math.max(1, this.items.length)) * 100);
    var isEvaluated = Boolean(this.currentEval);
    var activeInfo = this._getActivePoolInfo();
    var activeLang = this.activeCustomSet ? this.activeCustomSet.lang : this.lang;

    var levelButtonsHtml = LEVEL_META.map(function (lv) {
      var active = !this.activeCustomSet && !this.grade && this.level === lv.id;
      return (
        '<button type="button" class="dict-level-btn ' +
        (active ? 'is-active' : '') +
        '" data-level="' +
        lv.id +
        '">' +
        escapeHtml(lv.label) +
        '</button>'
      );
    }, this).join('');

    var gradesList = this.lang === 'ko' && TypingApp.DATA_KO && Array.isArray(TypingApp.DATA_KO.dictationGrades)
      ? TypingApp.DATA_KO.dictationGrades
      : [];
    var gradeButtonsHtml = gradesList.map(function (gr) {
      var active = !this.activeCustomSet && this.grade === gr.id;
      return (
        '<button type="button" class="dict-grade-btn ' +
        (active ? 'is-active' : '') +
        '" data-grade="' +
        escapeHtml(gr.id) +
        '">' +
        escapeHtml(gr.label) +
        '</button>'
      );
    }, this).join('');
    var activeGradeMeta = !this.activeCustomSet && this.lang === 'ko' && this.grade ? getGradeMeta(this.grade) : null;

    this.container.innerHTML =
      '<div class="practice-shell dictation-shell">' +
      '  <div class="practice-hud">' +
      '    <div class="hud-left">' +
      '      <span class="hud-mode-pill">받아쓰기 · ' + (activeLang === 'ko' ? '한글' : '영어') + '</span>' +
      '      <span class="hud-progress-text">' + (this.currentIndex + 1) + ' / ' + this.items.length + ' 문장</span>' +
      '      <span class="dict-pool-badge">출제 풀 ' + activeInfo.pool.length + '문장</span>' +
      '    </div>' +
      '    <div class="hud-metrics">' +
      '      <div class="hud-stat"><span class="hud-stat-label">평균 일치율</span><strong class="hud-stat-val" id="dict-hud-acc">-</strong></div>' +
      '      <div class="hud-stat"><span class="hud-stat-label">시간</span><strong class="hud-stat-val" id="dict-hud-time">00:00</strong></div>' +
      '      <button type="button" class="btn btn-secondary btn-sm" id="dict-open-sets-btn">직접 문장 입력 / 문제집</button>' +
      '      <button type="button" class="btn btn-ghost btn-sm" id="dict-restart-btn">새 문제</button>' +
      '    </div>' +
      '  </div>' +
      '  <div class="hud-progress-track"><div class="hud-progress-fill" style="width:' + progressPct + '%"></div></div>' +
      '  <div class="dict-level-bar">' +
      (this.activeCustomSet
        ? '<div class="dict-custom-banner">' +
          '  <span>📘 현재 문제집: <strong>' + escapeHtml(this.activeCustomSet.title) + '</strong> (' + this.activeCustomSet.sentences.length + '문장)</span>' +
          '  <button type="button" class="btn btn-ghost btn-sm" id="dict-exit-custom-btn">기본 문장 풀로 돌아가기</button>' +
          '</div>'
        : '<div class="dict-level-group" role="group" aria-label="받아쓰기 난이도">' +
          '  <span class="dict-toolbar-label">난이도</span>' +
          levelButtonsHtml +
          '</div>' +
          (gradeButtonsHtml
            ? '<div class="dict-grade-group" role="group" aria-label="학년별 받아쓰기">' +
              '  <span class="dict-toolbar-label">학년별 받아쓰기</span>' +
              gradeButtonsHtml +
              '</div>'
            : '')) +
      '  </div>' +
      (activeGradeMeta
        ? '<div class="dict-grade-tip" role="note">💡 <strong>' + escapeHtml(activeGradeMeta.label) + '</strong> — ' + escapeHtml(activeGradeMeta.tip) + '</div>'
        : '') +
      '  <section class="dict-card">' +
      '    <div class="dict-toolbar">' +
      '      <div class="dict-rate-group" role="group" aria-label="읽기 속도">' +
      '        <span class="dict-toolbar-label">속도</span>' +
      '        <button type="button" class="dict-rate-btn ' + (this.speechRate === 0.7 ? 'is-active' : '') + '" data-rate="0.7">천천히</button>' +
      '        <button type="button" class="dict-rate-btn ' + (this.speechRate === 0.9 ? 'is-active' : '') + '" data-rate="0.9">보통</button>' +
      '        <button type="button" class="dict-rate-btn ' + (this.speechRate === 1.1 ? 'is-active' : '') + '" data-rate="1.1">빠르게</button>' +
      '      </div>' +
      '      <div class="dict-toggles">' +
      '        <label class="dict-toggle-label"><input type="checkbox" id="dict-autoplay-chk" ' + (this.autoPlay ? 'checked' : '') + ' /> 자동 듣기</label>' +
      '        <label class="dict-toggle-label"><input type="checkbox" id="dict-hint-chk" ' + (this.showHint ? 'checked' : '') + ' /> 글자 수 힌트</label>' +
      '      </div>' +
      '    </div>' +
      '    <div class="dict-speaker-box">' +
      '      <button type="button" class="dict-speak-btn ' + (this.isSpeaking ? 'is-speaking' : '') + '" id="dict-speak-btn">' +
      '        <span class="dict-speaker-icon" aria-hidden="true">🔊</span>' +
      '        <span class="dict-speak-label">' + (this.isSpeaking ? '읽어주는 중...' : '문장 다시 듣기') + '</span>' +
      '      </button>' +
      '      <p class="dict-speech-status" id="dict-speech-status">' +
      (this.speechSupported
        ? '소리를 듣고 아래 입력창에 문장을 받아 적으세요. (Alt+R 다시 듣기)'
        : '이 브라우저는 음성 합성을 지원하지 않아 음성 재생이 제한됩니다.') +
      '</p>' +
      (this.showHint ? '<div class="dict-hint-pill">힌트: ' + escapeHtml(this._buildHintText(target)) + '</div>' : '') +
      '    </div>' +
      '    <form class="dict-input-form" id="dict-form">' +
      '      <input type="text" class="typing-input dict-input" id="dict-input"' +
      '        value="' + escapeHtml(this.currentTyped) + '"' +
      '        placeholder="' + (activeLang === 'ko' ? '들은 문장을 띄어쓰기와 마침표까지 정확히 적어보세요...' : 'Type the sentence with spacing and punctuation...') + '"' +
      '        autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"' +
      (isEvaluated ? ' readonly' : '') +
      '      />' +
      (isEvaluated
        ? ''
        : '<button type="submit" class="btn btn-primary dict-submit-btn" id="dict-submit-btn">채점하기 (Enter)</button>') +
      '    </form>' +
      this._renderFeedbackHTML() +
      '  </section>' +
      this._renderSetModalHTML() +
      '</div>';

    this._bindEvents();
  };

  DictationMode.prototype._bindEvents = function () {
    var self = this;

    var speakBtn = this.container.querySelector('#dict-speak-btn');
    if (speakBtn) {
      speakBtn.addEventListener('click', function () {
        self._speakCurrent();
        var inp = self.container.querySelector('#dict-input');
        if (inp && !self.currentEval) inp.focus();
      });
    }

    var restartBtn = this.container.querySelector('#dict-restart-btn');
    if (restartBtn) {
      restartBtn.addEventListener('click', function () {
        self._startNewSet();
      });
    }

    var openSetsBtn = this.container.querySelector('#dict-open-sets-btn');
    if (openSetsBtn) {
      openSetsBtn.addEventListener('click', function () {
        self._stopSpeech();
        self.isSetModalOpen = true;
        self.modalError = '';
        self._render();
      });
    }

    var exitCustomBtn = this.container.querySelector('#dict-exit-custom-btn');
    if (exitCustomBtn) {
      exitCustomBtn.addEventListener('click', function () {
        self.activeCustomSet = null;
        self._startNewSet();
      });
    }

    var levelBtns = this.container.querySelectorAll('.dict-level-btn');
    Array.prototype.forEach.call(levelBtns, function (btn) {
      btn.addEventListener('click', function () {
        self.activeCustomSet = null;
        self.grade = null;
        self.level = btn.dataset.level || 'all';
        self._startNewSet();
      });
    });

    var gradeBtns = this.container.querySelectorAll('.dict-grade-btn');
    Array.prototype.forEach.call(gradeBtns, function (btn) {
      btn.addEventListener('click', function () {
        self.activeCustomSet = null;
        self.grade = btn.dataset.grade || 'g1';
        self._startNewSet();
      });
    });

    var rateBtns = this.container.querySelectorAll('.dict-rate-btn');
    Array.prototype.forEach.call(rateBtns, function (btn) {
      btn.addEventListener('click', function () {
        self.speechRate = Number(btn.dataset.rate) || 0.9;
        self._render();
        self._speakCurrent();
      });
    });

    var autoChk = this.container.querySelector('#dict-autoplay-chk');
    if (autoChk) {
      autoChk.addEventListener('change', function () {
        self.autoPlay = autoChk.checked;
      });
    }

    var hintChk = this.container.querySelector('#dict-hint-chk');
    if (hintChk) {
      hintChk.addEventListener('change', function () {
        var inp = self.container.querySelector('#dict-input');
        if (inp && !self.currentEval) self.currentTyped = inp.value;
        self.showHint = hintChk.checked;
        self._render();
      });
    }

    var form = this.container.querySelector('#dict-form');
    var inputEl = this.container.querySelector('#dict-input');

    if (inputEl && !this.isSetModalOpen) {
      var activeLang = this.activeCustomSet ? this.activeCustomSet.lang : this.lang;
      if (TypingApp.MobileSupport && typeof TypingApp.MobileSupport.applyInputAttributes === 'function') {
        TypingApp.MobileSupport.applyInputAttributes(inputEl, activeLang);
      }

      inputEl.addEventListener('input', function () {
        self.currentTyped = inputEl.value;
        if (!self.startTime && inputEl.value.length > 0) {
          self.startTime = Date.now();
          self.itemStartTime = Date.now();
          self._startHudTimer();
        }
      });

      inputEl.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.isComposing && e.keyCode !== 229) {
          e.preventDefault();
          if (self.currentEval) {
            self._goNext();
          } else {
            self._submitCurrent();
          }
        }
      });

      if (!self.currentEval) {
        inputEl.focus({ preventScroll: true });
      }
    }

    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        if (self.currentEval) {
          self._goNext();
        } else {
          self._submitCurrent();
        }
      });
    }

    var nextBtn = this.container.querySelector('#dict-next-btn');
    if (nextBtn && !this.isSetModalOpen) {
      nextBtn.addEventListener('click', function () {
        self._goNext();
      });
      nextBtn.focus({ preventScroll: true });
    }

    // Modal events
    var modalBackdrop = this.container.querySelector('#dict-modal-backdrop');
    var modalCloseBtn = this.container.querySelector('#dict-modal-close');
    if (modalBackdrop) {
      modalBackdrop.addEventListener('click', function (e) {
        if (e.target === modalBackdrop) {
          self.isSetModalOpen = false;
          self.modalError = '';
          self._render();
        }
      });
    }
    if (modalCloseBtn) {
      modalCloseBtn.addEventListener('click', function () {
        self.isSetModalOpen = false;
        self.modalError = '';
        self._render();
      });
    }

    var useSetBtns = this.container.querySelectorAll('.dict-use-set-btn');
    Array.prototype.forEach.call(useSetBtns, function (btn) {
      btn.addEventListener('click', function () {
        var setId = btn.dataset.setId;
        for (var i = 0; i < self.customSets.length; i++) {
          if (self.customSets[i].id === setId) {
            self.activeCustomSet = self.customSets[i];
            self.isSetModalOpen = false;
            self.modalError = '';
            self._startNewSet();
            return;
          }
        }
      });
    });

    var delSetBtns = this.container.querySelectorAll('.dict-del-set-btn');
    Array.prototype.forEach.call(delSetBtns, function (btn) {
      btn.addEventListener('click', function () {
        self._deleteCustomSet(btn.dataset.setId);
      });
    });

    var newSetForm = this.container.querySelector('#dict-new-set-form');
    if (newSetForm) {
      newSetForm.addEventListener('submit', function (e) {
        e.preventDefault();
        var titleInp = self.container.querySelector('#dict-set-title-input');
        var langSel = self.container.querySelector('#dict-set-lang-select');
        var textArea = self.container.querySelector('#dict-set-textarea');
        self._saveCustomSet(
          titleInp ? titleInp.value : '',
          langSel ? langSel.value : self.lang,
          textArea ? textArea.value : ''
        );
      });
    }
  };

  DictationMode.prototype.destroy = function () {
    this._stopSpeech();
    this._stopHudTimer();
    document.removeEventListener('keydown', this._onKeyDown);
    global.removeEventListener('typingapp:firebase-ready', this._onFirebaseReady);
    if (typeof this.unsubDictationSets === 'function') {
      this.unsubDictationSets();
      this.unsubDictationSets = null;
    }
    if (this._onVoicesChanged && this.speechSupported && typeof global.speechSynthesis.removeEventListener === 'function') {
      global.speechSynthesis.removeEventListener('voiceschanged', this._onVoicesChanged);
    }
  };

  TypingApp.DictationMode = DictationMode;
})(window);
