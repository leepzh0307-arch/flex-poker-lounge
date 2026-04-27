function debounce(func, wait) {
  var timeout;
  return function () {
    clearTimeout(timeout);
    timeout = setTimeout(func.apply.bind(func, this, arguments), wait);
  };
}

function lerp(p1, p2, t) {
  return p1 + (p2 - p1) * t;
}

var CircularGallery = (function () {
  function createTextTexture(gl, text, font, color) {
    var canvas = document.createElement('canvas');
    var context = canvas.getContext('2d');
    context.font = font;
    var metrics = context.measureText(text);
    var textWidth = Math.ceil(metrics.width);
    var textHeight = Math.ceil(parseInt(font, 10) * 1.2);
    canvas.width = textWidth + 20;
    canvas.height = textHeight + 20;
    context.font = font;
    context.fillStyle = color;
    context.textBaseline = 'middle';
    context.textAlign = 'center';
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillText(text, canvas.width / 2, canvas.height / 2);
    return { canvas: canvas, width: canvas.width, height: canvas.height };
  }

  function Gallery(container, opts) {
    opts = opts || {};
    this.container = container;
    this.items = opts.items || [];
    this.bend = opts.bend || 3;
    this.textColor = opts.textColor || '#ffffff';
    this.borderRadius = opts.borderRadius || 0.05;
    this.scrollSpeed = opts.scrollSpeed || 2;
    this.scrollEase = opts.scrollEase || 0.05;
    this.scroll = { ease: this.scrollEase, current: 0, target: 0, last: 0 };
    this.onCheckDebounce = debounce(this.onCheck.bind(this), 200);
    this.isDown = false;
    this.start = 0;
    this.medias = [];
    this.raf = 0;

    this.init();
  }

  Gallery.prototype.init = function () {
    var self = this;
    import('https://cdn.jsdelivr.net/npm/ogl@1.0.6/+esm').then(function (OGL) {
      self.OGL = OGL;
      self.createRenderer();
      self.createCamera();
      self.createScene();
      self.onResize();
      self.createGeometry();
      self.createMedias();
      self.update();
      self.addEventListeners();
    }).catch(function (err) {
      console.warn('CircularGallery: Failed to load OGL:', err);
    });
  };

  Gallery.prototype.createRenderer = function () {
    var OGL = this.OGL;
    this.renderer = new OGL.Renderer({
      alpha: true,
      antialias: true,
      dpr: Math.min(window.devicePixelRatio || 1, 2),
    });
    this.gl = this.renderer.gl;
    this.gl.clearColor(0, 0, 0, 0);
    this.container.appendChild(this.gl.canvas);
    this.gl.canvas.style.width = '100%';
    this.gl.canvas.style.height = '100%';
  };

  Gallery.prototype.createCamera = function () {
    var OGL = this.OGL;
    this.camera = new OGL.Camera(this.gl);
    this.camera.fov = 45;
    this.camera.position.z = 20;
  };

  Gallery.prototype.createScene = function () {
    var OGL = this.OGL;
    this.scene = new OGL.Transform();
  };

  Gallery.prototype.createGeometry = function () {
    var OGL = this.OGL;
    this.planeGeometry = new OGL.Plane(this.gl, {
      heightSegments: 50,
      widthSegments: 100,
    });
  };

  Gallery.prototype.createMedias = function () {
    var OGL = this.OGL;
    var self = this;
    var galleryItems = this.items.concat(this.items);

    this.medias = galleryItems.map(function (data, index) {
      var texture = new OGL.Texture(self.gl, { generateMipmaps: true });

      var program = new OGL.Program(self.gl, {
        depthTest: false,
        depthWrite: false,
        vertex: [
          'precision highp float;',
          'attribute vec3 position;',
          'attribute vec2 uv;',
          'uniform mat4 modelViewMatrix;',
          'uniform mat4 projectionMatrix;',
          'uniform float uTime;',
          'uniform float uSpeed;',
          'varying vec2 vUv;',
          'void main() {',
          '  vUv = uv;',
          '  vec3 p = position;',
          '  p.z = (sin(p.x * 4.0 + uTime) * 1.5 + cos(p.y * 2.0 + uTime) * 1.5) * (0.1 + uSpeed * 0.5);',
          '  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);',
          '}',
        ].join('\n'),
        fragment: [
          'precision highp float;',
          'uniform vec2 uImageSizes;',
          'uniform vec2 uPlaneSizes;',
          'uniform sampler2D tMap;',
          'uniform float uBorderRadius;',
          'varying vec2 vUv;',
          'float roundedBoxSDF(vec2 p, vec2 b, float r) {',
          '  vec2 d = abs(p) - b;',
          '  return length(max(d, vec2(0.0))) + min(max(d.x, d.y), 0.0) - r;',
          '}',
          'void main() {',
          '  vec2 ratio = vec2(',
          '    min((uPlaneSizes.x / uPlaneSizes.y) / (uImageSizes.x / uImageSizes.y), 1.0),',
          '    min((uPlaneSizes.y / uPlaneSizes.x) / (uImageSizes.y / uImageSizes.x), 1.0)',
          '  );',
          '  vec2 uv = vec2(',
          '    vUv.x * ratio.x + (1.0 - ratio.x) * 0.5,',
          '    vUv.y * ratio.y + (1.0 - ratio.y) * 0.5',
          '  );',
          '  vec4 color = texture2D(tMap, uv);',
          '  float d = roundedBoxSDF(vUv - 0.5, vec2(0.5 - uBorderRadius), uBorderRadius);',
          '  float edgeSmooth = 0.002;',
          '  float alpha = 1.0 - smoothstep(-edgeSmooth, edgeSmooth, d);',
          '  gl_FragColor = vec4(color.rgb, alpha);',
          '}',
        ].join('\n'),
        uniforms: {
          tMap: { value: texture },
          uPlaneSizes: { value: [0, 0] },
          uImageSizes: { value: [0, 0] },
          uSpeed: { value: 0 },
          uTime: { value: 100 * Math.random() },
          uBorderRadius: { value: self.borderRadius },
        },
        transparent: true,
      });

      var img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = data.image;
      img.onload = function () {
        texture.image = img;
        program.uniforms.uImageSizes.value = [img.naturalWidth, img.naturalHeight];
      };

      var plane = new OGL.Mesh(self.gl, {
        geometry: self.planeGeometry,
        program: program,
      });
      plane.setParent(self.scene);

      var textData = createTextTexture(self.gl, data.text, 'bold 30px "DM Sans", sans-serif', self.textColor);
      var textTexture = new OGL.Texture(self.gl, { generateMipmaps: false });
      textTexture.image = textData.canvas;
      var textGeom = new OGL.Plane(self.gl);
      var textProgram = new OGL.Program(self.gl, {
        vertex: [
          'attribute vec3 position;',
          'attribute vec2 uv;',
          'uniform mat4 modelViewMatrix;',
          'uniform mat4 projectionMatrix;',
          'varying vec2 vUv;',
          'void main() {',
          '  vUv = uv;',
          '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
          '}',
        ].join('\n'),
        fragment: [
          'precision highp float;',
          'uniform sampler2D tMap;',
          'varying vec2 vUv;',
          'void main() {',
          '  vec4 color = texture2D(tMap, vUv);',
          '  if (color.a < 0.1) discard;',
          '  gl_FragColor = color;',
          '}',
        ].join('\n'),
        uniforms: { tMap: { value: textTexture } },
        transparent: true,
      });
      var textMesh = new OGL.Mesh(self.gl, { geometry: textGeom, program: textProgram });
      textMesh.setParent(plane);

      return {
        plane: plane,
        program: program,
        textMesh: textMesh,
        index: index,
        length: galleryItems.length,
        extra: 0,
        speed: 0,
        isBefore: false,
        isAfter: false,
        width: 0,
        widthTotal: 0,
        x: 0,
        padding: 2,
      };
    });

    this.onResize();
  };

  Gallery.prototype.onResize = function () {
    this.screen = {
      width: this.container.clientWidth,
      height: this.container.clientHeight,
    };
    if (this.screen.width === 0 || this.screen.height === 0) return;
    this.renderer.setSize(this.screen.width, this.screen.height);
    this.camera.perspective({ aspect: this.screen.width / this.screen.height });
    var fov = (this.camera.fov * Math.PI) / 180;
    var height = 2 * Math.tan(fov / 2) * this.camera.position.z;
    var width = height * this.camera.aspect;
    this.viewport = { width: width, height: height };

    if (this.medias.length > 0) {
      var self = this;
      this.medias.forEach(function (media) {
        var scale = self.screen.height / 1500;
        media.plane.scale.y = (self.viewport.height * (900 * scale)) / self.screen.height;
        media.plane.scale.x = (self.viewport.width * (700 * scale)) / self.screen.width;
        media.program.uniforms.uPlaneSizes.value = [media.plane.scale.x, media.plane.scale.y];

        var aspect = 1;
        var textHeight = media.plane.scale.y * 0.15;
        var textWidth = textHeight * aspect;
        media.textMesh.scale.set(textWidth, textHeight, 1);
        media.textMesh.position.y = -media.plane.scale.y * 0.5 - textHeight * 0.5 - 0.05;

        media.width = media.plane.scale.x + media.padding;
        media.widthTotal = media.width * media.length;
        media.x = media.width * media.index;
      });
    }
  };

  Gallery.prototype.update = function () {
    this.scroll.current = lerp(this.scroll.current, this.scroll.target, this.scroll.ease);
    var direction = this.scroll.current > this.scroll.last ? 'right' : 'left';

    var self = this;
    this.medias.forEach(function (media) {
      media.plane.position.x = media.x - self.scroll.current - media.extra;

      var x = media.plane.position.x;
      var H = self.viewport.width / 2;

      if (self.bend === 0) {
        media.plane.position.y = 0;
        media.plane.rotation.z = 0;
      } else {
        var B_abs = Math.abs(self.bend);
        var R = (H * H + B_abs * B_abs) / (2 * B_abs);
        var effectiveX = Math.min(Math.abs(x), H);
        var arc = R - Math.sqrt(R * R - effectiveX * effectiveX);
        if (self.bend > 0) {
          media.plane.position.y = -arc;
          media.plane.rotation.z = -Math.sign(x) * Math.asin(effectiveX / R);
        } else {
          media.plane.position.y = arc;
          media.plane.rotation.z = Math.sign(x) * Math.asin(effectiveX / R);
        }
      }

      media.speed = self.scroll.current - self.scroll.last;
      media.program.uniforms.uTime.value += 0.04;
      media.program.uniforms.uSpeed.value = media.speed;

      var planeOffset = media.plane.scale.x / 2;
      var viewportOffset = self.viewport.width / 2;
      media.isBefore = media.plane.position.x + planeOffset < -viewportOffset;
      media.isAfter = media.plane.position.x - planeOffset > viewportOffset;

      if (direction === 'right' && media.isBefore) {
        media.extra -= media.widthTotal;
        media.isBefore = media.isAfter = false;
      }
      if (direction === 'left' && media.isAfter) {
        media.extra += media.widthTotal;
        media.isBefore = media.isAfter = false;
      }
    });

    this.renderer.render({ scene: this.scene, camera: this.camera });
    this.scroll.last = this.scroll.current;
    this.raf = requestAnimationFrame(this.update.bind(this));
  };

  Gallery.prototype.onWheel = function (e) {
    var delta = e.deltaY || e.wheelDelta || e.detail;
    this.scroll.target += (delta > 0 ? this.scrollSpeed : -this.scrollSpeed) * 0.2;
    this.onCheckDebounce();
  };

  Gallery.prototype.onTouchDown = function (e) {
    this.isDown = true;
    this.scroll.position = this.scroll.current;
    this.start = e.touches ? e.touches[0].clientX : e.clientX;
  };

  Gallery.prototype.onTouchMove = function (e) {
    if (!this.isDown) return;
    var x = e.touches ? e.touches[0].clientX : e.clientX;
    var distance = (this.start - x) * (this.scrollSpeed * 0.025);
    this.scroll.target = this.scroll.position + distance;
  };

  Gallery.prototype.onTouchUp = function () {
    this.isDown = false;
    this.onCheck();
  };

  Gallery.prototype.onCheck = function () {
    if (!this.medias || !this.medias[0]) return;
    var width = this.medias[0].width;
    if (width === 0) return;
    var itemIndex = Math.round(Math.abs(this.scroll.target) / width);
    var item = width * itemIndex;
    this.scroll.target = this.scroll.target < 0 ? -item : item;
  };

  Gallery.prototype.addEventListeners = function () {
    this.boundOnResize = this.onResize.bind(this);
    this.boundOnWheel = this.onWheel.bind(this);
    this.boundOnTouchDown = this.onTouchDown.bind(this);
    this.boundOnTouchMove = this.onTouchMove.bind(this);
    this.boundOnTouchUp = this.onTouchUp.bind(this);
    window.addEventListener('resize', this.boundOnResize);
    window.addEventListener('mousewheel', this.boundOnWheel);
    window.addEventListener('wheel', this.boundOnWheel);
    this.container.addEventListener('mousedown', this.boundOnTouchDown);
    window.addEventListener('mousemove', this.boundOnTouchMove);
    window.addEventListener('mouseup', this.boundOnTouchUp);
    this.container.addEventListener('touchstart', this.boundOnTouchDown, { passive: true });
    window.addEventListener('touchmove', this.boundOnTouchMove, { passive: true });
    window.addEventListener('touchend', this.boundOnTouchUp);
  };

  Gallery.prototype.destroy = function () {
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.boundOnResize);
    window.removeEventListener('mousewheel', this.boundOnWheel);
    window.removeEventListener('wheel', this.boundOnWheel);
    this.container.removeEventListener('mousedown', this.boundOnTouchDown);
    window.removeEventListener('mousemove', this.boundOnTouchMove);
    window.removeEventListener('mouseup', this.boundOnTouchUp);
    this.container.removeEventListener('touchstart', this.boundOnTouchDown);
    window.removeEventListener('touchmove', this.boundOnTouchMove);
    window.removeEventListener('touchend', this.boundOnTouchUp);
    if (this.renderer && this.renderer.gl && this.renderer.gl.canvas.parentNode) {
      this.renderer.gl.canvas.parentNode.removeChild(this.renderer.gl.canvas);
    }
  };

  return {
    create: function (container, opts) {
      return new Gallery(container, opts);
    },
  };
})();
