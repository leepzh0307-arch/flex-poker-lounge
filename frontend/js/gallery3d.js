var Gallery3D = (function () {
  function create(container, opts) {
    opts = opts || {};
    var radius = opts.radius || 420;
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
    var targetAngle = 0;
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

    function layoutCards() {
      for (var i = 0; i < count; i++) {
        var angle = angleStep * i;
        var rad = (angle * Math.PI) / 180;
        var x = Math.sin(rad) * radius;
        var z = Math.cos(rad) * radius - radius;
        cards[i].style.transform = 'translateX(' + (x - cardWidth / 2) + 'px) translateY(' + (-cardHeight / 2) + 'px) translateZ(' + z + 'px) rotateY(' + angle + 'deg)';
      }
    }

    function updateCards() {
      track.style.transform = 'translateX(0) translateY(0) translateZ(0) rotateY(' + (-currentAngle) + 'deg)';

      for (var i = 0; i < count; i++) {
        var cardAngle = angleStep * i - currentAngle;
        var normalized = ((cardAngle % 360) + 540) % 360 - 180;
        var absNorm = Math.abs(normalized);
        var opacity = 1 - (absNorm / 180) * 0.7;
        var blur = absNorm > 90 ? (absNorm - 90) / 90 * 2 : 0;
        cards[i].style.opacity = Math.max(0.15, opacity);
        cards[i].style.filter = blur > 0 ? 'blur(' + blur.toFixed(1) + 'px)' : 'none';
        cards[i].style.pointerEvents = absNorm < 45 ? 'auto' : 'none';
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
      currentAngle = startAngle + dx * dragSpeed;

      var now = Date.now();
      var dt = now - lastTime;
      if (dt > 0) {
        velocity = (x - lastX) * dragSpeed / dt * 16;
      }
      lastX = x;
      lastTime = now;
    }

    function onPointerUp() {
      if (!isDragging) return;
      isDragging = false;
      snapToNearest();
    }

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

    var wheelTimeout;

    container.addEventListener('mousedown', onPointerDown);
    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerUp);
    container.addEventListener('touchstart', onPointerDown, { passive: true });
    window.addEventListener('touchmove', onPointerMove, { passive: true });
    window.addEventListener('touchend', onPointerUp);
    container.addEventListener('wheel', onWheel, { passive: false });

    layoutCards();
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
