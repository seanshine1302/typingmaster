(function (global) {
  'use strict';

  var TypingApp = (global.TypingApp = global.TypingApp || {});

  function createSvgEl(tag, attrs) {
    var el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        el.setAttribute(k, String(attrs[k]));
      });
    }
    return el;
  }

  var LEFT_FINGER_SHAPES = [
    { id: 'L5', label: '새끼', x: 22, y: 50, w: 26, h: 64, labelY: 16, rotate: null },
    { id: 'L4', label: '약지', x: 56, y: 28, w: 28, h: 84, labelY: 16, rotate: null },
    { id: 'L3', label: '중지', x: 92, y: 18, w: 28, h: 94, labelY: 16, rotate: null },
    { id: 'L2', label: '검지', x: 128, y: 30, w: 28, h: 82, labelY: 16, rotate: null },
    { id: 'L1', label: '엄지', x: 172, y: 80, w: 27, h: 58, labelY: 0, rotate: '24 185 109' },
  ];

  var RIGHT_FINGER_SHAPES = [
    { id: 'R1', label: '엄지', x: 61, y: 80, w: 27, h: 58, labelY: 0, rotate: '-24 74 109' },
    { id: 'R2', label: '검지', x: 104, y: 30, w: 28, h: 82, labelY: 16, rotate: null },
    { id: 'R3', label: '중지', x: 140, y: 18, w: 28, h: 94, labelY: 16, rotate: null },
    { id: 'R4', label: '약지', x: 176, y: 28, w: 28, h: 84, labelY: 16, rotate: null },
    { id: 'R5', label: '새끼', x: 212, y: 50, w: 26, h: 64, labelY: 16, rotate: null },
  ];

  function KeyboardView(container, options) {
    this.container = container;
    this.options = options || {};
    this.lang = this.options.lang === 'en' ? 'en' : 'ko';
    this.onKeyClick = typeof this.options.onKeyClick === 'function' ? this.options.onKeyClick : null;
    this.keyEls = {};
    this.fingerEls = {};
    this.currentTarget = null;
    this.flashTimers = {};
    this.render();
  }

  KeyboardView.prototype.render = function () {
    var self = this;
    var cfg = TypingApp.KeyboardConfig;
    self.container.innerHTML = '';
    self.keyEls = {};
    self.fingerEls = {};

    var wrapper = document.createElement('div');
    wrapper.className = 'keyboard-guide-wrapper';

    // 1. Virtual Keyboard
    var board = document.createElement('div');
    board.className = 'virtual-keyboard';
    board.setAttribute('aria-label', self.lang === 'ko' ? '한글 두벌식 가상 키보드' : '영문 QWERTY 가상 키보드');

    cfg.KEYBOARD_ROWS.forEach(function (row) {
      var rowEl = document.createElement('div');
      rowEl.className = 'keyboard-row';

      row.forEach(function (keyDef) {
        var fingerInfo = cfg.FINGERS[keyDef.finger];
        var keyBtn = document.createElement('button');
        keyBtn.type = 'button';
        keyBtn.className = 'keycap';
        keyBtn.dataset.code = keyDef.code;
        keyBtn.dataset.finger = keyDef.finger;
        keyBtn.style.flexGrow = String(keyDef.width);
        keyBtn.style.flexBasis = '0';
        keyBtn.style.setProperty('--finger-color', fingerInfo.color);

        if (keyDef.isModifier) keyBtn.classList.add('keycap--mod');
        if (keyDef.isShift) keyBtn.classList.add('keycap--shift');
        if (keyDef.isSpace) keyBtn.classList.add('keycap--space');
        if (keyDef.bump) keyBtn.classList.add('keycap--bump');

        self._populateKeycapContent(keyBtn, keyDef);

        if (self.onKeyClick) {
          keyBtn.addEventListener('click', function () {
            self.onKeyClick(keyDef);
          });
        } else {
          keyBtn.tabIndex = -1;
        }

        self.keyEls[keyDef.code] = keyBtn;
        rowEl.appendChild(keyBtn);
      });

      board.appendChild(rowEl);
    });

    wrapper.appendChild(board);

    // 2. Two-Hand 10-Finger SVG Guide
    var handsCard = document.createElement('div');
    handsCard.className = 'hands-guide-section';

    var legendRow = document.createElement('div');
    legendRow.className = 'hands-legend-row';
    legendRow.innerHTML =
      '<span class="legend-chip legend-chip--target"><span class="legend-dot"></span>누를 글자 키 · 손가락</span>' +
      '<span class="legend-chip legend-chip--shift"><span class="legend-dot"></span>함께 누를 반대쪽 Shift · 손가락</span>';
    handsCard.appendChild(legendRow);

    var handsGrid = document.createElement('div');
    handsGrid.className = 'hands-svg-grid';

    handsGrid.appendChild(self._buildHandSvg('left', '왼손 (Left Hand)', LEFT_FINGER_SHAPES, 22, 102, 134));
    handsGrid.appendChild(self._buildHandSvg('right', '오른손 (Right Hand)', RIGHT_FINGER_SHAPES, 104, 102, 134));

    handsCard.appendChild(handsGrid);
    wrapper.appendChild(handsCard);

    self.container.appendChild(wrapper);

    if (self.currentTarget) {
      self.highlightTarget(self.currentTarget);
    }
  };

  var COMPACT_MOD_LABELS = {
    Backspace: '⌫',
    Enter: '↵',
  };

  KeyboardView.prototype._populateKeycapContent = function (keyBtn, keyDef) {
    keyBtn.innerHTML = '';

    if (keyDef.isShift) {
      var shiftLabel = document.createElement('span');
      shiftLabel.className = 'keycap-mod-label';
      var fullShift = keyDef.code === 'ShiftLeft' ? '좌측 Shift' : '우측 Shift';
      var shortShift = keyDef.code === 'ShiftLeft' ? '⇧ 좌' : '⇧ 우';
      shiftLabel.innerHTML =
        '<span class="mod-full">' + fullShift + '</span>' +
        '<span class="mod-short">' + shortShift + '</span>';
      keyBtn.appendChild(shiftLabel);
      return;
    }

    if (keyDef.isModifier) {
      var modLabel = document.createElement('span');
      modLabel.className = 'keycap-mod-label';
      var fullText = keyDef.code === 'AltRight' && this.lang === 'en' ? 'Alt' : keyDef.label;
      var shortText = COMPACT_MOD_LABELS[keyDef.code] || fullText;
      if (shortText !== fullText) {
        modLabel.innerHTML =
          '<span class="mod-full">' + fullText + '</span>' +
          '<span class="mod-short">' + shortText + '</span>';
      } else {
        modLabel.textContent = fullText;
      }
      keyBtn.appendChild(modLabel);
      return;
    }

    if (keyDef.isSpace) {
      var spaceLabel = document.createElement('span');
      spaceLabel.className = 'keycap-mod-label';
      spaceLabel.textContent = 'Space';
      keyBtn.appendChild(spaceLabel);
      return;
    }

    var map = keyDef[this.lang];
    var shiftEl = document.createElement('span');
    shiftEl.className = 'keycap-shift-char';

    var mainEl = document.createElement('span');
    mainEl.className = 'keycap-main-char';

    if (this.lang === 'ko') {
      mainEl.textContent = map.normal;
      if (map.shift && map.shift !== map.normal) {
        shiftEl.textContent = map.shift;
      }
      if (/^Key[A-Z]$/.test(keyDef.code)) {
        var subHint = document.createElement('span');
        subHint.className = 'keycap-sub-hint';
        subHint.textContent = keyDef.en.shift;
        keyBtn.appendChild(subHint);
      }
    } else {
      var isLetter = /^[a-z]$/.test(map.normal);
      mainEl.textContent = isLetter ? map.shift : map.normal;
      if (!isLetter && map.shift && map.shift !== map.normal) {
        shiftEl.textContent = map.shift;
      }
    }

    if (shiftEl.textContent) {
      keyBtn.appendChild(shiftEl);
    }
    keyBtn.appendChild(mainEl);

    if (keyDef.bump) {
      var bumpBar = document.createElement('span');
      bumpBar.className = 'keycap-bump';
      bumpBar.setAttribute('aria-hidden', 'true');
      keyBtn.appendChild(bumpBar);
    }
  };

  KeyboardView.prototype._buildHandSvg = function (side, titleText, fingerShapes, palmX, palmY, palmW) {
    var self = this;
    var cfg = TypingApp.KeyboardConfig;

    var card = document.createElement('div');
    card.className = 'hand-card hand-card--' + side;

    var title = document.createElement('div');
    title.className = 'hand-card-title';
    title.textContent = titleText;
    card.appendChild(title);

    var svg = createSvgEl('svg', {
      viewBox: '0 0 260 164',
      class: 'hand-svg',
      role: 'img',
      'aria-label': titleText,
    });

    // Palm base
    var palm = createSvgEl('rect', {
      x: palmX,
      y: palmY,
      width: palmW,
      height: 50,
      rx: 20,
      class: 'hand-palm',
    });
    svg.appendChild(palm);

    // Subtle palm line
    var palmArc = createSvgEl('path', {
      d: side === 'left'
        ? 'M ' + (palmX + 18) + ' ' + (palmY + 24) + ' Q ' + (palmX + palmW * 0.5) + ' ' + (palmY + 14) + ' ' + (palmX + palmW - 18) + ' ' + (palmY + 26)
        : 'M ' + (palmX + 18) + ' ' + (palmY + 26) + ' Q ' + (palmX + palmW * 0.5) + ' ' + (palmY + 14) + ' ' + (palmX + palmW - 18) + ' ' + (palmY + 24),
      class: 'hand-palm-crease',
    });
    svg.appendChild(palmArc);

    fingerShapes.forEach(function (shape) {
      var fingerInfo = cfg.FINGERS[shape.id];
      var g = createSvgEl('g', {
        class: 'hand-finger',
        'data-finger': shape.id,
      });
      g.style.setProperty('--finger-color', fingerInfo.color);

      if (shape.rotate) {
        g.setAttribute('transform', 'rotate(' + shape.rotate + ')');
      }

      var rect = createSvgEl('rect', {
        x: shape.x,
        y: shape.y,
        width: shape.w,
        height: shape.h,
        rx: Math.round(shape.w / 2),
        class: 'finger-body',
      });
      g.appendChild(rect);

      // Fingernail / tip accent
      var nail = createSvgEl('rect', {
        x: shape.x + 5,
        y: shape.y + 5,
        width: shape.w - 10,
        height: 11,
        rx: 5,
        class: 'finger-nail',
      });
      g.appendChild(nail);

      // Label inside lower half of finger
      var text = createSvgEl('text', {
        x: shape.x + shape.w / 2,
        y: shape.y + shape.h - 14,
        'text-anchor': 'middle',
        class: 'finger-label',
      });
      text.textContent = shape.label;
      g.appendChild(text);

      self.fingerEls[shape.id] = g;
      svg.appendChild(g);
    });

    card.appendChild(svg);
    return card;
  };

  KeyboardView.prototype.setLanguage = function (lang) {
    var normalized = lang === 'en' ? 'en' : 'ko';
    if (this.lang === normalized) return;
    this.lang = normalized;
    this.render();
  };

  KeyboardView.prototype.clearHighlights = function () {
    Object.keys(this.keyEls).forEach(function (code) {
      this.keyEls[code].classList.remove('is-target-key', 'is-target-shift-key');
    }, this);

    Object.keys(this.fingerEls).forEach(function (fid) {
      this.fingerEls[fid].classList.remove('is-target-finger', 'is-target-shift-finger');
    }, this);
  };

  KeyboardView.prototype.highlightTarget = function (targetInfo) {
    this.currentTarget = targetInfo || null;
    this.clearHighlights();
    if (!targetInfo) return;

    var keyEl = this.keyEls[targetInfo.code];
    if (keyEl) {
      keyEl.classList.add('is-target-key');
    }

    if (targetInfo.finger && this.fingerEls[targetInfo.finger.id]) {
      this.fingerEls[targetInfo.finger.id].classList.add('is-target-finger');
    }

    if (targetInfo.needsShift) {
      if (targetInfo.shiftCode && this.keyEls[targetInfo.shiftCode]) {
        this.keyEls[targetInfo.shiftCode].classList.add('is-target-shift-key');
      }
      if (targetInfo.shiftFinger && this.fingerEls[targetInfo.shiftFinger.id]) {
        this.fingerEls[targetInfo.shiftFinger.id].classList.add('is-target-shift-finger');
      }
    }
  };

  KeyboardView.prototype.destroy = function () {
    Object.keys(this.flashTimers).forEach(function (code) {
      clearTimeout(this.flashTimers[code]);
    }, this);
    this.flashTimers = {};
  };

  KeyboardView.prototype.setPressedKey = function (code, pressed) {
    var keyEl = this.keyEls[code];
    if (!keyEl) return;
    if (pressed) {
      keyEl.classList.add('is-pressed');
    } else {
      keyEl.classList.remove('is-pressed');
    }
  };

  KeyboardView.prototype.clearAllPressed = function () {
    Object.keys(this.keyEls).forEach(function (code) {
      this.keyEls[code].classList.remove('is-pressed');
    }, this);
  };

  KeyboardView.prototype.flashFeedback = function (code, isCorrect) {
    var self = this;
    var keyEl = self.keyEls[code];
    if (!keyEl) return;

    var cls = isCorrect ? 'is-flash-correct' : 'is-flash-error';
    keyEl.classList.remove('is-flash-correct', 'is-flash-error');
    // Force reflow so rapid repeated errors still re-trigger animation
    void keyEl.offsetWidth;
    keyEl.classList.add(cls);

    if (self.flashTimers[code]) {
      clearTimeout(self.flashTimers[code]);
    }
    self.flashTimers[code] = setTimeout(function () {
      keyEl.classList.remove(cls);
      delete self.flashTimers[code];
    }, 280);
  };

  TypingApp.KeyboardView = KeyboardView;
})(window);
