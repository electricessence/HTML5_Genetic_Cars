// Global Vars
import b2Vec2 = Box2D.Common.Math.b2Vec2;
import b2RevoluteJointDef = Box2D.Dynamics.Joints.b2RevoluteJointDef;
let ghost;

const timeStep = 1.0/60.0;

let doDraw = true;
let cw_paused = false;

const box2dfps = 60;
const screenfps = 60;

const debugbox = document.getElementById("debug");

const canvas = <HTMLCanvasElement>document.getElementById("mainbox");
const ctx = canvas.getContext("2d");

const cameraspeed = 0.05;
let camera_y = 0;
let camera_x = 0;
let camera_target = -1; // which car should we follow? -1 = leader
const minimapcamera = document.getElementById("minimapcamera").style;

const graphcanvas = <HTMLCanvasElement>document.getElementById("graphcanvas");
const graphctx = graphcanvas.getContext("2d");
const graphheight = 250;
const graphwidth = 400;

const minimapcanvas = <HTMLCanvasElement>document.getElementById("minimap");
const minimapctx = minimapcanvas.getContext("2d");
const minimapscale = 3;
let minimapfogdistance = 0;
const fogdistance = document.getElementById("minimapfog").style;

const generationSize = 20;
let cw_carArray = [];
let cw_carGeneration = [];
let cw_carScores = [];
let cw_topScores = [];
let cw_graphTop = [];
let cw_graphElite = [];
let cw_graphAverage = [];

let gen_champions = 1;
const gen_parentality = 0.2;
let gen_mutation = 0.05;
let mutation_range = 1;
let gen_counter = 0;
const nAttributes = 15;

let gravity = new b2Vec2(0.0, -9.81);
const doSleep = true;

let world;

let zoom = 70;

let mutable_floor = false;

const maxFloorTiles = 200;
const cw_floorTiles = [];
let last_drawn_tile = 0;

const groundPieceWidth = 1.5;
const groundPieceHeight = 0.15;

const chassisAxisRange = 1.1;
const chassisMinAxis = 0.1;
const chassisMinDensity = 30;
const chassisDensityRange = 300;

const wheelRadiusRange = 0.5;
const wheelMinRadius = 0.2;
const wheelDensityRange = 100;
const wheelMinDensity = 40;

const velocityIndex = 0;
const deathSpeed = 0.1;
const max_car_health = box2dfps*10;
const car_health = max_car_health;

let motorSpeed = 20;

let swapPoint1 = 0;
let swapPoint2 = 0;

let cw_ghostReplayInterval = null;

const distanceMeter = document.getElementById("distancemeter");
const heightMeter = document.getElementById("heightmeter");

let leaderPosition = {
  x:0, y:0
};

minimapcamera.width = 12 * minimapscale + "px";
minimapcamera.height = 6 * minimapscale + "px";

function debug(str, clear) {
  if (clear) {
    debugbox.innerHTML = "";
  }
  debugbox.innerHTML += str + "<br />";
}

function showDistance(distance, height) {
  distanceMeter.innerHTML = distance + " meters<br />";
  heightMeter.innerHTML = height + " meters";
  if (distance > minimapfogdistance) {
    fogdistance.width = 800 - Math.round(distance + 15) * minimapscale + "px";
    minimapfogdistance = distance;
  }
}

/* ========================================================================= */
/* === Car ================================================================= */
module cw {


  import b2Body = Box2D.Dynamics.b2Body;
  export class Car {

    chassis:b2Body = null;
    wheels:b2Body[] = [];

    constructor()
    {
      this.velocityIndex = 0;
      this.health = max_car_health;
      this.maxPosition = 0;
      this.maxPositiony = 0;
      this.minPositiony = 0;
      this.frames = 0;
      this.car_def = car_def;
      this.alive = true;
      this.is_elite = car_def.is_elite;
      this.healthBar = document.getElementById("health" + car_def.index).style;
      this.healthBarText = document.getElementById("health" + car_def.index).nextSibling.nextSibling;
      this.healthBarText.innerHTML = car_def.index;
      this.minimapmarker = document.getElementById("bar" + car_def.index);

      if (this.is_elite) {
        this.healthBar.backgroundColor = "#3F72AF";
        this.minimapmarker.style.borderLeft = "1px solid #3F72AF";
        this.minimapmarker.innerHTML = car_def.index;
      } else {
        this.healthBar.backgroundColor = "#F7C873";
        this.minimapmarker.style.borderLeft = "1px solid #F7C873";
        this.minimapmarker.innerHTML = car_def.index;
      }

      this.chassis = cw_createChassis(car_def.vertex_list, car_def.chassis_density);

      this.wheels = [];
      for (let i = 0; i < car_def.wheelCount; i++) {
        this.wheels[i] = cw_createWheel(car_def.wheel_radius[i], car_def.wheel_density[i]);
      }

      let carmass = this.chassis.GetMass();
      for (let i = 0; i < car_def.wheelCount; i++) {
        carmass += this.wheels[i].GetMass();
      }
      const torque = [];
      for (let i = 0; i < car_def.wheelCount; i++) {
        torque[i] = carmass * -gravity.y / car_def.wheel_radius[i];
      }

      const joint_def = new b2RevoluteJointDef();

      for (let i = 0; i < car_def.wheelCount; i++) {
        const randvertex = this.chassis.vertex_list[car_def.wheel_vertex[i]];
        joint_def.localAnchorA.Set(randvertex.x, randvertex.y);
        joint_def.localAnchorB.Set(0, 0);
        joint_def.maxMotorTorque = torque[i];
        joint_def.motorSpeed = -motorSpeed;
        joint_def.enableMotor = true;
        joint_def.bodyA = this.chassis;
        joint_def.bodyB = this.wheels[i];
        const joint = world.CreateJoint(joint_def);
      }

      this.replay = ghost_create_replay();
      ghost_add_replay_frame(this.replay, this);
    }
  }
}


