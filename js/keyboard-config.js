(function (global) {
  'use strict';

  var TypingApp = (global.TypingApp = global.TypingApp || {});

  var FINGERS = {
    L5: {
      id: 'L5',
      hand: 'left',
      nameKo: '왼손 새끼손가락',
      shortLabel: '새끼',
      color: '#6366F1',
      softBg: '#EEF2FF',
    },
    L4: {
      id: 'L4',
      hand: 'left',
      nameKo: '왼손 약지',
      shortLabel: '약지',
      color: '#0EA5E9',
      softBg: '#E0F2FE',
    },
    L3: {
      id: 'L3',
      hand: 'left',
      nameKo: '왼손 중지',
      shortLabel: '중지',
      color: '#10B981',
      softBg: '#D1FAE5',
    },
    L2: {
      id: 'L2',
      hand: 'left',
      nameKo: '왼손 검지',
      shortLabel: '검지',
      color: '#F59E0B',
      softBg: '#FEF3C7',
    },
    L1: {
      id: 'L1',
      hand: 'left',
      nameKo: '왼손 엄지',
      shortLabel: '엄지',
      color: '#64748B',
      softBg: '#F1F5F9',
    },
    R1: {
      id: 'R1',
      hand: 'right',
      nameKo: '오른손 엄지',
      shortLabel: '엄지',
      color: '#64748B',
      softBg: '#F1F5F9',
    },
    R2: {
      id: 'R2',
      hand: 'right',
      nameKo: '오른손 검지',
      shortLabel: '검지',
      color: '#F59E0B',
      softBg: '#FEF3C7',
    },
    R3: {
      id: 'R3',
      hand: 'right',
      nameKo: '오른손 중지',
      shortLabel: '중지',
      color: '#10B981',
      softBg: '#D1FAE5',
    },
    R4: {
      id: 'R4',
      hand: 'right',
      nameKo: '오른손 약지',
      shortLabel: '약지',
      color: '#0EA5E9',
      softBg: '#E0F2FE',
    },
    R5: {
      id: 'R5',
      hand: 'right',
      nameKo: '오른손 새끼손가락',
      shortLabel: '새끼',
      color: '#6366F1',
      softBg: '#EEF2FF',
    },
  };

  var KEYBOARD_ROWS = [
    [
      { code: 'Backquote', width: 1, finger: 'L5', ko: { normal: '`', shift: '~' }, en: { normal: '`', shift: '~' } },
      { code: 'Digit1', width: 1, finger: 'L5', ko: { normal: '1', shift: '!' }, en: { normal: '1', shift: '!' } },
      { code: 'Digit2', width: 1, finger: 'L4', ko: { normal: '2', shift: '@' }, en: { normal: '2', shift: '@' } },
      { code: 'Digit3', width: 1, finger: 'L3', ko: { normal: '3', shift: '#' }, en: { normal: '3', shift: '#' } },
      { code: 'Digit4', width: 1, finger: 'L2', ko: { normal: '4', shift: '$' }, en: { normal: '4', shift: '$' } },
      { code: 'Digit5', width: 1, finger: 'L2', ko: { normal: '5', shift: '%' }, en: { normal: '5', shift: '%' } },
      { code: 'Digit6', width: 1, finger: 'R2', ko: { normal: '6', shift: '^' }, en: { normal: '6', shift: '^' } },
      { code: 'Digit7', width: 1, finger: 'R2', ko: { normal: '7', shift: '&' }, en: { normal: '7', shift: '&' } },
      { code: 'Digit8', width: 1, finger: 'R3', ko: { normal: '8', shift: '*' }, en: { normal: '8', shift: '*' } },
      { code: 'Digit9', width: 1, finger: 'R4', ko: { normal: '9', shift: '(' }, en: { normal: '9', shift: '(' } },
      { code: 'Digit0', width: 1, finger: 'R5', ko: { normal: '0', shift: ')' }, en: { normal: '0', shift: ')' } },
      { code: 'Minus', width: 1, finger: 'R5', ko: { normal: '-', shift: '_' }, en: { normal: '-', shift: '_' } },
      { code: 'Equal', width: 1, finger: 'R5', ko: { normal: '=', shift: '+' }, en: { normal: '=', shift: '+' } },
      { code: 'Backspace', width: 2, finger: 'R5', isModifier: true, label: 'Backspace' },
    ],
    [
      { code: 'Tab', width: 1.5, finger: 'L5', isModifier: true, label: 'Tab' },
      { code: 'KeyQ', width: 1, finger: 'L5', ko: { normal: 'ㅂ', shift: 'ㅃ' }, en: { normal: 'q', shift: 'Q' } },
      { code: 'KeyW', width: 1, finger: 'L4', ko: { normal: 'ㅈ', shift: 'ㅉ' }, en: { normal: 'w', shift: 'W' } },
      { code: 'KeyE', width: 1, finger: 'L3', ko: { normal: 'ㄷ', shift: 'ㄸ' }, en: { normal: 'e', shift: 'E' } },
      { code: 'KeyR', width: 1, finger: 'L2', ko: { normal: 'ㄱ', shift: 'ㄲ' }, en: { normal: 'r', shift: 'R' } },
      { code: 'KeyT', width: 1, finger: 'L2', ko: { normal: 'ㅅ', shift: 'ㅆ' }, en: { normal: 't', shift: 'T' } },
      { code: 'KeyY', width: 1, finger: 'R2', ko: { normal: 'ㅛ', shift: 'ㅛ' }, en: { normal: 'y', shift: 'Y' } },
      { code: 'KeyU', width: 1, finger: 'R2', ko: { normal: 'ㅕ', shift: 'ㅕ' }, en: { normal: 'u', shift: 'U' } },
      { code: 'KeyI', width: 1, finger: 'R3', ko: { normal: 'ㅑ', shift: 'ㅑ' }, en: { normal: 'i', shift: 'I' } },
      { code: 'KeyO', width: 1, finger: 'R4', ko: { normal: 'ㅐ', shift: 'ㅒ' }, en: { normal: 'o', shift: 'O' } },
      { code: 'KeyP', width: 1, finger: 'R5', ko: { normal: 'ㅔ', shift: 'ㅖ' }, en: { normal: 'p', shift: 'P' } },
      { code: 'BracketLeft', width: 1, finger: 'R5', ko: { normal: '[', shift: '{' }, en: { normal: '[', shift: '{' } },
      { code: 'BracketRight', width: 1, finger: 'R5', ko: { normal: ']', shift: '}' }, en: { normal: ']', shift: '}' } },
      { code: 'Backslash', width: 1.5, finger: 'R5', ko: { normal: '\\', shift: '|' }, en: { normal: '\\', shift: '|' } },
    ],
    [
      { code: 'CapsLock', width: 1.75, finger: 'L5', isModifier: true, label: 'Caps' },
      { code: 'KeyA', width: 1, finger: 'L5', ko: { normal: 'ㅁ', shift: 'ㅁ' }, en: { normal: 'a', shift: 'A' } },
      { code: 'KeyS', width: 1, finger: 'L4', ko: { normal: 'ㄴ', shift: 'ㄴ' }, en: { normal: 's', shift: 'S' } },
      { code: 'KeyD', width: 1, finger: 'L3', ko: { normal: 'ㅇ', shift: 'ㅇ' }, en: { normal: 'd', shift: 'D' } },
      { code: 'KeyF', width: 1, finger: 'L2', bump: true, ko: { normal: 'ㄹ', shift: 'ㄹ' }, en: { normal: 'f', shift: 'F' } },
      { code: 'KeyG', width: 1, finger: 'L2', ko: { normal: 'ㅎ', shift: 'ㅎ' }, en: { normal: 'g', shift: 'G' } },
      { code: 'KeyH', width: 1, finger: 'R2', ko: { normal: 'ㅗ', shift: 'ㅗ' }, en: { normal: 'h', shift: 'H' } },
      { code: 'KeyJ', width: 1, finger: 'R2', bump: true, ko: { normal: 'ㅓ', shift: 'ㅓ' }, en: { normal: 'j', shift: 'J' } },
      { code: 'KeyK', width: 1, finger: 'R3', ko: { normal: 'ㅏ', shift: 'ㅏ' }, en: { normal: 'k', shift: 'K' } },
      { code: 'KeyL', width: 1, finger: 'R4', ko: { normal: 'ㅣ', shift: 'ㅣ' }, en: { normal: 'l', shift: 'L' } },
      { code: 'Semicolon', width: 1, finger: 'R5', ko: { normal: ';', shift: ':' }, en: { normal: ';', shift: ':' } },
      { code: 'Quote', width: 1, finger: 'R5', ko: { normal: '\'', shift: '"' }, en: { normal: '\'', shift: '"' } },
      { code: 'Enter', width: 2.25, finger: 'R5', isModifier: true, label: 'Enter' },
    ],
    [
      { code: 'ShiftLeft', width: 2.25, finger: 'L5', isModifier: true, isShift: true, label: 'Shift' },
      { code: 'KeyZ', width: 1, finger: 'L5', ko: { normal: 'ㅋ', shift: 'ㅋ' }, en: { normal: 'z', shift: 'Z' } },
      { code: 'KeyX', width: 1, finger: 'L4', ko: { normal: 'ㅌ', shift: 'ㅌ' }, en: { normal: 'x', shift: 'X' } },
      { code: 'KeyC', width: 1, finger: 'L3', ko: { normal: 'ㅊ', shift: 'ㅊ' }, en: { normal: 'c', shift: 'C' } },
      { code: 'KeyV', width: 1, finger: 'L2', ko: { normal: 'ㅍ', shift: 'ㅍ' }, en: { normal: 'v', shift: 'V' } },
      { code: 'KeyB', width: 1, finger: 'L2', ko: { normal: 'ㅠ', shift: 'ㅠ' }, en: { normal: 'b', shift: 'B' } },
      { code: 'KeyN', width: 1, finger: 'R2', ko: { normal: 'ㅜ', shift: 'ㅜ' }, en: { normal: 'n', shift: 'N' } },
      { code: 'KeyM', width: 1, finger: 'R2', ko: { normal: 'ㅡ', shift: 'ㅡ' }, en: { normal: 'm', shift: 'M' } },
      { code: 'Comma', width: 1, finger: 'R3', ko: { normal: ',', shift: '<' }, en: { normal: ',', shift: '<' } },
      { code: 'Period', width: 1, finger: 'R4', ko: { normal: '.', shift: '>' }, en: { normal: '.', shift: '>' } },
      { code: 'Slash', width: 1, finger: 'R5', ko: { normal: '/', shift: '?' }, en: { normal: '/', shift: '?' } },
      { code: 'ShiftRight', width: 2.75, finger: 'R5', isModifier: true, isShift: true, label: 'Shift' },
    ],
    [
      { code: 'ControlLeft', width: 1.25, finger: 'L5', isModifier: true, label: 'Ctrl' },
      { code: 'MetaLeft', width: 1.25, finger: 'L5', isModifier: true, label: 'Win' },
      { code: 'AltLeft', width: 1.25, finger: 'L1', isModifier: true, label: 'Alt' },
      { code: 'Space', width: 6.25, finger: 'R1', isSpace: true, label: 'Space', ko: { normal: ' ', shift: ' ' }, en: { normal: ' ', shift: ' ' } },
      { code: 'AltRight', width: 1.25, finger: 'R1', isModifier: true, label: '한/영' },
      { code: 'MetaRight', width: 1.25, finger: 'R5', isModifier: true, label: 'Fn' },
      { code: 'ContextMenu', width: 1.25, finger: 'R5', isModifier: true, label: 'Menu' },
      { code: 'ControlRight', width: 1.25, finger: 'R5', isModifier: true, label: 'Ctrl' },
    ],
  ];

  var KEY_BY_CODE = {};
  var CHAR_MAP = { ko: {}, en: {} };

  KEYBOARD_ROWS.forEach(function (row) {
    row.forEach(function (key) {
      KEY_BY_CODE[key.code] = key;
      ['ko', 'en'].forEach(function (lang) {
        var mapping = key[lang];
        if (!mapping) return;
        if (mapping.normal && !CHAR_MAP[lang][mapping.normal]) {
          CHAR_MAP[lang][mapping.normal] = { key: key, needsShift: false };
        }
        if (mapping.shift && mapping.shift !== mapping.normal && !CHAR_MAP[lang][mapping.shift]) {
          CHAR_MAP[lang][mapping.shift] = { key: key, needsShift: true };
        }
      });
    });
  });

  function formatInstrumentParticle(fingerName) {
    // '새끼손가락' ends with batchim ㄱ -> '으로'; '약지/중지/검지/엄지' end with vowel -> '로'
    return fingerName.slice(-1) === '락' ? fingerName + '으로' : fingerName + '로';
  }

  function resolveTargetChar(char, lang) {
    var activeLang = lang === 'en' ? 'en' : 'ko';
    var entry = CHAR_MAP[activeLang][char];
    if (!entry) return null;

    var key = entry.key;
    var needsShift = entry.needsShift;
    var finger = FINGERS[key.finger];
    var baseRaw = key[activeLang].normal;
    var baseLabel = activeLang === 'en' && /^[a-z]$/.test(baseRaw) ? baseRaw.toUpperCase() : baseRaw;
    if (key.isSpace) {
      baseLabel = 'Space';
    }

    var shiftCode = null;
    var shiftFinger = null;
    var shiftSideLabel = null;
    var guideText = '';

    if (needsShift) {
      var useRightShift = finger.hand === 'left';
      shiftCode = useRightShift ? 'ShiftRight' : 'ShiftLeft';
      shiftFinger = useRightShift ? FINGERS.R5 : FINGERS.L5;
      shiftSideLabel = useRightShift ? '우측 Shift' : '좌측 Shift';
      guideText =
        formatInstrumentParticle(shiftFinger.nameKo) +
        ' ' +
        shiftSideLabel +
        ' + ' +
        formatInstrumentParticle(finger.nameKo) +
        ' ' +
        baseLabel;
    } else {
      guideText = formatInstrumentParticle(finger.nameKo) + ' ' + baseLabel + ' 키를 누르세요';
    }

    return {
      char: char,
      lang: activeLang,
      code: key.code,
      baseLabel: baseLabel,
      finger: finger,
      needsShift: needsShift,
      shiftCode: shiftCode,
      shiftFinger: shiftFinger,
      shiftSideLabel: shiftSideLabel,
      guideText: guideText,
    };
  }

  var KEYCODE_FALLBACK = {
    8: 'Backspace',
    9: 'Tab',
    13: 'Enter',
    20: 'CapsLock',
    27: 'Escape',
    32: 'Space',
    186: 'Semicolon',
    187: 'Equal',
    188: 'Comma',
    189: 'Minus',
    190: 'Period',
    191: 'Slash',
    192: 'Backquote',
    219: 'BracketLeft',
    220: 'Backslash',
    221: 'BracketRight',
    222: 'Quote',
  };

  function resolveEventCode(event) {
    if (!event) return { code: null, inferredShift: false };

    if (event.code && event.code !== 'Unidentified' && KEY_BY_CODE[event.code]) {
      return { code: event.code, inferredShift: false };
    }

    var kc = event.keyCode || event.which || 0;
    if (kc === 16 || event.key === 'Shift') {
      return { code: event.location === 2 ? 'ShiftRight' : 'ShiftLeft', inferredShift: false };
    }
    if (kc === 17 || event.key === 'Control') {
      return { code: event.location === 2 ? 'ControlRight' : 'ControlLeft', inferredShift: false };
    }
    if (kc === 18 || event.key === 'Alt') {
      return { code: event.location === 2 ? 'AltRight' : 'AltLeft', inferredShift: false };
    }
    if (kc >= 65 && kc <= 90) {
      return { code: 'Key' + String.fromCharCode(kc), inferredShift: false };
    }
    if (kc >= 48 && kc <= 57) {
      return { code: 'Digit' + String.fromCharCode(kc), inferredShift: false };
    }
    if (KEYCODE_FALLBACK[kc]) {
      return { code: KEYCODE_FALLBACK[kc], inferredShift: false };
    }

    if (event.key && event.key !== 'Unidentified' && event.key !== 'Process') {
      var entry = CHAR_MAP.ko[event.key] || CHAR_MAP.en[event.key];
      if (entry && entry.key) {
        return { code: entry.key.code, inferredShift: Boolean(entry.needsShift) };
      }
    }

    return { code: null, inferredShift: false };
  }

  function matchesPhysicalKey(event, targetInfo, heldShifts) {
    if (!event || !targetInfo) {
      return { matched: false, usedRecommendedShift: false };
    }
    var resolved = resolveEventCode(event);
    var codeMatched = resolved.code === targetInfo.code;
    var hasLeftHeld = Boolean(heldShifts && heldShifts.has('ShiftLeft'));
    var hasRightHeld = Boolean(heldShifts && heldShifts.has('ShiftRight'));
    var shiftHeld = Boolean(event.shiftKey || resolved.inferredShift || hasLeftHeld || hasRightHeld);

    var shiftRequirementMet = targetInfo.needsShift ? shiftHeld : !shiftHeld;
    var matched = codeMatched && shiftRequirementMet;

    var usedRecommendedShift = true;
    if (targetInfo.needsShift) {
      if (hasLeftHeld || hasRightHeld) {
        usedRecommendedShift = Boolean(heldShifts.has(targetInfo.shiftCode));
      } else {
        usedRecommendedShift = shiftHeld;
      }
    }

    return {
      matched: matched,
      usedRecommendedShift: usedRecommendedShift,
    };
  }

  TypingApp.KeyboardConfig = {
    FINGERS: FINGERS,
    KEYBOARD_ROWS: KEYBOARD_ROWS,
    KEY_BY_CODE: KEY_BY_CODE,
    resolveEventCode: resolveEventCode,
    resolveTargetChar: resolveTargetChar,
    matchesPhysicalKey: matchesPhysicalKey,
    formatInstrumentParticle: formatInstrumentParticle,
  };
})(window);
