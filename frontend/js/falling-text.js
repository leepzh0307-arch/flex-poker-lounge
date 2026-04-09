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
    gravity: 1.5,
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

  // ✅ 修复1：统一字体样式获取，避免中英文副标题样式不一致
  function getComputedTextStyles(el) {
    var cs = window.getComputedStyle(el);
    var line1 = el.querySelector('.hero-title-line1');
    var line2 = el.querySelector('.hero-title-line2');
    var subtextLeft = el.querySelector('.hero-subtext-left p');
    
    var lineCs = line1 ? window.getComputedStyle(line1) : cs;
    var subtextLeftCs = subtextLeft ? window.getComputedStyle(subtextLeft) : lineCs;
    
    return {
      fontFamily: lineCs.fontFamily || "'Playfair Display', serif",
      fontWeight: lineCs.fontWeight || '700',
      fontSize: lineCs.fontSize || '6.5vw',
      color: lineCs.color || '#ffffff',
      letterSpacing: lineCs.letterSpacing || '-0.02em',
      lineHeight: lineCs.lineHeight || '1.1',
      // 单独获取副标题样式
      leftSub: {
        fontFamily: subtextLeftCs.fontFamily || "'Inter', sans-serif",
        fontWeight: subtextLeftCs.fontWeight || '300',
        fontSize: subtextLeftCs.fontSize || '0.8125vw',
        lineHeight: subtextLeftCs.lineHeight || '1.6',
        fontStyle: 'italic'
      }
    };
  }

  // ✅ 修复2：移除所有换行标记，纯按类型拆分单词，彻底避免标记歧义
  function extractWords(container) {
    var words = {
      title: [],
      subEnglish: []
    };
    var line1 = container.querySelector('.hero-title-line1');
    var line2 = container.querySelector('.hero-title-line2');
    var englishSubtext = container.querySelector('.hero-subtext-left p');
    
    // 提取主标题（两行合并，后续布局单独处理）
    if (line1) {
      var line1Text = line1.textContent.trim();
      if (line1Text) {
        line1Text.split(/\s+/).forEach(function(word) {
          if (word) words.title.push({ text: word, type: 'title', line: 1 });
        });
      }
    }
    if (line2) {
      var line2Text = line2.textContent.trim();
      if (line2Text) {
        line2Text.split(/\s+/).forEach(function(word) {
          if (word) words.title.push({ text: word, type: 'title', line: 2 });
        });
      }
    }
    
    // 提取英文副标题
    if (englishSubtext) {
      var englishText = englishSubtext.textContent.trim();
      if (englishText) {
        englishText.split(/\s+/).forEach(function(word) {
          if (word) words.subEnglish.push({ text: word, type: 'subtext-english' });
        });
      }
    }
    
    return words;
  }

  // ✅ 修复3：精准测量文字尺寸，区分中英文副标题字体
  function measureWord(word, styles) {
    var mCanvas = document.createElement('canvas');
    var mCtx = mCanvas.getContext('2d');
    
    var fontConfig;
    if (word.type === 'subtext-english') {
      fontConfig = styles.leftSub;
    } else {
      fontConfig = styles;
    }
    
    var fontSizePx = parseFloat(fontConfig.fontSize);
    if (fontConfig.fontSize.indexOf('vw') !== -1) {
      fontSizePx = parseFloat(fontConfig.fontSize) * window.innerWidth / 100;
    }
    
    var fontStyle = fontConfig.fontStyle ? fontConfig.fontStyle + ' ' : '';
    mCtx.font = fontStyle + fontConfig.fontWeight + ' ' + Math.round(fontSizePx) + 'px ' + fontConfig.fontFamily;
    var metrics = mCtx.measureText(word.text);
    
    // 主标题使用紧凑尺寸，副标题保持原样
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
    // Matter.js矩形需要传入中心点坐标，这里精准计算左上角对应中心点
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

  // ✅ 修复4：完全重构布局逻辑，分块独立处理，强制锁定副标题同一行起始
  function layoutWords(words, styles, cachedRects) {
    var bodies = [];
    var { line1Rect, line2Rect, englishRect } = cachedRects;

    // ========== 1. 主标题布局 ==========
    var titleLine1X = line1Rect ? line1Rect.left : 80;
    var titleLine1Y = line1Rect ? line1Rect.top : 120;
    var titleLine2X = line2Rect ? line2Rect.left : titleLine1X;
    var titleLine2Y = line2Rect ? line2Rect.top : titleLine1Y + 80;
    var titleLineHeight = parseFloat(styles.fontSize);
    if (styles.fontSize.indexOf('vw') !== -1) {
      titleLineHeight = parseFloat(styles.fontSize) * window.innerWidth / 100;
    }
    var titleWordGap = titleLineHeight * 0.12;

    var currentTitleX = titleLine1X;
    var currentTitleY = titleLine1Y;
    words.title.forEach(function(word, index) {
      // 切换到第二行
      if (word.line === 2 && index === words.title.findIndex(w => w.line === 2)) {
        currentTitleX = titleLine2X;
        currentTitleY = titleLine2Y;
      }
      var size = measureWord(word, styles);
      var body = createWordBody(word, currentTitleX, currentTitleY, size.width, size.height, styles, size.fontConfig);
      bodies.push(body);
      currentTitleX += size.width + titleWordGap;
    });

    // ========== 2. 副标题布局（支持自动换行） ==========
    var subBaseY = 240;
    if (englishRect) {
      subBaseY = englishRect.top;
    } else {
      // 如果没有副标题元素，基于主标题位置计算
      subBaseY = line2Rect ? line2Rect.top + 80 : titleLine1Y + 160;
    }

    // 英文副标题布局
    var englishStartX = englishRect ? englishRect.left : 80;
    // 获取副标题容器的最大宽度用于换行判断
    var subMaxWidth = englishRect ? englishRect.width : (window.innerWidth * 0.6);

    // 副标题通用参数
    var subFontSize = parseFloat(styles.leftSub.fontSize);
    if (styles.leftSub.fontSize.indexOf('vw') !== -1) {
      subFontSize = parseFloat(styles.leftSub.fontSize) * window.innerWidth / 100;
    }
    var subLineHeight = subFontSize * 1.2;
    var subWordGap = subLineHeight * 0.3;

    // 英文副标题布局（支持自动换行）
    var currentEnglishX = englishStartX;
    var currentSubY = subBaseY;
    var lineStartX = englishStartX; // 每行的起始X坐标

    words.subEnglish.forEach(function(word, index) {
      var size = measureWord(word, styles);
      
      // 检查是否需要换行（不是第一个单词且超出最大宽度）
      var needNewLine = index > 0 && 
                       (currentEnglishX + size.width > englishStartX + subMaxWidth);
      
      if (needNewLine) {
        currentEnglishX = lineStartX;
        currentSubY += subLineHeight;
      }
      
      var body = createWordBody(word, currentEnglishX, currentSubY, size.width, size.height, styles, size.fontConfig);
      bodies.push(body);
      currentEnglishX += size.width + subWordGap;
    });

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

  // ✅ 修复5：canvas强制覆盖整个视口，避免坐标系错位
  function createCanvasOverlay() {
    var viewportWidth = window.innerWidth;
    var viewportHeight = window.innerHeight;
    var dpr = window.devicePixelRatio || 1;

    var canvasEl = document.createElement('canvas');
    canvasEl.className = 'falling-text-canvas';
    // 画布尺寸适配高清屏
    canvasEl.width = viewportWidth * dpr;
    canvasEl.height = viewportHeight * dpr;
    // 样式尺寸和视口完全一致
    canvasEl.style.width = viewportWidth + 'px';
    canvasEl.style.height = viewportHeight + 'px';
    canvasEl.style.position = 'fixed';
    canvasEl.style.top = '0';
    canvasEl.style.left = '0';
    canvasEl.style.zIndex = '9999';
    canvasEl.style.pointerEvents = 'auto';
    canvasEl.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';

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
      var fontConfig;
      if (data.fontConfig) {
        fontConfig = data.fontConfig;
      } else if (data.type === 'subtext-english') {
        fontConfig = data.styles.leftSub;
      } else {
        fontConfig = data.styles;
      }

      ctx.translate(pos.x, pos.y);
      ctx.rotate(angle);

      // 使用原始的字体大小配置，确保动画前后一致
      var fontSizePx = parseFloat(fontConfig.fontSize);
      if (fontConfig.fontSize.indexOf('vw') !== -1) {
        fontSizePx = parseFloat(fontConfig.fontSize) * window.innerWidth / 100;
      }
      var fontSize = Math.round(fontSizePx);
      var fontStyle = fontConfig.fontStyle ? fontConfig.fontStyle + ' ' : '';
      ctx.font = fontStyle + fontConfig.fontWeight + ' ' + fontSize + 'px ' + fontConfig.fontFamily;
      ctx.fillStyle = '#ffffff';
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

  // ✅ 修复6：调整执行顺序，DOM修改前完成所有坐标/样式计算
  function trigger(selector) {
    return new Promise(function(resolve) {
      if (isAnimating || typeof Matter === 'undefined') {
        resolve();
        return;
      }

      containerEl = document.querySelector(selector || '.hero-title-container');
      if (!containerEl) {
        resolve();
        return;
      }

      // 1. 提前缓存所有原始数据（DOM修改前完成，绝对避免取值错误）
      var words = extractWords(containerEl);
      var validWords = [...words.title, ...words.subEnglish];
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

      // 2. 一次性缓存所有样式和DOM坐标，后续不再查询DOM
      var styles = getComputedTextStyles(containerEl);
      var cachedRects = {
        line1Rect: containerEl.querySelector('.hero-title-line1')?.getBoundingClientRect() || null,
        line2Rect: containerEl.querySelector('.hero-title-line2')?.getBoundingClientRect() || null,
        englishRect: containerEl.querySelector('.hero-subtext-left p')?.getBoundingClientRect() || null
      };
      
      var viewportWidth = window.innerWidth;
      var viewportHeight = window.innerHeight;
      savedContainerRect = {
        width: viewportWidth,
        height: viewportHeight
      };

      // 3. 完成布局计算（此时DOM还未修改，所有坐标都是原始值）
      wordBodies = layoutWords(words, styles, cachedRects);

      // 4. 所有计算完成后，再修改DOM和创建canvas
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