const cw_Car = function()
{
  this.__constructor.apply(this, arguments);
};

cw_Car.prototype.__constructor = function (car_def) {
  this.velocityIndex = 0;
  this.health = max_car_health;
  this.maxPosition = 0;
  this.maxPositiony = 0;
  this.minPositiony = 0;
  this.frames = 0;
  this.car_def = car_def;
  this.alive = true;
  this.is_elite = car_def.is_elite;
  this.healthBar = document.getElementById("health" + car_def.index).style;
  this.healthBarText = document.getElementById("health" + car_def.index).nextSibling.nextSibling;
  this.healthBarText.innerHTML = car_def.index;
  this.minimapmarker = document.getElementById("bar" + car_def.index);

  if (this.is_elite) {
    this.healthBar.backgroundColor = "#3F72AF";
    this.minimapmarker.style.borderLeft = "1px solid #3F72AF";
    this.minimapmarker.innerHTML = car_def.index;
  } else {
    this.healthBar.backgroundColor = "#F7C873";
    this.minimapmarker.style.borderLeft = "1px solid #F7C873";
    this.minimapmarker.innerHTML = car_def.index;
  }

  this.chassis = cw_createChassis(car_def.vertex_list, car_def.chassis_density);

  this.wheels = [];
  for (let i = 0; i < car_def.wheelCount; i++) {
    this.wheels[i] = cw_createWheel(car_def.wheel_radius[i], car_def.wheel_density[i]);
  }

  let carmass = this.chassis.GetMass();
  for (let i = 0; i < car_def.wheelCount; i++) {
    carmass += this.wheels[i].GetMass();
  }
  const torque = [];
  for (let i = 0; i < car_def.wheelCount; i++) {
    torque[i] = carmass * -gravity.y / car_def.wheel_radius[i];
  }

  const joint_def = new b2RevoluteJointDef();

  for (let i = 0; i < car_def.wheelCount; i++) {
    const randvertex = this.chassis.vertex_list[car_def.wheel_vertex[i]];
    joint_def.localAnchorA.Set(randvertex.x, randvertex.y);
    joint_def.localAnchorB.Set(0, 0);
    joint_def.maxMotorTorque = torque[i];
    joint_def.motorSpeed = -motorSpeed;
    joint_def.enableMotor = true;
    joint_def.bodyA = this.chassis;
    joint_def.bodyB = this.wheels[i];
    const joint = world.CreateJoint(joint_def);
  }

  this.replay = ghost_create_replay();
  ghost_add_replay_frame(this.replay, this);
}

cw_Car.prototype.getPosition = function () {
  return this.chassis.GetPosition();
}

cw_Car.prototype.draw = function () {
  drawObject(this.chassis);

  for (let i = 0; i < this.wheels.length; i++) {
    drawObject(this.wheels[i]);
  }
}

cw_Car.prototype.kill = function () {
  const avgspeed = (this.maxPosition/this.frames)*box2dfps;
  const position = this.maxPosition;
  const score = position + avgspeed;
  ghost_compare_to_replay(this.replay, ghost, score);
  cw_carScores.push({
    car_def: this.car_def,
    v: score,
    s: avgspeed,
    x: position,
    y: this.maxPositiony,
    y2: this.minPositiony
  });
  world.DestroyBody(this.chassis);

  for (let i = 0; i < this.wheels.length; i++) {
    world.DestroyBody(this.wheels[i]);
  }
  this.alive = false;

  // refocus camera to leader on death
  if (camera_target == this.car_def.index) {
    cw_setCameraTarget(-1);
  }
}

cw_Car.prototype.checkDeath = function () {
  // check health
  const position = this.getPosition();
  // check if car reached end of the path
  if (position.x > world.finishLine) {
    this.healthBar.width = "0";
    return true;
  }
  if (position.y > this.maxPositiony) {
    this.maxPositiony = position.y;
  }
  if (position.y < this.minPositiony) {
    this.minPositiony = position.y;
  }
  if (position.x > this.maxPosition + 0.02) {
    this.health = max_car_health;
    this.maxPosition = position.x;
  } else {
    if (position.x > this.maxPosition) {
      this.maxPosition = position.x;
    }
    if (Math.abs(this.chassis.GetLinearVelocity().x) < 0.001) {
      this.health -= 5;
    }
    this.health--;
    if (this.health <= 0) {
      this.healthBarText.innerHTML = "&dagger;";
      this.healthBar.width = "0";
      return true;
    }
  }
}

