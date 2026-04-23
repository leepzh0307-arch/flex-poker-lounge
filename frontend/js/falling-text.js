var FallingText = (function() {
  var engine, runner, mouse, mouseConstraint;
  var wordBodies = [];
  var canvas, ctx;
  var isAnimating = false;
  var timeoutId = null;
  var containerEl = null;
  var originalHTML = '';
  var originalStyles = {};
  var savedContainerRect = null;
  var animationFrameId = null;
  var animationStartTime = 0;

  var CONFIG = {
    gravity: 0.8,
    mouseConstraintStiffness: 0.9,
    friction: 0.5,
    frictionStatic: 0.8,
    restitution: 0.18,
    density: 0.001,
    airFriction: 0.01,
    maxTimeout: 5000,
    minAnimationDuration: 1250,
    checkInterval: 200,
    velocityThreshold: 0.08
  };

  var TEXT_COLOR = '#2D3A31';
  var SUBTEXT_COLOR = '#6B7D63';

  function getComputedTextStyles(el) {
    var cs = window.getComputedStyle(el);
    var titleLines = el.querySelectorAll('.hero-title-line');
    var subtitle = el.querySelector('.hero-subtitle');

    var titleCs = titleLines.length > 0 ? window.getComputedStyle(titleLines[0]) : cs;
    var subCs = subtitle ? window.getComputedStyle(subtitle) : titleCs;

    return {
      fontFamily: titleCs.fontFamily || "'Playfair Display', serif",
      fontWeight: titleCs.fontWeight || '700',
      fontSize: titleCs.fontSize || '6vw',
      color: TEXT_COLOR,
      letterSpacing: titleCs.letterSpacing || '-0.02em',
      lineHeight: titleCs.lineHeight || '1.1',
      sub: {
        fontFamily: subCs.fontFamily || "'Playfair Display', serif",
        fontWeight: subCs.fontWeight || '400',
        fontSize: subCs.fontSize || '1.2vw',
        lineHeight: subCs.lineHeight || '1.7',
        fontStyle: 'italic',
        color: SUBTEXT_COLOR
      }
    };
  }

  function extractWords(container) {
    var words = { title: [], sub: [] };
    var titleLines = container.querySelectorAll('.hero-title-line');
    var subtitle = container.querySelector('.hero-subtitle');

    titleLines.forEach(function(line, lineIndex) {
      var text = line.textContent.trim();
      if (text) {
        text.split(/\s+/).forEach(function(word) {
          if (word) words.title.push({ text: word, type: 'title', line: lineIndex + 1 });
        });
      }
    });

    if (subtitle) {
      var subText = subtitle.textContent.trim();
      if (subText) {
        subText.split(/\s+/).forEach(function(word) {
          if (word) words.sub.push({ text: word, type: 'sub' });
        });
      }
    }

    return words;
  }

  function measureWord(word, styles) {
    var mCanvas = document.createElement('canvas');
    var mCtx = mCanvas.getContext('2d');

    var fontConfig = word.type === 'sub' ? styles.sub : styles;

    var fontSizePx = parseFloat(fontConfig.fontSize);
    if (fontConfig.fontSize.indexOf('vw') !== -1) {
      fontSizePx = parseFloat(fontConfig.fontSize) * window.innerWidth / 100;
    }

    var fontStyle = fontConfig.fontStyle ? fontConfig.fontStyle + ' ' : '';
    mCtx.font = fontStyle + fontConfig.fontWeight + ' ' + Math.round(fontSizePx) + 'px ' + fontConfig.fontFamily;
    var metrics = mCtx.measureText(word.text);

    var isTitle = word.type === 'title';
    return {
      width: isTitle ? metrics.width : metrics.width + 4,
      height: isTitle ? fontSizePx : fontSizePx * 1.2,
      fontSizePx: fontSizePx,
      fontConfig: fontConfig
    };
  }

  function createEngine(containerRect) {
    engine = Matter.Engine.create({
      enableSleeping: false,
      constraintIterations: 4
    });

    engine.world.gravity.y = CONFIG.gravity;
    engine.world.gravity.x = 0;

    var ground = Matter.Bodies.rectangle(
      containerRect.width / 2,
      containerRect.height * 0.9 + 50,
      containerRect.width * 3,
      100,
      { isStatic: true, label: 'ground' }
    );

    var leftWall = Matter.Bodies.rectangle(
      -50,
      containerRect.height / 2,
      100,
      containerRect.height * 3,
      { isStatic: true, label: 'leftWall' }
    );

    var rightWall = Matter.Bodies.rectangle(
      containerRect.width + 50,
      containerRect.height / 2,
      100,
      containerRect.height * 3,
      { isStatic: true, label: 'rightWall' }
    );

    Matter.Composite.add(engine.world, [ground, leftWall, rightWall]);

    return engine;
  }

  function createWordBody(word, x, y, w, h, styles, fontConfig) {
    var centerX = x + w / 2;
    var centerY = y + h / 2;
    var body = Matter.Bodies.rectangle(centerX, centerY, w, h, {
      friction: CONFIG.friction,
      frictionStatic: CONFIG.frictionStatic,
      frictionAir: CONFIG.airFriction,
      restitution: CONFIG.restitution,
      density: CONFIG.density,
      label: 'word'
    });

    body.wordData = {
      text: word.text,
      type: word.type,
      width: w,
      height: h,
      styles: styles,
      fontConfig: fontConfig
    };

    return body;
  }

  function layoutWords(words, styles, cachedRects) {
    var bodies = [];
    var titleRects = [];
    var subRect = cachedRects.subRect;

    var titleLines = containerEl ? containerEl.querySelectorAll('.hero-title-line') : [];
    titleLines.forEach(function(line) {
      titleRects.push(line.getBoundingClientRect());
    });

    var titleLineHeight = parseFloat(styles.fontSize);
    if (styles.fontSize.indexOf('vw') !== -1) {
      titleLineHeight = parseFloat(styles.fontSize) * window.innerWidth / 100;
    }
    var titleWordGap = titleLineHeight * 0.12;

    var currentX, currentY;
    var currentLineIndex = 0;

    words.title.forEach(function(word, index) {
      var lineIndex = word.line - 1;
      if (lineIndex !== currentLineIndex || index === 0) {
        currentLineIndex = lineIndex;
        var rect = titleRects[lineIndex];
        currentX = rect ? rect.left : 80;
        currentY = rect ? rect.top : 120;
      }

      var size = measureWord(word, styles);
      var body = createWordBody(word, currentX, currentY, size.width, size.height, styles, size.fontConfig);
      bodies.push(body);
      currentX += size.width + titleWordGap;
    });

    if (words.sub.length > 0) {
      var subBaseY = subRect ? subRect.top : (titleRects.length > 0 ? titleRects[titleRects.length - 1].bottom + 40 : 240);
      var subStartX = subRect ? subRect.left : 80;
      var subMaxWidth = subRect ? subRect.width : (window.innerWidth * 0.6);

      var subFontSize = parseFloat(styles.sub.fontSize);
      if (styles.sub.fontSize.indexOf('vw') !== -1) {
        subFontSize = parseFloat(styles.sub.fontSize) * window.innerWidth / 100;
      }
      var subLineHeight = subFontSize * 1.2;
      var subWordGap = subLineHeight * 0.3;

      var currentSubX = subStartX;
      var currentSubY = subBaseY;

      words.sub.forEach(function(word, index) {
        var size = measureWord(word, styles);

        if (index > 0 && (currentSubX + size.width > subStartX + subMaxWidth)) {
          currentSubX = subStartX;
          currentSubY += subLineHeight;
        }

        var body = createWordBody(word, currentSubX, currentSubY, size.width, size.height, styles, size.fontConfig);
        bodies.push(body);
        currentSubX += size.width + subWordGap;
      });
    }

    return bodies;
  }

  function setupMouseInteraction(canvasEl, engineInst) {
    mouse = Matter.Mouse.create(canvasEl);
    mouse.pixelRatio = window.devicePixelRatio || 1;

    mouseConstraint = Matter.MouseConstraint.create(engineInst, {
      mouse: mouse,
      constraint: {
        stiffness: CONFIG.mouseConstraintStiffness,
        damping: 0.05
      }
    });

    Matter.Composite.add(engineInst.world, mouseConstraint);

    canvasEl.addEventListener('mousedown', function(e) {
      if (mouseConstraint.body) {
        e.preventDefault();
      }
    });

    canvasEl.style.touchAction = 'none';
  }

  function createCanvasOverlay() {
    var viewportWidth = window.innerWidth;
    var viewportHeight = window.innerHeight;
    var dpr = window.devicePixelRatio || 1;

    var canvasEl = document.createElement('canvas');
    canvasEl.className = 'falling-text-canvas';
    canvasEl.width = viewportWidth * dpr;
    canvasEl.height = viewportHeight * dpr;
    canvasEl.style.width = viewportWidth + 'px';
    canvasEl.style.height = viewportHeight + 'px';
    canvasEl.style.position = 'fixed';
    canvasEl.style.top = '0';
    canvasEl.style.left = '0';
    canvasEl.style.zIndex = '9998';
    canvasEl.style.pointerEvents = 'auto';
    canvasEl.style.backgroundColor = 'rgba(249, 248, 244, 0)';

    document.body.appendChild(canvasEl);
    return canvasEl;
  }

  function renderFrame() {
    if (!ctx || !canvas || !engine) return;

    var dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.scale(dpr, dpr);

    var allBodies = Matter.Composite.allBodies(engine.world);
    allBodies.forEach(function(body) {
      if (!body.wordData) return;

      var pos = body.position;
      var angle = body.angle;
      var data = body.wordData;
      var fontConfig = data.fontConfig || (data.type === 'sub' ? data.styles.sub : data.styles);

      ctx.translate(pos.x, pos.y);
      ctx.rotate(angle);

      var fontSizePx = parseFloat(fontConfig.fontSize);
      if (fontConfig.fontSize.indexOf('vw') !== -1) {
        fontSizePx = parseFloat(fontConfig.fontSize) * window.innerWidth / 100;
      }
      var fontSize = Math.round(fontSizePx);
      var fontStyle = fontConfig.fontStyle ? fontConfig.fontStyle + ' ' : '';
      ctx.font = fontStyle + fontConfig.fontWeight + ' ' + fontSize + 'px ' + fontConfig.fontFamily;
      ctx.fillStyle = data.type === 'sub' ? SUBTEXT_COLOR : TEXT_COLOR;
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'center';
      ctx.fillText(data.text, 0, 0);

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    });

    ctx.restore();
  }

  function checkAnimationComplete() {
    if (!isAnimating || !engine || !wordBodies.length) return false;

    var dpr = window.devicePixelRatio || 1;
    var canvasHeight = canvas ? canvas.height / dpr : window.innerHeight;
    var canvasWidth = canvas ? canvas.width / dpr : window.innerWidth;

    var allOffScreen = wordBodies.every(function(body) {
      return body.position.y > canvasHeight + 100 ||
             body.position.x < -200 ||
             body.position.x > canvasWidth + 200;
    });

    if (allOffScreen) return true;

    var allStationary = wordBodies.every(function(body) {
      var vel = body.velocity;
      var angVel = body.angularVelocity;
      return Math.abs(vel.x) < CONFIG.velocityThreshold &&
             Math.abs(vel.y) < CONFIG.velocityThreshold &&
             Math.abs(angVel) < CONFIG.velocityThreshold;
    });

    return allStationary;
  }

  function startCompletionCheck(callback) {
    var elapsed = 0;
    var interval = setInterval(function() {
      elapsed += CONFIG.checkInterval;
      var animationElapsed = Date.now() - animationStartTime;
      var minDurationMet = animationElapsed >= CONFIG.minAnimationDuration;

      if ((checkAnimationComplete() && minDurationMet) || elapsed >= CONFIG.maxTimeout) {
        clearInterval(interval);
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        callback();
      }
    }, CONFIG.checkInterval);
  }

  function cleanup() {
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
    if (runner) {
      Matter.Runner.stop(runner);
      runner = null;
    }
    if (engine) {
      Matter.Engine.clear(engine);
      engine = null;
    }
    if (mouseConstraint) {
      mouseConstraint = null;
    }
    if (mouse) {
      mouse = null;
    }
    if (canvas && canvas.parentNode) {
      canvas.parentNode.removeChild(canvas);
    }
    canvas = null;
    ctx = null;
    wordBodies = [];
    savedContainerRect = null;

    if (containerEl && originalHTML) {
      containerEl.innerHTML = originalHTML;
      containerEl.style.visibility = '';
      containerEl.style.opacity = '';
      Object.keys(originalStyles).forEach(function(key) {
        containerEl.style[key] = originalStyles[key];
      });
    }
    containerEl = null;
  }

  function startRenderLoop() {
    function loop() {
      if (!isAnimating) return;
      renderFrame();
      animationFrameId = requestAnimationFrame(loop);
    }
    animationFrameId = requestAnimationFrame(loop);
  }

  function trigger(selector) {
    return new Promise(function(resolve) {
      if (isAnimating || typeof Matter === 'undefined') {
        resolve();
        return;
      }

      containerEl = document.querySelector(selector || '#hero-content');
      if (!containerEl) {
        resolve();
        return;
      }

      var words = extractWords(containerEl);
      var validWords = [].concat(words.title, words.sub);
      if (validWords.length === 0) {
        resolve();
        return;
      }

      isAnimating = true;
      animationStartTime = Date.now();
      originalHTML = containerEl.innerHTML;
      originalStyles = {
        visibility: containerEl.style.visibility,
        opacity: containerEl.style.opacity
      };

      var styles = getComputedTextStyles(containerEl);

      var titleLines = containerEl.querySelectorAll('.hero-title-line');
      var subtitle = containerEl.querySelector('.hero-subtitle');
      var cachedRects = {
        titleRects: Array.from(titleLines).map(function(l) { return l.getBoundingClientRect(); }),
        subRect: subtitle ? subtitle.getBoundingClientRect() : null
      };

      var viewportWidth = window.innerWidth;
      var viewportHeight = window.innerHeight;
      savedContainerRect = {
        width: viewportWidth,
        height: viewportHeight
      };

      wordBodies = layoutWords(words, styles, cachedRects);

      containerEl.innerHTML = '';
      try {
        canvas = createCanvasOverlay();
        ctx = canvas.getContext('2d');
        engine = createEngine(savedContainerRect);

        Matter.Composite.add(engine.world, wordBodies);
        setupMouseInteraction(canvas, engine);

        runner = Matter.Runner.create();
        Matter.Runner.run(runner, engine);
        startRenderLoop();

        timeoutId = setTimeout(function() {
          finishAnimation(resolve);
        }, CONFIG.maxTimeout);

        startCompletionCheck(function() {
          finishAnimation(resolve);
        });

      } catch (err) {
        console.error('[FallingText] Animation error:', err);
        cleanup();
        isAnimating = false;
        resolve();
      }
    });
  }

  function finishAnimation(resolve) {
    if (!isAnimating) return;
    setTimeout(function() {
      cleanup();
      isAnimating = false;
      if (resolve) resolve();
    }, 400);
  }

  return {
    trigger: trigger,
    isAnimating: function() { return isAnimating; }
  };
})();
