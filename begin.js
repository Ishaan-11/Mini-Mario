let simpleLevelPlan=`
......................
..#................#..
..#..............=.#..
..#.........o.o....#..
..#.@......#####...#..
..#####............#..
......#++++++++++++#..
......##############..
......................`;

//the following class stores a level object
class Level {
    constructor(plan) {
      let rows = plan.trim().split("\n").map(l => [...l]);
      this.height = rows.length;
      this.width = rows[0].length;
      this.startActors = [];
  
      this.rows = rows.map((row, y) => {
        return row.map((ch, x) => {
          let type = levelChars[ch];
          if (typeof type == "string") return type;
          this.startActors.push(
            type.create(new Vec(x, y), ch));
          return "empty";
        });
      });
    }
  }

//State class to track the state of a running game.
//Status property will switch to "lost" or "won" when the game has ended
class State {
    constructor(level, actors, status) {
      this.level = level;
      this.actors = actors;
      this.status = status;
    }
  
    static start(level) {
      return new State(level, level.startActors, "playing");
    }
  
    get player() {
      return this.actors.find(a => a.type == "player");
    }
  }

//the Vec class is used for position of actors
class Vec {
    constructor(x, y) {
      this.x = x; this.y = y;
    }
    plus(other) {
      return new Vec(this.x + other.x, this.y + other.y);
    }
    times(factor) {
      return new Vec(this.x * factor, this.y * factor);
    }
  }

//The player class has a property speed that stores its current speed 
//to simulate momentum and gravity
class Player {
    constructor(pos, speed) {
      this.pos = pos;
      this.speed = speed;
    }
  
    get type() { return "player"; }
  
    static create(pos) {
      return new Player(pos.plus(new Vec(0, -0.5)),
                        new Vec(0, 0));
    }
  }
  
  Player.prototype.size = new Vec(0.8, 1.5);

//lava class,if reset then jump back to starting position
class Lava {
    constructor(pos, speed, reset) {
      this.pos = pos;
      this.speed = speed;
      this.reset = reset;
    }
  
    get type() { return "lava"; }
  
    static create(pos, ch) {
      if (ch == "=") {
        return new Lava(pos, new Vec(2, 0));
      } else if (ch == "|") {
        return new Lava(pos, new Vec(0, 2));
      } else if (ch == "v") {
        return new Lava(pos, new Vec(0, 3), pos);
      }
    }
  }
  
  Lava.prototype.size = new Vec(1, 1);

//coin actor
class Coin {
    constructor(pos, basePos, wobble) {
      this.pos = pos;
      this.basePos = basePos;
      this.wobble = wobble;
    }
  
    get type() { return "coin"; }
  
    static create(pos) {
      let basePos = pos.plus(new Vec(0.2, 0.1));
      return new Coin(basePos, basePos,
                      Math.random() * Math.PI * 2);
    }
  }
  
  Coin.prototype.size = new Vec(0.6, 0.6);

 const levelChars = {
    ".": "empty", "#": "wall", "+": "lava",
    "@": Player, "o": Coin,
    "=": Lava, "|": Lava, "v": Lava
  };
//That gives us all the parts needed to create a Level instance
//let simpleLevel=new Level(simpleLevelPlan);
/* console.log(`${simpleLevel.width} by ${simpleLevel.height}`);
//->22 by 9 */

//to create an element and give it some attributes and child nodes
function elt(name, attrs, ...children) {
    let dom = document.createElement(name);
    for (let attr of Object.keys(attrs)) {
      dom.setAttribute(attr, attrs[attr]);
    }
    for (let child of children) {
      dom.appendChild(child);
    }
    return dom;
  }

//A display is created by giving it a parent element 
//to which it should append itself and a level object
class DOMDisplay {
    constructor(parent, level) {
      this.dom = elt("div", {class: "game"}, drawGrid(level));
      this.actorLayer = null;
      parent.appendChild(this.dom);
    }
  
    clear() { this.dom.remove(); }
  }
//The actorLayer property will be used to track the element that holds 
//the actors so that they can be easily removed and replaced

