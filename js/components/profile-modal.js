(function (global) {
  'use strict';

  var TypingApp = (global.TypingApp = global.TypingApp || {});

  var MODE_META = [
    { id: 'position', label: '자리 연습', badgeClass: 'sky' },
    { id: 'word', label: '낱말 연습', badgeClass: 'mint' },
    { id: 'short', label: '단문장 연습', badgeClass: 'sky' },
    { id: 'long', label: '장문장 연습', badgeClass: 'indigo' },
    { id: 'dictation', label: '받아쓰기', badgeClass: 'mint' },
  ];

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatDateTime(isoStr) {
    if (!isoStr) return '-';
    var d = new Date(isoStr);
    if (isNaN(d.getTime())) return '-';
    var mm = String(d.getMonth() + 1).padStart(2, '0');
    var dd = String(d.getDate()).padStart(2, '0');
    var hh = String(d.getHours()).padStart(2, '0');
    var min = String(d.getMinutes()).padStart(2, '0');
    return mm + '/' + dd + ' ' + hh + ':' + min;
  }

  function ProfileModal(overlayEl, options) {
    this.overlayEl = overlayEl;
    this.options = options || {};
    this.activeTab = 'profiles';
    this.confirmDeleteId = null;
    this.confirmTimer = null;
    this.errorMsg = '';

    this._onEscKey = this._handleKeyDown.bind(this);
    this._onBackdropClick = this._handleBackdropClick.bind(this);
  }

  ProfileModal.prototype.isOpen = function () {
    return Boolean(this.overlayEl && !this.overlayEl.classList.contains('hidden'));
  };

  ProfileModal.prototype.open = function (tab) {
    if (!this.overlayEl) return;
    this.activeTab = tab === 'records' ? 'records' : 'profiles';
    this.confirmDeleteId = null;
    this.errorMsg = '';

    this.overlayEl.classList.remove('hidden');
    this.render();

    document.addEventListener('keydown', this._onEscKey);
    this.overlayEl.addEventListener('click', this._onBackdropClick);

    var modalEl = this.overlayEl.querySelector('.profile-modal');
    if (modalEl) {
      modalEl.focus({ preventScroll: true });
    }
  };

  ProfileModal.prototype.close = function () {
    if (!this.overlayEl) return;
    if (this.confirmTimer) {
      clearTimeout(this.confirmTimer);
      this.confirmTimer = null;
    }
    this.confirmDeleteId = null;
    this.errorMsg = '';
    this.overlayEl.classList.add('hidden');
    this.overlayEl.innerHTML = '';

    document.removeEventListener('keydown', this._onEscKey);
    this.overlayEl.removeEventListener('click', this._onBackdropClick);
  };

  ProfileModal.prototype._handleKeyDown = function (e) {
    if (e.key === 'Escape' && this.isOpen()) {
      e.preventDefault();
      this.close();
    }
  };

  ProfileModal.prototype._handleBackdropClick = function (e) {
    if (e.target === this.overlayEl) {
      this.close();
    }
  };

  ProfileModal.prototype._notifyProfileChanged = function (user, reason) {
    if (typeof this.options.onProfileChanged === 'function') {
      this.options.onProfileChanged(user, reason);
    }
  };

  ProfileModal.prototype._notifyToast = function (msg) {
    if (typeof this.options.onToast === 'function') {
      this.options.onToast(msg);
    }
  };

  ProfileModal.prototype.render = function () {
    var self = this;
    if (!self.overlayEl) return;

    var store = TypingApp.ProfileStore;
    var activeUser = store.getActiveUser();
    var activeGrade = store.calculateUserGrade(activeUser);

    var html =
      '<div class="profile-modal" tabindex="-1">' +
      '  <div class="profile-modal-header">' +
      '    <div class="profile-modal-title-group">' +
      '      <span class="profile-active-chip">' +
      '        <span class="user-avatar-sm">' + escapeHtml(activeUser.name.slice(0, 1)) + '</span>' +
      '        <span>' + escapeHtml(activeUser.name) + '</span>' +
      '        <span class="grade-badge grade-badge--xs grade-tier-' + activeGrade.tier + '">' + escapeHtml(activeGrade.label) + '</span>' +
      '      </span>' +
      '      <h2 class="profile-modal-title" id="profile-modal-title">' +
      (self.activeTab === 'profiles' ? '사용자 관리' : '내 연습 기록') +
      '      </h2>' +
      '    </div>' +
      '    <button type="button" class="modal-close-btn" id="profile-close-btn" aria-label="창 닫기">✕</button>' +
      '  </div>' +
      '  <div class="profile-tabs" role="tablist">' +
      '    <button type="button" role="tab" class="profile-tab-btn' + (self.activeTab === 'profiles' ? ' is-active' : '') + '" data-tab="profiles" aria-selected="' + (self.activeTab === 'profiles') + '">사용자 목록</button>' +
      '    <button type="button" role="tab" class="profile-tab-btn' + (self.activeTab === 'records' ? ' is-active' : '') + '" data-tab="records" aria-selected="' + (self.activeTab === 'records') + '">내 기록 대시보드</button>' +
      '  </div>' +
      '  <div class="profile-modal-body">' +
      (self.activeTab === 'profiles' ? self._renderProfilesTabHTML() : self._renderRecordsTabHTML(activeUser)) +
      '  </div>' +
      '</div>';

    self.overlayEl.innerHTML = html;
    self._bindModalEvents();
  };

  ProfileModal.prototype._renderProfilesTabHTML = function () {
    var store = TypingApp.ProfileStore;
    var users = store.getUsers();
    var activeId = store.getActiveUserId();
    var canDelete = users.length > 1;

    var listHtml = users.map(function (user) {
      var isActive = user.id === activeId;
      var summary = store.getOverallSummary(user);
      var grade = summary.grade || store.calculateUserGrade(user);
      var langText = user.settings.lang === 'en' ? '영어' : '한글';
      var isConfirming = this.confirmDeleteId === user.id;

      return (
        '<div class="user-row' + (isActive ? ' is-active' : '') + '" data-user-id="' + escapeHtml(user.id) + '">' +
        '  <button type="button" class="user-row-main" data-action="select" data-user-id="' + escapeHtml(user.id) + '">' +
        '    <span class="user-avatar-md">' + escapeHtml(user.name.slice(0, 1)) + '</span>' +
        '    <span class="user-row-info">' +
        '      <strong class="user-row-name">' + escapeHtml(user.name) +
        '        <span class="grade-badge grade-badge--xs grade-tier-' + grade.tier + '">' + escapeHtml(grade.label) + '</span>' +
        (isActive ? ' <span class="user-active-pill">사용 중</span>' : '') +
        '      </strong>' +
        '      <span class="user-row-meta">누적 ' + summary.totalCombinedSessions + '회 (연습 ' + summary.totalSessions + ' · 산성비 ' + summary.totalAcidGames + ') · 마지막 언어: ' + langText + '</span>' +
        '    </span>' +
        '  </button>' +
        '  <div class="user-row-actions">' +
        (!isActive
          ? '<button type="button" class="btn btn-secondary btn-sm" data-action="select" data-user-id="' + escapeHtml(user.id) + '">선택</button>'
          : '') +
        '    <button type="button" class="btn btn-sm ' + (isConfirming ? 'btn-danger-solid' : 'btn-danger-ghost') + '"' +
        '      data-action="delete" data-user-id="' + escapeHtml(user.id) + '"' +
        (!canDelete ? ' disabled title="최소 1명의 사용자가 필요합니다"' : '') + '>' +
        (isConfirming ? '삭제 확인' : '삭제') +
        '    </button>' +
        '  </div>' +
        '</div>'
      );
    }, this).join('');

    return (
      '<div class="profile-section">' +
      '  <div class="section-heading-row">' +
      '    <h3 class="section-heading">등록된 사용자 (' + users.length + '명)</h3>' +
      '    <span class="section-hint">클릭하면 해당 사용자의 기록과 언어 설정을 즉시 불러옵니다.</span>' +
      '  </div>' +
      '  <div class="user-list">' + listHtml + '</div>' +
      '</div>' +
      '<div class="profile-section">' +
      '  <h3 class="section-heading">새 사용자 추가</h3>' +
      '  <form class="add-user-form" id="profile-add-form">' +
      '    <input type="text" class="typing-input add-user-input" id="profile-add-input" maxlength="20" autocomplete="off" placeholder="새 사용자 이름 입력 (최대 20자)..." />' +
      '    <button type="submit" class="btn btn-primary">추가</button>' +
      '  </form>' +
      (this.errorMsg ? '<p class="form-error-msg" id="profile-add-error">' + escapeHtml(this.errorMsg) + '</p>' : '') +
      '</div>'
    );
  };

  ProfileModal.prototype._renderRecordsTabHTML = function (user) {
    var store = TypingApp.ProfileStore;
    var summary = store.getOverallSummary(user);
    var langText = user.settings.lang === 'en' ? '영어 (QWERTY)' : '한글 (두벌식)';

    var modeCardsHtml = MODE_META.map(function (meta) {
      var m = user.practice[meta.id] || {};
      return (
        '<div class="record-mode-card record-mode-card--' + meta.badgeClass + '">' +
        '  <div class="record-mode-head">' +
        '    <strong class="record-mode-title">' + meta.label + '</strong>' +
        '    <span class="record-count-pill">' + (m.sessions || 0) + '회</span>' +
        '  </div>' +
        '  <div class="record-mode-metrics">' +
        '    <div><span>최고 타수</span><strong>' + (m.bestCpm || 0) + ' CPM <small>(' + (m.bestWpm || 0) + ' WPM)</small></strong></div>' +
        '    <div><span>평균 정타율</span><strong>' + (m.sessions > 0 ? Number(m.avgAccuracy).toFixed(1) + '%' : '-') + '</strong></div>' +
        '  </div>' +
        '</div>'
      );
    }).join('');

    var koAcid = user.acidRain.ko || {};
    var enAcid = user.acidRain.en || {};

    var acidCardsHtml =
      '<div class="record-acid-grid">' +
      '  <div class="record-acid-card">' +
      '    <div class="record-acid-head">' +
      '      <span class="acid-badge acid-badge--ko">한글 산성비</span>' +
      '      <span class="record-count-pill">' + (koAcid.gamesPlayed || 0) + '회</span>' +
      '    </div>' +
      '    <div class="record-acid-stats">' +
      '      <div><span>최고 점수</span><strong>' + (koAcid.highScore || 0).toLocaleString() + '점</strong></div>' +
      '      <div><span>클리어 최고 단계</span><strong>' + (koAcid.bestClearedLevel > 0 ? koAcid.bestClearedLevel + '단계' : '미달성') + '</strong></div>' +
      '      <div><span>최고 도달 단계</span><strong>' + (koAcid.bestReachedLevel > 0 ? koAcid.bestReachedLevel + '단계' : '-') + '</strong></div>' +
      '    </div>' +
      '  </div>' +
      '  <div class="record-acid-card">' +
      '    <div class="record-acid-head">' +
      '      <span class="acid-badge acid-badge--en">영어 산성비</span>' +
      '      <span class="record-count-pill">' + (enAcid.gamesPlayed || 0) + '회</span>' +
      '    </div>' +
      '    <div class="record-acid-stats">' +
      '      <div><span>최고 점수</span><strong>' + (enAcid.highScore || 0).toLocaleString() + '점</strong></div>' +
      '      <div><span>클리어 최고 단계</span><strong>' + (enAcid.bestClearedLevel > 0 ? enAcid.bestClearedLevel + '단계' : '미달성') + '</strong></div>' +
      '      <div><span>최고 도달 단계</span><strong>' + (enAcid.bestReachedLevel > 0 ? enAcid.bestReachedLevel + '단계' : '-') + '</strong></div>' +
      '    </div>' +
      '  </div>' +
      '</div>';

    var historyList = (user.recentHistory || []).slice(0, 15);
    var historyHtml = '';
    if (historyList.length === 0) {
      historyHtml = '<p class="history-empty">아직 저장된 연습 기록이 없습니다. 연습이나 산성비 게임을 완료하면 자동으로 기록됩니다.</p>';
    } else {
      historyHtml = '<div class="history-list">' + historyList.map(function (h) {
        var modeNameMap = {
          position: '자리 연습',
          word: '낱말 연습',
          short: '단문장 연습',
          long: '장문장 연습',
          acid: '산성비 게임',
        };
        var modeLabel = modeNameMap[h.mode] || h.mode;
        var langPill = h.lang === 'en' ? 'EN' : 'KO';
        var metricText = h.mode === 'acid'
          ? (h.score.toLocaleString() + '점 · ' + (h.clearedLevel > 0 ? h.clearedLevel + '단계 클리어' : h.reachedLevel + '단계 도달'))
          : (h.cpm + ' CPM (' + h.wpm + ' WPM) · 정타율 ' + Number(h.accuracy).toFixed(1) + '%');

        return (
          '<div class="history-item">' +
          '  <div class="history-item-left">' +
          '    <span class="history-mode-tag">' + modeLabel + '</span>' +
          '    <span class="history-lang-tag">' + langPill + '</span>' +
          '    <span class="history-title-text">' + escapeHtml(h.title || modeLabel) + '</span>' +
          '  </div>' +
          '  <div class="history-item-right">' +
          '    <strong class="history-metric">' + metricText + '</strong>' +
          '    <span class="history-date">' + formatDateTime(h.timestamp) + '</span>' +
          '  </div>' +
          '</div>'
        );
      }).join('') + '</div>';
    }

    return (
      '<div class="records-kpi-row">' +
      '  <div class="records-kpi-card"><span>총 연습 완료</span><strong>' + summary.totalSessions + '회</strong></div>' +
      '  <div class="records-kpi-card"><span>전체 평균 정타율</span><strong>' + (summary.totalSessions > 0 ? summary.overallAvgAccuracy.toFixed(1) + '%' : '-') + '</strong></div>' +
      '  <div class="records-kpi-card"><span>전체 최고 타수</span><strong>' + summary.bestCpm + ' CPM</strong></div>' +
      '  <div class="records-kpi-card"><span>최근 선택 언어</span><strong>' + langText + '</strong></div>' +
      '</div>' +
      '<div class="profile-section">' +
      '  <h3 class="section-heading">연습 모드별 누적 통계</h3>' +
      '  <div class="record-mode-grid">' + modeCardsHtml + '</div>' +
      '</div>' +
      '<div class="profile-section">' +
      '  <h3 class="section-heading">산성비 미니게임 최고 기록 (한글 / 영어)</h3>' +
      acidCardsHtml +
      '</div>' +
      '<div class="profile-section">' +
      '  <h3 class="section-heading">최근 연습 이력</h3>' +
      historyHtml +
      '</div>'
    );
  };

  ProfileModal.prototype._bindModalEvents = function () {
    var self = this;
    var store = TypingApp.ProfileStore;

    var closeBtn = self.overlayEl.querySelector('#profile-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', function () {
        self.close();
      });
    }

    var tabBtns = self.overlayEl.querySelectorAll('.profile-tab-btn');
    tabBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var tab = btn.dataset.tab;
        if (tab && tab !== self.activeTab) {
          self.activeTab = tab;
          self.confirmDeleteId = null;
          self.errorMsg = '';
          self.render();
        }
      });
    });

    if (self.activeTab === 'profiles') {
      var selectEls = self.overlayEl.querySelectorAll('[data-action="select"]');
      selectEls.forEach(function (el) {
        el.addEventListener('click', function () {
          var uid = el.dataset.userId;
          if (!uid || uid === store.getActiveUserId()) return;
          var res = store.selectUser(uid);
          if (res.ok) {
            self.confirmDeleteId = null;
            self.errorMsg = '';
            self._notifyProfileChanged(res.user, 'select');
            self._notifyToast(res.user.name + ' 프로필로 전환했습니다.');
            self.render();
          }
        });
      });

      var deleteEls = self.overlayEl.querySelectorAll('[data-action="delete"]');
      deleteEls.forEach(function (btn) {
        btn.addEventListener('click', function (e) {
          e.stopPropagation();
          var uid = btn.dataset.userId;
          if (!uid) return;
          if (self.confirmDeleteId !== uid) {
            self.confirmDeleteId = uid;
            if (self.confirmTimer) clearTimeout(self.confirmTimer);
            self.confirmTimer = setTimeout(function () {
              self.confirmDeleteId = null;
              if (self.isOpen() && self.activeTab === 'profiles') {
                self.render();
              }
            }, 3500);
            self.render();
            return;
          }

          if (self.confirmTimer) {
            clearTimeout(self.confirmTimer);
            self.confirmTimer = null;
          }
          var delRes = store.deleteUser(uid);
          if (delRes.ok) {
            self.confirmDeleteId = null;
            self._notifyProfileChanged(delRes.activeUser, 'delete');
            self._notifyToast('사용자를 삭제했습니다.');
            self.render();
          } else {
            self.errorMsg = delRes.error || '삭제할 수 없습니다.';
            self.render();
          }
        });
      });

      var addForm = self.overlayEl.querySelector('#profile-add-form');
      var addInput = self.overlayEl.querySelector('#profile-add-input');
      if (addForm && addInput) {
        addForm.addEventListener('submit', function (e) {
          e.preventDefault();
          var res = store.addUser(addInput.value);
          if (res.ok) {
            self.errorMsg = '';
            self.confirmDeleteId = null;
            self._notifyProfileChanged(res.user, 'add');
            self._notifyToast(res.user.name + ' 사용자를 추가하고 전환했습니다.');
            self.render();
          } else {
            self.errorMsg = res.error || '사용자를 추가할 수 없습니다.';
            self.render();
            var refocused = self.overlayEl.querySelector('#profile-add-input');
            if (refocused) refocused.focus();
          }
        });
      }
    }
  };

  TypingApp.ProfileModal = ProfileModal;
})(window);
