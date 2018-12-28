if ( WEBGL.isWebGLAvailable() === false ) {

   document.body.appendChild( WEBGL.getWebGLErrorMessage() );
   document.getElementById( 'container' ).innerHTML = "";

}

var container, stats;
var player, engine, handler;


class Engine {

   constructor() {
      this.scene = new THREE.Scene();
      this.scene.background = new THREE.Color( 0x006666 );

      // initialize map
      var map = new Terrain( false ); // flat = False
      this.mesh = map.getMapMesh();
      this.scene.add( this.mesh );

      this.camera = new THREE.PerspectiveCamera(
              60, window.innerWidth / window.innerHeight, 1, 20000 );
      this.camera.position.y = map.getY(
            worldHalfWidth, worldHalfDepth ) * 100 + 100;
      this.camera.position.z = 5;

      this.renderer = new THREE.WebGLRenderer( { antialias: true } );
      this.renderer.setPixelRatio( window.devicePixelRatio );
      this.renderer.setSize( window.innerWidth, window.innerHeight );

      this.initializeControls();

      this.mouse = new THREE.Vector2();
      this.raycaster = new THREE.Raycaster();
      this.clock = new THREE.Clock();

      // initialize lights
      var ambientLight = new THREE.AmbientLight( 0xcccccc );
      this.scene.add( ambientLight );

      var directionalLight = new THREE.DirectionalLight( 0xffffff, 2 );
      directionalLight.position.set( 1, 1, 0.5 ).normalize();
      this.scene.add( directionalLight );

      document.body.appendChild( this.renderer.domElement );
   }

   initializeControls() {
      var controls = new THREE.OrbitControls(this.camera, container);
      controls.mouseButtons = {
         LEFT: THREE.MOUSE.MIDDLE, // rotate
         RIGHT: THREE.MOUSE.LEFT // pan
      }

      controls.target.set( 0, 0, 0 );
      controls.enablePan = false;
      controls.minPolarAngle = 0.0001;
      controls.maxPolarAngle = Math.PI / 2.0 - 0.1;
      controls.movementSpeed = 1000;
      controls.lookSpeed = 0.125;
      controls.lookVertical = true;
      this.controls = controls;
   }

   onWindowResize() {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize( window.innerWidth, window.innerHeight );
   }

   render() {
      /*
       * TODO: sometimes the camera rotates itself?
       */
      var delta = this.clock.getDelta();
      //this.translate(delta)
      this.controls.update( delta );
      this.renderer.render( this.scene, this.camera );
   }

   translate( delta ) {
      handler.translate(delta);
   }

   onMouseDown( event ) {
      /*
       * Sets the translation direction based on the clicked square and toggles
       * state to translate.
       */

      this.mouse.x = (
            event.clientX / this.renderer.domElement.clientWidth ) * 2 - 1;
      this.mouse.y = - (
            event.clientY / this.renderer.domElement.clientHeight ) * 2 + 1;
      this.raycaster.setFromCamera( this.mouse, this.camera );

      // See if the ray from the camera into the world hits one of our meshes
      var intersects = this.raycaster.intersectObject( this.mesh );

      // Toggle rotation bool for meshes that we clicked
      if ( intersects.length > 0 ) {
         var x = intersects[ 0 ].point.x;
         var z = intersects[ 0 ].point.z;

         x = Math.min(Math.max(0, Math.floor(x/sz)), worldWidth);
         z = Math.min(Math.max(0, Math.floor(z/sz)), worldDepth);

         player.translateState = true;
         player.moveTarg = [x, z];
         player.sendMove();
      }
   }
}



class PlayerHandler {
   /*
    * The PlayerHandler receives packets from the server containing player
    * information (other players' movements, interactions with our player)
    * and disperses the signals appropriately.
    */

   constructor() {
      this.players = [];
      this.numPlayers = 0;
   }

   addPlayer( player ) {
      this.players.push(player);
      this.numPlayers += 1;
   }

   removePlayer( playerIndex ) {
      this.players.splice(playerIndex, 1);
      this.numPlayers -= 1;
   }