function cw_createChassisPart(body, vertex1, vertex2, density) {
  const vertex_list = [];
  vertex_list.push(vertex1);
  vertex_list.push(vertex2);
  vertex_list.push(b2Vec2.Make(0, 0));
  const fix_def = new b2FixtureDef();
  fix_def.shape = new b2PolygonShape();
  fix_def.density = density;
  fix_def.friction = 10;
  fix_def.restitution = 0.2;
  fix_def.filter.groupIndex = -1;
  fix_def.shape.SetAsArray(vertex_list, 3);

  body.CreateFixture(fix_def);
}

function cw_createChassis(vertex_list, density) {
  const body_def = new b2BodyDef();
  body_def.type = b2Body.b2_dynamicBody;
  body_def.position.Set(0.0, 4.0);

  const body = world.CreateBody(body_def);

  cw_createChassisPart(body, vertex_list[0], vertex_list[1], density);
  cw_createChassisPart(body, vertex_list[1], vertex_list[2], density);
  cw_createChassisPart(body, vertex_list[2], vertex_list[3], density);
  cw_createChassisPart(body, vertex_list[3], vertex_list[4], density);
  cw_createChassisPart(body, vertex_list[4], vertex_list[5], density);
  cw_createChassisPart(body, vertex_list[5], vertex_list[6], density);
  cw_createChassisPart(body, vertex_list[6], vertex_list[7], density);
  cw_createChassisPart(body, vertex_list[7], vertex_list[0], density);

  body.vertex_list = vertex_list;

  return body;
}

function cw_createWheel(radius, density) {
  const body_def = new b2BodyDef();
  body_def.type = b2Body.b2_dynamicBody;
  body_def.position.Set(0, 0);

  const body = world.CreateBody(body_def);

  const fix_def = new b2FixtureDef();
  fix_def.shape = new b2CircleShape(radius);
  fix_def.density = density;
  fix_def.friction = 1;
  fix_def.restitution = 0.2;
  fix_def.filter.groupIndex = -1;

  body.CreateFixture(fix_def);
  return body;
}

function cw_createRandomCar() {
  const v = [];
  const car_def = {};

  car_def.wheelCount = 2;

  car_def.wheel_radius = [];
  car_def.wheel_density = [];
  car_def.wheel_vertex = [];
  for (var i = 0; i < car_def.wheelCount; i++) {
    car_def.wheel_radius[i] = Math.random() * wheelRadiusRange + wheelMinRadius;
    car_def.wheel_density[i] = Math.random() * wheelDensityRange + wheelMinDensity;
  }

  car_def.chassis_density = Math.random() * chassisDensityRange + chassisMinDensity

  car_def.vertex_list = [];
  car_def.vertex_list.push(new b2Vec2(Math.random() * chassisAxisRange + chassisMinAxis, 0));
  car_def.vertex_list.push(new b2Vec2(Math.random() * chassisAxisRange + chassisMinAxis, Math.random() * chassisAxisRange + chassisMinAxis));
  car_def.vertex_list.push(new b2Vec2(0, Math.random() * chassisAxisRange + chassisMinAxis));
  car_def.vertex_list.push(new b2Vec2(-Math.random() * chassisAxisRange - chassisMinAxis, Math.random() * chassisAxisRange + chassisMinAxis));
  car_def.vertex_list.push(new b2Vec2(-Math.random() * chassisAxisRange - chassisMinAxis, 0));
  car_def.vertex_list.push(new b2Vec2(-Math.random() * chassisAxisRange - chassisMinAxis, -Math.random() * chassisAxisRange - chassisMinAxis));
  car_def.vertex_list.push(new b2Vec2(0, -Math.random() * chassisAxisRange - chassisMinAxis));
  car_def.vertex_list.push(new b2Vec2(Math.random() * chassisAxisRange + chassisMinAxis, -Math.random() * chassisAxisRange - chassisMinAxis));

  const left = [];
  for (var i = 0; i < 8; i++) {
    left.push(i);
  }
  for (var i = 0; i < car_def.wheelCount; i++) {
    const indexOfNext = Math.floor(Math.random()*left.length);
    car_def.wheel_vertex[i] = left[indexOfNext];
    left.splice(indexOfNext, 1);
  }

  return car_def;
}

/* === END Car ============================================================= */
/* ========================================================================= */


/* ========================================================================= */
/* ==== Generation ========================================================= */

function cw_generationZero() {
  for (let k = 0; k < generationSize; k++) {
    const car_def = cw_createRandomCar();
    car_def.index = k;
    cw_carGeneration.push(car_def);
  }
  gen_counter = 0;
  cw_deadCars = 0;
  leaderPosition = {};
  leaderPosition.x = 0;
  leaderPosition.y = 0;
  cw_materializeGeneration();
  document.getElementById("generation").innerHTML = "0";
  document.getElementById("population").innerHTML = generationSize.toString();
  ghost = ghost_create_ghost();
}

