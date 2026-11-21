(function (global) {
  'use strict';

  var TypingApp = (global.TypingApp = global.TypingApp || {});

  var STORAGE_KEY = 'typingmaster_profiles_v1';
  var ACTIVE_USER_KEY = 'typingmaster_active_user_id_v1';
  var PRACTICE_MODES = ['position', 'word', 'short', 'long', 'dictation'];
  var MAX_HISTORY = 50;

  var GRADE_TIERS = [
    { tier: 1, id: 'beginner', label: '초보자', colorName: 'gray', minSessions: 0, minCpm: 0, minWpm: 0, minAccuracy: 0 },
    { tier: 2, id: 'novice', label: '입문자', colorName: 'mint', minSessions: 5, minCpm: 100, minWpm: 20, minAccuracy: 0 },
    { tier: 3, id: 'skilled', label: '숙련자', colorName: 'sky', minSessions: 20, minCpm: 200, minWpm: 40, minAccuracy: 90 },
    { tier: 4, id: 'expert', label: '전문가', colorName: 'purple', minSessions: 50, minCpm: 350, minWpm: 70, minAccuracy: 95 },
    { tier: 5, id: 'master', label: '마스터', colorName: 'amber', minSessions: 100, minCpm: 500, minWpm: 100, minAccuracy: 97 },
  ];

  var memoryFallback = null;

  function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function makeId(prefix) {
    return (
      (prefix || 'id') +
      '_' +
      Date.now().toString(36) +
      '_' +
      Math.random().toString(36).slice(2, 7)
    );
  }

  function emptyModeStats() {
    return {
      sessions: 0,
      bestCpm: 0,
      bestWpm: 0,
      totalAccuracySum: 0,
      avgAccuracy: 0,
      lastPlayedAt: null,
    };
  }

  function emptyAcidStats() {
    return {
      highScore: 0,
      bestClearedLevel: 0,
      bestReachedLevel: 0,
      gamesPlayed: 0,
    };
  }

  function normalizeModeStats(raw) {
    var src = raw && typeof raw === 'object' ? raw : {};
    var sessions = Math.max(0, Math.floor(Number(src.sessions) || 0));
    var totalAccuracySum = Math.max(0, Number(src.totalAccuracySum) || 0);
    var avgAccuracy =
      sessions > 0
        ? Number((totalAccuracySum / sessions).toFixed(1))
        : Math.max(0, Math.min(100, Number(src.avgAccuracy) || 0));

    return {
      sessions: sessions,
      bestCpm: Math.max(0, Math.round(Number(src.bestCpm) || 0)),
      bestWpm: Math.max(0, Math.round(Number(src.bestWpm) || 0)),
      totalAccuracySum: Number(totalAccuracySum.toFixed(2)),
      avgAccuracy: avgAccuracy,
      lastPlayedAt: typeof src.lastPlayedAt === 'string' ? src.lastPlayedAt : null,
    };
  }

  function normalizeAcidStats(raw) {
    var src = raw && typeof raw === 'object' ? raw : {};
    return {
      highScore: Math.max(0, Math.round(Number(src.highScore) || 0)),
      bestClearedLevel: Math.max(0, Math.min(10, Math.floor(Number(src.bestClearedLevel) || 0))),
      bestReachedLevel: Math.max(0, Math.min(10, Math.floor(Number(src.bestReachedLevel) || 0))),
      gamesPlayed: Math.max(0, Math.floor(Number(src.gamesPlayed) || 0)),
    };
  }

  function normalizeHistoryItem(raw) {
    if (!raw || typeof raw !== 'object') return null;
    var mode = String(raw.mode || 'word');
    if (PRACTICE_MODES.indexOf(mode) === -1 && mode !== 'acid') return null;

    return {
      id: typeof raw.id === 'string' && raw.id ? raw.id : makeId('hist'),
      mode: mode,
      lang: raw.lang === 'en' ? 'en' : 'ko',
      title: typeof raw.title === 'string' ? raw.title : '',
      cpm: Math.max(0, Math.round(Number(raw.cpm) || 0)),
      wpm: Math.max(0, Math.round(Number(raw.wpm) || 0)),
      accuracy: Math.max(0, Math.min(100, Number(raw.accuracy) || 0)),
      typoRate: Math.max(0, Math.min(100, Number(raw.typoRate) || 0)),
      elapsedSeconds: Math.max(0, Math.round(Number(raw.elapsedSeconds) || 0)),
      score: Math.max(0, Math.round(Number(raw.score) || 0)),
      reachedLevel: Math.max(0, Math.min(10, Math.floor(Number(raw.reachedLevel) || 0))),
      clearedLevel: Math.max(0, Math.min(10, Math.floor(Number(raw.clearedLevel) || 0))),
      clearedCount: Math.max(0, Math.floor(Number(raw.clearedCount) || 0)),
      timestamp: typeof raw.timestamp === 'string' ? raw.timestamp : new Date().toISOString(),
    };
  }

  function createUserObject(name, id) {
    return {
      id: id || makeId('usr'),
      name: String(name || '기본 사용자').trim().slice(0, 20) || '기본 사용자',
      createdAt: new Date().toISOString(),
      settings: {
        lang: 'ko',
      },
      bestSpeed: {
        koCpm: 0,
        enWpm: 0,
      },
      practice: {
        position: emptyModeStats(),
        word: emptyModeStats(),
        short: emptyModeStats(),
        long: emptyModeStats(),
        dictation: emptyModeStats(),
      },
      acidRain: {
        ko: emptyAcidStats(),
        en: emptyAcidStats(),
      },
      recentHistory: [],
    };
  }

  function normalizeUser(raw) {
    if (!raw || typeof raw !== 'object') return null;
    var cleanName = typeof raw.name === 'string' ? raw.name.trim().slice(0, 20) : '';
    if (!cleanName) return null;

    var practiceRaw = raw.practice && typeof raw.practice === 'object' ? raw.practice : {};
    var acidRaw = raw.acidRain && typeof raw.acidRain === 'object' ? raw.acidRain : {};
    var settingsRaw = raw.settings && typeof raw.settings === 'object' ? raw.settings : {};
    var historyRaw = Array.isArray(raw.recentHistory) ? raw.recentHistory : [];

    var history = [];
    for (var i = 0; i < historyRaw.length && history.length < MAX_HISTORY; i++) {
      var h = normalizeHistoryItem(historyRaw[i]);
      if (h) history.push(h);
    }

    var practice = {
      position: normalizeModeStats(practiceRaw.position),
      word: normalizeModeStats(practiceRaw.word),
      short: normalizeModeStats(practiceRaw.short),
      long: normalizeModeStats(practiceRaw.long),
      dictation: normalizeModeStats(practiceRaw.dictation),
    };

    var speedRaw = raw.bestSpeed && typeof raw.bestSpeed === 'object' ? raw.bestSpeed : {};
    var koCpm = Math.max(0, Math.round(Number(speedRaw.koCpm) || 0));
    var enWpm = Math.max(0, Math.round(Number(speedRaw.enWpm) || 0));

    for (var hi = 0; hi < history.length; hi++) {
      var hItem = history[hi];
      if (hItem.mode !== 'acid') {
        if (hItem.lang === 'ko' && hItem.cpm > koCpm) koCpm = hItem.cpm;
        if (hItem.lang === 'en' && hItem.wpm > enWpm) enWpm = hItem.wpm;
      }
    }

    // Backfill legacy profiles lacking bestSpeed & recentHistory
    if (koCpm === 0 && enWpm === 0) {
      var legacyBestCpm = 0;
      var legacyBestWpm = 0;
      PRACTICE_MODES.forEach(function (m) {
        if (practice[m].bestCpm > legacyBestCpm) legacyBestCpm = practice[m].bestCpm;
        if (practice[m].bestWpm > legacyBestWpm) legacyBestWpm = practice[m].bestWpm;
      });
      if (legacyBestCpm > 0 || legacyBestWpm > 0) {
        if (settingsRaw.lang === 'en') {
          enWpm = legacyBestWpm;
        } else {
          koCpm = legacyBestCpm;
        }
      }
    }

    return {
      id: typeof raw.id === 'string' && raw.id ? raw.id : makeId('usr'),
      name: cleanName,
      createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date().toISOString(),
      settings: {
        lang: settingsRaw.lang === 'en' ? 'en' : 'ko',
      },
      bestSpeed: {
        koCpm: koCpm,
        enWpm: enWpm,
      },
      practice: practice,
      acidRain: {
        ko: normalizeAcidStats(acidRaw.ko),
        en: normalizeAcidStats(acidRaw.en),
      },
      recentHistory: history,
    };
  }

  function createDefaultState() {
    var defaultUser = createUserObject('기본 사용자', 'usr_default');
    return {
      version: 1,
      activeUserId: defaultUser.id,
      users: [defaultUser],
    };
  }

  function normalizeState(raw) {
    if (!raw || typeof raw !== 'object' || !Array.isArray(raw.users)) {
      return null;
    }

    var users = [];
    var seenIds = {};
    var seenNames = {};

    for (var i = 0; i < raw.users.length; i++) {
      var u = normalizeUser(raw.users[i]);
      if (!u) continue;
      if (seenIds[u.id]) u.id = makeId('usr');
      var nameKey = u.name.toLowerCase();
      if (seenNames[nameKey]) continue;
      seenIds[u.id] = true;
      seenNames[nameKey] = true;
      users.push(u);
    }

    if (users.length === 0) return null;

    var activeId = typeof raw.activeUserId === 'string' && seenIds[raw.activeUserId]
      ? raw.activeUserId
      : users[0].id;

    return {
      version: 1,
      activeUserId: activeId,
      users: users,
    };
  }

  function readStorageRaw() {
    try {
      if (global.localStorage) {
        return global.localStorage.getItem(STORAGE_KEY);
      }
    } catch (e) {
      // Fallback to memory storage
    }
    return memoryFallback;
  }

  function writeStorageRaw(serialized) {
    memoryFallback = serialized;
    try {
      if (global.localStorage) {
        global.localStorage.setItem(STORAGE_KEY, serialized);
      }
    } catch (e) {
      // Ignore quota / privacy mode failures and retain in-memory copy
    }
  }

  function readSavedActiveUserId() {
    try {
      if (global.localStorage) {
        return global.localStorage.getItem(ACTIVE_USER_KEY) || '';
      }
    } catch (e) {
      // Ignore storage errors
    }
    return '';
  }

  function writeSavedActiveUserId(userId) {
    try {
      if (global.localStorage && userId) {
        global.localStorage.setItem(ACTIVE_USER_KEY, String(userId));
      }
    } catch (e) {
      // Ignore storage errors
    }
  }

  function loadState() {
    var raw = readStorageRaw();
    if (raw) {
      try {
        var parsed = JSON.parse(raw);
        var normalized = normalizeState(parsed);
        if (normalized) {
          var savedId = readSavedActiveUserId();
          if (savedId && normalized.users.some(function (u) { return u.id === savedId; })) {
            normalized.activeUserId = savedId;
          } else {
            writeSavedActiveUserId(normalized.activeUserId);
          }
          return normalized;
        }
      } catch (e) {
        // Ignore corrupt JSON and recreate default state
      }
    }
    var fresh = createDefaultState();
    var existingSavedId = readSavedActiveUserId();
    writeStorageRaw(JSON.stringify(fresh));
    if (!existingSavedId) {
      writeSavedActiveUserId(fresh.activeUserId);
    }
    return fresh;
  }

  function saveState(stateObj) {
    if (stateObj && stateObj.activeUserId) {
      writeSavedActiveUserId(stateObj.activeUserId);
    }
    writeStorageRaw(JSON.stringify(stateObj));
  }

  var state = loadState();
  var listeners = [];
  var remoteBridge = null;
  var unsubscribeRemote = null;
  var initialSyncDone = false;

  function notifyListeners(reason) {
    var snapshot = {
      reason: reason || 'update',
      activeUser: clone(getActiveUserRef()),
      users: clone(state.users),
    };
    listeners.slice().forEach(function (fn) {
      try {
        fn(snapshot);
      } catch (err) {
        console.warn('[ProfileStore] listener error:', err);
      }
    });
  }

  function getUserTotalCount(userObj) {
    if (!userObj) return 0;
    var total = 0;
    PRACTICE_MODES.forEach(function (mode) {
      if (userObj.practice && userObj.practice[mode]) {
        total += Number(userObj.practice[mode].sessions) || 0;
      }
    });
    if (userObj.acidRain) {
      total += Number(userObj.acidRain.ko && userObj.acidRain.ko.gamesPlayed) || 0;
      total += Number(userObj.acidRain.en && userObj.acidRain.en.gamesPlayed) || 0;
    }
    return total;
  }

  function hasMeaningfulLocalData(userObj) {
    if (!userObj) return false;
    return (
      getUserTotalCount(userObj) > 0 ||
      userObj.id !== 'usr_default' ||
      userObj.name !== '기본 사용자'
    );
  }

  function sortUsersStably(users) {
    return users.slice().sort(function (a, b) {
      if (a.id === 'usr_default' && b.id !== 'usr_default') return -1;
      if (b.id === 'usr_default' && a.id !== 'usr_default') return 1;
      var ta = Date.parse(a.createdAt || '') || 0;
      var tb = Date.parse(b.createdAt || '') || 0;
      if (ta !== tb) return ta - tb;
      return String(a.name || '').localeCompare(String(b.name || ''));
    });
  }

  function resolveActiveUserId(users) {
    var preferredId = readSavedActiveUserId() || state.activeUserId;
    for (var i = 0; i < users.length; i++) {
      if (users[i].id === preferredId) {
        return preferredId;
      }
    }
    return users[0].id;
  }

  function applyRemoteUsers(rawRemoteList, reason) {
    var normalizedList = [];
    (rawRemoteList || []).forEach(function (item) {
      var u = normalizeUser(item);
      if (u) normalizedList.push(u);
    });

    if (!normalizedList.length) {
      return false;
    }

    var sorted = sortUsersStably(normalizedList);
    state.users = sorted;
    state.activeUserId = resolveActiveUserId(sorted);
    saveState(state);
    notifyListeners(reason || 'remote');
    return true;
  }

  function pushUserToRemote(userObj) {
    if (!remoteBridge || typeof remoteBridge.upsertUser !== 'function' || !userObj) return;
    remoteBridge.upsertUser(clone(userObj)).catch(function (err) {
      console.warn('[ProfileStore] Firestore 저장 대기/오프라인 fallback:', err && err.message ? err.message : err);
    });
  }

  function deleteUserFromRemote(userId) {
    if (!remoteBridge || typeof remoteBridge.deleteUser !== 'function' || !userId) return;
    remoteBridge.deleteUser(userId).catch(function (err) {
      console.warn('[ProfileStore] Firestore 삭제 실패:', err && err.message ? err.message : err);
    });
  }

  function replaceAllRemoteUsers(users, previousIds) {
    if (!remoteBridge || typeof remoteBridge.replaceAllUsers !== 'function') return;
    remoteBridge.replaceAllUsers(clone(users), previousIds || []).catch(function (err) {
      console.warn('[ProfileStore] Firestore 전체 복원 동기화 실패:', err && err.message ? err.message : err);
    });
  }

  function attachRemoteBridge(bridge) {
    if (!bridge || !bridge.ready) return;
    remoteBridge = bridge;

    if (typeof unsubscribeRemote === 'function') {
      unsubscribeRemote();
      unsubscribeRemote = null;
    }

    var localUsersSnapshot = clone(state.users);

    bridge.fetchAllUsers().then(function (rawRemote) {
      var remoteUsers = [];
      (rawRemote || []).forEach(function (item) {
        var u = normalizeUser(item);
        if (u) remoteUsers.push(u);
      });

      var toUpload = [];
      if (remoteUsers.length === 0) {
        // First-time migration: upload all existing localStorage users to Firestore
        toUpload = localUsersSnapshot;
        remoteUsers = localUsersSnapshot;
      } else {
        var remoteById = {};
        remoteUsers.forEach(function (u) {
          remoteById[u.id] = u;
        });

        localUsersSnapshot.forEach(function (localUser) {
          var existingRemote = remoteById[localUser.id];
          if (!existingRemote) {
            if (hasMeaningfulLocalData(localUser)) {
              toUpload.push(localUser);
              remoteUsers.push(localUser);
              remoteById[localUser.id] = localUser;
            }
          } else if (getUserTotalCount(existingRemote) === 0 && getUserTotalCount(localUser) > 0) {
            toUpload.push(localUser);
            remoteById[localUser.id] = localUser;
            for (var k = 0; k < remoteUsers.length; k++) {
              if (remoteUsers[k].id === localUser.id) {
                remoteUsers[k] = localUser;
                break;
              }
            }
          }
        });
      }

      applyRemoteUsers(remoteUsers, 'initial-sync');
      initialSyncDone = true;

      if (toUpload.length > 0) {
        Promise.all(toUpload.map(function (u) {
          return bridge.upsertUser(u);
        })).catch(function (err) {
          console.warn('[ProfileStore] 기존 기록 마이그레이션 중 일부 지연:', err);
        });
      }

      if (typeof bridge.subscribeUsers === 'function') {
        unsubscribeRemote = bridge.subscribeUsers(
          function (liveList, metadata) {
            if (!initialSyncDone) return;
            if (metadata && metadata.hasPendingWrites) return;
            if (!liveList || liveList.length === 0) return;
            applyRemoteUsers(liveList, 'realtime');
          },
          function (err) {
            console.warn('[ProfileStore] Firestore 실시간 구독 오류(로컬 캐시 유지):', err && err.message ? err.message : err);
          }
        );
      }
    }).catch(function (err) {
      console.warn('[ProfileStore] Firestore 초기 동기화 실패(오프라인 캐시 사용):', err && err.message ? err.message : err);
    });
  }

  function getActiveUserRef() {
    for (var i = 0; i < state.users.length; i++) {
      if (state.users[i].id === state.activeUserId) {
        return state.users[i];
      }
    }
    state.activeUserId = state.users[0].id;
    return state.users[0];
  }

  function getUsers() {
    return clone(state.users);
  }

  function getActiveUser() {
    return clone(getActiveUserRef());
  }

  function getActiveUserId() {
    return getActiveUserRef().id;
  }

  function addUser(name) {
    var trimmed = typeof name === 'string' ? name.trim() : '';
    if (!trimmed) {
      return { ok: false, error: '사용자 이름을 입력해 주세요.' };
    }
    if (trimmed.length > 20) {
      return { ok: false, error: '사용자 이름은 20자 이내로 입력해 주세요.' };
    }

    var lower = trimmed.toLowerCase();
    for (var i = 0; i < state.users.length; i++) {
      if (state.users[i].name.toLowerCase() === lower) {
        return { ok: false, error: '이미 등록된 사용자 이름입니다.' };
      }
    }

    var user = createUserObject(trimmed);
    state.users.push(user);
    state.activeUserId = user.id;
    saveState(state);
    pushUserToRemote(user);

    return { ok: true, user: clone(user) };
  }

  function selectUser(userId) {
    for (var i = 0; i < state.users.length; i++) {
      if (state.users[i].id === userId) {
        state.activeUserId = userId;
        saveState(state);
        return { ok: true, user: clone(state.users[i]) };
      }
    }
    return { ok: false, error: '선택한 사용자를 찾을 수 없습니다.' };
  }

  function deleteUser(userId) {
    if (state.users.length <= 1) {
      return { ok: false, error: '최소 1명의 사용자는 유지되어야 합니다.' };
    }

    var idx = -1;
    for (var i = 0; i < state.users.length; i++) {
      if (state.users[i].id === userId) {
        idx = i;
        break;
      }
    }
    if (idx === -1) {
      return { ok: false, error: '삭제할 사용자를 찾을 수 없습니다.' };
    }

    state.users.splice(idx, 1);
    if (state.activeUserId === userId) {
      state.activeUserId = state.users[0].id;
    }
    saveState(state);
    deleteUserFromRemote(userId);

    return { ok: true, activeUser: clone(getActiveUserRef()) };
  }

  function setUserLanguage(lang) {
    var normalized = lang === 'en' ? 'en' : 'ko';
    var active = getActiveUserRef();
    active.settings.lang = normalized;
    saveState(state);
    pushUserToRemote(active);
    return normalized;
  }

  function recordPracticeSession(payload) {
    var opts = payload || {};
    var mode = opts.mode;
    if (PRACTICE_MODES.indexOf(mode) === -1) {
      return null;
    }

    var active = getActiveUserRef();
    var prevGrade = calculateUserGrade(active);
    var lang = opts.lang === 'en' ? 'en' : 'ko';
    var stats = opts.stats || {};
    var cpm = Math.max(0, Math.round(Number(stats.cpm) || 0));
    var wpm = Math.max(0, Math.round(Number(stats.wpm) || 0));
    var accuracy = Math.max(0, Math.min(100, Number(stats.accuracy) || 0));
    var typoRate = typeof stats.typoRate === 'number'
      ? Math.max(0, Math.min(100, stats.typoRate))
      : Number((100 - accuracy).toFixed(1));
    var elapsedSeconds = Math.max(0, Math.round(Number(stats.elapsedSeconds) || 0));
    var nowIso = new Date().toISOString();

    if (!active.bestSpeed) {
      active.bestSpeed = { koCpm: 0, enWpm: 0 };
    }
    if (lang === 'ko' && cpm > active.bestSpeed.koCpm) {
      active.bestSpeed.koCpm = cpm;
    }
    if (lang === 'en' && wpm > active.bestSpeed.enWpm) {
      active.bestSpeed.enWpm = wpm;
    }

    var modeStats = active.practice[mode];
    var isNewBestCpm = cpm > 0 && cpm > modeStats.bestCpm;

    modeStats.sessions += 1;
    if (cpm > modeStats.bestCpm) modeStats.bestCpm = cpm;
    if (wpm > modeStats.bestWpm) modeStats.bestWpm = wpm;
    modeStats.totalAccuracySum = Number((modeStats.totalAccuracySum + accuracy).toFixed(2));
    modeStats.avgAccuracy = Number((modeStats.totalAccuracySum / modeStats.sessions).toFixed(1));
    modeStats.lastPlayedAt = nowIso;

    active.recentHistory.unshift({
      id: makeId('hist'),
      mode: mode,
      lang: lang,
      title: typeof opts.title === 'string' ? opts.title : mode,
      cpm: cpm,
      wpm: wpm,
      accuracy: Number(accuracy.toFixed(1)),
      typoRate: Number(typoRate.toFixed(1)),
      elapsedSeconds: elapsedSeconds,
      score: 0,
      reachedLevel: 0,
      clearedLevel: 0,
      clearedCount: 0,
      timestamp: nowIso,
    });
    if (active.recentHistory.length > MAX_HISTORY) {
      active.recentHistory.length = MAX_HISTORY;
    }

    saveState(state);
    pushUserToRemote(active);
    var newGrade = calculateUserGrade(active);
    var gradeUp = newGrade.tier > prevGrade.tier ? { from: prevGrade, to: newGrade } : null;

    return {
      isNewBestCpm: isNewBestCpm,
      modeStats: clone(modeStats),
      grade: newGrade,
      gradeUp: gradeUp,
    };
  }

  function recordAcidRainResult(payload) {
    var opts = payload || {};
    var active = getActiveUserRef();
    var prevGrade = calculateUserGrade(active);
    var lang = opts.lang === 'en' ? 'en' : 'ko';
    var score = Math.max(0, Math.round(Number(opts.score) || 0));
    var reachedLevel = Math.max(1, Math.min(10, Math.floor(Number(opts.reachedLevel) || 1)));
    var clearedLevel = Math.max(0, Math.min(10, Math.floor(Number(opts.clearedLevel) || 0)));
    var clearedCount = Math.max(0, Math.floor(Number(opts.clearedCount) || 0));
    var nowIso = new Date().toISOString();

    var acidStats = active.acidRain[lang];
    var isNewHighScore = score > 0 && score > acidStats.highScore;

    acidStats.gamesPlayed += 1;
    if (score > acidStats.highScore) acidStats.highScore = score;
    if (clearedLevel > acidStats.bestClearedLevel) acidStats.bestClearedLevel = clearedLevel;
    if (reachedLevel > acidStats.bestReachedLevel) acidStats.bestReachedLevel = reachedLevel;

    active.recentHistory.unshift({
      id: makeId('hist'),
      mode: 'acid',
      lang: lang,
      title: '산성비 미니게임',
      cpm: 0,
      wpm: 0,
      accuracy: 0,
      typoRate: 0,
      elapsedSeconds: 0,
      score: score,
      reachedLevel: reachedLevel,
      clearedLevel: clearedLevel,
      clearedCount: clearedCount,
      timestamp: nowIso,
    });
    if (active.recentHistory.length > MAX_HISTORY) {
      active.recentHistory.length = MAX_HISTORY;
    }

    saveState(state);
    pushUserToRemote(active);
    var newGrade = calculateUserGrade(active);
    var gradeUp = newGrade.tier > prevGrade.tier ? { from: prevGrade, to: newGrade } : null;

    return {
      isNewHighScore: isNewHighScore,
      acidStats: clone(acidStats),
      grade: newGrade,
      gradeUp: gradeUp,
    };
  }

  function computeRawSummary(userObj) {
    var user = userObj || getActiveUserRef();
    var totalSessions = 0;
    var accSum = 0;
    var bestCpm = 0;
    var bestWpm = 0;

    PRACTICE_MODES.forEach(function (mode) {
      var m = user.practice && user.practice[mode] ? user.practice[mode] : emptyModeStats();
      totalSessions += m.sessions;
      accSum += m.totalAccuracySum;
      if (m.bestCpm > bestCpm) bestCpm = m.bestCpm;
      if (m.bestWpm > bestWpm) bestWpm = m.bestWpm;
    });

    var koAcid = user.acidRain && user.acidRain.ko ? user.acidRain.ko : emptyAcidStats();
    var enAcid = user.acidRain && user.acidRain.en ? user.acidRain.en : emptyAcidStats();
    var totalAcidGames = koAcid.gamesPlayed + enAcid.gamesPlayed;
    var bestKoCpm = user.bestSpeed && typeof user.bestSpeed.koCpm === 'number' ? user.bestSpeed.koCpm : 0;
    var bestEnWpm = user.bestSpeed && typeof user.bestSpeed.enWpm === 'number' ? user.bestSpeed.enWpm : 0;

    return {
      totalSessions: totalSessions,
      overallAvgAccuracy: totalSessions > 0 ? Number((accSum / totalSessions).toFixed(1)) : 0,
      bestCpm: bestCpm,
      bestWpm: bestWpm,
      bestKoCpm: bestKoCpm,
      bestEnWpm: bestEnWpm,
      totalAcidGames: totalAcidGames,
      totalCombinedSessions: totalSessions + totalAcidGames,
      bestAcidScore: Math.max(koAcid.highScore, enAcid.highScore),
      bestAcidReachedLevel: Math.max(koAcid.bestReachedLevel, enAcid.bestReachedLevel),
      bestAcidClearedLevel: Math.max(koAcid.bestClearedLevel, enAcid.bestClearedLevel),
    };
  }

  function calculateUserGrade(userObj) {
    var s = computeRawSummary(userObj);
    for (var i = GRADE_TIERS.length - 1; i >= 0; i--) {
      var g = GRADE_TIERS[i];
      var meetsSessions = s.totalCombinedSessions >= g.minSessions;
      var meetsSpeed =
        s.bestKoCpm >= g.minCpm ||
        s.bestEnWpm >= g.minWpm ||
        s.bestCpm >= g.minCpm ||
        s.bestWpm >= g.minWpm;
      var meetsAccuracy = g.minAccuracy === 0 || s.overallAvgAccuracy >= g.minAccuracy;

      if (meetsSessions && meetsSpeed && meetsAccuracy) {
        return clone(g);
      }
    }
    return clone(GRADE_TIERS[0]);
  }

  function getOverallSummary(userObj) {
    var user = userObj || getActiveUserRef();
    var raw = computeRawSummary(user);
    raw.grade = calculateUserGrade(user);
    return raw;
  }

  function getGradeProgress(userObj) {
    var user = userObj || getActiveUserRef();
    var summary = getOverallSummary(user);
    var currentGrade = summary.grade;
    var nextGrade = null;

    for (var i = 0; i < GRADE_TIERS.length; i++) {
      if (GRADE_TIERS[i].tier === currentGrade.tier + 1) {
        nextGrade = clone(GRADE_TIERS[i]);
        break;
      }
    }

    var isMaster = !nextGrade;
    var targetGrade = nextGrade || currentGrade;

    var effCpm = summary.bestKoCpm > 0 ? summary.bestKoCpm : (summary.bestEnWpm === 0 ? summary.bestCpm : 0);
    var effWpm = summary.bestEnWpm > 0 ? summary.bestEnWpm : (summary.bestKoCpm === 0 ? summary.bestWpm : 0);

    var sessCur = summary.totalCombinedSessions;
    var sessTarget = isMaster ? GRADE_TIERS[GRADE_TIERS.length - 1].minSessions : targetGrade.minSessions;
    var sessPct = sessTarget > 0 ? Math.min(100, Math.round((sessCur / sessTarget) * 100)) : 100;

    var koRatio = targetGrade.minCpm > 0 ? effCpm / targetGrade.minCpm : 1;
    var enRatio = targetGrade.minWpm > 0 ? effWpm / targetGrade.minWpm : 1;
    var useEn = enRatio > koRatio;
    var speedUnit = useEn ? 'WPM' : 'CPM';
    var speedCur = useEn ? effWpm : effCpm;
    var speedTarget = useEn ? targetGrade.minWpm : targetGrade.minCpm;
    var speedPct = speedTarget > 0 ? Math.min(100, Math.round((speedCur / speedTarget) * 100)) : 100;
    var speedMet = effCpm >= targetGrade.minCpm || effWpm >= targetGrade.minWpm;

    var accCur = summary.overallAvgAccuracy;
    var accTarget = targetGrade.minAccuracy;
    var hasAccReq = accTarget > 0;
    var accMet = !hasAccReq || accCur >= accTarget;
    var accPct = !hasAccReq ? 100 : Math.min(100, Math.round((accCur / accTarget) * 100));

    return {
      currentGrade: currentGrade,
      nextGrade: nextGrade,
      isMaster: isMaster,
      sessions: {
        current: sessCur,
        target: sessTarget,
        pct: isMaster ? 100 : sessPct,
        met: isMaster || sessCur >= sessTarget,
      },
      speed: {
        current: speedCur,
        target: speedTarget,
        unit: speedUnit,
        pct: isMaster ? 100 : speedPct,
        met: isMaster || speedMet,
        koCpm: effCpm,
        enWpm: effWpm,
        targetCpm: targetGrade.minCpm,
        targetWpm: targetGrade.minWpm,
      },
      accuracy: {
        current: accCur,
        target: accTarget,
        pct: isMaster ? 100 : accPct,
        met: isMaster || accMet,
        hasRequirement: hasAccReq,
      },
    };
  }

  function exportAllData() {
    return JSON.stringify(
      {
        app: 'TypingMaster',
        schemaVersion: 1,
        exportedAt: new Date().toISOString(),
        data: clone(state),
      },
      null,
      2
    );
  }

  function importAllData(jsonText) {
    if (typeof jsonText !== 'string' || !jsonText.trim()) {
      return { ok: false, error: '비어 있는 파일입니다.' };
    }

    var parsed;
    try {
      parsed = JSON.parse(jsonText);
    } catch (e) {
      return { ok: false, error: '올바른 JSON 백업 파일이 아닙니다.' };
    }

    var candidate = parsed && parsed.data ? parsed.data : parsed;
    var normalized = normalizeState(candidate);
    if (!normalized) {
      return { ok: false, error: '션샤인타자연습 사용자 기록 형식을 찾을 수 없습니다.' };
    }

    var previousIds = state.users.map(function (u) { return u.id; });
    state = normalized;
    saveState(state);
    replaceAllRemoteUsers(state.users, previousIds);

    return {
      ok: true,
      userCount: state.users.length,
      activeUser: clone(getActiveUserRef()),
    };
  }

  function subscribe(listener) {
    if (typeof listener !== 'function') {
      return function () {};
    }
    listeners.push(listener);
    return function () {
      var idx = listeners.indexOf(listener);
      if (idx !== -1) listeners.splice(idx, 1);
    };
  }

  TypingApp.ProfileStore = {
    GRADE_TIERS: clone(GRADE_TIERS),
    getUsers: getUsers,
    getActiveUser: getActiveUser,
    getActiveUserId: getActiveUserId,
    addUser: addUser,
    selectUser: selectUser,
    deleteUser: deleteUser,
    setUserLanguage: setUserLanguage,
    recordPracticeSession: recordPracticeSession,
    recordAcidRainResult: recordAcidRainResult,
    getOverallSummary: getOverallSummary,
    calculateUserGrade: calculateUserGrade,
    getGradeProgress: getGradeProgress,
    exportAllData: exportAllData,
    importAllData: importAllData,
    subscribe: subscribe,
    attachRemoteBridge: attachRemoteBridge,
    reload: function () {
      state = loadState();
      return getActiveUser();
    },
  };

  if (TypingApp.FirebaseBridge && TypingApp.FirebaseBridge.ready) {
    attachRemoteBridge(TypingApp.FirebaseBridge);
  }
})(window);
