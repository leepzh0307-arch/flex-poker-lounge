var Dice3D = (function () {
  var renderer, scene, camera, diceMesh, physicsWorld;
  var diceArray = [];
  var canvasEl;
  var isInitialized = false;
  var onDiceSettled = null;
  var settledCount = 0;
  var totalDice = 0;
  var animationId = null;

  var params = {
    numberOfDice: 5,
    segments: 40,
    edgeRadius: 0.07,
    notchRadius: 0.12,
    notchDepth: 0.1,
  };

  function init(canvas) {
    if (isInitialized) return;
    canvasEl = canvas || document.getElementById('dice-canvas');
    if (!canvasEl) return;

    initPhysics();
    initScene();
    isInitialized = true;
  }

  function initScene() {
    if (!window.THREE) return;
    var THREE = window.THREE;

    renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      canvas: canvasEl,
    });
    renderer.shadowMap.enabled = true;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;

    scene = new THREE.Scene();

    var aspect = canvasEl.clientWidth / canvasEl.clientHeight;
    camera = new THREE.PerspectiveCamera(40, aspect, 0.1, 300);
    camera.position.set(0, 12, 8);
    camera.lookAt(0, 0, 0);

    updateSceneSize();

    var ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    var topLight = new THREE.SpotLight(0xffffff, 0.8);
    topLight.position.set(0, 20, 0);
    topLight.angle = Math.PI / 4;
    topLight.penumbra = 0.3;
    topLight.castShadow = true;
    topLight.shadow.mapSize.width = 2048;
    topLight.shadow.mapSize.height = 2048;
    topLight.shadow.camera.near = 5;
    topLight.shadow.camera.far = 50;
    scene.add(topLight);

    var fillLight = new THREE.PointLight(0xffeedd, 0.3);
    fillLight.position.set(-8, 10, 5);
    scene.add(fillLight);

    createFloor();
    createWalls();
    diceMesh = createDiceMesh();

    render();
  }

  function initPhysics() {
    if (!window.CANNON) return;
    var CANNON = window.CANNON;

    physicsWorld = new CANNON.World();
    physicsWorld.gravity.set(0, -30, 0);
    physicsWorld.allowSleep = true;
    physicsWorld.broadphase = new CANNON.NaiveBroadphase();
    physicsWorld.solver.iterations = 10;

    var diceMaterial = new CANNON.Material('dice');
    var floorMaterial = new CANNON.Material('floor');
    var diceFloorContact = new CANNON.ContactMaterial(diceMaterial, floorMaterial, {
      friction: 0.4,
      restitution: 0.3,
    });
    physicsWorld.addContactMaterial(diceFloorContact);

    var diceDiceContact = new CANNON.ContactMaterial(diceMaterial, diceMaterial, {
      friction: 0.3,
      restitution: 0.4,
    });
    physicsWorld.addContactMaterial(diceDiceContact);
  }

  function createFloor() {
    var THREE = window.THREE;
    var CANNON = window.CANNON;
    if (!THREE || !CANNON) return;

    var floorGeo = new THREE.CircleGeometry(12, 64);
    var floorMat = new THREE.MeshStandardMaterial({
      color: 0x1a3a1a,
      roughness: 0.8,
      metalness: 0.1,
    });
    var floor = new THREE.Mesh(floorGeo, floorMat);
    floor.receiveShadow = true;
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.01;
    scene.add(floor);

    var rimGeo = new THREE.RingGeometry(11.5, 12.5, 64);
    var rimMat = new THREE.MeshStandardMaterial({
      color: 0x8B7355,
      roughness: 0.6,
      metalness: 0.3,
    });
    var rim = new THREE.Mesh(rimGeo, rimMat);
    rim.rotation.x = -Math.PI / 2;
    rim.position.y = 0.01;
    scene.add(rim);

    var floorBody = new CANNON.Body({ mass: 0 });
    floorBody.addShape(new CANNON.Plane());
    floorBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
    physicsWorld.addBody(floorBody);
  }

  function createWalls() {
    var CANNON = window.CANNON;
    if (!CANNON) return;

    var wallDist = 10;
    var wallHeight = 3;
    var wallThickness = 0.5;

    for (var i = 0; i < 6; i++) {
      var angle = (i / 6) * Math.PI * 2;
      var wx = Math.cos(angle) * wallDist;
      var wz = Math.sin(angle) * wallDist;

      var wallBody = new CANNON.Body({ mass: 0 });
      wallBody.addShape(new CANNON.Box(new CANNON.Vec3(wallDist * 0.6, wallHeight, wallThickness)));
      wallBody.position.set(wx * 0.5, wallHeight, wz * 0.5);
      wallBody.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), -angle + Math.PI / 2);
      physicsWorld.addBody(wallBody);
    }
  }

  function createDiceMesh() {
    var THREE = window.THREE;
    if (!THREE) return null;

    var boxMaterialOuter = new THREE.MeshStandardMaterial({
      color: 0xf5f5f0,
      roughness: 0.3,
      metalness: 0.05,
    });
    var boxMaterialInner = new THREE.MeshStandardMaterial({
      color: 0x111111,
      roughness: 0,
      metalness: 1,
      side: THREE.DoubleSide,
    });

    var group = new THREE.Group();
    var innerMesh = new THREE.Mesh(createInnerGeometry(), boxMaterialInner);
    var outerMesh = new THREE.Mesh(createBoxGeometry(), boxMaterialOuter);
    outerMesh.castShadow = true;
    group.add(innerMesh, outerMesh);

    return group;
  }

  function createBoxGeometry() {
    var THREE = window.THREE;
    if (!THREE) return null;

    var boxGeometry = new THREE.BoxGeometry(1, 1, 1, params.segments, params.segments, params.segments);
    var positionAttr = boxGeometry.attributes.position;
    var subCubeHalfSize = 0.5 - params.edgeRadius;

    for (var i = 0; i < positionAttr.count; i++) {
      var position = new THREE.Vector3().fromBufferAttribute(positionAttr, i);
      var subCube = new THREE.Vector3(Math.sign(position.x), Math.sign(position.y), Math.sign(position.z)).multiplyScalar(subCubeHalfSize);
      var addition = new THREE.Vector3().subVectors(position, subCube);

      if (Math.abs(position.x) > subCubeHalfSize && Math.abs(position.y) > subCubeHalfSize && Math.abs(position.z) > subCubeHalfSize) {
        addition.normalize().multiplyScalar(params.edgeRadius);
        position = subCube.add(addition);
      } else if (Math.abs(position.x) > subCubeHalfSize && Math.abs(position.y) > subCubeHalfSize) {
        addition.z = 0;
        addition.normalize().multiplyScalar(params.edgeRadius);
        position.x = subCube.x + addition.x;
        position.y = subCube.y + addition.y;
      } else if (Math.abs(position.x) > subCubeHalfSize && Math.abs(position.z) > subCubeHalfSize) {
        addition.y = 0;
        addition.normalize().multiplyScalar(params.edgeRadius);
        position.x = subCube.x + addition.x;
        position.z = subCube.z + addition.z;
      } else if (Math.abs(position.y) > subCubeHalfSize && Math.abs(position.z) > subCubeHalfSize) {
        addition.x = 0;
        addition.normalize().multiplyScalar(params.edgeRadius);
        position.y = subCube.y + addition.y;
        position.z = subCube.z + addition.z;
      }

      var notchWave = function (v) {
        v = (1 / params.notchRadius) * v;
        v = Math.PI * Math.max(-1, Math.min(1, v));
        return params.notchDepth * (Math.cos(v) + 1);
      };
      var notch = function (pos) { return notchWave(pos[0]) * notchWave(pos[1]); };
      var offset = 0.23;

      if (position.y === 0.5) {
        position.y -= notch([position.x, position.z]);
      } else if (position.x === 0.5) {
        position.x -= notch([position.y + offset, position.z + offset]);
        position.x -= notch([position.y - offset, position.z - offset]);
      } else if (position.z === 0.5) {
        position.z -= notch([position.x - offset, position.y + offset]);
        position.z -= notch([position.x, position.y]);
        position.z -= notch([position.x + offset, position.y - offset]);
      } else if (position.z === -0.5) {
        position.z += notch([position.x + offset, position.y + offset]);
        position.z += notch([position.x + offset, position.y - offset]);
        position.z += notch([position.x - offset, position.y + offset]);
        position.z += notch([position.x - offset, position.y - offset]);
      } else if (position.x === -0.5) {
        position.x += notch([position.y + offset, position.z + offset]);
        position.x += notch([position.y + offset, position.z - offset]);
        position.x += notch([position.y, position.z]);
        position.x += notch([position.y - offset, position.z + offset]);
        position.x += notch([position.y - offset, position.z - offset]);
      } else if (position.y === -0.5) {
        position.y += notch([position.x + offset, position.z + offset]);
        position.y += notch([position.x + offset, position.z]);
        position.y += notch([position.x + offset, position.z - offset]);
        position.y += notch([position.x - offset, position.z + offset]);
        position.y += notch([position.x - offset, position.z]);
        position.y += notch([position.x - offset, position.z - offset]);
      }

      positionAttr.setXYZ(i, position.x, position.y, position.z);
    }

    boxGeometry.deleteAttribute('normal');
    boxGeometry.deleteAttribute('uv');
    boxGeometry = THREE.BufferGeometryUtils.mergeVertices(boxGeometry);
    boxGeometry.computeVertexNormals();

    return boxGeometry;
  }

  function createInnerGeometry() {
    var THREE = window.THREE;
    if (!THREE) return null;

    var baseGeometry = new THREE.PlaneGeometry(1 - 2 * params.edgeRadius, 1 - 2 * params.edgeRadius);
    var offset = 0.48;
    return THREE.BufferGeometryUtils.mergeBufferGeometries([
      baseGeometry.clone().translate(0, 0, offset),
      baseGeometry.clone().translate(0, 0, -offset),
      baseGeometry.clone().rotateX(0.5 * Math.PI).translate(0, -offset, 0),
      baseGeometry.clone().rotateX(0.5 * Math.PI).translate(0, offset, 0),
      baseGeometry.clone().rotateY(0.5 * Math.PI).translate(-offset, 0, 0),
      baseGeometry.clone().rotateY(0.5 * Math.PI).translate(offset, 0, 0),
    ], false);
  }

  function createDice() {
    var CANNON = window.CANNON;
    if (!diceMesh || !CANNON) return null;

    var mesh = diceMesh.clone();
    scene.add(mesh);

    var body = new CANNON.Body({
      mass: 1,
      sleepTimeLimit: 0.3,
      linearDamping: 0.1,
      angularDamping: 0.1,
    });
    body.addShape(new CANNON.Box(new CANNON.Vec3(0.5, 0.5, 0.5)));
    physicsWorld.addBody(body);

    return { mesh: mesh, body: body, result: 0 };
  }

  function addDiceEvents(dice) {
    var CANNON = window.CANNON;
    if (!CANNON) return;

    dice.body.addEventListener('sleep', function (e) {
      dice.body.allowSleep = false;

      var euler = new CANNON.Vec3();
      e.target.quaternion.toEuler(euler);

      var eps = 0.15;
      var isZero = function (angle) { return Math.abs(angle) < eps; };
      var isHalfPi = function (angle) { return Math.abs(angle - 0.5 * Math.PI) < eps; };
      var isMinusHalfPi = function (angle) { return Math.abs(0.5 * Math.PI + angle) < eps; };
      var isPiOrMinusPi = function (angle) { return Math.abs(Math.PI - angle) < eps || Math.abs(Math.PI + angle) < eps; };

      var result = 0;
      if (isZero(euler.z)) {
        if (isZero(euler.x)) result = 1;
        else if (isHalfPi(euler.x)) result = 4;
        else if (isMinusHalfPi(euler.x)) result = 3;
        else if (isPiOrMinusPi(euler.x)) result = 6;
      } else if (isHalfPi(euler.z)) {
        result = 2;
      } else if (isMinusHalfPi(euler.z)) {
        result = 5;
      }

      if (result > 0) {
        dice.result = result;
        settledCount++;
        if (settledCount >= totalDice && onDiceSettled) {
          var results = diceArray.map(function (d) { return d.result; });
          onDiceSettled(results);
        }
      } else {
        dice.body.allowSleep = true;
      }
    });
  }

  function throwDice(numDice, callback) {
    if (!isInitialized) {
      if (callback) callback(generateRandomResults(numDice));
      return;
    }

    clearDice();
    params.numberOfDice = numDice;
    totalDice = numDice;
    settledCount = 0;
    onDiceSettled = callback;

    for (var i = 0; i < numDice; i++) {
      var dice = createDice();
      if (dice) {
        addDiceEvents(dice);
        diceArray.push(dice);

        var startX = (Math.random() - 0.5) * 4;
        var startZ = (Math.random() - 0.5) * 4;

        dice.body.velocity.setZero();
        dice.body.angularVelocity.setZero();
        dice.body.position.set(startX, 8 + i * 2, startZ);
        dice.mesh.position.copy(dice.body.position);

        var rotX = Math.random() * Math.PI * 2;
        var rotY = Math.random() * Math.PI * 2;
        var rotZ = Math.random() * Math.PI * 2;
        dice.mesh.rotation.set(rotX, rotY, rotZ);
        dice.body.quaternion.copy(dice.mesh.quaternion);

        var throwForceX = (Math.random() - 0.5) * 8;
        var throwForceZ = (Math.random() - 0.5) * 8;
        dice.body.velocity.set(throwForceX, -2, throwForceZ);

        var spinX = (Math.random() - 0.5) * 20;
        var spinY = (Math.random() - 0.5) * 20;
        var spinZ = (Math.random() - 0.5) * 20;
        dice.body.angularVelocity.set(spinX, spinY, spinZ);

        dice.body.allowSleep = true;
      }
    }
  }

  function clearDice() {
    diceArray.forEach(function (d) {
      if (d.mesh) scene.remove(d.mesh);
      if (d.body) physicsWorld.removeBody(d.body);
    });
    diceArray = [];
    settledCount = 0;
    totalDice = 0;
  }

  function generateRandomResults(numDice) {
    var results = [];
    for (var i = 0; i < numDice; i++) {
      results.push(Math.floor(Math.random() * 6) + 1);
    }
    return results;
  }

  function render() {
    if (!renderer) return;
    if (physicsWorld) physicsWorld.step(1 / 60);

    for (var i = 0; i < diceArray.length; i++) {
      diceArray[i].mesh.position.copy(diceArray[i].body.position);
      diceArray[i].mesh.quaternion.copy(diceArray[i].body.quaternion);
    }

    renderer.render(scene, camera);
    animationId = requestAnimationFrame(render);
  }

  function updateSceneSize() {
    if (!camera || !renderer || !canvasEl) return;
    var w = canvasEl.clientWidth;
    var h = canvasEl.clientHeight;
    if (w === 0 || h === 0) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }

  function destroy() {
    clearDice();
    if (animationId) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
    if (renderer) {
      renderer.dispose();
      renderer = null;
    }
    isInitialized = false;
  }

  return {
    init: init,
    throwDice: throwDice,
    clearDice: clearDice,
    generateRandomResults: generateRandomResults,
    updateSceneSize: updateSceneSize,
    destroy: destroy,
  };
})();