function cw_materializeGeneration() {
  cw_carArray = [];
  for (let k = 0; k < generationSize; k++) {
    cw_carArray.push(new cw_Car(cw_carGeneration[k]));
  }
}

function cw_nextGeneration() {
  const newGeneration = [];
  let newborn;
  cw_getChampions();
  cw_topScores.push({
    i: gen_counter,
    v: cw_carScores[0].v,
    x: cw_carScores[0].x,
    y: cw_carScores[0].y,
    y2: cw_carScores[0].y2
  });
  plot_graphs();
  for (let k = 0; k < gen_champions; k++) {
    cw_carScores[k].car_def.is_elite = true;
    cw_carScores[k].car_def.index = k;
    newGeneration.push(cw_carScores[k].car_def);
  }
  for (let k = gen_champions; k < generationSize; k++) {
    const parent1 = cw_getParents();
    let parent2 = parent1;
    while (parent2 == parent1) {
      parent2 = cw_getParents();
    }
    newborn = cw_makeChild(cw_carScores[parent1].car_def,
      cw_carScores[parent2].car_def);
    newborn = cw_mutate(newborn);
    newborn.is_elite = false;
    newborn.index = k;
    newGeneration.push(newborn);
  }
  cw_carScores = [];
  cw_carGeneration = newGeneration;
  gen_counter++;
  cw_materializeGeneration();
  cw_deadCars = 0;
  leaderPosition = {};
  leaderPosition.x = 0;
  leaderPosition.y = 0;
  document.getElementById("generation").innerHTML = gen_counter.toString();
  document.getElementById("cars").innerHTML = "";
  document.getElementById("population").innerHTML = generationSize.toString();
}

function cw_getChampions() {
  const ret = [];
  cw_carScores.sort(function (a, b) {
    if (a.v > b.v) {
      return -1
    } else {
      return 1
    }
  });
  for (let k = 0; k < generationSize; k++) {
    ret.push(cw_carScores[k].i);
  }
  return ret;
}

function cw_getParents() {
  const r = Math.random();
  if (r == 0)
    return 0;
  return Math.floor(-Math.log(r) * generationSize) % generationSize;
}

function cw_makeChild(car_def1, car_def2) {
  const newCarDef = {};
  swapPoint1 = Math.round(Math.random() * (nAttributes - 1));
  swapPoint2 = swapPoint1;
  while (swapPoint2 == swapPoint1) {
    swapPoint2 = Math.round(Math.random() * (nAttributes - 1));
  }
  const parents = [car_def1, car_def2];
  let curparent = 0;
  let wheelParent = 0;

  let variateWheelParents = parents[0].wheelCount==parents[1].wheelCount;

  if (!variateWheelParents) {
    wheelParent = Math.floor(Math.random() * 2);
  }

  newCarDef.wheelCount = parents[wheelParent].wheelCount;

  newCarDef.wheel_radius = [];
  for (let i = 0; i < newCarDef.wheelCount; i++) {
    if (variateWheelParents) {
      curparent = cw_chooseParent(curparent, i);
    } else {
      curparent = wheelParent;
    }
    newCarDef.wheel_radius[i] = parents[curparent].wheel_radius[i];
  }

  newCarDef.wheel_vertex = [];
  for (let i = 0; i < newCarDef.wheelCount; i++) {
    if (variateWheelParents) {
      curparent = cw_chooseParent(curparent, i + 2);
    } else {
      curparent = wheelParent;
    }
    newCarDef.wheel_vertex[i] = parents[curparent].wheel_vertex[i];
  }

  newCarDef.wheel_density = [];
  for (let i = 0; i < newCarDef.wheelCount; i++) {
    if (variateWheelParents) {
      curparent = cw_chooseParent(curparent, i + 12);
    } else {
      curparent = wheelParent;
    }
    newCarDef.wheel_density[i] = parents[curparent].wheel_density[i];
  }

  newCarDef.vertex_list = [];
  curparent = cw_chooseParent(curparent, 4);
  newCarDef.vertex_list[0] = parents[curparent].vertex_list[0];
  curparent = cw_chooseParent(curparent, 5);
  newCarDef.vertex_list[1] = parents[curparent].vertex_list[1];
  curparent = cw_chooseParent(curparent, 6);
  newCarDef.vertex_list[2] = parents[curparent].vertex_list[2];
  curparent = cw_chooseParent(curparent, 7);
  newCarDef.vertex_list[3] = parents[curparent].vertex_list[3];
  curparent = cw_chooseParent(curparent, 8);
  newCarDef.vertex_list[4] = parents[curparent].vertex_list[4];
  curparent = cw_chooseParent(curparent, 9);
  newCarDef.vertex_list[5] = parents[curparent].vertex_list[5];
  curparent = cw_chooseParent(curparent, 10);
  newCarDef.vertex_list[6] = parents[curparent].vertex_list[6];
  curparent = cw_chooseParent(curparent, 11);
  newCarDef.vertex_list[7] = parents[curparent].vertex_list[7];

  curparent = cw_chooseParent(curparent, 14);
  newCarDef.chassis_density = parents[curparent].chassis_density;
  return newCarDef;
}