   update(packet) {
      //Orig
      var id = 0;
      var move = packet[id]['pos'];
      console.log(move)
      this.players[id].moveTo(move);

      for (var i = 1; i < this.numPlayers; i++) {
         this.players[i].moveTo([Math.random() * worldWidth,
               Math.random() * worldDepth]);
      }
   }

   translate( delta ) {
      for (var i = 0; i < this.numPlayers; i++) {
         this.players[i].translate( delta );
      }
   }
}


class Player extends THREE.Mesh {

   constructor( geometry, material, index )  {
      super(geometry, material);
      this.translateState = false;
      this.translateDir = new THREE.Vector3(0.0, 0.0, 0.0);
      this.moveTarg = [0, 0];
      this.pos = [0, 0];

      this.target = this.position.clone();
      this.index = index;
   }

   moveTo( pos ) {

      /*
       * Initialize a translation for the player, send current pos to server
       */
      var x = pos[0];
      var z = pos[1];

      //Instant move hack
      this.position.copy(new THREE.Vector3(x*sz, sz+0.1, z*sz));

      //console.log("Received move to ", x, z);
      this.target = new THREE.Vector3(x*sz, sz+0.1, z*sz);
      this.translateState = true;
      this.translateDir = this.target.clone();
      this.translateDir.sub(this.position);

      // Signal for begin translation
      if (this.index == 0) {
         this.sendMove();
      }
   }

   sendMove() {
      var packet = JSON.stringify({
         "pos" : this.moveTarg
      });
      ws.send(packet);
   }

   translate(delta) {
      if (this.translateState) {
         var movement = this.translateDir.clone();
         movement.multiplyScalar(delta / tick);
         this.position.add(movement);

         var eps = 0.0000001;
         if (this.position.distanceToSquared(this.target) <= eps) {
            // Finish animating, reset
            this.translateState = false;
            this.position.copy(this.target);
            this.translateDir.set(0.0, 0.0, 0.0);
         }
      }
   }
}


class TargetPlayer extends Player {

   translate(delta) {
      /*
       * Translate, but also move the camera at the same time.
       */
      if (this.translateState) {
         var movement = this.translateDir.clone();
         movement.multiplyScalar(delta / tick);

         // Move player, then camera
         this.position.add(movement);
         engine.camera.position.add(movement);

         // Turn the target into the new position of the player
         engine.controls.target.copy(this.position);

         var eps = 0.0000001;
         if (this.position.distanceToSquared(this.target) <= eps) {
            // Finish animating, reset
            this.translateState = false;
            this.position.copy(this.target);
            engine.controls.target.copy(this.position);
            this.translateDir.set(0.0, 0.0, 0.0);
         }
      }
   }
}


function init() {
   container = document.getElementById( 'container' );
   engine = new Engine();
   handler = new PlayerHandler();
   initializePlayers();

   // hook up signals
   container.innerHTML = "";
   container.appendChild( engine.renderer.domElement );

   function onMouseDown( event ) { engine.onMouseDown( event ); }
   function onWindowResize() { engine.onWindowResize(); }

   stats = new Stats();
   container.appendChild( stats.dom );
   container.addEventListener( 'click', onMouseDown, false );
   window.addEventListener( 'resize', onWindowResize, false );
}


function initializePlayers() {
   // initialize player
   var geometry = new THREE.CubeGeometry(sz, sz, sz);
   var material = new THREE.MeshBasicMaterial( {color: 0xff0000} );
   player = new TargetPlayer(geometry, material, 0);
   engine.scene.add(player);
   handler.addPlayer(player);

   const maxPlayers = 10;
   for (var i = 1; i < maxPlayers; i++) {
      var geometry = new THREE.CubeGeometry(sz, sz, sz);
      var material = new THREE.MeshBasicMaterial( {color: 0x00ffff} );
      var newPlayer = new Player(geometry, material, i);
      engine.scene.add(newPlayer);
      handler.addPlayer(newPlayer);
   }
}


function animate() {
   requestAnimationFrame( animate );
   while (inbox.length > 0) {
      // Receive packet, begin translating based on the received position
      var packet = inbox.shift();
      console.log(packet);
      packet = JSON.parse(packet);
      handler.update(packet)
   }
   engine.render();
   stats.update();
}


// Main
init();
animate();
