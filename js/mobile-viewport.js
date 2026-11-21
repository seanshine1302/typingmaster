(function (global) {
  'use strict';

  var TypingApp = (global.TypingApp = global.TypingApp || {});

  var STORAGE_KEY = 'typingmaster_hw_kb';

  function readSavedHwKbMode() {
    try {
      return global.localStorage && global.localStorage.getItem(STORAGE_KEY) === '1';
    } catch (e) {
      return false;
    }
  }

  function saveHwKbMode(enabled) {
    try {
      if (global.localStorage) {
        global.localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0');
      }
    } catch (e) {
      // Ignore storage errors in private browsing or restricted environments
    }
  }

  function isTouchCapable() {
    return (
      (typeof global.ontouchstart !== 'undefined') ||
      (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0)
    );
  }

  var hwKeyboardMode = readSavedHwKbMode();
  var deferredInstallPrompt = null;
  var installChangeCallback = null;
  var initialized = false;

  function syncViewportMetrics() {
    if (typeof document === 'undefined' || !document.documentElement) return;
    var rootStyle = document.documentElement.style;
    var vv = global.visualViewport;
    var layoutH = global.innerHeight || document.documentElement.clientHeight || 800;
    var vvh = vv && typeof vv.height === 'number' ? vv.height : layoutH;
    var offsetTop = vv && typeof vv.offsetTop === 'number' ? vv.offsetTop : 0;
    var kbHeight = Math.max(0, Math.round(layoutH - vvh - offsetTop));

    rootStyle.setProperty('--vvh', Math.round(vvh) + 'px');
    rootStyle.setProperty('--kb-offset', kbHeight + 'px');

    var headerEl = document.getElementById('app-header');
    if (headerEl && headerEl.offsetHeight > 0) {
      rootStyle.setProperty('--header-h', headerEl.offsetHeight + 'px');
    }

    var isVkbOpen = kbHeight > 120;
    if (document.body) {
      document.body.classList.toggle('is-vkb-open', isVkbOpen);
    }

    if (isVkbOpen) {
      var activeEl = document.activeElement;
      if (activeEl && activeEl.classList && activeEl.classList.contains('typing-input')) {
        if (typeof activeEl.scrollIntoView === 'function') {
          try {
            activeEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          } catch (err) {
            activeEl.scrollIntoView(false);
          }
        }
      }
    }
  }

  function applyInputMode(inputEl, enterKeyHint) {
    if (!inputEl) return;
    var modeValue = hwKeyboardMode ? 'none' : 'text';
    inputEl.setAttribute('inputmode', modeValue);
    if ('inputMode' in inputEl) {
      inputEl.inputMode = modeValue;
    }
    if ('virtualKeyboardPolicy' in inputEl) {
      inputEl.virtualKeyboardPolicy = hwKeyboardMode ? 'manual' : 'auto';
    }
    if (enterKeyHint) {
      inputEl.setAttribute('enterkeyhint', enterKeyHint);
    } else if (!inputEl.getAttribute('enterkeyhint')) {
      inputEl.setAttribute('enterkeyhint', 'send');
    }
  }

  function applyToAllActiveInputs() {
    if (typeof document === 'undefined' || typeof document.querySelectorAll !== 'function') return;
    var inputs = document.querySelectorAll('.typing-input');
    for (var i = 0; i < inputs.length; i++) {
      applyInputMode(inputs[i]);
    }
  }

  function setHardwareKeyboardMode(enabled) {
    hwKeyboardMode = Boolean(enabled);
    saveHwKbMode(hwKeyboardMode);
    applyToAllActiveInputs();
    return hwKeyboardMode;
  }

  function isHardwareKeyboardMode() {
    return hwKeyboardMode;
  }

  function bindPinchZoomGuards() {
    if (typeof document === 'undefined' || !document.addEventListener) return;

    function preventMultiTouch(e) {
      if (!e) return;
      if ((e.touches && e.touches.length > 1) || (typeof e.scale === 'number' && e.scale !== 1)) {
        e.preventDefault();
      }
    }

    function preventGesture(e) {
      if (e) e.preventDefault();
    }

    document.addEventListener('touchstart', preventMultiTouch, { passive: false });
    document.addEventListener('touchmove', preventMultiTouch, { passive: false });
    document.addEventListener('gesturestart', preventGesture, { passive: false });
    document.addEventListener('gesturechange', preventGesture, { passive: false });
    document.addEventListener('gestureend', preventGesture, { passive: false });
  }

  function registerServiceWorker() {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    if (typeof location === 'undefined') return;
    var isSecureOrigin =
      location.protocol === 'https:' ||
      location.hostname === 'localhost' ||
      location.hostname === '127.0.0.1';
    if (!isSecureOrigin) return;

    global.addEventListener('load', function () {
      navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(function () {
        // Silent fallback if SW cannot register in restricted context
      });
    });
  }

  function notifyInstallAvailability() {
    if (typeof installChangeCallback === 'function') {
      installChangeCallback(Boolean(deferredInstallPrompt));
    }
  }

  function init(options) {
    var opts = options || {};
    if (typeof opts.onInstallAvailabilityChange === 'function') {
      installChangeCallback = opts.onInstallAvailabilityChange;
    }

    syncViewportMetrics();

    if (initialized) {
      notifyInstallAvailability();
      return;
    }
    initialized = true;

    if (global.visualViewport) {
      global.visualViewport.addEventListener('resize', syncViewportMetrics);
      global.visualViewport.addEventListener('scroll', syncViewportMetrics);
    }
    global.addEventListener('resize', syncViewportMetrics);
    global.addEventListener('orientationchange', function () {
      setTimeout(syncViewportMetrics, 120);
    });

    if (typeof document !== 'undefined') {
      document.addEventListener('focusin', function (e) {
        if (e.target && e.target.classList && e.target.classList.contains('typing-input')) {
          setTimeout(syncViewportMetrics, 180);
        }
      });
      document.addEventListener('focusout', function () {
        setTimeout(syncViewportMetrics, 180);
      });
    }

    bindPinchZoomGuards();
    registerServiceWorker();

    global.addEventListener('beforeinstallprompt', function (e) {
      e.preventDefault();
      deferredInstallPrompt = e;
      notifyInstallAvailability();
    });

    global.addEventListener('appinstalled', function () {
      deferredInstallPrompt = null;
      notifyInstallAvailability();
    });
  }

  function canInstall() {
    return Boolean(deferredInstallPrompt);
  }

  function promptInstall() {
    if (!deferredInstallPrompt) return Promise.resolve(false);
    var promptObj = deferredInstallPrompt;
    deferredInstallPrompt = null;
    notifyInstallAvailability();
    return promptObj.prompt().then(function () {
      return promptObj.userChoice ? promptObj.userChoice.then(function (res) {
        return res && res.outcome === 'accepted';
      }) : true;
    }).catch(function () {
      return false;
    });
  }

  TypingApp.MobileSupport = {
    init: init,
    syncViewportMetrics: syncViewportMetrics,
    isHardwareKeyboardMode: isHardwareKeyboardMode,
    setHardwareKeyboardMode: setHardwareKeyboardMode,
    applyInputMode: applyInputMode,
    isTouchCapable: isTouchCapable,
    canInstall: canInstall,
    promptInstall: promptInstall,
  };
})(window);