function cw_mutate1(old, min, range) {
  const span = range*mutation_range;
  let base = old - 0.5*span;
  if (base < min)
    base = min;
  if (base > min + (range - span))
    base = min + (range - span);
  return base + span * Math.random();
}

function cw_mutatev(car_def, n, xfact, yfact) {
  if (Math.random() >= gen_mutation)
    return;

  const v = car_def.vertex_list[n];
  let x = 0;
  let y = 0;
  if (xfact != 0)
    x = xfact * cw_mutate1(xfact * v.x, chassisMinAxis, chassisAxisRange);
  if (yfact != 0)
    y = yfact * cw_mutate1(yfact * v.y, chassisMinAxis, chassisAxisRange);
  car_def.vertex_list.splice(n, 1, new b2Vec2(x, y));
}


function cw_mutate(car_def) {
  for (let i = 0; i < car_def.wheelCount; i++) {
    if (Math.random() < gen_mutation) {
      car_def.wheel_radius[i] = cw_mutate1(car_def.wheel_radius[i], wheelMinRadius, wheelRadiusRange);
    }
  }

  const wheel_m_rate = mutation_range<gen_mutation ? mutation_range : gen_mutation;

  for (let i = 0; i < car_def.wheelCount; i++) {
    if (Math.random() < wheel_m_rate) {
      car_def.wheel_vertex[i] = Math.floor(Math.random() * 8) % 8;
    }
  }

  for (let i = 0; i < car_def.wheelCount; i++) {
    if (Math.random() < gen_mutation) {
      car_def.wheel_density[i] = cw_mutate1(car_def.wheel_density[i], wheelMinDensity, wheelDensityRange);
    }
  }

  if (Math.random() < gen_mutation) {
    car_def.chassis_density = cw_mutate1(car_def.chassis_density, chassisMinDensity, chassisDensityRange);
  }

  cw_mutatev(car_def, 0, 1, 0);
  cw_mutatev(car_def, 1, 1, 1);
  cw_mutatev(car_def, 2, 0, 1);
  cw_mutatev(car_def, 3, -1, 1);
  cw_mutatev(car_def, 4, -1, 0);
  cw_mutatev(car_def, 5, -1, -1);
  cw_mutatev(car_def, 6, 0, -1);
  cw_mutatev(car_def, 7, 1, -1);

  return car_def;
}

function cw_chooseParent(curparent, attributeIndex) {
  let ret;
  if ((swapPoint1 == attributeIndex) || (swapPoint2 == attributeIndex)) {
    if (curparent == 1) {
      ret = 0;
    } else {
      ret = 1;
    }
  } else {
    ret = curparent;
  }
  return ret;
}

function cw_setMutation(mutation) {
  gen_mutation = parseFloat(mutation);
}

function cw_setMutationRange(range) {
  mutation_range = parseFloat(range);
}

function cw_setMutableFloor(choice) {
  mutable_floor = (choice == 1);
}

function cw_setGravity(choice) {
  gravity = new b2Vec2(0.0, -parseFloat(choice));
  // CHECK GRAVITY CHANGES
  if (world.GetGravity().y != gravity.y) {
    world.SetGravity(gravity);
  }
}

function cw_setEliteSize(clones) {
  gen_champions = parseInt(clones, 10);
}

/* ==== END Genration ====================================================== */
/* ========================================================================= */

/* ========================================================================= */
/* ==== Drawing ============================================================ */

function cw_drawScreen() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  cw_setCameraPosition();
  ctx.translate(200 - (camera_x * zoom), 200 + (camera_y * zoom));
  ctx.scale(zoom, -zoom);
  cw_drawFloor();
  ghost_draw_frame(ctx, ghost);
  cw_drawCars();
  ctx.restore();
}

function cw_minimapCamera(x, y) {
  minimapcamera.left = Math.round((2 + camera_x) * minimapscale) + "px";
  minimapcamera.top = Math.round((31 - camera_y) * minimapscale) + "px";
}

function cw_setCameraTarget(k) {
  camera_target = k;
}

function cw_setCameraPosition() {
  if (camera_target >= 0) {
    let cameraTargetPosition = cw_carArray[camera_target].getPosition();
  } else {
    let cameraTargetPosition = leaderPosition;
  }
  const diff_y = camera_y - cameraTargetPosition.y;
  const diff_x = camera_x - cameraTargetPosition.x;
  camera_y -= cameraspeed * diff_y;
  camera_x -= cameraspeed * diff_x;
  cw_minimapCamera(camera_x, camera_y);
}

