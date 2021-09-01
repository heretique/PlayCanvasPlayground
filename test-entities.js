import './playcanvas-stable.js';

// Create a PlayCanvas application
var canvas = document.getElementById("application-canvas");
var app = new pc.Application(canvas, {});
app.start();

// Fill the available space at full resolution
app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
app.setCanvasResolution(pc.RESOLUTION_AUTO);


var CubeSpawner = pc.createScript('cubeSpawner');
CubeSpawner.attributes.add('spawnArea', {
    type: 'number',
    default: 10
});

CubeSpawner.attributes.add('lifetime',{
    type: 'number',
    default: 5
});

CubeSpawner.prototype.initialize = function() {
    this.cubes = [];
};

CubeSpawner.prototype.update = function(dt) {
    while (this.cubes.length < 100) {
        this.spawnCube();
    }

    for (var i = 0; i < this.cubes.length; i++) {
        this.cubes[i].timer -= dt;
        if (this.cubes[i].timer < 0) {

            this.cubes[i].entity.destroy();
            this.cubes.splice(i, 1);
        }
    }
};

CubeSpawner.prototype.spawnCube = function() {
    var entity = new pc.Entity();

    entity.addComponent("model", {
        type: 'box'
    });

    // set material
    // entity.model.material = this.material.resource;


    entity.setLocalPosition(
        pc.math.random(-this.spawnArea, this.spawnArea),
        pc.math.random(-this.spawnArea, this.spawnArea),
        pc.math.random(-this.spawnArea, this.spawnArea)
    );


    this.app.root.addChild(entity);

    this.cubes.push({
        entity: entity,
        timer: pc.math.random(0, this.lifetime)
    });
}

var camera = new pc.Entity();
camera.addComponent('camera', {
    clearColor: new pc.Color(0.1, 0.2, 0.3)
});

var cubeSpawner = new pc.Entity();
cubeSpawner.addComponent('script');
cubeSpawner.script.create('cubeSpawner');

camera.addComponent('script');
camera.script.create('cubeSpawner');

// Create directional light entity
var light = new pc.Entity();
light.addComponent('light');

// // Add to hierarchy
app.root.addChild(cubeSpawner);
app.root.addChild(camera);
app.root.addChild(light);

// Set up initial positions and orientations
camera.setPosition(0, 0, 20);
light.setEulerAngles(45, 0, 0);

// Create a rotation script
var Orbit = pc.createScript('orbit');

Orbit.prototype.initialize = function() {
    this.target = new pc.Vec3(0, 0, 0);
}

Orbit.prototype.update = function (dt) {
    var distance = this.entity.getPosition().distance(this.target);
    var translate = new pc.Vec3(0, 0, 0);
    translate.copy(this.entity.forward);
    translate.mulScalar(distance);
    this.entity.translate(translate);
    this.entity.rotate(0, 20 * dt, 0);
    translate.copy(this.entity.forward);
    translate.mulScalar(distance);
    this.entity.translate(new pc.Vec3(-translate.x, -translate.y, -translate.z));
};

camera.addComponent('script');
camera.script.create('orbit');

// Resize the canvas when the window is resized
window.addEventListener('resize', function () {
    app.resizeCanvas(canvas.width, canvas.height);
});