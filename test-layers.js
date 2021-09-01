import './playcanvas-stable.js';

function createPlane(numVertX, numVertY, vertSpacing, app) {

    // Generate positions and uv coordinates for vertices, store them in Float32Arrays
    const positions = new Float32Array(3 * numVertX * numVertY);
    const uvs =  new Float32Array(2 * numVertX * numVertY);
    let index = 0;
    for (let x = 0; x < numVertX; x++) {
        for (let z = 0; z < numVertY; z++) {
            positions[3 * index] = vertSpacing * (x - numVertX * 0.5);
            positions[3 * index + 1] = 0;  // no elevation, flat grid
            positions[3 * index + 2] = vertSpacing * (z - numVertY * 0.5);
            uvs[2 * index] = x / numVertX;
            uvs[2 * index + 1] = 1 - z / numVertY;
            index++;
        }
    }

        // Generate array of indices to form triangle list - two triangles per grid square
        const indexArray = [];
        for (let x = 0; x < numVertX - 1; x++) {
            for (let y = 0; y < numVertY - 1; y++) {
                indexArray.push(x * numVertY + y + 1, (x + 1) * numVertY + y, x * numVertY + y,
                                (x + 1) * numVertY + y, x * numVertY + y + 1, (x + 1) * numVertY + y + 1);
            }
        }

        const mesh = new pc.Mesh(app.graphicsDevice);
        mesh.clear(true, false);
        mesh.setPositions(positions);
        mesh.setNormals(pc.calculateNormals(positions, indexArray));
        mesh.setUvs(0, uvs);
        mesh.setIndices(indexArray);
        mesh.update(pc.PRIMITIVE_TRIANGLES);
        return mesh;
}


// Create a PlayCanvas application
const canvas = document.getElementById("application-canvas");
const app = new pc.Application(canvas, {});
app.mouse = new pc.Mouse(canvas);
app.start();

// Fill the available space at full resolution
app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
app.setCanvasResolution(pc.RESOLUTION_AUTO);


const cellNoiseTexture = new pc.Texture(app.graphicsDevice, {
    width: 512,
    height: 512,
    format: pc.PIXELFORMAT_RGBA32F,
    mipmaps: false,
    minFilter: pc.FILTER_LINEAR,
    magFilter: pc.FILTER_LINEAR,
    addressU: pc.ADDRESS_CLAMP_TO_EDGE,
    addressV: pc.ADDRESS_CLAMP_TO_EDGE
});

const renderTarget = new pc.RenderTarget({
    colorBuffer: cellNoiseTexture,
    depth: false
});

const cellNoiseVertShader = `
attribute vec2 vertex_position;

void main()
{
    gl_Position = vec4(vertex_position, 0, 1.0);
}
`

const cellNoiseFragShader = `
precision highp float;

uniform vec2 u_resolution;
uniform float u_scale;
uniform float u_uTilling;
uniform float u_vTilling;
uniform float u_time;

vec2 random2( vec2 p ) {
    return fract(sin(vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3))))*43758.5453);
}

void main() {
    vec2 st = gl_FragCoord.xy/u_resolution.xy;
    st.x *= u_resolution.x/u_resolution.y;
    vec3 color = vec3(.0);

    // Scale
    st *= 3.;

    // Tile the space
    vec2 i_st = floor(st);
    vec2 f_st = fract(st);

    float m_dist = 1.;  // minimun distance

    for (int y= -1; y <= 1; y++) {
        for (int x= -1; x <= 1; x++) {
            // Neighbor place in the grid
            vec2 neighbor = vec2(float(x),float(y));

            // Random position from current + neighbor place in the grid
            vec2 point = random2(i_st + neighbor);

                        // Animate the point
            point = 0.5 + 0.5*sin(u_time + 6.2831*point);

                        // Vector between the pixel and the point
            vec2 diff = neighbor + point - f_st;

            // Distance to the point
            float dist = length(diff);

            // Keep the closer distance
            m_dist = min(m_dist, dist);
        }
    }

    // Draw the min distance (distance field)
    color += m_dist;
    gl_FragColor = vec4(color,1.0);
}
`