function cw_drawGhostReplay() {
  carPosition = ghost_get_position(ghost);
  camera_x = carPosition.x;
  camera_y = carPosition.y;
  cw_minimapCamera(camera_x, camera_y);
  showDistance(Math.round(carPosition.x * 100) / 100, Math.round(carPosition.y * 100) / 100);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(200 - (carPosition.x * zoom), 200 + (carPosition.y * zoom));
  ctx.scale(zoom, -zoom);
  ghost_draw_frame(ctx, ghost);
  ghost_move_frame(ghost);
  cw_drawFloor();
  ctx.restore();
}


function cw_drawCars() {
  for (let k = (cw_carArray.length - 1); k >= 0; k--) {
    myCar = cw_carArray[k];
    if (!myCar.alive) {
      continue;
    }
    myCarPos = myCar.getPosition();

    if (myCarPos.x < (camera_x - 5)) {
      // too far behind, don't draw
      continue;
    }

    ctx.strokeStyle = "#444";
    ctx.lineWidth = 1 / zoom;

    for (let i = 0; i < myCar.wheels.length; i++) {
      b = myCar.wheels[i];
      for (f = b.GetFixtureList(); f; f = f.m_next) {
        var s = f.GetShape();
        const color = Math.round(255 - (255*(f.m_density - wheelMinDensity))/wheelDensityRange).toString();
        const rgbcolor = "rgb(" + color + "," + color + "," + color + ")";
        cw_drawCircle(b, s.m_p, s.m_radius, b.m_sweep.a, rgbcolor);
      }
    }

    if (myCar.is_elite) {
      ctx.strokeStyle = "#3F72AF";
      ctx.fillStyle = "#DBE2EF";
    } else {
      ctx.strokeStyle = "#F7C873";
      ctx.fillStyle = "#FAEBCD";
    }
    ctx.beginPath();
    var b = myCar.chassis;
    for (f = b.GetFixtureList(); f; f = f.m_next) {
      var s = f.GetShape();
      cw_drawVirtualPoly(b, s.m_vertices, s.m_vertexCount);
    }
    ctx.fill();
    ctx.stroke();
  }
}

function toggleDisplay() {
  if (cw_paused) {
    return;
  }
  canvas.width = canvas.width;
  if (doDraw) {
    doDraw = false;
    cw_stopSimulation();
    cw_runningInterval = setInterval(function () {
      const time = performance.now() + (1000/screenfps);
      while (time > performance.now()) {
        simulationStep();
      }
    }, 1);
  } else {
    doDraw = true;
    clearInterval(cw_runningInterval);
    cw_startSimulation();
  }
}

function cw_drawVirtualPoly(body, vtx, n_vtx) {
  // set strokestyle and fillstyle before call
  // call beginPath before call

  const p0 = body.GetWorldPoint(vtx[0]);
  ctx.moveTo(p0.x, p0.y);
  for (let i = 1; i < n_vtx; i++) {
    p = body.GetWorldPoint(vtx[i]);
    ctx.lineTo(p.x, p.y);
  }
  ctx.lineTo(p0.x, p0.y);
}

function cw_drawPoly(body, vtx, n_vtx) {
  // set strokestyle and fillstyle before call
  ctx.beginPath();

  const p0 = body.GetWorldPoint(vtx[0]);
  ctx.moveTo(p0.x, p0.y);
  for (let i = 1; i < n_vtx; i++) {
    p = body.GetWorldPoint(vtx[i]);
    ctx.lineTo(p.x, p.y);
  }
  ctx.lineTo(p0.x, p0.y);

  ctx.fill();
  ctx.stroke();
}

function cw_drawCircle(body, center, radius, angle, color) {
  const p = body.GetWorldPoint(center);
  ctx.fillStyle = color;

  ctx.beginPath();
  ctx.arc(p.x, p.y, radius, 0, 2 * Math.PI, true);

  ctx.moveTo(p.x, p.y);
  ctx.lineTo(p.x + radius * Math.cos(angle), p.y + radius * Math.sin(angle));

  ctx.fill();
  ctx.stroke();
}

function cw_drawMiniMap() {
  let last_tile = null;
  let tile_position = new b2Vec2(-5, 0);
  minimapfogdistance = 0;
  fogdistance.width = "800px";
  minimapcanvas.width = minimapcanvas.width;
  minimapctx.strokeStyle = "#3F72AF";
  minimapctx.beginPath();
  minimapctx.moveTo(0, 35 * minimapscale);
  for (let k = 0; k < cw_floorTiles.length; k++) {
    last_tile = cw_floorTiles[k];
    last_fixture = last_tile.GetFixtureList();
    last_world_coords = last_tile.GetWorldPoint(last_fixture.GetShape().m_vertices[3]);
    tile_position = last_world_coords;
    minimapctx.lineTo((tile_position.x + 5) * minimapscale, (-tile_position.y + 35) * minimapscale);
  }
  minimapctx.stroke();
}

/* ==== END Drawing ======================================================== */
/* ========================================================================= */

function saveProgress() {
  localStorage.cw_savedGeneration = JSON.stringify(cw_carGeneration);
  localStorage.cw_genCounter = gen_counter;
  localStorage.cw_ghost = JSON.stringify(ghost);
  localStorage.cw_topScores = JSON.stringify(cw_topScores);
  localStorage.cw_floorSeed = floorseed;
}

