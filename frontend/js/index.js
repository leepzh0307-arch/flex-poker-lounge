(function() {
  var toastEl = document.getElementById('toast');
  var toastTimer = null;

  function showToast(message) {
    if (!toastEl) return;
    toastEl.textContent = message;
    toastEl.classList.add('visible');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function() {
      toastEl.classList.remove('visible');
    }, 3000);
  }

  function openModal(id) {
    var overlay = document.getElementById(id);
    if (!overlay) return;
    overlay.classList.add('active');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    var firstInput = overlay.querySelector('.form-input');
    if (firstInput) {
      setTimeout(function() { firstInput.focus(); }, 300);
    }
  }

  function closeModal(id) {
    var overlay = document.getElementById(id);
    if (!overlay) return;
    overlay.classList.remove('active');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  function closeAllModals() {
    document.querySelectorAll('.modal-overlay.active').forEach(function(m) {
      m.classList.remove('active');
      m.setAttribute('aria-hidden', 'true');
    });
    document.body.style.overflow = '';
  }

  document.querySelectorAll('.mode-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var mode = this.getAttribute('data-mode');
      if (mode === 'pvp') openModal('pvp-modal');
      else if (mode === 'pvc') openModal('pvc-modal');
      else if (mode === 'omaha-pvc') openModal('omaha-pvc-modal');
      else if (mode === 'omaha-pvp') openModal('omaha-pvp-modal');
    });
  });

  document.querySelectorAll('.modal-close').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var overlay = this.closest('.modal-overlay');
      if (overlay) closeModal(overlay.id);
    });
  });

  document.querySelectorAll('.modal-overlay').forEach(function(overlay) {
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) closeModal(overlay.id);
    });
  });

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') closeAllModals();
  });

  var nav = document.querySelector('.nav');
  if (nav) {
    window.addEventListener('scroll', function() {
      if (window.scrollY > 40) nav.classList.add('scrolled');
      else nav.classList.remove('scrolled');
    }, { passive: true });
  }

  var nicknamePvp = document.getElementById('nickname-pvp');
  var nicknamePvc = document.getElementById('nickname-pvc');
  var roomIdInput = document.getElementById('room-id');
  var createRoomBtn = document.getElementById('create-room');
  var joinRoomBtn = document.getElementById('join-room');
  var createAiRoomBtn = document.getElementById('create-ai-room');
  var aiDifficultySelect = document.getElementById('ai-difficulty');
  var aiCountSelect = document.getElementById('ai-count');

  function validateNickname(inputEl) {
    var nickname = inputEl.value.trim();
    if (!nickname) {
      showToast('请输入昵称');
      inputEl.focus();
      return null;
    }
    if (nickname.length > 20) {
      showToast('昵称长度不能超过20个字符');
      inputEl.focus();
      return null;
    }
    return nickname;
  }

  function navigateToRoom(targetUrl) {
    if (FallingText.isAnimating()) return;

    try {
      var urlObj = new URL(targetUrl, window.location.origin);
      var params = {};
      urlObj.searchParams.forEach(function(value, key) {
        params[key] = value;
      });
      if (Object.keys(params).length > 0) {
        sessionStorage.setItem('flexPokerNavParams', JSON.stringify(params));
      }
    } catch (e) {}

    FallingText.trigger('#hero-content').then(function() {
      createRoomBtn.disabled = true;
      joinRoomBtn.disabled = true;
      if (createAiRoomBtn) createAiRoomBtn.disabled = true;

      var overlay = document.createElement('div');
      overlay.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:#F9F8F4;z-index:99999;pointer-events:none;';
      document.body.appendChild(overlay);

      if (document.startViewTransition) {
        document.startViewTransition(function() {
          window.location.href = targetUrl;
        });
      } else {
        window.location.href = targetUrl;
      }
    });
  }

  function createRoom() {
    var nickname = validateNickname(nicknamePvp);
    if (!nickname) return;

    var targetUrl = 'room.html?nickname=' + encodeURIComponent(nickname) + '&isHost=true&isCreating=true';
    closeAllModals();
    setTimeout(function() { navigateToRoom(targetUrl); }, 300);
  }

  function joinRoom() {
    var nickname = validateNickname(nicknamePvp);
    if (!nickname) return;

    var roomId = roomIdInput.value.trim();
    if (!roomId) {
      showToast('请输入房间号');
      roomIdInput.focus();
      return;
    }

    var targetUrl = 'room.html?roomId=' + roomId + '&nickname=' + encodeURIComponent(nickname) + '&isHost=false';
    closeAllModals();
    setTimeout(function() { navigateToRoom(targetUrl); }, 300);
  }

  function createAiRoom() {
    var nickname = validateNickname(nicknamePvc);
    if (!nickname) return;

    var aiDifficulty = aiDifficultySelect ? aiDifficultySelect.value : 'medium';
    var aiCount = aiCountSelect ? aiCountSelect.value : '3';

    var targetUrl = 'room.html?nickname=' + encodeURIComponent(nickname) + '&isHost=true&isCreating=true&isAiRoom=true&aiDifficulty=' + aiDifficulty + '&aiCount=' + aiCount;
    closeAllModals();
    setTimeout(function() { navigateToRoom(targetUrl); }, 300);
  }

  var bindEvent = function(element, handler) {
    if (element) {
      element.addEventListener('click', handler);
    }
  };

  bindEvent(createRoomBtn, createRoom);
  bindEvent(joinRoomBtn, joinRoom);
  bindEvent(createAiRoomBtn, createAiRoom);

  var createOmahaAiRoomBtn = document.getElementById('create-omaha-ai-room');
  var omahaNicknameInput = document.getElementById('omaha-nickname');
  var omahaAiDifficultySelect = document.getElementById('omaha-ai-difficulty');
  var omahaAiCountSelect = document.getElementById('omaha-ai-count');
  var omahaInitialChipsInput = document.getElementById('omaha-initial-chips');

  function createOmahaAiRoom() {
    var nickname = omahaNicknameInput ? omahaNicknameInput.value.trim() : '';
    if (!nickname) {
      showToast('请输入昵称');
      if (omahaNicknameInput) omahaNicknameInput.focus();
      return;
    }

    var aiDifficulty = omahaAiDifficultySelect ? omahaAiDifficultySelect.value : 'medium';
    var aiCount = omahaAiCountSelect ? omahaAiCountSelect.value : '3';
    var initialChips = omahaInitialChipsInput ? omahaInitialChipsInput.value : '1000';

    var targetUrl = 'omaha-room.html?nickname=' + encodeURIComponent(nickname) + '&isHost=true&isCreating=true&isAiRoom=true&aiDifficulty=' + aiDifficulty + '&aiCount=' + aiCount + '&initialChips=' + initialChips;
    closeAllModals();
    setTimeout(function() { navigateToRoom(targetUrl); }, 300);
  }

  bindEvent(createOmahaAiRoomBtn, createOmahaAiRoom);

  var createOmahaRoomBtn = document.getElementById('create-omaha-room');
  var joinOmahaRoomBtn = document.getElementById('join-omaha-room');
  var omahaPvpNickname = document.getElementById('omaha-pvp-nickname');
  var omahaPvpRoomId = document.getElementById('omaha-pvp-room-id');

  function createOmahaRoom() {
    var nickname = omahaPvpNickname ? omahaPvpNickname.value.trim() : '';
    if (!nickname) {
      showToast('请输入昵称');
      if (omahaPvpNickname) omahaPvpNickname.focus();
      return;
    }
    var targetUrl = 'omaha-room.html?nickname=' + encodeURIComponent(nickname) + '&isHost=true&isCreating=true&gameType=omaha';
    closeAllModals();
    setTimeout(function() { navigateToRoom(targetUrl); }, 300);
  }

  function joinOmahaRoom() {
    var nickname = omahaPvpNickname ? omahaPvpNickname.value.trim() : '';
    if (!nickname) {
      showToast('请输入昵称');
      if (omahaPvpNickname) omahaPvpNickname.focus();
      return;
    }
    var roomId = omahaPvpRoomId ? omahaPvpRoomId.value.trim() : '';
    if (!roomId) {
      showToast('请输入房间号');
      if (omahaPvpRoomId) omahaPvpRoomId.focus();
      return;
    }
    var targetUrl = 'omaha-room.html?roomId=' + roomId + '&nickname=' + encodeURIComponent(nickname) + '&isHost=false&gameType=omaha';
    closeAllModals();
    setTimeout(function() { navigateToRoom(targetUrl); }, 300);
  }

  bindEvent(createOmahaRoomBtn, createOmahaRoom);
  bindEvent(joinOmahaRoomBtn, joinOmahaRoom);

  if (omahaPvpNickname) {
    omahaPvpNickname.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        if (omahaPvpRoomId && omahaPvpRoomId.value.trim()) joinOmahaRoom();
        else createOmahaRoom();
      }
    });
  }

  if (omahaPvpRoomId) {
    omahaPvpRoomId.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') joinOmahaRoom();
    });
  }

  if (omahaNicknameInput) {
    omahaNicknameInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') createOmahaAiRoom();
    });
  }

  if (nicknamePvp) {
    nicknamePvp.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        if (roomIdInput && roomIdInput.value.trim()) joinRoom();
        else createRoom();
      }
    });
  }

  if (roomIdInput) {
    roomIdInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') joinRoom();
    });
  }

  if (nicknamePvc) {
    nicknamePvc.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') createAiRoom();
    });
  }

  var SCROLL_EASE = 0.07;
  var SCROLL_THRESHOLD = 0.08;
  var scrollElements = [];
  var scrollRafId = null;

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function getStaggeredTranslateY() {
    if (window.innerWidth <= 768) return 32;
    if (window.innerWidth <= 1024) return 64;
    return 80;
  }

  function getStaggeredFinalY() {
    if (window.innerWidth <= 768) return 0;
    if (window.innerWidth <= 1024) return 32;
    return 48;
  }

  function ScrollRevealEl(el) {
    this.el = el;
    this.progress = 0;
    this.target = 0;
    this.delay = parseInt(el.getAttribute('data-scroll-delay') || '0', 10);
    this.delayElapsed = false;
    this.delayTimer = null;
    this.started = false;
    this.revealed = false;
  }

  ScrollRevealEl.prototype.applyInitialState = function() {
    var scale = 0.82;
    var translateY = 32;
    if (this.el.classList.contains('game-card--staggered')) {
      translateY = getStaggeredTranslateY();
    }
    var variant = this.el.getAttribute('data-scroll-reveal');
    if (variant === 'fade-up') {
      scale = 1;
      translateY = 40;
    } else if (variant === 'scale-only') {
      scale = 0.82;
      translateY = 0;
    }
    this.el.style.transform = 'scale(' + scale + ') translateY(' + translateY + 'px)';
  };

  ScrollRevealEl.prototype.activate = function() {
    if (this.started) return;
    this.started = true;
    this.applyInitialState();
    var self = this;
    if (this.delay > 0) {
      this.delayTimer = setTimeout(function() {
        self.delayElapsed = true;
        self.target = 1;
        startScrollRevealLoop();
      }, this.delay);
    } else {
      this.delayElapsed = true;
      this.target = 1;
    }
  };

  ScrollRevealEl.prototype.update = function() {
    if (!this.delayElapsed) return false;
    this.progress = lerp(this.progress, this.target, SCROLL_EASE);
    if (Math.abs(this.progress - this.target) < 0.001) {
      this.progress = this.target;
    }
    var p = this.progress;
    var easedP = 1 - Math.pow(1 - p, 4);
    var scale = lerp(0.82, 1, easedP);
    var translateY = lerp(32, 0, easedP);
    var opacity = easedP;
    if (this.el.classList.contains('game-card--soon')) {
      opacity = lerp(0, 0.7, easedP);
    }
    if (this.el.classList.contains('game-card--staggered')) {
      translateY = lerp(getStaggeredTranslateY(), getStaggeredFinalY(), easedP);
    }
    var variant = this.el.getAttribute('data-scroll-reveal');
    if (variant === 'fade-up') {
      scale = 1;
      translateY = lerp(40, 0, easedP);
    } else if (variant === 'scale-only') {
      scale = lerp(0.82, 1, easedP);
      translateY = 0;
    }
    this.el.style.opacity = opacity;
    this.el.style.transform = 'scale(' + scale + ') translateY(' + translateY + 'px)';
    if (p >= 1 && !this.revealed) {
      this.revealed = true;
      this.el.classList.add('revealed');
      this.el.style.opacity = '';
      this.el.style.transform = '';
    }
    return p < 1;
  };

  function scrollRevealLoop() {
    var hasActive = false;
    for (var i = 0; i < scrollElements.length; i++) {
      if (scrollElements[i].update()) {
        hasActive = true;
      }
    }
    if (hasActive) {
      scrollRafId = requestAnimationFrame(scrollRevealLoop);
    } else {
      scrollRafId = null;
    }
  }

  function startScrollRevealLoop() {
    if (!scrollRafId) {
      scrollRafId = requestAnimationFrame(scrollRevealLoop);
    }
  }

  var scrollObserver = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting) {
        var el = entry.target;
        var wrapper = null;
        for (var i = 0; i < scrollElements.length; i++) {
          if (scrollElements[i].el === el) {
            wrapper = scrollElements[i];
            break;
          }
        }
        if (wrapper) {
          wrapper.activate();
          startScrollRevealLoop();
        }
        scrollObserver.unobserve(el);
      }
    });
  }, { threshold: SCROLL_THRESHOLD });

  document.querySelectorAll('[data-scroll-reveal]').forEach(function(el, index) {
    if (!el.getAttribute('data-scroll-delay')) {
      el.setAttribute('data-scroll-delay', String(index * 120));
    }
    var wrapper = new ScrollRevealEl(el);
    scrollElements.push(wrapper);
    scrollObserver.observe(el);
  });
})();
