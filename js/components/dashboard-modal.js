(function (global) {
  'use strict';

  var TypingApp = (global.TypingApp = global.TypingApp || {});

  var MODE_META = [
    { id: 'position', label: '자리 연습' },
    { id: 'word', label: '낱말 연습' },
    { id: 'short', label: '단문장 연습' },
    { id: 'long', label: '장문장 연습' },
  ];

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function renderGradeBadgeHTML(grade, sizeClass) {
    var g = grade || { tier: 1, label: '초보자' };
    var sz = sizeClass ? ' ' + sizeClass : '';
    return '<span class="grade-badge grade-tier-' + g.tier + sz + '">' + escapeHtml(g.label) + '</span>';
  }

  function DashboardModal(overlayEl, options) {
    this.overlayEl = overlayEl;
    this.options = options || {};
    this.selectedUserId = null;

    this._onEscKey = this._handleKeyDown.bind(this);
    this._onBackdropClick = this._handleBackdropClick.bind(this);
  }

  DashboardModal.prototype.isOpen = function () {
    return Boolean(this.overlayEl && !this.overlayEl.classList.contains('hidden'));
  };

  DashboardModal.prototype.open = function (focusUserId) {
    if (!this.overlayEl || !TypingApp.ProfileStore) return;
    var activeId = TypingApp.ProfileStore.getActiveUserId();
    this.selectedUserId = focusUserId || activeId;

    this.overlayEl.classList.remove('hidden');
    this.render();

    document.addEventListener('keydown', this._onEscKey);
    this.overlayEl.addEventListener('click', this._onBackdropClick);

    var modalEl = this.overlayEl.querySelector('.dashboard-modal');
    if (modalEl) {
      modalEl.focus({ preventScroll: true });
    }
  };

  DashboardModal.prototype.close = function () {
    if (!this.overlayEl) return;
    this.overlayEl.classList.add('hidden');
    this.overlayEl.innerHTML = '';

    document.removeEventListener('keydown', this._onEscKey);
    this.overlayEl.removeEventListener('click', this._onBackdropClick);
  };

  DashboardModal.prototype._handleKeyDown = function (e) {
    if (e.key === 'Escape' && this.isOpen()) {
      e.preventDefault();
      this.close();
    }
  };

  DashboardModal.prototype._handleBackdropClick = function (e) {
    if (e.target === this.overlayEl) {
      this.close();
    }
  };

  DashboardModal.prototype._notifyProfileChanged = function (user, reason) {
    if (typeof this.options.onProfileChanged === 'function') {
      this.options.onProfileChanged(user, reason);
    }
  };

  DashboardModal.prototype._notifyToast = function (msg) {
    if (typeof this.options.onToast === 'function') {
      this.options.onToast(msg);
    }
  };

  DashboardModal.prototype.render = function () {
    var self = this;
    if (!self.overlayEl || !TypingApp.ProfileStore) return;

    var store = TypingApp.ProfileStore;
    var users = store.getUsers();
    var activeId = store.getActiveUserId();

    // Ensure selectedUserId exists
    var selectedUser = null;
    for (var i = 0; i < users.length; i++) {
      if (users[i].id === self.selectedUserId) {
        selectedUser = users[i];
        break;
      }
    }
    if (!selectedUser) {
      selectedUser = store.getActiveUser();
      self.selectedUserId = selectedUser.id;
    }

    // Build sorted leaderboard entries
    var entries = users.map(function (user) {
      var summary = store.getOverallSummary(user);
      return {
        user: user,
        summary: summary,
        effectiveScoreSpeed: Math.max(summary.bestKoCpm, summary.bestEnWpm * 5, summary.bestCpm),
      };
    });

    entries.sort(function (a, b) {
      if (b.summary.grade.tier !== a.summary.grade.tier) {
        return b.summary.grade.tier - a.summary.grade.tier;
      }
      if (b.effectiveScoreSpeed !== a.effectiveScoreSpeed) {
        return b.effectiveScoreSpeed - a.effectiveScoreSpeed;
      }
      if (b.summary.totalCombinedSessions !== a.summary.totalCombinedSessions) {
        return b.summary.totalCombinedSessions - a.summary.totalCombinedSessions;
      }
      return b.summary.bestAcidScore - a.summary.bestAcidScore;
    });

    var leaderboardHtml = entries.map(function (item, idx) {
      var u = item.user;
      var s = item.summary;
      var isCurrent = u.id === activeId;
      var isSelected = u.id === selectedUser.id;
      var reachedTxt = s.bestAcidReachedLevel > 0 ? 'Lv.' + s.bestAcidReachedLevel : '-';

      return (
        '<div class="leaderboard-card' +
        (isCurrent ? ' is-current' : '') +
        (isSelected ? ' is-selected' : '') +
        '" data-user-card="' + escapeHtml(u.id) + '" role="button" tabindex="0">' +
        '  <div class="leaderboard-card-top">' +
        '    <div class="leaderboard-identity">' +
        '      <span class="rank-num">#' + (idx + 1) + '</span>' +
        '      <span class="user-avatar-sm">' + escapeHtml(u.name.slice(0, 1)) + '</span>' +
        '      <strong class="leaderboard-name">' + escapeHtml(u.name) + '</strong>' +
        renderGradeBadgeHTML(s.grade, 'grade-badge--xs') +
        '    </div>' +
        (isCurrent
          ? '<span class="current-user-pill">현재 사용자</span>'
          : '<button type="button" class="btn btn-secondary btn-xs" data-switch-user="' + escapeHtml(u.id) + '">이 사용자로 전환</button>') +
        '  </div>' +
        '  <div class="leaderboard-stats-grid">' +
        '    <div class="lb-stat">' +
        '      <span class="lb-stat-label">한글 최고 / 영어 최고</span>' +
        '      <strong class="lb-stat-val">' + s.bestKoCpm + ' CPM · ' + s.bestEnWpm + ' WPM</strong>' +
        '    </div>' +
        '    <div class="lb-stat">' +
        '      <span class="lb-stat-label">평균 정타율 · 누적 연습</span>' +
        '      <strong class="lb-stat-val">' + (s.totalSessions > 0 ? s.overallAvgAccuracy.toFixed(1) + '%' : '-') + ' · ' + s.totalCombinedSessions + '회</strong>' +
        '    </div>' +
        '    <div class="lb-stat">' +
        '      <span class="lb-stat-label">산성비 최고 · 도달</span>' +
        '      <strong class="lb-stat-val">' + s.bestAcidScore.toLocaleString() + '점 · ' + reachedTxt + '</strong>' +
        '    </div>' +
        '  </div>' +
        '</div>'
      );
    }).join('');

    var selectedSummary = store.getOverallSummary(selectedUser);
    var progress = store.getGradeProgress(selectedUser);
    var isSelectedCurrent = selectedUser.id === activeId;

    var progressSectionHtml = '';
    if (progress.isMaster) {
      progressSectionHtml =
        '<div class="master-achieved-banner">' +
        '  <span class="master-crown" aria-hidden="true">🏆</span>' +
        '  <div>' +
        '    <strong>최고 등급 달성 완료 (5단계 마스터)</strong>' +
        '    <p>모든 누적 연습·타수·정타율 기준을 돌파하여 최고 등급에 올랐습니다!</p>' +
        '  </div>' +
        '</div>';
    } else {
      progressSectionHtml =
        '<div class="next-grade-header">' +
        '  <span class="next-grade-label">다음 승급 목표</span>' +
        renderGradeBadgeHTML(progress.nextGrade, 'grade-badge--sm') +
        '</div>';
    }

    var accText = progress.accuracy.hasRequirement
      ? (selectedSummary.totalSessions > 0 ? progress.accuracy.current.toFixed(1) + '%' : '0%') + ' / ' + progress.accuracy.target + '%'
      : (selectedSummary.totalSessions > 0 ? progress.accuracy.current.toFixed(1) + '% (기준 없음 · 달성)' : '기준 없음 · 달성');

    var progressBarsHtml =
      '<div class="grade-progress-list">' +
      '  <div class="grade-progress-item">' +
      '    <div class="grade-progress-meta">' +
      '      <span class="gp-label">누적 연습 횟수 (전체 모드 + 산성비)</span>' +
      '      <strong class="gp-values">' + progress.sessions.current + ' / ' + progress.sessions.target + '회 (' + progress.sessions.pct + '%)</strong>' +
      '    </div>' +
      '    <div class="grade-progress-track">' +
      '      <div class="grade-progress-fill' + (progress.sessions.met ? ' is-met' : '') + '" style="width: ' + progress.sessions.pct + '%"></div>' +
      '    </div>' +
      '  </div>' +
      '  <div class="grade-progress-item">' +
      '    <div class="grade-progress-meta">' +
      '      <span class="gp-label">최고 타수 <small>(한글 ' + progress.speed.targetCpm + ' CPM 또는 영어 ' + progress.speed.targetWpm + ' WPM)</small></span>' +
      '      <strong class="gp-values">' + progress.speed.current + ' / ' + progress.speed.target + ' ' + progress.speed.unit + ' (' + progress.speed.pct + '%)</strong>' +
      '    </div>' +
      '    <div class="grade-progress-track">' +
      '      <div class="grade-progress-fill' + (progress.speed.met ? ' is-met' : '') + '" style="width: ' + progress.speed.pct + '%"></div>' +
      '    </div>' +
      '  </div>' +
      '  <div class="grade-progress-item">' +
      '    <div class="grade-progress-meta">' +
      '      <span class="gp-label">전체 평균 정타율</span>' +
      '      <strong class="gp-values">' + accText + '</strong>' +
      '    </div>' +
      '    <div class="grade-progress-track">' +
      '      <div class="grade-progress-fill' + (progress.accuracy.met ? ' is-met' : '') + '" style="width: ' + progress.accuracy.pct + '%"></div>' +
      '    </div>' +
      '  </div>' +
      '</div>';

    var modeCardsHtml = MODE_META.map(function (meta) {
      var m = selectedUser.practice && selectedUser.practice[meta.id] ? selectedUser.practice[meta.id] : {};
      return (
        '<div class="dash-mode-card">' +
        '  <div class="dash-mode-head">' +
        '    <strong>' + meta.label + '</strong>' +
        '    <span class="record-count-pill">' + (m.sessions || 0) + '회</span>' +
        '  </div>' +
        '  <div class="dash-mode-nums">' +
        '    <div><span>최고 타수</span><strong>' + (m.bestCpm || 0) + ' CPM <small>(' + (m.bestWpm || 0) + ' WPM)</small></strong></div>' +
        '    <div><span>평균 정타율</span><strong>' + (m.sessions > 0 ? Number(m.avgAccuracy).toFixed(1) + '%' : '-') + '</strong></div>' +
        '  </div>' +
        '</div>'
      );
    }).join('');

    var koAcid = selectedUser.acidRain && selectedUser.acidRain.ko ? selectedUser.acidRain.ko : {};
    var enAcid = selectedUser.acidRain && selectedUser.acidRain.en ? selectedUser.acidRain.en : {};

    var gradeRowsHtml = store.GRADE_TIERS.map(function (g) {
      var isUserTier = g.tier === selectedSummary.grade.tier;
      var sessReq = g.minSessions === 0 ? '기본 (신규 생성)' : g.minSessions + '회 이상';
      var speedReq = g.minCpm === 0 ? '-' : g.minCpm + ' CPM 또는 ' + g.minWpm + ' WPM 이상';
      var accReq = g.minAccuracy === 0 ? '-' : g.minAccuracy + '% 이상';

      return (
        '<tr class="' + (isUserTier ? 'is-current-tier' : '') + '">' +
        '  <td>' + g.tier + '단계</td>' +
        '  <td>' + renderGradeBadgeHTML(g, 'grade-badge--sm') + '</td>' +
        '  <td>' + sessReq + '</td>' +
        '  <td>' + speedReq + '</td>' +
        '  <td>' + accReq + '</td>' +
        '</tr>'
      );
    }).join('');

    self.overlayEl.innerHTML =
      '<div class="dashboard-modal" tabindex="-1">' +
      '  <div class="dashboard-header">' +
      '    <div>' +
      '      <span class="dashboard-eyebrow">MULTI-USER RANK &amp; STATS</span>' +
      '      <h2 class="dashboard-title" id="dashboard-modal-title">전체 사용자 현황 및 등급 대시보드</h2>' +
      '    </div>' +
      '    <button type="button" class="modal-close-btn" id="dashboard-close-btn" aria-label="대시보드 닫기">✕</button>' +
      '  </div>' +
      '  <div class="dashboard-body">' +
      '    <section class="dash-section">' +
      '      <div class="section-heading-row">' +
      '        <h3 class="section-heading">① 전체 사용자 비교 (리더보드 · ' + users.length + '명)</h3>' +
      '        <span class="section-hint">카드를 클릭하면 아래에서 해당 사용자의 상세 진행률을 볼 수 있습니다.</span>' +
      '      </div>' +
      '      <div class="leaderboard-grid">' + leaderboardHtml + '</div>' +
      '    </section>' +
      '    <section class="dash-section dash-detail-panel">' +
      '      <div class="dash-detail-header">' +
      '        <div class="dash-detail-user">' +
      '          <span class="user-avatar-md">' + escapeHtml(selectedUser.name.slice(0, 1)) + '</span>' +
      '          <div>' +
      '            <div class="dash-detail-name-row">' +
      '              <strong>' + escapeHtml(selectedUser.name) + '</strong>' +
      renderGradeBadgeHTML(selectedSummary.grade, 'grade-badge--sm') +
      (isSelectedCurrent ? '<span class="current-user-pill">현재 사용자</span>' : '') +
      '            </div>' +
      '            <span class="section-hint">전체 누적 ' + selectedSummary.totalCombinedSessions + '회 (연습 ' + selectedSummary.totalSessions + '회 + 산성비 ' + selectedSummary.totalAcidGames + '회)</span>' +
      '          </div>' +
      '        </div>' +
      (!isSelectedCurrent
        ? '<button type="button" class="btn btn-primary btn-sm" id="dash-switch-selected-btn" data-switch-user="' + escapeHtml(selectedUser.id) + '">이 사용자로 전환</button>'
        : '') +
      '      </div>' +
      '      <div class="dash-progress-box">' +
      '        <h4 class="dash-subheading">② 다음 등급 승급 진행률</h4>' +
      progressSectionHtml +
      progressBarsHtml +
      '      </div>' +
      '      <div class="dash-modes-box">' +
      '        <h4 class="dash-subheading">모드별 세부 기록</h4>' +
      '        <div class="dash-mode-grid">' + modeCardsHtml + '</div>' +
      '        <div class="dash-acid-summary-row">' +
      '          <span class="acid-chip-item"><span class="acid-badge acid-badge--ko">한글 산성비</span> 최고 ' + (koAcid.highScore || 0).toLocaleString() + '점 · 클리어 ' + (koAcid.bestClearedLevel > 0 ? koAcid.bestClearedLevel + '단계' : '미달성') + ' · 도달 ' + (koAcid.bestReachedLevel > 0 ? koAcid.bestReachedLevel + '단계' : '-') + ' (' + (koAcid.gamesPlayed || 0) + '회)</span>' +
      '          <span class="acid-chip-item"><span class="acid-badge acid-badge--en">영어 산성비</span> 최고 ' + (enAcid.highScore || 0).toLocaleString() + '점 · 클리어 ' + (enAcid.bestClearedLevel > 0 ? enAcid.bestClearedLevel + '단계' : '미달성') + ' · 도달 ' + (enAcid.bestReachedLevel > 0 ? enAcid.bestReachedLevel + '단계' : '-') + ' (' + (enAcid.gamesPlayed || 0) + '회)</span>' +
      '        </div>' +
      '      </div>' +
      '    </section>' +
      '    <section class="dash-section">' +
      '      <div class="section-heading-row">' +
      '        <h3 class="section-heading">③ 전체 등급 가이드 (5단계 승급 기준)</h3>' +
      '        <span class="section-hint">누적 연습(산성비 포함), 최고 타수(한글 CPM 또는 영어 WPM), 전체 평균 정타율을 모두 만족하면 자동 승급됩니다.</span>' +
      '      </div>' +
      '      <div class="grade-guide-table-wrap">' +
      '        <table class="grade-guide-table">' +
      '          <thead><tr><th>단계</th><th>등급 배지</th><th>누적 연습 횟수</th><th>최고 타수 (한글 / 영어)</th><th>평균 정타율</th></tr></thead>' +
      '          <tbody>' + gradeRowsHtml + '</tbody>' +
      '        </table>' +
      '      </div>' +
      '    </section>' +
      '  </div>' +
      '</div>';

    self._bindEvents();
  };

  DashboardModal.prototype._bindEvents = function () {
    var self = this;
    var store = TypingApp.ProfileStore;

    var closeBtn = self.overlayEl.querySelector('#dashboard-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', function () {
        self.close();
      });
    }

    var switchBtns = self.overlayEl.querySelectorAll('[data-switch-user]');
    switchBtns.forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var uid = btn.dataset.switchUser;
        if (!uid) return;
        var res = store.selectUser(uid);
        if (res.ok) {
          self.selectedUserId = res.user.id;
          self._notifyProfileChanged(res.user, 'select');
          self._notifyToast(res.user.name + ' 사용자로 전환했습니다.');
          self.render();
        }
      });
    });

    var cards = self.overlayEl.querySelectorAll('[data-user-card]');
    cards.forEach(function (card) {
      function selectCard() {
        var uid = card.dataset.userCard;
        if (uid && uid !== self.selectedUserId) {
          self.selectedUserId = uid;
          self.render();
        }
      }
      card.addEventListener('click', selectCard);
      card.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          selectCard();
        }
      });
    });
  };

  TypingApp.DashboardModal = DashboardModal;
})(window);
