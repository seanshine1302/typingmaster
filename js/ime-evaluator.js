(function (global) {
  'use strict';

  var TypingApp = (global.TypingApp = global.TypingApp || {});

  // Stroke counts matching 2-beolsik Hangul decomposition
  var CHO_STROKES = [
    1, 2, 1, 1, 2, 1, 1, 1, 2, 1,
    2, 1, 1, 2, 1, 1, 1, 1, 1,
  ]; // ㄱ ㄲ ㄴ ㄷ ㄸ ㄹ ㅁ ㅂ ㅃ ㅅ ㅆ ㅇ ㅈ ㅉ ㅊ ㅋ ㅌ ㅍ ㅎ

  var JUNG_STROKES = [
    1, 1, 1, 2, 1, 1, 1, 2, 1, 2,
    2, 2, 1, 1, 2, 2, 2, 1, 1, 2, 1,
  ]; // ㅏ ㅐ ㅑ ㅒ ㅓ ㅔ ㅕ ㅖ ㅗ ㅘ ㅙ ㅚ ㅛ ㅜ ㅝ ㅞ ㅟ ㅠ ㅡ ㅢ ㅣ

  var JONG_STROKES = [
    0, 1, 2, 2, 1, 2, 2, 1, 1, 2,
    2, 2, 2, 2, 2, 2, 1, 1, 2, 1,
    2, 1, 1, 1, 1, 1, 1, 1,
  ]; // '' ㄱ ㄲ ㄳ ㄴ ㄵ ㄶ ㄷ ㄹ ㄺ ㄻ ㄼ ㄽ ㄾ ㄿ ㅀ ㅁ ㅂ ㅄ ㅅ ㅆ ㅇ ㅈ ㅊ ㅋ ㅌ ㅍ ㅎ

  var DOUBLE_JAMO = {
    'ㄲ': 2, 'ㄳ': 2, 'ㄵ': 2, 'ㄶ': 2, 'ㄸ': 2, 'ㄺ': 2, 'ㄻ': 2, 'ㄼ': 2,
    'ㄽ': 2, 'ㄾ': 2, 'ㄿ': 2, 'ㅀ': 2, 'ㅃ': 2, 'ㅄ': 2, 'ㅆ': 2, 'ㅉ': 2,
    'ㅒ': 2, 'ㅖ': 2, 'ㅘ': 2, 'ㅙ': 2, 'ㅚ': 2, 'ㅝ': 2, 'ㅞ': 2, 'ㅟ': 2, 'ㅢ': 2,
  };

  function countKeystrokes(text, lang) {
    if (!text) return 0;
    if (lang === 'en') {
      return text.length;
    }

    var total = 0;
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      var code = text.charCodeAt(i);
      if (code >= 0xac00 && code <= 0xd7a3) {
        var offset = code - 0xac00;
        var cho = Math.floor(offset / (21 * 28));
        var jung = Math.floor((offset % (21 * 28)) / 28);
        var jong = offset % 28;
        total += CHO_STROKES[cho] + JUNG_STROKES[jung] + JONG_STROKES[jong];
      } else if (code >= 0x3131 && code <= 0x3163) {
        total += DOUBLE_JAMO[ch] || 1;
      } else {
        total += 1;
      }
    }
    return total;
  }

  function evaluateInput(target, typed, isComposing, activeComposingIndex) {
    var safeTarget = target || '';
    var safeTyped = typed || '';
    var composing = Boolean(isComposing && safeTyped.length > 0);
    var compIdx = composing
      ? (typeof activeComposingIndex === 'number' && activeComposingIndex >= 0
          ? Math.min(activeComposingIndex, safeTyped.length - 1)
          : safeTyped.length - 1)
      : -1;

    var chars = [];
    var extra = [];
    var correctCount = 0;
    var typoCount = 0;
    var composingCount = 0;

    for (var i = 0; i < safeTarget.length; i++) {
      var targetChar = safeTarget[i];
      var typedChar = i < safeTyped.length ? safeTyped[i] : '';
      var status = 'pending';

      if (i < safeTyped.length) {
        if (composing && i === compIdx) {
          status = 'composing';
          composingCount++;
        } else if (typedChar === targetChar) {
          status = 'correct';
          correctCount++;
        } else {
          status = 'typo';
          typoCount++;
        }
      } else if (i === safeTyped.length) {
        status = 'current';
      }

      chars.push({
        index: i,
        targetChar: targetChar,
        typedChar: typedChar,
        status: status,
      });
    }

    for (var j = safeTarget.length; j < safeTyped.length; j++) {
      var extraStatus = composing && j === compIdx ? 'composing' : 'typo';
      if (extraStatus === 'composing') {
        composingCount++;
      } else {
        typoCount++;
      }
      extra.push({
        index: j,
        typedChar: safeTyped[j],
        status: extraStatus,
      });
    }

    return {
      chars: chars,
      extra: extra,
      correctCount: correctCount,
      typoCount: typoCount,
      composingCount: composingCount,
      isComplete: !composing && safeTyped.length >= safeTarget.length,
    };
  }

  function computeSetStats(records, elapsedMs, lang) {
    var safeRecords = Array.isArray(records) ? records : [];
    var correctChars = 0;
    var typoChars = 0;
    var correctKeystrokes = 0;

    for (var r = 0; r < safeRecords.length; r++) {
      var rec = safeRecords[r] || {};
      var target = rec.target || '';
      var typed = rec.typed || '';

      for (var i = 0; i < target.length; i++) {
        if (i < typed.length && typed[i] === target[i]) {
          correctChars++;
          correctKeystrokes += countKeystrokes(target[i], lang);
        } else {
          typoChars++;
        }
      }

      if (typed.length > target.length) {
        typoChars += typed.length - target.length;
      }
    }

    var totalChars = correctChars + typoChars;
    var accuracy = totalChars > 0 ? Number(((correctChars / totalChars) * 100).toFixed(1)) : 100;
    var typoRate = totalChars > 0 ? Number((100 - accuracy).toFixed(1)) : 0;

    var safeElapsedMs = Math.max(0, Number(elapsedMs) || 0);
    var elapsedSeconds = Math.round(safeElapsedMs / 1000);
    var elapsedMinutes = Math.max(safeElapsedMs / 60000, 1 / 600);

    var cpm = Math.round(correctKeystrokes / elapsedMinutes);
    var wpm = Math.round(cpm / 5);

    return {
      correctChars: correctChars,
      typoChars: typoChars,
      totalChars: totalChars,
      correctKeystrokes: correctKeystrokes,
      accuracy: accuracy,
      typoRate: typoRate,
      cpm: cpm,
      wpm: wpm,
      elapsedSeconds: elapsedSeconds,
    };
  }

  function attachIMEInput(inputEl, handlers) {
    if (!inputEl) {
      return {
        reset: function () {},
        destroy: function () {},
        isComposing: function () { return false; },
      };
    }

    var opts = handlers || {};
    var onChange = typeof opts.onChange === 'function' ? opts.onChange : function () {};
    var onEnter = typeof opts.onEnter === 'function' ? opts.onEnter : function () {};

    var isComposing = false;
    var activeComposingIndex = -1;
    var pendingEnter = false;
    var enterFallbackTimer = null;
    var lastEnterTs = 0;
    var destroyed = false;

    function isTouchDevice() {
      return Boolean(
        (TypingApp.MobileSupport && TypingApp.MobileSupport.isTouchCapable()) ||
        (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0)
      );
    }

    function computeComposingIndex() {
      var len = inputEl.value.length;
      if (len === 0) return -1;
      var caret = typeof inputEl.selectionEnd === 'number' ? inputEl.selectionEnd : len;
      return Math.max(0, Math.min(len - 1, caret - 1));
    }

    function clearTimers() {
      if (enterFallbackTimer !== null) {
        clearTimeout(enterFallbackTimer);
        enterFallbackTimer = null;
      }
    }

    function invokeEnterOnce(value) {
      var now = Date.now();
      if (now - lastEnterTs < 80) return;
      lastEnterTs = now;
      onEnter(value);
    }

    function flushEnter() {
      if (destroyed) return;
      clearTimers();
      if (!pendingEnter) return;
      pendingEnter = false;
      isComposing = false;
      activeComposingIndex = -1;
      invokeEnterOnce(inputEl.value);
    }

    function queueEnterSubmission(composingNow) {
      if (!composingNow) {
        pendingEnter = false;
        clearTimers();
        invokeEnterOnce(inputEl.value);
        return;
      }

      pendingEnter = true;
      clearTimers();
      enterFallbackTimer = setTimeout(function () {
        flushEnter();
      }, 60);
    }

    function handleCompositionStart() {
      if (destroyed) return;
      isComposing = true;
      activeComposingIndex = computeComposingIndex();
    }

    function handleCompositionUpdate() {
      if (destroyed) return;
      isComposing = true;
      activeComposingIndex = computeComposingIndex();
      onChange(inputEl.value, true, activeComposingIndex);
    }

    function handleCompositionEnd() {
      if (destroyed) return;
      isComposing = false;
      activeComposingIndex = -1;
      onChange(inputEl.value, false, -1);

      if (pendingEnter) {
        clearTimers();
        enterFallbackTimer = setTimeout(function () {
          flushEnter();
        }, 0);
      }
    }

    function handleInput(e) {
      if (destroyed) return;
      var eventComposing = Boolean(e && e.isComposing);
      if (eventComposing) {
        isComposing = true;
        activeComposingIndex = computeComposingIndex();
      } else if (!isComposing) {
        activeComposingIndex = -1;
      }
      onChange(inputEl.value, isComposing, activeComposingIndex);
    }

    function handleBeforeInput(e) {
      if (destroyed || !e) return;
      if (e.inputType === 'insertLineBreak' || e.inputType === 'insertParagraph') {
        if (typeof e.preventDefault === 'function') e.preventDefault();
        queueEnterSubmission(isComposing || Boolean(e.isComposing));
      }
    }

    function handleKeyDown(e) {
      if (destroyed) return;
      var isEnterKey =
        e.key === 'Enter' ||
        e.code === 'Enter' ||
        e.code === 'NumpadEnter' ||
        e.keyCode === 13;
      if (!isEnterKey) return;
      if (e.repeat) {
        e.preventDefault();
        return;
      }
      e.preventDefault();

      var composingNow = isComposing || e.isComposing || e.keyCode === 229;
      queueEnterSubmission(composingNow);
    }

    inputEl.addEventListener('compositionstart', handleCompositionStart);
    inputEl.addEventListener('compositionupdate', handleCompositionUpdate);
    inputEl.addEventListener('compositionend', handleCompositionEnd);
    inputEl.addEventListener('beforeinput', handleBeforeInput);
    inputEl.addEventListener('input', handleInput);
    inputEl.addEventListener('keydown', handleKeyDown);

    function safeFocus() {
      try {
        inputEl.focus({ preventScroll: true });
      } catch (err) {
        inputEl.focus();
      }
    }

    function reset(shouldRefocus) {
      clearTimers();
      var hadComposing = isComposing;
      pendingEnter = false;
      isComposing = false;
      activeComposingIndex = -1;
      inputEl.value = '';
      if (typeof inputEl.setSelectionRange === 'function') {
        try {
          inputEl.setSelectionRange(0, 0);
        } catch (err) {
          // Ignore if input type does not support selection range
        }
      }

      // On touch devices, calling blur() drops the active software/Bluetooth input focus
      if (hadComposing && !isTouchDevice() && typeof document !== 'undefined' && document.activeElement === inputEl) {
        inputEl.blur();
        if (shouldRefocus !== false) {
          safeFocus();
        }
      } else if (shouldRefocus !== false) {
        safeFocus();
      }
    }

    function destroy() {
      destroyed = true;
      clearTimers();
      inputEl.removeEventListener('compositionstart', handleCompositionStart);
      inputEl.removeEventListener('compositionupdate', handleCompositionUpdate);
      inputEl.removeEventListener('compositionend', handleCompositionEnd);
      inputEl.removeEventListener('beforeinput', handleBeforeInput);
      inputEl.removeEventListener('input', handleInput);
      inputEl.removeEventListener('keydown', handleKeyDown);
    }

    return {
      reset: reset,
      destroy: destroy,
      isComposing: function () { return isComposing; },
    };
  }

  TypingApp.IMEEvaluator = {
    countKeystrokes: countKeystrokes,
    evaluateInput: evaluateInput,
    computeSetStats: computeSetStats,
    attachIMEInput: attachIMEInput,
  };
})(window);
