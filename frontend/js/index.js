(function() {
  const titleContainer = document.querySelector('.hero-title-container');
  if (!titleContainer) return;

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function() {
      titleContainer.classList.add('fonts-loaded');
    });
  }
})();



(function() {
  const video = document.querySelector('.bg-video');
  if (!video) return;

  const reveal = () => { video.classList.add('loaded'); };

  if (video.readyState >= 2) {
    requestAnimationFrame(() => requestAnimationFrame(reveal));
  } else {
    const onCanPlay = () => {
      video.removeEventListener('canplay', onCanPlay);
      video.removeEventListener('loadeddata', onCanPlay);
      reveal();
    };
    video.addEventListener('canplay', onCanPlay, { once: true });
    video.addEventListener('loadeddata', onCanPlay, { once: true });

    if (video.decode) {
      video.decode().catch(() => {}).then(() => {
        if (!video.classList.contains('loaded')) reveal();
      });
    }

    setTimeout(reveal, 800);
  }
})();

// 首页逻辑
const nicknameInput = document.getElementById('nickname');
const roomIdInput = document.getElementById('room-id');
const createRoomBtn = document.getElementById('create-room');
const joinRoomBtn = document.getElementById('join-room');
const createAiRoomBtn = document.getElementById('create-ai-room');
const aiDifficultySelect = document.getElementById('ai-difficulty');
const aiCountSelect = document.getElementById('ai-count');
const errorMessage = document.getElementById('error-message');

// 显示错误信息
function showError(message) {
  errorMessage.textContent = message;
  errorMessage.style.display = 'block';
  setTimeout(() => {
    errorMessage.style.display = 'none';
  }, 3000);
}

// 验证输入
function validateInput() {
  const nickname = nicknameInput.value.trim();
  if (!nickname) {
    showError('请输入昵称');
    return false;
  }
  if (nickname.length > 20) {
    showError('昵称长度不能超过20个字符');
    return false;
  }
  return true;
}

// 创建房间
function createRoom() {
  if (!validateInput()) return;
  if (FallingText.isAnimating()) return;

  const nickname = nicknameInput.value.trim();
  const targetUrl = `room.html?nickname=${encodeURIComponent(nickname)}&isHost=true&isCreating=true`;

  FallingText.trigger('.hero-title-container').then(function() {
    // 锁定按钮防止重复点击
    createRoomBtn.disabled = true;
    joinRoomBtn.disabled = true;

    // 在 FallingText cleanup 恢复 DOM 后，立即覆盖同色遮罩
    // 避免 startViewTransition 捕获到恢复后的登录页导致"闪回"
    var overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:#060a0c;z-index:99999;pointer-events:none;';
    document.body.appendChild(overlay);

    if (document.startViewTransition) {
      document.startViewTransition(() => {
        window.location.href = targetUrl;
      });
    } else {
      window.location.href = targetUrl;
    }
  });
}

// 加入房间
function joinRoom() {
  if (!validateInput()) return;
  if (FallingText.isAnimating()) return;

  const nickname = nicknameInput.value.trim();
  const roomId = roomIdInput.value.trim();

  if (!roomId) {
    showError('请输入房间号');
    return;
  }

  const targetUrl = `room.html?roomId=${roomId}&nickname=${encodeURIComponent(nickname)}&isHost=false`;

  FallingText.trigger('.hero-title-container').then(function() {
    // 锁定按钮防止重复点击
    createRoomBtn.disabled = true;
    joinRoomBtn.disabled = true;

    // 在 FallingText cleanup 恢复 DOM 后，立即覆盖同色遮罩
    // 避免 startViewTransition 捕获到恢复后的登录页导致"闪回"
    var overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:#060a0c;z-index:99999;pointer-events:none;';
    document.body.appendChild(overlay);

    if (document.startViewTransition) {
      document.startViewTransition(() => {
        window.location.href = targetUrl;
      });
    } else {
      window.location.href = targetUrl;
    }
  });
}

// 创建人机对战房间
function createAiRoom() {
  if (!validateInput()) return;
  if (FallingText.isAnimating()) return;

  const nickname = nicknameInput.value.trim();
  const aiDifficulty = aiDifficultySelect ? aiDifficultySelect.value : 'medium';
  const aiCount = aiCountSelect ? aiCountSelect.value : '3';

  const targetUrl = `room.html?nickname=${encodeURIComponent(nickname)}&isHost=true&isCreating=true&isAiRoom=true&aiDifficulty=${aiDifficulty}&aiCount=${aiCount}`;

  FallingText.trigger('.hero-title-container').then(function() {
    createRoomBtn.disabled = true;
    joinRoomBtn.disabled = true;
    if (createAiRoomBtn) createAiRoomBtn.disabled = true;

    var overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:#060a0c;z-index:99999;pointer-events:none;';
    document.body.appendChild(overlay);

    if (document.startViewTransition) {
      document.startViewTransition(() => {
        window.location.href = targetUrl;
      });
    } else {
      window.location.href = targetUrl;
    }
  });
}

// 通用事件绑定函数，同时支持点击和触摸事件
const bindEvent = (element, handler) => {
  if (element) {
    element.addEventListener('click', handler);
    element.addEventListener('touchstart', (e) => {
      e.preventDefault();
      handler(e);
    });
  }
};

// 事件监听
bindEvent(createRoomBtn, createRoom);
bindEvent(joinRoomBtn, joinRoom);
bindEvent(createAiRoomBtn, createAiRoom);

// 回车键提交
nicknameInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    if (roomIdInput.value.trim()) {
      joinRoom();
    } else {
      createRoom();
    }
  }
});

roomIdInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    joinRoom();
  }
});