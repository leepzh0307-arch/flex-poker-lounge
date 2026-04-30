var GamePreloader = (function () {
  var maskEl = null;
  var totalResources = 0;
  var loadedResources = 0;
  var callback = null;

  function init(options) {
    maskEl = document.getElementById('game-loading-mask');
    if (!maskEl) {
      if (options && options.onComplete) options.onComplete();
      return;
    }

    callback = options && options.onComplete ? options.onComplete : null;

    var images = (options && options.images) || [];
    var videos = (options && options.videos) || [];

    totalResources = images.length + videos.length;
    loadedResources = 0;

    if (totalResources === 0) {
      hide();
      return;
    }

    images.forEach(function (src) {
      preloadImage(src);
    });

    videos.forEach(function (src) {
      preloadVideo(src);
    });

    setTimeout(function () {
      hide();
    }, 8000);
  }

  function preloadImage(src) {
    var img = new Image();
    img.onload = onResourceLoaded;
    img.onerror = onResourceLoaded;
    img.src = src;
  }

  function preloadVideo(src) {
    var video = document.createElement('video');
    video.oncanplaythrough = onResourceLoaded;
    video.onerror = onResourceLoaded;
    video.src = src;
    video.load();
  }

  function onResourceLoaded() {
    loadedResources++;
    if (loadedResources >= totalResources) {
      hide();
    }
  }

  function hide() {
    if (!maskEl) return;
    maskEl.classList.add('fade-out');
    setTimeout(function () {
      if (maskEl && maskEl.parentNode) {
        maskEl.parentNode.removeChild(maskEl);
      }
      maskEl = null;
      if (callback) callback();
    }, 500);
  }

  return {
    init: init,
    hide: hide,
  };
})();