const cellNoiseShader = new pc.Shader(app.graphicsDevice, {
    attributes: {
        vertex_position: pc.SEMANTIC_POSITION
    },
    vshader: cellNoiseVertShader,
    fshader: cellNoiseFragShader
});

const noiseDisplacementVertShader = `
attribute vec3 aPosition;
attribute vec3 aNormal;
attribute vec2 aUv;

varying vec3 vWorldPosition;
varying vec2 vUv;

uniform sampler2D uDisplacementTexture;
uniform mat4 matrix_model;
uniform mat4 matrix_viewProjection;

void main()
{
    float n = texture2D(uDisplacementTexture, aUv).r;
    vWorldPosition = vec3(matrix_model * vec4(aPosition, 1.0));
    vWorldPosition = vWorldPosition + n * aNormal;
    vUv = aUv;
    // Calculate vertex position in clip coordinates
    gl_Position = matrix_viewProjection * matrix_model * vec4(vWorldPosition, 1.0);
}
`
const noiseDisplacementFragShader = `
precision highp float;

varying vec3 vWorldPosition;
varying vec2 vUv;

uniform sampler2D uDisplacementTexture;

void main()
{
    gl_FragColor = vec4(texture2D(uDisplacementTexture,vUv).rgb, 1.0);
}
`

const noiseDisplacementShader = new pc.Shader(app.graphicsDevice, {
    attributes: {
        aPosition: pc.SEMANTIC_POSITION,
        aNormal: pc.SEMANTIC_NORMAL,
        aUv: pc.SEMANTIC_TEXCOORD0
    },
    vshader: noiseDisplacementVertShader,
    fshader: noiseDisplacementFragShader
});

const noiseMaterial = new pc.Material();
noiseMaterial.setShader(noiseDisplacementShader);
noiseMaterial.setParameter('uDisplacementTexture', cellNoiseTexture);
noiseMaterial.cull = pc.CULLFACE_NONE;
noiseMaterial.update();

const plane = createPlane(100, 100, 0.1, app);
const planeInstance = new pc.MeshInstance(plane, noiseMaterial);

const planeEntity = new pc.Entity();
planeEntity.addComponent('render', {
    meshInstances: [planeInstance]
});

// Create camera entity
var camera = new pc.Entity();
camera.addComponent('camera', {
    clearColor: new pc.Color(0.1, 0.2, 0.3)
});



camera.addComponent('script');
app.loader.load("./orbit-camera.js", "script", function(err, ScriptObject) {
    camera.script.create('orbitCamera', {
        attributes: {
            distanceMax: 100,
            distanceMin: 20,
            focusEntity: planeEntity
        }
    });
    app.loader.load("./mouse-input.js", "script", function(err, ScriptObject) { camera.script.create('mouseInput'); });
});


// Create directional light entity
var light = new pc.Entity();
light.addComponent('light');

// Add to hierarchy
app.root.addChild(planeEntity);
app.root.addChild(camera);
app.root.addChild(light);

// Set up initial positions and orientations
camera.setPosition(10, 10, 0);
camera.lookAt(planeEntity.getPosition());
light.setEulerAngles(45, 0, 0);

// Create a rotation script
var Rotate = pc.createScript('rotate');
Rotate.prototype.update = function (dt) {
    this.entity.rotate(0, 0, 0);
};

var Noise = pc.createScript('noise');
Noise.prototype.initialize = function () {
    this.time = 0;
}
Noise.prototype.update = function (dt) {
    const scope = app.graphicsDevice.scope
    this.time += dt;

    scope.resolve('u_resolution').setValue([cellNoiseTexture.width, cellNoiseTexture.height]);
    scope.resolve('u_scale').setValue(1.0);
    scope.resolve('u_uTilling').setValue(1.0);
    scope.resolve('u_vTilling').setValue(1.0);
    scope.resolve('u_time').setValue(this.time);

    pc.drawQuadWithShader(app.graphicsDevice, renderTarget, cellNoiseShader);
}

// Add rotation script to cube
planeEntity.addComponent('script');
planeEntity.script.create('rotate');
planeEntity.script.create('noise');

// Resize the canvas when the window is resized
window.addEventListener('resize', function () {
    app.resizeCanvas(canvas.width, canvas.height);
});