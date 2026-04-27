var Gallery3D = (function () {
  function create(container, opts) {
    opts = opts || {};
    var radius = opts.radius || 1260;
    var cardWidth = opts.cardWidth || 260;
    var cardHeight = opts.cardHeight || 380;
    var dragSpeed = opts.dragSpeed || 0.35;
    var snapDuration = opts.snapDuration || 600;

    var track = container.querySelector('.gallery-3d-track');
    var cards = container.querySelectorAll('.gallery-card');
    var count = cards.length;
    if (!track || count === 0) return null;

    var angleStep = 360 / count;
    var currentAngle = 0;
    var isDragging = false;
    var startX = 0;
    var startAngle = 0;
    var velocity = 0;
    var lastX = 0;
    var lastTime = 0;
    var raf = 0;
    var isSnapping = false;
    var snapStart = 0;
    var snapFrom = 0;
    var snapTo = 0;

    function updateCards() {
      for (var i = 0; i < count; i++) {
        var angle = angleStep * i - currentAngle;
        var rad = (angle * Math.PI) / 180;
        var x = Math.sin(rad) * radius;
        var z = Math.cos(rad) * radius - radius;

        var normalized = ((angle % 360) + 540) % 360 - 180;
        var absNorm = Math.abs(normalized);

        if (absNorm > 90) {
          cards[i].style.opacity = '0';
          cards[i].style.pointerEvents = 'none';
          cards[i].style.visibility = 'hidden';
          cards[i].style.zIndex = '-1';
          continue;
        }

        var scale = 1 - absNorm / 180 * 0.3;
        var opacity = 1 - (absNorm / 90) * 0.5;
        var zIndex = Math.round(100 - absNorm);

        cards[i].style.transform =
          'translateX(' + (x - cardWidth / 2) + 'px) ' +
          'translateY(' + (-cardHeight / 2) + 'px) ' +
          'translateZ(' + z + 'px) ' +
          'scale(' + scale.toFixed(3) + ')';
        cards[i].style.opacity = opacity;
        cards[i].style.filter = 'none';
        cards[i].style.pointerEvents = absNorm < 45 ? 'auto' : 'none';
        cards[i].style.visibility = 'visible';
        cards[i].style.zIndex = zIndex;
      }
    }

    function animate() {
      if (isSnapping) {
        var elapsed = Date.now() - snapStart;
        var t = Math.min(elapsed / snapDuration, 1);
        var ease = 1 - Math.pow(1 - t, 3);
        currentAngle = snapFrom + (snapTo - snapFrom) * ease;
        if (t >= 1) {
          isSnapping = false;
          currentAngle = snapTo;
        }
      } else if (!isDragging) {
        velocity *= 0.95;
        currentAngle += velocity;
        if (Math.abs(velocity) < 0.01) velocity = 0;
      }

      updateCards();
      raf = requestAnimationFrame(animate);
    }

    function snapToNearest() {
      isSnapping = true;
      snapStart = Date.now();
      snapFrom = currentAngle;
      var nearestIndex = Math.round(currentAngle / angleStep);
      snapTo = nearestIndex * angleStep;
    }

    function onPointerDown(e) {
      isDragging = true;
      isSnapping = false;
      startX = e.clientX || (e.touches && e.touches[0].clientX) || 0;
      startAngle = currentAngle;
      lastX = startX;
      lastTime = Date.now();
      velocity = 0;
    }

    function onPointerMove(e) {
      if (!isDragging) return;
      var x = e.clientX || (e.touches && e.touches[0].clientX) || 0;
      var dx = x - startX;
      currentAngle = startAngle - dx * dragSpeed;

      var now = Date.now();
      var dt = now - lastTime;
      if (dt > 0) {
        velocity = -(x - lastX) * dragSpeed / dt * 16;
      }
      lastX = x;
      lastTime = now;
    }

    function onPointerUp() {
      if (!isDragging) return;
      isDragging = false;
      snapToNearest();
    }

    var wheelTimeout;

    function onWheel(e) {
      e.preventDefault();
      var delta = e.deltaY || e.wheelDelta || e.detail;
      currentAngle += (delta > 0 ? 1 : -1) * angleStep * 0.3;
      velocity = 0;
      isSnapping = false;
      clearTimeout(wheelTimeout);
      wheelTimeout = setTimeout(function () {
        snapToNearest();
      }, 200);
    }

    container.addEventListener('mousedown', onPointerDown);
    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerUp);
    container.addEventListener('touchstart', onPointerDown, { passive: true });
    window.addEventListener('touchmove', onPointerMove, { passive: true });
    window.addEventListener('touchend', onPointerUp);
    container.addEventListener('wheel', onWheel, { passive: false });

    updateCards();
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
        container.removeEventListener('wheel', onWheel);
      },
    };
  }

  return { create: create };
})();
