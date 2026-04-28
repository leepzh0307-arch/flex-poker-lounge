var Gallery3D = (function () {
  function create(container, opts) {
    opts = opts || {};
    var autoRotateSpeed = opts.autoRotateSpeed || 0.0018;
    var dragSensitivity = opts.dragSensitivity || 1.0;
    var snapDuration = opts.snapDuration || 500;
    var gap = opts.gap || 30;

    var track = container.querySelector('.gallery-3d-track');
    var cardEls = container.querySelectorAll('.gallery-card');
    var count = cardEls.length;
    if (!track || count === 0) return null;

    var THREE = window.THREE;
    if (!THREE || !THREE.CSS3DRenderer) {
      return createFallback(container, opts);
    }

    var camera, scene, renderer;
    var cardObjects = [];
    var cardWidth = 0;
    var cardHeight = 0;
    var radius = 0;
    var arcSpan = Math.PI * 0.92;

    var scrollAngle = 0;
    var scrollVelocity = 0;
    var isDown = false;
    var startX = 0;
    var angleStart = 0;
    var lastX = 0;
    var lastTime = 0;
    var autoRotate = true;
    var autoRotateTimer = null;
    var raf = 0;
    var isSnapping = false;
    var snapStartTime = 0;
    var snapFromAngle = 0;
    var snapToAngle = 0;

    var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function easeOutQuart(t) {
      return 1 - Math.pow(1 - t, 4);
    }

    function wrapAngle(angle) {
      var half = arcSpan / 2;
      var a = ((angle + half) % arcSpan + arcSpan) % arcSpan - half;
      return a;
    }

    function calculateSizes() {
      var cw = container.clientWidth;
      var ch = container.clientHeight;
      var divisor = cw < 360 ? 1.0 : cw < 500 ? 1.2 : cw < 768 ? 1.6 : 2.1;
      cardWidth = Math.floor(cw / divisor);
      cardHeight = Math.floor(cardWidth * 1.46);
      if (cardHeight > ch - 30) {
        cardHeight = ch - 30;
        cardWidth = Math.floor(cardHeight / 1.46);
      }
      if (cw < 500) {
        var maxCardWidth = cw - 20;
        if (cardWidth > maxCardWidth) cardWidth = maxCardWidth;
        cardHeight = Math.floor(cardWidth * 1.46);
      }

      var angleStep = arcSpan / count;
      radius = Math.max(cardWidth * 2.0, (cardWidth + gap) / (2 * Math.sin(angleStep / 2)));

      for (var i = 0; i < count; i++) {
        cardEls[i].style.width = cardWidth + 'px';
        cardEls[i].style.height = cardHeight + 'px';
      }
    }

    function init() {
      calculateSizes();

      camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 1, 5000);
      camera.position.set(0, 0, radius * 2.2);

      scene = new THREE.Scene();

      renderer = new THREE.CSS3DRenderer();
      renderer.setSize(container.clientWidth, container.clientHeight);
      renderer.domElement.style.position = 'absolute';
      renderer.domElement.style.top = '0';
      renderer.domElement.style.left = '0';
      container.appendChild(renderer.domElement);

      track.style.display = 'none';

      for (var i = 0; i < count; i++) {
        var element = cardEls[i];
        var cssObject = new THREE.CSS3DObject(element);
        cssObject.element.style.display = 'flex';
        scene.add(cssObject);
        cardObjects.push(cssObject);
      }

      positionCards();
    }

    function positionCards() {
      var angleStep = arcSpan / count;

      for (var i = 0; i < count; i++) {
        var rawAngle = angleStep * (i + 0.5) + scrollAngle;
        var angle = wrapAngle(rawAngle);

        var x = Math.sin(angle) * radius;
        var z = Math.cos(angle) * radius;

        cardObjects[i].position.set(x, 0, z);
        cardObjects[i].rotation.y = 0;

        var cosA = Math.cos(angle);
        var absSin = Math.abs(Math.sin(angle));

        var opacity = 1;
        if (absSin > 0.75) {
          opacity = 1 - (absSin - 0.75) / 0.25;
        }
        if (cosA < 0.1) {
          opacity = Math.min(opacity, cosA / 0.1);
        }
        opacity = Math.max(0.02, opacity);
        cardObjects[i].element.style.opacity = opacity;

        var isClickable = absSin < 0.65 && cosA > 0.2;
        cardObjects[i].element.style.pointerEvents = isClickable ? 'auto' : 'none';
        cardObjects[i].element.style.zIndex = Math.round(cosA * 100 + 100);
      }
    }

    function animate() {
      if (isSnapping) {
        var elapsed = Date.now() - snapStartTime;
        var t = Math.min(elapsed / snapDuration, 1);
        scrollAngle = snapFromAngle + (snapToAngle - snapFromAngle) * easeOutQuart(t);
        if (t >= 1) {
          isSnapping = false;
          scrollAngle = snapToAngle;
          scrollVelocity = 0;
        }
      } else if (autoRotate && !isDown && !prefersReducedMotion) {
        scrollAngle += autoRotateSpeed;
      }

      if (!isDown && !isSnapping) {
        scrollVelocity *= 0.95;
        if (Math.abs(scrollVelocity) < 0.00001) scrollVelocity = 0;
      }

      positionCards();
      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    }

    function snapToNearest() {
      var angleStep = arcSpan / count;
      var projected = scrollAngle + scrollVelocity * 80;
      var rawIndex = projected / angleStep - 0.5;
      var itemIndex = Math.round(rawIndex);
      isSnapping = true;
      snapStartTime = Date.now();
      snapFromAngle = scrollAngle;
      snapToAngle = angleStep * (itemIndex + 0.5);
    }

    function onPointerDown(e) {
      isDown = true;
      isSnapping = false;
      autoRotate = false;
      clearTimeout(autoRotateTimer);
      startX = e.clientX || (e.touches && e.touches[0].clientX) || 0;
      angleStart = scrollAngle;
      lastX = startX;
      lastTime = Date.now();
      scrollVelocity = 0;
    }

    function onPointerMove(e) {
      if (!isDown) return;
      var x = e.clientX || (e.touches && e.touches[0].clientX) || 0;
      var dx = x - startX;
      var angleDelta = (dx / container.clientWidth) * Math.PI * dragSensitivity;
      scrollAngle = angleStart + angleDelta;
      var now = Date.now();
      var dt = now - lastTime;
      if (dt > 0) {
        scrollVelocity = ((x - lastX) / dt) * 0.0005 * dragSensitivity;
      }
      lastX = x;
      lastTime = now;
    }

    function onPointerUp() {
      if (!isDown) return;
      isDown = false;
      snapToNearest();
      autoRotateTimer = setTimeout(function () {
        autoRotate = true;
      }, 3000);
    }

    function onResize() {
      calculateSizes();
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      camera.position.set(0, 0, radius * 2.2);
      renderer.setSize(container.clientWidth, container.clientHeight);
    }

    container.addEventListener('mousedown', onPointerDown);
    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerUp);
    container.addEventListener('touchstart', onPointerDown, { passive: true });
    window.addEventListener('touchmove', onPointerMove, { passive: true });
    window.addEventListener('touchend', onPointerUp);
    window.addEventListener('resize', onResize);

    init();
    raf = requestAnimationFrame(animate);

    return {
      destroy: function () {
        cancelAnimationFrame(raf);
        container.removeEventListener('mousedown', onPointerDown);
        window.removeEventListener('mousemove', onPointerMove);
        window.removeEventListener('mouseup', onPointerUp);
        container.removeEventListener('touchstart', onPointerDown);
        window.removeEventListener('touchmove', onPointerMove);
        window.removeEventListener('touchend', onPointerUp);
        window.removeEventListener('resize', onResize);
        clearTimeout(autoRotateTimer);
        if (renderer && renderer.domElement && renderer.domElement.parentNode) {
          renderer.domElement.parentNode.removeChild(renderer.domElement);
        }
        track.style.display = '';
      },
    };
  }

  function createFallback(container, opts) {
    opts = opts || {};
    var dragSensitivity = opts.dragSensitivity || 1.0;
    var snapDuration = opts.snapDuration || 400;
    var gap = opts.gap || 20;

    var track = container.querySelector('.gallery-3d-track');
    var cards = container.querySelectorAll('.gallery-card');
    var count = cards.length;
    if (!track || count === 0) return null;

    var cardWidth = 0;
    var cardHeight = 0;
    var itemWidth = 0;
    var totalWidth = 0;
    var scrollPos = 0;
    var scrollVelocity = 0;
    var extras = [];
    for (var e = 0; e < count; e++) extras.push(0);
    var isDown = false;
    var startX = 0;
    var scrollStart = 0;
    var lastX = 0;
    var lastTime = 0;
    var raf = 0;
    var isSnapping = false;
    var snapStartTime = 0;
    var snapFrom = 0;
    var snapTo = 0;
    var autoRotate = true;
    var autoRotateTimer = null;
    var autoRotateSpeed = opts.autoRotateSpeed || 0.9;

    function easeOutQuart(t) {
      return 1 - Math.pow(1 - t, 4);
    }

    function calculateSizes() {
      var cw = container.clientWidth;
      var ch = container.clientHeight;
      var divisor = cw < 360 ? 1.0 : cw < 500 ? 1.2 : cw < 768 ? 1.6 : 2.4;
      cardWidth = Math.floor(cw / divisor);
      cardHeight = Math.floor(cardWidth * 1.46);
      if (cardHeight > ch - 20) {
        cardHeight = ch - 20;
        cardWidth = Math.floor(cardHeight / 1.46);
      }
      if (cw < 500) {
        var maxCardWidth = cw - 20;
        if (cardWidth > maxCardWidth) cardWidth = maxCardWidth;
        cardHeight = Math.floor(cardWidth * 1.46);
      }
      itemWidth = cardWidth + gap;
      totalWidth = itemWidth * count;
      for (var i = 0; i < count; i++) {
        cards[i].style.width = cardWidth + 'px';
        cards[i].style.height = cardHeight + 'px';
      }
    }

    function updateCards() {
      var halfContainer = container.clientWidth / 2;
      for (var i = 0; i < count; i++) {
        var rawX = itemWidth * i - scrollPos;
        var x = ((rawX + halfContainer) % totalWidth + totalWidth) % totalWidth - halfContainer;
        if (x > halfContainer) x -= totalWidth;

        var absCenter = Math.abs(x);
        if (absCenter > halfContainer + cardWidth) {
          cards[i].style.visibility = 'hidden';
          cards[i].style.opacity = '0';
          cards[i].style.pointerEvents = 'none';
          continue;
        }
        var distRatio = absCenter / halfContainer;
        var scale = 1 - distRatio * 0.1;
        var opacity = 1 - distRatio * 0.4;
        var yPos = (container.clientHeight - cardHeight) / 2;
        cards[i].style.transform =
          'translateX(' + (x - cardWidth / 2 + halfContainer) + 'px) ' +
          'translateY(' + yPos + 'px) ' +
          'scale(' + scale.toFixed(3) + ')';
        cards[i].style.opacity = Math.max(0.1, opacity);
        cards[i].style.visibility = 'visible';
        cards[i].style.pointerEvents = absCenter < cardWidth * 0.7 ? 'auto' : 'none';
        cards[i].style.zIndex = Math.round(100 - absCenter);
      }
    }

    function animate() {
      if (isSnapping) {
        var elapsed = Date.now() - snapStartTime;
        var t = Math.min(elapsed / snapDuration, 1);
        scrollPos = snapFrom + (snapTo - snapFrom) * easeOutQuart(t);
        if (t >= 1) {
          isSnapping = false;
          scrollPos = snapTo;
          scrollVelocity = 0;
        }
      } else if (autoRotate && !isDown) {
        scrollPos += autoRotateSpeed;
      }
      updateCards();
      raf = requestAnimationFrame(animate);
    }

    function snapToNearest() {
      if (count === 0 || itemWidth === 0) return;
      isSnapping = true;
      snapStartTime = Date.now();
      snapFrom = scrollPos;
      var projected = scrollPos + scrollVelocity * 150;
      var rawIndex = projected / itemWidth;
      var itemIndex = Math.round(rawIndex);
      snapTo = itemWidth * itemIndex;
    }

    function onPointerDown(e) {
      isDown = true;
      isSnapping = false;
      autoRotate = false;
      clearTimeout(autoRotateTimer);
      scrollStart = scrollPos;
      startX = e.clientX || (e.touches && e.touches[0].clientX) || 0;
      lastX = startX;
      lastTime = Date.now();
      scrollVelocity = 0;
    }

    function onPointerMove(e) {
      if (!isDown) return;
      var x = e.clientX || (e.touches && e.touches[0].clientX) || 0;
      var dx = x - startX;
      scrollPos = scrollStart + dx * dragSensitivity;
      var now = Date.now();
      var dt = now - lastTime;
      if (dt > 0) {
        scrollVelocity = (x - lastX) / dt * dragSensitivity;
      }
      lastX = x;
      lastTime = now;
    }

    function onPointerUp() {
      if (!isDown) return;
      isDown = false;
      snapToNearest();
      autoRotateTimer = setTimeout(function () {
        autoRotate = true;
      }, 3000);
    }

    function onResize() {
      calculateSizes();
    }

    container.addEventListener('mousedown', onPointerDown);
    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerUp);
    container.addEventListener('touchstart', onPointerDown, { passive: true });
    window.addEventListener('touchmove', onPointerMove, { passive: true });
    window.addEventListener('touchend', onPointerUp);
    window.addEventListener('resize', onResize);

    calculateSizes();
    raf = requestAnimationFrame(animate);

    return {
      destroy: function () {
        cancelAnimationFrame(raf);
        container.removeEventListener('mousedown', onPointerDown);
        window.removeEventListener('mousemove', onPointerMove);
        window.removeEventListener('mouseup', onPointerUp);
        container.removeEventListener('touchstart', onPointerDown);
        window.removeEventListener('touchmove', onPointerMove);
        window.removeEventListener('touchend', onPointerUp);
        window.removeEventListener('resize', onResize);
        clearTimeout(autoRotateTimer);
      },
    };
  }

  return { create: create };
})();
