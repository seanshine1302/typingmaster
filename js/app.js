(function (global) {
  'use strict';

  var TypingApp = (global.TypingApp = global.TypingApp || {});

  var MODE_CARDS = [
    {
      id: 'position',
      num: '01',
      title: '자리 연습',
      badge: '기초 운지법',
      accent: 'sky',
      descKo: '가상 키보드와 양손 10손가락 가이드로 글자 위치와 Shift 반대 손가락 규칙을 익힙니다.',
      descEn: 'Learn QWERTY key positions, 10-finger placement, and opposite-hand Shift combos.',
    },
    {
      id: 'word',
      num: '02',
      title: '낱말 연습',
      badge: '단어 숙달',
      accent: 'mint',
      descKo: '일상·교양·쌍자음 낱말을 실시간 오타 표시와 함께 빠르고 정확하게 연습합니다.',
      descEn: 'Build rhythm and accuracy with curated English words and instant typo feedback.',
    },
    {
      id: 'short',
      num: '03',
      title: '단문장 연습',
      badge: '문장 호흡',
      accent: 'sky',
      descKo: '띄어쓰기와 문장부호가 포함된 자연스러운 짧은 문장으로 리듬감을 기릅니다.',
      descEn: 'Practice spacing, punctuation, and smooth flow across natural short sentences.',
    },
    {
      id: 'long',
      num: '04',
      title: '장문장 연습',
      badge: '집중 지구력',
      accent: 'indigo',
      descKo: '여러 줄로 이루어진 문학·교양·기술 지문을 끝까지 입력하며 실전 타자 실력을 다집니다.',
      descEn: 'Type multi-line essays and stories to strengthen endurance and steady speed.',
    },
    {
      id: 'acid',
      num: '05',
      title: '산성비 미니게임',
      badge: '1~10단계 도전',
      accent: 'coral',
      descKo: '하늘에서 떨어지는 단어를 바닥에 닿기 전에 제거하며 최고 점수와 단계에 도전하세요.',
      descEn: 'Clear falling English words before they hit the ground across 10 speed levels.',
    },
  ];

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function AppController() {
    var activeUser = TypingApp.ProfileStore ? TypingApp.ProfileStore.getActiveUser() : null;
    this.lang = activeUser && activeUser.settings && activeUser.settings.lang === 'en' ? 'en' : 'ko';
    this.currentMode = 'home';
    this.activeController = null;
    this.toastTimer = null;

    this.mainEl = document.getElementById('app-main');
    this.resultOverlay = document.getElementById('result-overlay');
    this.profileOverlay = document.getElementById('profile-overlay');
    this.dashboardOverlay = document.getElementById('dashboard-overlay');
    this.toastContainer = document.getElementById('toast-container');
    this.brandSubEl = document.getElementById('brand-sub');
    this.hwKbBtn = document.getElementById('hw-kb-toggle');
    this.installBtn = document.getElementById('pwa-install-btn');
    this.profileMenuBtn = document.getElementById('profile-menu-btn');
    this.dashboardOpenBtn = document.getElementById('dashboard-open-btn');
    this.headerUserNameEl = document.getElementById('header-user-name');
    this.headerUserAvatarEl = document.getElementById('header-user-avatar');
    this.headerUserGradeEl = document.getElementById('header-user-grade');
    this.navButtons = Array.prototype.slice.call(document.querySelectorAll('#mode-nav .nav-tab'));
    this.langButtons = Array.prototype.slice.call(document.querySelectorAll('#lang-toggle .lang-btn'));

    this._initMobileSupport();
    this._initProfileModal();
    this._initDashboardModal();
    this._bindHeader();
    this._updateHeaderState();
    this.navigate('home');
  }

  AppController.prototype._initProfileModal = function () {
    var self = this;
    if (!TypingApp.ProfileModal || !self.profileOverlay) return;

    self.profileModal = new TypingApp.ProfileModal(self.profileOverlay, {
      onProfileChanged: function (newUser) {
        self._handleProfileChanged(newUser);
      },
      onToast: function (msg) {
        self.showToast(msg);
      },
    });
  };

  AppController.prototype._initDashboardModal = function () {
    var self = this;
    if (!TypingApp.DashboardModal || !self.dashboardOverlay) return;

    self.dashboardModal = new TypingApp.DashboardModal(self.dashboardOverlay, {
      onProfileChanged: function (newUser) {
        self._handleProfileChanged(newUser);
      },
      onToast: function (msg) {
        self.showToast(msg);
      },
    });
  };

  AppController.prototype.openDashboardModal = function (focusUserId) {
    if (this.profileModal && this.profileModal.isOpen()) {
      this.profileModal.close();
    }
    if (this.dashboardModal) {
      this.dashboardModal.open(focusUserId);
    }
  };

  AppController.prototype.refreshHeaderState = function () {
    this._updateHeaderState();
  };

  AppController.prototype._handleProfileChanged = function (newUser) {
    var nextLang = newUser && newUser.settings && newUser.settings.lang === 'en' ? 'en' : 'ko';
    var langChanged = nextLang !== this.lang;
    this.lang = nextLang;

    if (!this.resultOverlay.classList.contains('hidden')) {
      this.hideResult();
    }

    this._updateHeaderState();

    if (this.currentMode === 'home') {
      this._renderHome();
    } else if (this.activeController) {
      if (langChanged && typeof this.activeController.setLanguage === 'function') {
        this.activeController.setLanguage(this.lang);
      } else if (this.currentMode === 'acid' && this.activeController.phase === 'select') {
        this.activeController.render();
      }
    }
  };

  AppController.prototype.getActiveUser = function () {
    return TypingApp.ProfileStore ? TypingApp.ProfileStore.getActiveUser() : null;
  };

  AppController.prototype.openRecordsModal = function () {
    if (this.profileModal) {
      this.profileModal.open('records');
    }
  };

  AppController.prototype.recordAcidRain = function (payload) {
    if (!TypingApp.ProfileStore) return null;
    return TypingApp.ProfileStore.recordAcidRainResult(payload);
  };

  AppController.prototype._initMobileSupport = function () {
    var self = this;
    if (!TypingApp.MobileSupport) return;

    TypingApp.MobileSupport.init({
      onInstallAvailabilityChange: function (canInstall) {
        if (self.installBtn) {
          self.installBtn.classList.toggle('hidden', !canInstall);
        }
      },
    });
  };

  AppController.prototype.applyInputMode = function (inputEl, enterKeyHint) {
    if (TypingApp.MobileSupport) {
      TypingApp.MobileSupport.applyInputMode(inputEl, enterKeyHint);
    }
  };

  AppController.prototype._bindHeader = function () {
    var self = this;

    var brandBtn = document.getElementById('brand-home-btn');
    if (brandBtn) {
      brandBtn.addEventListener('click', function () {
        self.hideResult();
        self.navigate('home');
      });
    }

    if (self.hwKbBtn) {
      self.hwKbBtn.addEventListener('click', function () {
        self.hwKbBtn.blur();
        if (!TypingApp.MobileSupport) return;
        var nextState = !TypingApp.MobileSupport.isHardwareKeyboardMode();
        TypingApp.MobileSupport.setHardwareKeyboardMode(nextState);
        self._updateHwKbButton();
        self.showToast(
          nextState
            ? '외장 키보드 모드 켜짐: 모바일 터치 가상 키보드 팝업을 억제합니다.'
            : '외장 키보드 모드 꺼짐: 터치 가상 키보드를 정상 사용합니다.'
        );
      });
    }

    if (self.installBtn) {
      self.installBtn.addEventListener('click', function () {
        self.installBtn.blur();
        if (!TypingApp.MobileSupport) return;
        TypingApp.MobileSupport.promptInstall();
      });
    }

    if (self.profileMenuBtn) {
      self.profileMenuBtn.addEventListener('click', function () {
        self.profileMenuBtn.blur();
        if (self.dashboardModal && self.dashboardModal.isOpen()) {
          self.dashboardModal.close();
        }
        if (self.profileModal) {
          self.profileModal.open('profiles');
        }
      });
    }

    if (self.dashboardOpenBtn) {
      self.dashboardOpenBtn.addEventListener('click', function () {
        self.dashboardOpenBtn.blur();
        self.openDashboardModal();
      });
    }

    self.navButtons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        btn.blur();
        var mode = btn.dataset.mode;
        self.hideResult();
        self.navigate(mode);
      });
    });

    self.langButtons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        btn.blur();
        var nextLang = btn.dataset.lang === 'en' ? 'en' : 'ko';
        self.setLanguage(nextLang);
      });
    });
  };

  AppController.prototype.getLanguage = function () {
    return this.lang;
  };

  AppController.prototype.setLanguage = function (nextLang) {
    var normalized = nextLang === 'en' ? 'en' : 'ko';
    if (this.lang === normalized) return;

    this.lang = normalized;
    if (TypingApp.ProfileStore) {
      TypingApp.ProfileStore.setUserLanguage(this.lang);
    }
    this._updateHeaderState();

    // Always allow seamless language switching even if result modal is open
    var hadResultOpen = !this.resultOverlay.classList.contains('hidden');
    if (hadResultOpen) {
      this.hideResult();
    }

    if (this.currentMode === 'home') {
      this._renderHome();
    } else if (this.activeController && typeof this.activeController.setLanguage === 'function') {
      this.activeController.setLanguage(this.lang);
    }

    this.showToast(
      this.lang === 'ko'
        ? '한글(두벌식) 모드로 전환되었습니다.'
        : '영어(QWERTY) 모드로 전환되었습니다.'
    );
  };

  AppController.prototype._updateHeaderState = function () {
    var self = this;

    document.documentElement.lang = self.lang === 'en' ? 'en' : 'ko';

    if (self.brandSubEl) {
      self.brandSubEl.textContent = self.lang === 'ko' ? '한글 두벌식' : '영문 QWERTY';
    }

    self.langButtons.forEach(function (btn) {
      var active = btn.dataset.lang === self.lang;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });

    self.navButtons.forEach(function (btn) {
      var active = btn.dataset.mode === self.currentMode;
      btn.classList.toggle('is-active', active);
    });

    if (TypingApp.ProfileStore) {
      var activeUser = TypingApp.ProfileStore.getActiveUser();
      var activeGrade = TypingApp.ProfileStore.calculateUserGrade(activeUser);
      if (self.headerUserNameEl) {
        self.headerUserNameEl.textContent = activeUser.name;
      }
      if (self.headerUserAvatarEl) {
        self.headerUserAvatarEl.textContent = activeUser.name.slice(0, 1);
      }
      if (self.headerUserGradeEl && activeGrade) {
        self.headerUserGradeEl.textContent = activeGrade.label;
        self.headerUserGradeEl.className = 'grade-badge grade-badge--xs grade-tier-' + activeGrade.tier;
      }
    }

    self._updateHwKbButton();
  };

  AppController.prototype._updateHwKbButton = function () {
    if (!this.hwKbBtn || !TypingApp.MobileSupport) return;
    var isOn = TypingApp.MobileSupport.isHardwareKeyboardMode();
    this.hwKbBtn.classList.toggle('is-active', isOn);
    this.hwKbBtn.setAttribute('aria-pressed', isOn ? 'true' : 'false');
  };

  AppController.prototype.navigate = function (mode) {
    var targetMode = mode || 'home';

    if (this.activeController && typeof this.activeController.destroy === 'function') {
      this.activeController.destroy();
      this.activeController = null;
    }

    this.currentMode = targetMode;
    this._updateHeaderState();

    if (targetMode === 'home') {
      this._renderHome();
      return;
    }

    if (targetMode === 'position') {
      this.activeController = new TypingApp.PositionMode(this.mainEl, this);
    } else if (targetMode === 'word' || targetMode === 'short' || targetMode === 'long') {
      this.activeController = new TypingApp.TextPracticeMode(this.mainEl, this, targetMode);
    } else if (targetMode === 'acid') {
      this.activeController = new TypingApp.AcidRainMode(this.mainEl, this);
    } else {
      this.currentMode = 'home';
      this._updateHeaderState();
      this._renderHome();
    }
  };

  var GRADE_RECOMMENDATIONS = {
    1: {
      primaryMode: 'position',
      primaryLabel: '자리 연습 시작하기',
      secondaryMode: 'word',
      secondaryLabel: '낱말 연습 도전',
      descKo: '초보자 추천: 자리 연습으로 손가락 위치를 익히고 낱말 연습으로 기본 타자 감각을 잡아보세요.',
      descEn: '초보자 추천: 영문 QWERTY 자리 연습으로 손가락 위치를 익히고 낱말 연습을 시작해 보세요.',
    },
    2: {
      primaryMode: 'word',
      primaryLabel: '낱말 연습 이어하기',
      secondaryMode: 'short',
      secondaryLabel: '단문장 연습 도전',
      descKo: '입문자 추천: 다양한 낱말 연습으로 타자 속도를 높이고 단문장 입력에 도전해 보세요.',
      descEn: '입문자 추천: 영문 낱말 연습으로 타자 속도를 높이고 단문장 입력에 도전해 보세요.',
    },
    3: {
      primaryMode: 'short',
      primaryLabel: '단문장 연습 이어하기',
      secondaryMode: 'acid',
      secondaryLabel: '산성비 게임 도전',
      descKo: '숙련자 추천: 단문장 연습으로 문장 호흡과 정확도를 다지고 산성비 게임으로 순발력을 키워보세요.',
      descEn: '숙련자 추천: 영문 단문장 연습으로 문장 호흡과 정확도를 다지고 산성비 게임에 도전해 보세요.',
    },
    4: {
      primaryMode: 'long',
      primaryLabel: '장문장 연습 도전',
      secondaryMode: 'acid',
      secondaryLabel: '산성비 고난도 도전',
      descKo: '전문가 추천: 장문장 지문을 안정적으로 완주하고 산성비 상위 단계로 마스터 등급에 도전해 보세요.',
      descEn: '전문가 추천: 영문 장문장 지문을 안정적으로 완주하고 산성비 상위 단계로 마스터 등급에 도전해 보세요.',
    },
    5: {
      primaryMode: 'long',
      primaryLabel: '장문장 마스터 연습',
      secondaryMode: 'acid',
      secondaryLabel: '산성비 10단계 도전',
      descKo: '마스터 추천: 장문장 최고 타수 경신과 산성비 10단계 완주에 도전해 보세요.',
      descEn: '마스터 추천: 영문 장문장 최고 타수 경신과 산성비 10단계 완주에 도전해 보세요.',
    },
  };

  AppController.prototype._renderHome = function () {
    var self = this;
    var isKo = self.lang === 'ko';
    var data = isKo ? TypingApp.DATA_KO : TypingApp.DATA_EN;
    var wordTotal = data.words.easy.length + data.words.medium.length + data.words.hard.length;
    var activeUser = self.getActiveUser();
    var summary = TypingApp.ProfileStore && activeUser
      ? TypingApp.ProfileStore.getOverallSummary(activeUser)
      : { totalSessions: 0, totalCombinedSessions: 0, overallAvgAccuracy: 0, bestCpm: 0, totalAcidGames: 0, bestAcidScore: 0, grade: { tier: 1, label: '초보자' } };
    var activeGrade = summary.grade || { tier: 1, label: '초보자' };
    var tierRec = GRADE_RECOMMENDATIONS[activeGrade.tier] || GRADE_RECOMMENDATIONS[1];
    var acidCurrent = activeUser && activeUser.acidRain ? activeUser.acidRain[self.lang] : { highScore: 0 };

    self.mainEl.innerHTML = '';

    var page = document.createElement('section');
    page.className = 'home-page';

    // Hero Summary Banner
    var hero = document.createElement('div');
    hero.className = 'panel-card home-hero';
    hero.innerHTML =
      '<div class="home-hero-copy">' +
      '  <div class="hero-status-row">' +
      '    <span class="hero-status-pill">' +
      '      <span class="hero-status-dot"></span>' +
      (isKo ? '현재 언어: 한글 두벌식 자판' : '현재 언어: 영문 QWERTY 자판') +
      '    </span>' +
      '    <span class="grade-badge grade-badge--sm grade-tier-' + activeGrade.tier + '">' + escapeHtml(activeGrade.label) + ' (' + activeGrade.tier + '단계)</span>' +
      '  </div>' +
      '  <h1 class="home-hero-title">' +
      (activeUser ? escapeHtml(activeUser.name) + '님, ' : '') +
      '편안하고 정확한 타자 연습을 시작해 보세요</h1>' +
      '  <p class="home-hero-desc">' +
      escapeHtml(isKo ? tierRec.descKo : tierRec.descEn) +
      '  </p>' +
      '  <div class="home-hero-actions">' +
      '    <button type="button" class="btn btn-primary btn-lg" data-start-mode="' + tierRec.primaryMode + '">' + escapeHtml(tierRec.primaryLabel) + '</button>' +
      '    <button type="button" class="btn btn-mint btn-lg" data-start-mode="' + tierRec.secondaryMode + '">' + escapeHtml(tierRec.secondaryLabel) + '</button>' +
      '    <button type="button" class="btn btn-ghost btn-lg" id="home-records-btn">내 기록</button>' +
      '    <button type="button" class="btn btn-ghost btn-lg" id="home-dashboard-btn">전체 현황</button>' +
      '  </div>' +
      '</div>' +
      '<div class="home-hero-stats">' +
      '  <div class="hero-mini-card">' +
      '    <span class="hero-mini-label">누적 연습(전체) · 최고 타수</span>' +
      '    <strong class="hero-mini-value">' + summary.totalCombinedSessions + '회 · ' + summary.bestCpm + ' CPM</strong>' +
      '  </div>' +
      '  <div class="hero-mini-card">' +
      '    <span class="hero-mini-label">평균 정타율 · 산성비 최고</span>' +
      '    <strong class="hero-mini-value">' + (summary.totalSessions > 0 ? summary.overallAvgAccuracy.toFixed(1) + '%' : '-') + ' · ' + (acidCurrent.highScore || 0).toLocaleString() + '점</strong>' +
      '  </div>' +
      '  <div class="hero-mini-card">' +
      '    <span class="hero-mini-label">내장 단어 · 단문장</span>' +
      '    <strong class="hero-mini-value">' + wordTotal + '단어 · ' + data.shortSentences.length + '문장</strong>' +
      '  </div>' +
      '  <div class="hero-mini-card">' +
      '    <span class="hero-mini-label">장문장 · 산성비</span>' +
      '    <strong class="hero-mini-value">' + data.longPassages.length + '편 · 1~10단계</strong>' +
      '  </div>' +
      '</div>';

    page.appendChild(hero);

    // 5 Mode Cards Grid
    var grid = document.createElement('div');
    grid.className = 'home-mode-grid';

    MODE_CARDS.forEach(function (cardMeta) {
      var card = document.createElement('button');
      card.type = 'button';
      card.className = 'mode-card mode-card--' + cardMeta.accent;
      card.dataset.mode = cardMeta.id;
      card.innerHTML =
        '<div class="mode-card-top">' +
        '  <span class="mode-card-num">' + cardMeta.num + '</span>' +
        '  <span class="mode-card-badge">' + cardMeta.badge + '</span>' +
        '</div>' +
        '<h2 class="mode-card-title">' + cardMeta.title + '</h2>' +
        '<p class="mode-card-desc">' + (isKo ? cardMeta.descKo : cardMeta.descEn) + '</p>' +
        '<span class="mode-card-cta">시작하기 →</span>';

      card.addEventListener('click', function () {
        self.navigate(cardMeta.id);
      });
      grid.appendChild(card);
    });

    page.appendChild(grid);
    self.mainEl.appendChild(page);

    var quickBtns = hero.querySelectorAll('[data-start-mode]');
    quickBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        self.navigate(btn.dataset.startMode);
      });
    });

    var recordsBtn = hero.querySelector('#home-records-btn');
    if (recordsBtn) {
      recordsBtn.addEventListener('click', function () {
        self.openRecordsModal();
      });
    }

    var dashBtn = hero.querySelector('#home-dashboard-btn');
    if (dashBtn) {
      dashBtn.addEventListener('click', function () {
        self.openDashboardModal();
      });
    }
  };

  AppController.prototype.showResult = function (payload) {
    var self = this;
    var stats = payload.stats || {};
    var accuracy = typeof stats.accuracy === 'number' ? stats.accuracy : 100;
    var typoRate = typeof stats.typoRate === 'number' ? stats.typoRate : Number((100 - accuracy).toFixed(1));
    var cpm = stats.cpm || 0;
    var wpm = stats.wpm || 0;
    var elapsedSeconds = stats.elapsedSeconds || 0;

    var recordOutcome = null;
    if (TypingApp.ProfileStore && payload.mode) {
      recordOutcome = TypingApp.ProfileStore.recordPracticeSession({
        mode: payload.mode,
        lang: payload.lang,
        title: payload.title,
        stats: stats,
      });
      self._updateHeaderState();
    }

    var gradeUpHtml = '';
    if (recordOutcome && recordOutcome.gradeUp) {
      var up = recordOutcome.gradeUp;
      gradeUpHtml =
        '<div class="grade-up-banner" role="status">' +
        '  <span class="grade-up-icon" aria-hidden="true">🎉</span>' +
        '  <div class="grade-up-copy">' +
        '    <strong>등급 승급 축하합니다!</strong>' +
        '    <div class="grade-up-badges">' +
        '      <span class="grade-badge grade-badge--xs grade-tier-' + up.from.tier + '">' + escapeHtml(up.from.label) + '</span>' +
        '      <span class="grade-arrow" aria-hidden="true">→</span>' +
        '      <span class="grade-badge grade-badge--sm grade-tier-' + up.to.tier + '">' + escapeHtml(up.to.label) + ' (' + up.to.tier + '단계)</span>' +
        '    </div>' +
        '  </div>' +
        '</div>';
    }

    var radius = 52;
    var circumference = 2 * Math.PI * radius;
    var dashOffset = circumference * (1 - Math.max(0, Math.min(100, accuracy)) / 100);

    var gradeText = '잘했어요!';
    if (accuracy >= 98) gradeText = '매우 정확합니다!';
    else if (accuracy >= 92) gradeText = '훌륭한 정확도입니다!';
    else if (accuracy < 80) gradeText = '조금 더 천천히 정확하게 쳐 보세요!';

    self.resultOverlay.innerHTML =
      '<div class="result-modal" tabindex="-1">' +
      '  <div class="result-header">' +
      '    <div class="result-badges-row">' +
      '      <span class="result-lang-tag">' + (payload.lang === 'ko' ? '한글 두벌식' : '영문 QWERTY') + '</span>' +
      (recordOutcome && recordOutcome.isNewBestCpm ? '<span class="new-record-badge">🏆 최고 타수 경신!</span>' : '') +
      '    </div>' +
      '    <h2 class="result-title" id="result-modal-title">' + payload.title + '</h2>' +
      '    <p class="result-subtitle">' + (payload.subtitle || gradeText) + '</p>' +
      '  </div>' +
      gradeUpHtml +
      '  <div class="result-gauge-section">' +
      '    <div class="accuracy-ring-wrap">' +
      '      <svg class="accuracy-ring" width="132" height="132" viewBox="0 0 132 132">' +
      '        <circle class="ring-track" cx="66" cy="66" r="' + radius + '"></circle>' +
      '        <circle class="ring-progress" cx="66" cy="66" r="' + radius + '"' +
      '          stroke-dasharray="' + circumference.toFixed(2) + '"' +
      '          stroke-dashoffset="' + dashOffset.toFixed(2) + '"></circle>' +
      '      </svg>' +
      '      <div class="ring-center">' +
      '        <span class="ring-label">정타율</span>' +
      '        <strong class="ring-value">' + accuracy.toFixed(1) + '%</strong>' +
      '      </div>' +
      '    </div>' +
      '    <div class="result-grade-note">' + gradeText + '</div>' +
      '  </div>' +
      '  <div class="result-metrics-grid">' +
      '    <div class="result-metric-box result-metric-box--sky">' +
      '      <span class="metric-label">정타율 (%)</span>' +
      '      <strong class="metric-value">' + accuracy.toFixed(1) + '%</strong>' +
      '    </div>' +
      '    <div class="result-metric-box result-metric-box--coral">' +
      '      <span class="metric-label">오타율 (%)</span>' +
      '      <strong class="metric-value">' + typoRate.toFixed(1) + '%</strong>' +
      '    </div>' +
      '    <div class="result-metric-box result-metric-box--mint">' +
      '      <span class="metric-label">분당 타수 (CPM)</span>' +
      '      <strong class="metric-value">' + cpm + ' 타</strong>' +
      '    </div>' +
      '    <div class="result-metric-box">' +
      '      <span class="metric-label">분당 단어 (WPM)</span>' +
      '      <strong class="metric-value">' + wpm + ' WPM</strong>' +
      '    </div>' +
      '  </div>' +
      '  <div class="result-summary-strip">' +
      '    <span>정타 ' + (stats.correctChars || 0) + '자</span>' +
      '    <span>오타 ' + (stats.typoChars || 0) + '자</span>' +
      '    <span>소요 시간 ' + elapsedSeconds + '초</span>' +
      '  </div>' +
      '  <div class="result-actions">' +
      '    <button type="button" class="btn btn-ghost" id="res-records-btn">내 기록</button>' +
      '    <button type="button" class="btn btn-ghost" id="res-home-btn">메인으로</button>' +
      '    <button type="button" class="btn btn-secondary" id="res-retry-btn">다시 연습</button>' +
      '    <button type="button" class="btn btn-primary" id="res-next-btn">' + (payload.nextLabel || '다음 세트') + '</button>' +
      '  </div>' +
      '</div>';

    self.resultOverlay.classList.remove('hidden');

    var openedAt = Date.now();
    var modalEl = self.resultOverlay.querySelector('.result-modal');
    if (modalEl) {
      modalEl.focus({ preventScroll: true });
    }

    var recordsBtn = self.resultOverlay.querySelector('#res-records-btn');
    var homeBtn = self.resultOverlay.querySelector('#res-home-btn');
    var retryBtn = self.resultOverlay.querySelector('#res-retry-btn');
    var nextBtn = self.resultOverlay.querySelector('#res-next-btn');

    function isStrayKeyboardSubmit(e) {
      return e && e.detail === 0 && (Date.now() - openedAt) < 200;
    }

    if (recordsBtn) {
      recordsBtn.addEventListener('click', function (e) {
        if (isStrayKeyboardSubmit(e)) return;
        self.openRecordsModal();
      });
    }

    if (homeBtn) {
      homeBtn.addEventListener('click', function (e) {
        if (isStrayKeyboardSubmit(e)) return;
        self.hideResult();
        self.navigate('home');
      });
    }
    if (retryBtn) {
      retryBtn.addEventListener('click', function (e) {
        if (isStrayKeyboardSubmit(e)) return;
        self.hideResult();
        if (typeof payload.onRetry === 'function') payload.onRetry();
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener('click', function (e) {
        if (isStrayKeyboardSubmit(e)) return;
        self.hideResult();
        if (typeof payload.onNext === 'function') payload.onNext();
      });
    }

    if (recordOutcome && recordOutcome.gradeUp) {
      self.showGradeUpToast(recordOutcome.gradeUp);
    }
  };

  AppController.prototype.showGradeUpToast = function (gradeUp) {
    var self = this;
    if (!self.toastContainer || !gradeUp || !gradeUp.to) return;

    self.toastContainer.innerHTML = '';
    var toast = document.createElement('div');
    toast.className = 'toast-pill toast-pill--gradeup';
    toast.innerHTML =
      '<span aria-hidden="true">🎉</span> ' +
      '<span>등급 승급! <strong>' + escapeHtml(gradeUp.from ? gradeUp.from.label : '') + '</strong> → </span>' +
      '<span class="grade-badge grade-badge--xs grade-tier-' + gradeUp.to.tier + '">' +
      escapeHtml(gradeUp.to.label) + ' (' + gradeUp.to.tier + '단계)' +
      '</span>';
    self.toastContainer.appendChild(toast);

    if (self.toastTimer) {
      clearTimeout(self.toastTimer);
    }
    self.toastTimer = setTimeout(function () {
      toast.classList.add('is-fading');
      setTimeout(function () {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 240);
    }, 4200);
  };

  AppController.prototype.hideResult = function () {
    if (!this.resultOverlay) return;
    this.resultOverlay.classList.add('hidden');
    this.resultOverlay.innerHTML = '';
  };

  AppController.prototype.showToast = function (message) {
    var self = this;
    if (!self.toastContainer || !message) return;

    self.toastContainer.innerHTML = '';
    var toast = document.createElement('div');
    toast.className = 'toast-pill';
    toast.textContent = message;
    self.toastContainer.appendChild(toast);

    if (self.toastTimer) {
      clearTimeout(self.toastTimer);
    }
    self.toastTimer = setTimeout(function () {
      toast.classList.add('is-fading');
      setTimeout(function () {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 220);
    }, 2400);
  };

  document.addEventListener('DOMContentLoaded', function () {
    TypingApp.app = new AppController();
  });
})(window);