function restoreProgress() {
  if (typeof localStorage.cw_savedGeneration == 'undefined' || localStorage.cw_savedGeneration == null) {
    alert("No saved progress found");
    return;
  }
  cw_stopSimulation();
  cw_carGeneration = JSON.parse(localStorage.cw_savedGeneration);
  gen_counter = localStorage.cw_genCounter;
  ghost = JSON.parse(localStorage.cw_ghost);
  cw_topScores = JSON.parse(localStorage.cw_topScores);
  floorseed = localStorage.cw_floorSeed;
  document.getElementById("newseed").value = floorseed;

  for (b = world.m_bodyList; b; b = b.m_next) {
    world.DestroyBody(b);
  }
  Math.seedrandom(floorseed);
  cw_createFloor();
  cw_drawMiniMap();
  Math.seedrandom();

  cw_materializeGeneration();
  cw_deadCars = 0;
  leaderPosition = {};
  leaderPosition.x = 0;
  leaderPosition.y = 0;
  document.getElementById("generation").innerHTML = gen_counter;
  document.getElementById("cars").innerHTML = "";
  document.getElementById("population").innerHTML = generationSize;
  cw_startSimulation();
}

function simulationStep() {
  world.Step(1 / box2dfps, 20, 20);
  ghost_move_frame(ghost);
  for (let k = 0; k < generationSize; k++) {
    if (!cw_carArray[k].alive) {
      continue;
    }
    ghost_add_replay_frame(cw_carArray[k].replay, cw_carArray[k]);
    cw_carArray[k].frames++;
    position = cw_carArray[k].getPosition();
    cw_carArray[k].minimapmarker.style.left = Math.round((position.x + 5) * minimapscale) + "px";
    cw_carArray[k].healthBar.width = Math.round((cw_carArray[k].health / max_car_health) * 100) + "%";
    if (cw_carArray[k].checkDeath()) {
      cw_carArray[k].kill();
      cw_deadCars++;
      document.getElementById("population").innerHTML = (generationSize - cw_deadCars).toString();
      cw_carArray[k].minimapmarker.style.borderLeft = "1px solid #3F72AF";
      if (cw_deadCars >= generationSize) {
        cw_newRound();
      }
      if (leaderPosition.leader == k) {
        // leader is dead, find new leader
        cw_findLeader();
      }
      continue;
    }
    if (position.x > leaderPosition.x) {
      leaderPosition = position;
      leaderPosition.leader = k;
    }
  }
  showDistance(Math.round(leaderPosition.x * 100) / 100, Math.round(leaderPosition.y * 100) / 100);
}

function cw_findLeader() {
  const lead = 0;
  for (let k = 0; k < cw_carArray.length; k++) {
    if (!cw_carArray[k].alive) {
      continue;
    }
    position = cw_carArray[k].getPosition();
    if (position.x > lead) {
      leaderPosition = position;
      leaderPosition.leader = k;
    }
  }
}

function cw_newRound() {
  if (mutable_floor) {
    // GHOST DISABLED
    ghost = null;
    floorseed = btoa(Math.seedrandom());

    world = new b2World(gravity, doSleep);
    cw_createFloor();
    cw_drawMiniMap();
  } else {
    // RE-ENABLE GHOST
    ghost_reset_ghost(ghost);
  }

  cw_nextGeneration();
  camera_x = camera_y = 0;
  cw_setCameraTarget(-1);
}

function cw_startSimulation() {
  cw_runningInterval = setInterval(simulationStep, Math.round(1000 / box2dfps));
  cw_drawInterval = setInterval(cw_drawScreen, Math.round(1000 / screenfps));
}

function cw_stopSimulation() {
  clearInterval(cw_runningInterval);
  clearInterval(cw_drawInterval);
}

function cw_kill() {
  const avgspeed = (myCar.maxPosition/myCar.frames)*box2dfps;
  const position = myCar.maxPosition;
  const score = position + avgspeed;
  document.getElementById("cars").innerHTML += Math.round(position * 100) / 100 + "m + " + " " + Math.round(avgspeed * 100) / 100 + " m/s = " + Math.round(score * 100) / 100 + "pts<br />";
  ghost_compare_to_replay(replay, ghost, score);
  cw_carScores.push({
    i: current_car_index,
    v: score,
    s: avgspeed,
    x: position,
    y: myCar.maxPositiony,
    y2: myCar.minPositiony
  });
  current_car_index++;
  cw_killCar();
  if (current_car_index >= generationSize) {
    cw_nextGeneration();
    current_car_index = 0;
  }
  myCar = cw_createNextCar();
  last_drawn_tile = 0;
}

function cw_resetPopulation() {
  document.getElementById("generation").innerHTML = "";
  document.getElementById("cars").innerHTML = "";
  document.getElementById("topscores").innerHTML = "";
  cw_clearGraphics();
  cw_carArray = [];
  cw_carGeneration = [];
  cw_carScores = [];
  cw_topScores = [];
  cw_graphTop = [];
  cw_graphElite = [];
  cw_graphAverage = [];
  lastmax = 0;
  lastaverage = 0;
  lasteliteaverage = 0;
  swapPoint1 = 0;
  swapPoint2 = 0;
  cw_generationZero();
}

