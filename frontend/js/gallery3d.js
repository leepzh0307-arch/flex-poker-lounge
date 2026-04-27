var Gallery3D = (function () {
  function create(container, opts) {
    opts = opts || {};
    var scrollSpeed = opts.scrollSpeed || 1.2;
    var scrollEase = opts.scrollEase || 0.03;
    var gap = opts.gap || 20;

    var track = container.querySelector('.gallery-3d-track');
    var cards = container.querySelectorAll('.gallery-card');
    var count = cards.length;
    if (!track || count === 0) return null;

    var cardWidth = 0;
    var cardHeight = 0;
    var itemWidth = 0;
    var totalWidth = 0;

    var scroll = { current: 0, target: 0, last: 0, position: 0 };
    var extras = [];
    for (var e = 0; e < count; e++) extras.push(0);

    var isDown = false;
    var startX = 0;
    var raf = 0;
    var checkTimeout = null;

    function lerp(a, b, t) {
      return a + (b - a) * t;
    }

    function calculateSizes() {
      var cw = container.clientWidth;
      var ch = container.clientHeight;
      cardWidth = Math.floor(cw / 3.6);
      cardHeight = Math.floor(cardWidth * 1.46);
      if (cardHeight > ch - 40) {
        cardHeight = ch - 40;
        cardWidth = Math.floor(cardHeight / 1.46);
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
      var direction = scroll.current > scroll.last ? 'right' : 'left';

      for (var i = 0; i < count; i++) {
        var x = itemWidth * i - scroll.current - extras[i];

        var planeOffset = cardWidth / 2;
        var viewportOffset = halfContainer;
        var isBefore = x + planeOffset < -viewportOffset;
        var isAfter = x - planeOffset > viewportOffset;

        if (direction === 'right' && isBefore) {
          extras[i] -= totalWidth;
        }
        if (direction === 'left' && isAfter) {
          extras[i] += totalWidth;
        }

        x = itemWidth * i - scroll.current - extras[i];

        var centerX = x;
        var absCenter = Math.abs(centerX);

        if (absCenter > halfContainer + cardWidth) {
          cards[i].style.visibility = 'hidden';
          cards[i].style.opacity = '0';
          cards[i].style.pointerEvents = 'none';
          continue;
        }

        var distRatio = absCenter / halfContainer;
        var scale = 1 - distRatio * 0.12;
        var opacity = 1 - distRatio * 0.5;

        var yPos = (container.clientHeight - cardHeight) / 2;

        cards[i].style.transform =
          'translateX(' + (x - cardWidth / 2 + halfContainer) + 'px) ' +
          'translateY(' + yPos + 'px) ' +
          'scale(' + scale.toFixed(3) + ')';
        cards[i].style.opacity = Math.max(0.1, opacity);
        cards[i].style.visibility = 'visible';
        cards[i].style.pointerEvents = absCenter < cardWidth * 0.6 ? 'auto' : 'none';
        cards[i].style.zIndex = Math.round(100 - absCenter);
      }
    }

    function animate() {
      scroll.current = lerp(scroll.current, scroll.target, scrollEase);
      updateCards();
      scroll.last = scroll.current;
      raf = requestAnimationFrame(animate);
    }

    function onCheck() {
      if (count === 0 || itemWidth === 0) return;
      var itemIndex = Math.round(Math.abs(scroll.target) / itemWidth);
      var item = itemWidth * itemIndex;
      scroll.target = scroll.target < 0 ? -item : item;
    }

    function onPointerDown(e) {
      isDown = true;
      scroll.position = scroll.current;
      startX = e.clientX || (e.touches && e.touches[0].clientX) || 0;
    }

    function onPointerMove(e) {
      if (!isDown) return;
      var x = e.clientX || (e.touches && e.touches[0].clientX) || 0;
      var distance = (startX - x) * (scrollSpeed * 0.025);
      scroll.target = scroll.position + distance;
    }

    function onPointerUp() {
      if (!isDown) return;
      isDown = false;
      onCheck();
    }

    function onWheel(e) {
      e.preventDefault();
      var delta = e.deltaY || e.wheelDelta || e.detail;
      scroll.target += (delta > 0 ? scrollSpeed : -scrollSpeed) * 0.2;
      clearTimeout(checkTimeout);
      checkTimeout = setTimeout(onCheck, 200);
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
    container.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('resize', onResize);

    calculateSizes();
    raf = requestAnimationFrame(animate);

    return {
      destroy: function () {
        cancelAnimationFrame(raf);
        clearTimeout(checkTimeout);
        container.removeEventListener('mousedown', onPointerDown);
        window.removeEventListener('mousemove', onPointerMove);
        window.removeEventListener('mouseup', onPointerUp);
        container.removeEventListener('touchstart', onPointerDown);
        window.removeEventListener('touchmove', onPointerMove);
        window.removeEventListener('touchend', onPointerUp);
        container.removeEventListener('wheel', onWheel);
        window.removeEventListener('resize', onResize);
      },
    };
  }

  return { create: create };
})();