//The scale constant gives the number of pixels that a single
//unit takes up on the screen
const scale=20;
function drawGrid(level) {
    return elt("table", {
      class: "background",
      style: `width: ${level.width * scale}px`
    }, ...level.rows.map(row =>
      elt("tr", {style: `height: ${scale}px`},
          ...row.map(type => elt("td", {class: type})))
    ));
  }

//The following CSS makes the table look like the background we want
/*
.background{background:rgb(52,166,251);
            table-layout:fixed;
            border-spacing:0;
            }
.background td{ padding: 0; }
.lava{ background: rgb(255,100,100); }
.wall{ background: white; }
*/


//drawing actors
function drawActors(actors) {
    return elt("div", {}, ...actors.map(actor => {
      let rect = elt("div", {class: `actor ${actor.type}`});
      rect.style.width = `${actor.size.x * scale}px`;
      rect.style.height = `${actor.size.y * scale}px`;
      rect.style.left = `${actor.pos.x * scale}px`;
      rect.style.top = `${actor.pos.y * scale}px`;
      return rect;
    }));
  }

/*
.actor{ position: absolute; }
.coin{ background: rgb(241,229,89); }
.player{ background: rgb(64,64,64); }
*/


//The syncState method is used to make the display show a given state. 
//It first removes the old actor graphics, 
//if any, and then redraws the actors in their new positions
DOMDisplay.prototype.syncState = function(state) {
    if (this.actorLayer) this.actorLayer.remove();
    this.actorLayer = drawActors(state.actors);
    this.dom.appendChild(this.actorLayer);
    this.dom.className = `game ${state.status}`;
    this.scrollPlayerIntoView(state);
  };

/*
.lost .player {
    background: rgb(160, 64, 64);
}
.won .player {
    box-shadow: -4px -7px 8px white, 4px -7px 8px white;
}
*/

/*
.game {
    overflow: hidden;
    max-width: 600px;
    max-height: 450px;
    position: relative;
}
*/

//the level always fits in viewport ,this is done by scrollplayerview
DOMDisplay.prototype.scrollPlayerIntoView = function(state) {
    let width = this.dom.clientWidth;
    let height = this.dom.clientHeight;
    let margin = width / 3;
  
    // The viewport
    let left = this.dom.scrollLeft, right = left + width;
    let top = this.dom.scrollTop, bottom = top + height;
  
    let player = state.player;
    let center = player.pos.plus(player.size.times(0.5))
                           .times(scale);
  
    if (center.x < left + margin) {
      this.dom.scrollLeft = center.x - margin;
    } else if (center.x > right - margin) {
      this.dom.scrollLeft = center.x + margin - width;
    }
    if (center.y < top + margin) {
      this.dom.scrollTop = center.y - margin;
    } else if (center.y > bottom - margin) {
      this.dom.scrollTop = center.y + margin - height;
    }
};

//motion and collision

//tells us whether a rectangle touches a grid element of the given type
Level.prototype.touches=function(pos,size,type){
    var xStart=Math.floor(pos.x);
    var xEnd=Math.ceil(pos.x+size.x);
    var yStart=Math.floor(pos.y);
    var yEnd=Math.ceil(pos.y+size.y);

    for(var y=yStart;y<yEnd;y++){
        for(var x=xStart;x<xEnd;x++){
            let isOutside=x<0 || x>= this.width ||
                          y<0 || y>= this.height;
            let here= isOutside ? "wall" : this.rows[y][x];
            if(here==type) return true;
        }
    }
    return false;
};

//The state update uses touches to tell whether player is touching lava.
State.prototype.update=function(time,keys){
    let actors=this.actors
        .map(actor=>actor.update(time,this,keys));
    let newState=new State(this.level,actors,this.status);

    if(newState.status!="playing") return newState;

    let player=newState.player;
    if(this.level.touches(player.pos,player.size,"lava")){
        return new State(this.level,actors,"lost");
    }

    for(let actor of actors){
        if(actor!=player && overlap(actor,player)){
            newState=actor.collide(newState);
        }
    }
    return newState;
};

