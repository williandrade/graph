/**
* @fileOverview Defines a naive form of links for webglGraphics class.
* This form allows to change color of links.
**/

var glUtils = require('./webgl.js');
var Bezier = require('../Utils/bezier.js');

module.exports = webglLinkProgram;

/**
* Defines UI for links in webgl renderer.
*/
function webglLinkProgram() {
  var ATTRIBUTES_PER_PRIMITIVE = 6, // primitive is Line with two points. Each has x,y and color = 3 * 2 attributes.
  BYTES_PER_LINK = 2 * (2 * Float32Array.BYTES_PER_ELEMENT + Uint32Array.BYTES_PER_ELEMENT), // two nodes * (x, y + color)
  linksFS = [
    'precision mediump float;',
    'varying vec4 color;',
    'void main(void) {',
    '   gl_FragColor = color;',
    '}'
  ].join('\n'),

  linksVS = [
    'attribute vec2 a_vertexPos;',
    'attribute vec4 a_color;',

    'uniform vec2 u_screenSize;',
    'uniform mat4 u_transform;',

    'varying vec4 color;',

    'void main(void) {',
    '   gl_Position = u_transform * vec4(a_vertexPos/u_screenSize, 0.0, 1.0);',
    '   color = a_color.abgr;',
    '}'
  ].join('\n'),

  program,
  gl,
  buffer,
  utils,
  locations,
  linksCount = 0,
  frontLinkId, // used to track z-index of links.
  storage = new ArrayBuffer(16 * BYTES_PER_LINK),
  positions = new Float32Array(storage),
  colors = new Uint32Array(storage),
  allLinksProgram = [],
  width,
  height,
  transform,
  sizeDirty,

  ensureEnoughStorage = function () {
    // TODO: this is a duplicate of webglNodeProgram code. Extract it to webgl.js
    if ((linksCount+1)*BYTES_PER_LINK > storage.byteLength) {
      // Every time we run out of space create new array twice bigger.
      // TODO: it seems buffer size is limited. Consider using multiple arrays for huge graphs
      var extendedStorage = new ArrayBuffer(storage.byteLength * 2),
      extendedPositions = new Float32Array(extendedStorage),
      extendedColors = new Uint32Array(extendedStorage);

      extendedColors.set(colors); // should be enough to copy just one view.
      positions = extendedPositions;
      colors = extendedColors;
      storage = extendedStorage;
    }
  };

  return {
    load : function (glContext) {
      gl = glContext;
      utils = Viva.Graph.webgl(glContext);

      program = utils.createProgram(linksVS, linksFS);
      gl.useProgram(program);
      locations = utils.getLocations(program, ['a_vertexPos', 'a_color', 'u_screenSize', 'u_transform']);

      gl.enableVertexAttribArray(locations.vertexPos);
      gl.enableVertexAttribArray(locations.color);

      buffer = gl.createBuffer();
    },

    position: function (linkUi, fromPos, toPos) {
      var linkIdx = linkUi.id,
      offset = linkIdx * ATTRIBUTES_PER_PRIMITIVE;
      positions[offset] = fromPos.x;
      positions[offset + 1] = fromPos.y;
      colors[offset + 2] = linkUi.color;

      positions[offset + 3] = toPos.x;
      positions[offset + 4] = toPos.y;
      colors[offset + 5] = linkUi.color;
    },

    createLink : function (ui) {
      ensureEnoughStorage();

      linksCount += 1;
      allLinksProgram[ui.id] = ui;
      frontLinkId = ui.id;
    },

    removeLink : function (ui) {
      if (linksCount > 0) { linksCount -= 1; }
      // swap removed link with the last link. This will give us O(1) performance for links removal:
      if (ui.id < linksCount && linksCount > 0) {
        // using colors as a view to array buffer is okay here.
        utils.copyArrayPart(colors, ui.id * ATTRIBUTES_PER_PRIMITIVE, linksCount * ATTRIBUTES_PER_PRIMITIVE, ATTRIBUTES_PER_PRIMITIVE);
      }
    },

    updateTransform : function (newTransform) {
      sizeDirty = true;
      transform = newTransform;
    },

    updateSize : function (w, h) {
      width = w;
      height = h;
      sizeDirty = true;
    },

    render : function () {
      gl.useProgram(program);

      function arc(positions){
        var exist = [];


        for (var j = 0; j < positions.length; j++){
          if (positions[j] != positions[j+3] || positions[j+1] != positions[j+4]){

            points = [];
            pointsMid = [];
            var dx = positions[j] - positions[j+3],
            dy = positions[j+1] - positions[j+4],
            cx = (positions[j]+positions[j+3])/2,
            cy = (positions[j+1]+positions[j+4])/2;



            var identifier = cx*cy;

            var variante = 1;

            if(exist[identifier] == undefined){
              exist[identifier] = variante;
            } else {
              var counter = exist[identifier];
              variante = counter + 1;
              exist[identifier] = variante;
            }

            n = 1;

            if(variante > 1){
              n = 2;
            }



            a = Math.atan2(dy, dx) * (180 / Math.PI),
            r = Math.sqrt(dx * dx + dy * dy)/2,
            angle = a * Math.PI / 180,
            dA = Math.PI / n;

            var factor = variante/5;

            var beginX = cx + r * Math.cos(angle + 0 * dA);
            var beginY = cy + r * Math.sin(angle + 0 * dA);
            var middleX = (cx*factor) + r * Math.cos(angle + ((n/2) * dA));
            var middleY = (cy*factor) + r * Math.sin(angle + ((n/2) * dA));
            var endX = cx + r * Math.cos(angle + n * dA);
            var endY = cy + r * Math.sin(angle + n * dA);

            var curve = new Bezier(beginX, beginY , middleX, middleY , endX, endY);
            var calculated = curve.getLUT(20);


            for(var i = 0; i < calculated.length; i++){

              var x = calculated[i].x;
              var y = calculated[i].y;

              points.push(x, y, 0.2);

            }

            gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(points), gl.DYNAMIC_DRAW);

            if (sizeDirty) {
              sizeDirty = false;
              gl.uniformMatrix4fv(locations.transform, false, transform);
              gl.uniform2f(locations.screenSize, width, height);
            }

            gl.vertexAttribPointer(locations.vertexPos, 2, gl.FLOAT, false, 3 * Float32Array.BYTES_PER_ELEMENT, 0);
            gl.vertexAttribPointer(locations.color, 4, gl.UNSIGNED_BYTE, true, 3 * Float32Array.BYTES_PER_ELEMENT, 2 * 4);
            // param : mode , 0, numItems
            gl.drawArrays(gl.LINE_STRIP, 0, points.length/3)
          }

          j += 5;
        }
      }

      d = 0; j = 0;
      var ap = arc(positions);
    },

    bringToFront : function (link) {
      if (frontLinkId > link.id) {
        utils.swapArrayPart(positions, link.id * ATTRIBUTES_PER_PRIMITIVE, frontLinkId * ATTRIBUTES_PER_PRIMITIVE, ATTRIBUTES_PER_PRIMITIVE);
      }
      if (frontLinkId > 0) {
        frontLinkId -= 1;
      }
    },

    getFrontLinkId : function () {
      return frontLinkId;
    }
  };
}