function cw_resetWorld() {
  doDraw = true;
  cw_stopSimulation();
  for (b = world.m_bodyList; b; b = b.m_next) {
    world.DestroyBody(b);
  }
  floorseed = document.getElementById("newseed").value;
  Math.seedrandom(floorseed);
  cw_createFloor();
  cw_drawMiniMap();
  Math.seedrandom();
  cw_resetPopulation();
  cw_startSimulation();
}

function cw_confirmResetWorld() {
  if (confirm('Really reset world?')) {
    cw_resetWorld();
  } else {
    return false;
  }
}

// ghost replay stuff

function cw_pauseSimulation() {
  cw_paused = true;
  clearInterval(cw_runningInterval);
  clearInterval(cw_drawInterval);
  old_last_drawn_tile = last_drawn_tile;
  last_drawn_tile = 0;
  ghost_pause(ghost);
}

function cw_resumeSimulation() {
  cw_paused = false;
  ghost_resume(ghost);
  last_drawn_tile = old_last_drawn_tile;
  cw_runningInterval = setInterval(simulationStep, Math.round(1000 / box2dfps));
  cw_drawInterval = setInterval(cw_drawScreen, Math.round(1000 / screenfps));
}

function cw_startGhostReplay() {
  if (!doDraw) {
    toggleDisplay();
  }
  cw_pauseSimulation();
  cw_ghostReplayInterval = setInterval(cw_drawGhostReplay, Math.round(1000 / screenfps));
}

function cw_stopGhostReplay() {
  clearInterval(cw_ghostReplayInterval);
  cw_ghostReplayInterval = null;
  cw_findLeader();
  camera_x = leaderPosition.x;
  camera_y = leaderPosition.y;
  cw_resumeSimulation();
}

function cw_toggleGhostReplay(button) {
  if (cw_ghostReplayInterval == null) {
    cw_startGhostReplay();
    button.value = "Resume simulation";
  } else {
    cw_stopGhostReplay();
    button.value = "View top replay";
  }
}
// ghost replay stuff END

// initial stuff, only called once (hopefully)
function cw_init() {
  // clone silver dot and health bar
  const mmm = document.getElementsByName('minimapmarker')[0];
  const hbar = document.getElementsByName('healthbar')[0];

  for (let k = 0; k < generationSize; k++) {

    // minimap markers
    const newbar = mmm.cloneNode(true);
    newbar.id = "bar" + k;
    newbar.style.paddingTop = k * 9 + "px";
    minimapholder.appendChild(newbar);

    // health bars
    const newhealth = hbar.cloneNode(true);
    newhealth.getElementsByTagName("DIV")[0].id = "health" + k;
    newhealth.car_index = k;
    document.getElementById("health").appendChild(newhealth);
  }
  mmm.parentNode.removeChild(mmm);
  hbar.parentNode.removeChild(hbar);
  floorseed = btoa(Math.seedrandom());
  world = new b2World(gravity, doSleep);
  cw_createFloor();
  cw_drawMiniMap();
  cw_generationZero();
  cw_runningInterval = setInterval(simulationStep, Math.round(1000 / box2dfps));
  cw_drawInterval = setInterval(cw_drawScreen, Math.round(1000 / screenfps));
}

function relMouseCoords(event) {
  let totalOffsetX = 0;
  let totalOffsetY = 0;
  let canvasX = 0;
  let canvasY = 0;
  let currentElement = this;

  do {
    totalOffsetX += currentElement.offsetLeft - currentElement.scrollLeft;
    totalOffsetY += currentElement.offsetTop - currentElement.scrollTop;
  }
  while (currentElement = currentElement.offsetParent);

  canvasX = event.pageX - totalOffsetX;
  canvasY = event.pageY - totalOffsetY;

  return {x: canvasX, y: canvasY}
}
HTMLDivElement.prototype.relMouseCoords = relMouseCoords;
minimapholder.onclick = function (event) {
  const coords = minimapholder.relMouseCoords(event);
  const closest = {
    index: 0,
    dist: Math.abs(((cw_carArray[0].getPosition().x + 6)*minimapscale) - coords.x),
    x: cw_carArray[0].getPosition().x
  };

  let maxX = 0;
  for (let i = 0; i < cw_carArray.length; i++) {
    if (!cw_carArray[i].alive) {
      continue;
    }
    const pos = cw_carArray[i].getPosition();
    const dist = Math.abs(((pos.x + 6)*minimapscale) - coords.x);
    if (dist < closest.dist) {
      closest.index = i;
      closest.dist = dist;
      closest.x = pos.x;
    }
    maxX = Math.max(pos.x, maxX);
  }

  if (closest.x == maxX) { // focus on leader again
    cw_setCameraTarget(-1);
  } else {
    cw_setCameraTarget(closest.index);
  }
}

cw_init();