//Overlap between actors is detected with the overlap function
function overlap(actor1,actor2){
    return actor1.pos.x + actor1.size.x > actor2.pos.x &&
           actor1.pos.x < actor2.pos.x + actor2.size.x &&
           actor1.pos.y + actor1.size.y > actor2.pos.y &&
           actor1.pos.y < actor2.pos.y + actor2.size.y;
}

//If actor overlap, its collide method update the state
Lava.prototype.collide=function(state){
    return new State(state.level,state.actors, "lost");
};

Coin.prototype.collide=function(state){
    let filtered=state.actors.filter(a=>a!=this);
    let status=state.status;
    if(!filtered.some(a=>a.type=="coin")) status="won";
    return new State(state.level,filtered,status);
};

//lava update
Lava.prototype.update=function(time,state){
    let newPos=this.pos.plus(this.speed.times(time));
    if(!state.level.touches(newPos,this.size, "wall")){
        return new Lava(newPos,this.speed,this.reset);
    }
    else if(this.reset){
        return new Lava(this.reset,this.speed,this.reset);
    }
    else{
        return new Lava(this.pos,this.speed.times(-1));
    }
};

//Coins use their update method to wobble
const wobbleSpeed=8,wobbleDist=0.07;

Coin.prototype.update=function(time){
    let wobble=this.wobble + time * wobbleSpeed;
    let wobblePos=Math.sin(wobble) * wobbleDist;
    return new Coin(this.basePos.plus(new Vec(0,wobblePos)),
                    this.basePos,wobble);
};

//player update
const playerXSpeed=7;
const gravity=30;
const jumpSpeed=17;

Player.prototype.update=function(time,state,keys){
    let xSpeed=0;
    if(keys.ArrowLeft) xSpeed -= playerXSpeed;
    if(keys.ArrowRight) xSpeed +=playerXSpeed;
    let pos=this.pos;
    let movedX=pos.plus(new Vec(xSpeed * time,0));
    if(!state.level.touches(movedX,this.size, "wall")){
        pos=movedX;
    }

    let ySpeed=this.speed.y + time * gravity;
    let movedY=pos.plus(new Vec(0,ySpeed * time));
    if(!state.level.touches(movedY,this.size, "wall")){
        pos=movedY;
    }
    else if(keys.ArrowUp && ySpeed > 0){
        ySpeed = -jumpSpeed;
    }
    else{
        ySpeed=0;
    }
    return new Player(pos,new Vec(xSpeed,ySpeed));
};

//tracking keys

//when given an array of key names, will return an object 
//that tracks the current position of those keys.
function trackKeys(keys){
    let down=Object.create(null);
    function track(event){
        if(keys.includes(event.key)){
            down[event.key]=event.type=="keydown";
            event.preventDefault();
        }
    }
    window.addEventListener("keydown",track);
    window.addEventListener("keyup",track);
    return down;
}

const arrowKeys=trackKeys(["ArrowLeft","ArrowRight","ArrowUp"]);

//running the game

//it requires us to track the time at which our function was called last
//time around and call requestAnimationFrame again after every frame.
//When the frame function returns the value false, the animation stops.
function runAnimation(frameFunc){
    let lastTime=null;
    function frame(time){
        if(lastTime!=null){
            let timeStep=Math.min(time - lastTime,100)/1000;
            if(frameFunc(timeStep)===false) return;
        }
        lastTime=time;
        requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
}

//The runLevel function takes a Level object and a display constructor
//and returns a promise.
function runLevel(level,Display){
    let display=new Display(document.body,level);
    let state =State.start(level);
    let ending=1;
    return new Promise(resolve=>{
        runAnimation(time=>{
            state=state.update(time,arrowKeys);
            display.syncState(state);
            if(state.status=="playing"){
                return true;
            }
            else if(ending > 0){
                ending -= time;
                return true;
            }
            else{
                display.clear();
                resolve(state.status);
                return false;
            }
        });
    });
}

//Whenever the player dies, the current level is restarted.
//When a level is completed, we move on to the next level
async function runGame(plans,Display){
    for(let level=0; level < plans.length; ){
        let status=await runLevel(new Level(plans[level]),Display);
        if(status=="won") level++;
    }
    console.log("You've won!");
}
