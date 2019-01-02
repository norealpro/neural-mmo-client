//var worldWidth = 256, worldDepth = 256,
//worldHalfWidth = worldWidth / 2, worldHalfDepth = worldDepth / 2;

function terrain(map) {
   var data = generateHeight( worldWidth, worldDepth );

   var geometry = new THREE.PlaneBufferGeometry( 6400, 6400, worldWidth - 1, worldDepth - 1 );
   geometry.rotateX( - Math.PI / 2 );

   var vertices = geometry.attributes.position.array;

   for ( var i = 0, j = 0, l = vertices.length; i < l; i ++, j += 3 ) {
      vertices[ j + 1 ] = data[ i ] * 64;
   }

   texture = new THREE.CanvasTexture( generateTexture( data, worldWidth, worldDepth ) );
   texture.wrapS = THREE.ClampToEdgeWrapping;
   texture.wrapT = THREE.ClampToEdgeWrapping;

   mesh = new THREE.Mesh( geometry, new THREE.MeshBasicMaterial( { map: texture } ) );
   return mesh
}

function tile(x, y) {
   var ymod = y % 4;
   var xmod = x % 4;

   if (ymod == 2 || ymod == 3){
      return 0;
   }
   if (xmod == 2 || xmod == 3){
      return 0;
   }
   return 1;
}

function generateHeight( width, height ) {
   var size = width * height;
   var data = new Uint8Array( size );
   for ( var i = 0; i < size; i ++ ) {
      var x = i % width;
      var y = ~ ~ ( i / width );
      data[ i ] = 1*tile(x, y);
   }
   return data;
}

function generateTexture( data, width, height ) {

   var canvas, canvasScaled, context, image, imageData, vector3, sun, shade;

   vector3 = new THREE.Vector3( 0, 0, 0 );

   sun = new THREE.Vector3( 1, 1, 1 );
   sun.normalize();

   canvas = document.createElement( 'canvas' );
   canvas.width = width;
   canvas.height = height;

   context = canvas.getContext( '2d' );
   context.fillStyle = '#000';
   context.fillRect( 0, 0, width, height );

   image = context.getImageData( 0, 0, canvas.width, canvas.height );
   imageData = image.data;

   for ( var i = 0, j = 0, l = imageData.length; i < l; i += 4, j ++ ) {

      vector3.x = data[ j - 2 ] - data[ j + 2 ];
      vector3.y = 2;
      vector3.z = data[ j - width * 2 ] - data[ j + width * 2 ];
      vector3.normalize();

      shade = vector3.dot( sun );

      imageData[ i ] = ( 96 + shade * 128 ) * ( 0.5 + data[ j ] * 0.007 );
      imageData[ i + 1 ] = ( 32 + shade * 96 ) * ( 0.5 + data[ j ] * 0.007 );
      imageData[ i + 2 ] = ( shade * 96 ) * ( 0.5 + data[ j ] * 0.007 );

   }

   context.putImageData( image, 0, 0 );

   // Scaled 4x

   canvasScaled = document.createElement( 'canvas' );
   canvasScaled.width = width * 4;
   canvasScaled.height = height * 4;

   context = canvasScaled.getContext( '2d' );
   context.scale( 4, 4 );
   context.drawImage( canvas, 0, 0 );

   image = context.getImageData( 0, 0, canvasScaled.width, canvasScaled.height );
   imageData = image.data;

   for ( var i = 0, l = imageData.length; i < l; i += 4 ) {

      var v = ~ ~ ( Math.random() * 5 );

      imageData[ i ] += v;
      imageData[ i + 1 ] += v;
      imageData[ i + 2 ] += v;

   }

   context.putImageData( image, 0, 0 );

   return canvasScaled;

}

/*
function animate() {

   requestAnimationFrame( animate );

   render();
   stats.update();

}

function render() {

   controls.update( clock.getDelta() );
   renderer.render( scene, camera );

}
*/