/*
  SimLand - a webbrowser game inspired by a classic
  Copyright (C) 2012  Aurélio A. Heckert <aurium@gmail.com>

  This program is free software: you can redistribute it and/or modify
  it under the terms of the GNU Affero General Public License as
  published by the Free Software Foundation, either version 3 of the
  License, or (at your option) any later version.

  This program is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
  GNU Affero General Public License for more details.

  You should have received a copy of the GNU Affero General Public License
  along with this program.  If not, see <http://www.gnu.org/licenses/>.
  You also can read the full license at <http://www.gnu.org/licenses/agpl.html>
*/

(function (exports) {

/** @private */
function makeEl(tagName, conf) {
  var el = document.createElement(tagName);
  for ( att in conf ) {
    if ( att == 'parent' ) conf.parent.appendChild(el);
    else {
      if ( att == 'innerHTML' ) el.innerHTML = conf.innerHTML;
      else el.setAttribute(att, conf[att]);
    }
  }
  return el;
}

if (!console) console = { log:function(){} };

/** @private */
function arrayRand(array) {
  return array.sort(function(){ return Math.random()-0.5 });
}

/** @private */
function round2(number) {
  return Math.round(number*100)/100;
}
/** @private */
function round2str(number) {
  // Force two decimals only:
  return round2(number).toString().replace(/(\...).*/,'$1');
}

months = 'Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split(' ');

/** @constructor SimLand */
exports.SimLand = function SimLand(baseElId, landSize) {
  this.landSize = landSize;
  this.date = [2000,0];
  this.monthSecsDelay = 10;
  this.money = 1000;
  this.taxes = { individual : 0.2,
                 commerce   : 5,
                 industry   : 7,
                 farming    : 2
               };
  this.cache = {};
  this.goodsStock = 10;
  this.foodStock = 20;
  this.baseEl = document.getElementById(baseElId);
  this.baseEl.style.width = (landSize*40)+'px';
  this.baseEl.style.height = (landSize*24+50)+'px';
  this.landEl = makeEl('div', {
    class: 'visibleLand landDimention',
    parent: this.baseEl
  });
  this.eventCatcher = makeEl('div', {
    class: 'eventCatcher landDimention',
    parent: this.baseEl,
    style: 'z-index:'+(landSize+10)
  });
  this.landEl.style.width = this.eventCatcher.style.width = landSize*20+'px';
  this.landEl.style.height = this.eventCatcher.style.height = landSize*20+'px';
  this.landEl.style.left = this.eventCatcher.style.left = (landSize*10)+'px';
  this.landEl.style.top = this.eventCatcher.style.top = (landSize*2+50)+'px';
  // build squares
  this.squares = [];
  for ( var x=0; x<landSize; x++ ) {
    this.squares[x] = [];
    for ( var y=0; y<landSize; y++ ) {
      this.squares[x][y] = new Square(this, x, y);
      if ( Math.random()<0.4 ) this.squares[x][y].add('tree', true);
    }
  }
  makeControls(this);
  this.setTool('pointer');
  createInitialCity( this, Math.floor(landSize/2), Math.floor(landSize/2) );
  this.cache = {};
  this.updateStatus();
  var me = this;
  setTimeout(function(){ me.tic() }, this.monthSecsDelay*1000);
};

SimLand.prototype.tic = function() {
  try {
    this.date[1]++;
    if ( this.date[1] > 11 ) {
      this.date[1] = 0;
      this.date[0]++;
    }
    this.collectTaxes();
    for ( var x=0; x<this.landSize; x++ ) {
      for ( var y=0; y<this.landSize; y++ ) {
        var square = this.squares[x][y];
        var sqInfo = this.calcProductionFor(square);
        this.money -= sqInfo.consumption.money;
        this.goodsStock += sqInfo.goods - sqInfo.consumption.goods;
        this.foodStock += sqInfo.food - sqInfo.consumption.food;
      }
    }
    this.goodsStock = Math.round(this.goodsStock*9)/10; // some lost
    this.foodStock = Math.round(this.foodStock*8)/10; // some rots
    if ( this.goodsStock < 0 ) this.goodsStock = 0;
    if ( this.foodStock < 0 ) this.foodStock = 0;
    this.privateInitiativeNewBuildings();
    this.bornAndDie();
    this.moveDwellers()
  } catch(e) {
    console.log(e.stack, e);
  }
  this.cache = {}; // clear cache
  this.updateStatus();
  var me = this;
  if ( this.calcHappiness() == 0 ) return this.sadGameOver();
  this.ticTimeout = setTimeout(function(){ me.tic() }, this.monthSecsDelay*1000);
  if ( this.calcHappiness() < 0.25 ) this.displaySadnessReport();
};

/** @desc someone move from a full home to another with a empty bathroom */
SimLand.prototype.moveDwellers = function() {
  var houses = this.getSquareByType('house').sort(function(a,b){
    return a.dwellers - b.dwellers;
  });
  houses[0].dwellers++;
  houses[houses.length-1].dwellers--;
};

SimLand.prototype.privateInitiativeNewBuildings = function() {
  var pop = this.countPopulation();
  // Build houses
  var houses = arrayRand(this.getSquareByType('house'));
  if ( pop > houses.length*5 ) {
    var residAreas = arrayRand(this.getSquareByType('resid'));
    if ( residAreas[0] ) residAreas[0].add('house');
    if ( pop>houses.length*6 && residAreas[1] ) residAreas[1].add('house', true);
  }
  // Build farms
  if ( ( pop + this.calcRequiredGoodsOrFood() ) > this.foodStock ) {
    var countryAreas = arrayRand(this.getSquareByType('country'));
    var type = ( (Math.random()<0.3) ? 'silo' : 'farm' );
    if ( countryAreas[0] ) countryAreas[0].add(type);
    if ( pop > this.foodStock*1.5 && countryAreas[1] ) countryAreas[1].add(type, true);
  }
  // Build shoppings
  var shoppings = this.getSquareByType('shopping');
  var game=this, shoppWorkers=0, shoppJobs=0;
  shoppings.forEach(function(shopping) {
    shoppWorkers += game.calcWorkersFor(shopping);
    shoppJobs += gameThings.shopping.employs;
  });
  if ( (shoppWorkers/shoppJobs) > 0.8 ) {
    var commAreas = arrayRand(this.getSquareByType('commerce'));
    if ( commAreas[0] ) commAreas[0].add('shopping');
    if ( (shoppWorkers/shoppJobs) > 0.9 && commAreas[1] ) commAreas[1].add('shopping', true);
  }
  // Build factories
  var reqGoods = this.calcRequiredGoods() + this.calcRequiredGoodsOrFood();
  var game=this, prodGoods=0, factoryWorkers=0, factoryJobs=0;
  this.getSquareByType('factory').forEach(function(factory) {
    prodGoods += game.calcProductionFor(factory).goods;
    factoryWorkers += game.calcWorkersFor(factory);
    factoryJobs += gameThings.factory.employs;
  });
  if ( (factoryWorkers/factoryJobs) > 0.8 && reqGoods > prodGoods ) {
    var commAreas = arrayRand(this.getSquareByType('industry'));
    if ( commAreas[0] ) commAreas[0].add('factory', true);
  }
};

SimLand.prototype.bornAndDie = function() {
  var pop = this.countPopulation();
  var houses = this.getSquareByType('house');
  var hospEffect = this.getSquareByType('hospital') / pop;
  if ( hospEffect > 0.01 ) hospEffect = 0.01;
  var pollution = this.calcPollution();
  var bornTax = 0.003 + hospEffect;
  if ( pop < 50  ) bornTax *= 3;
  if ( pop < 100 ) bornTax *= 3;
  if ( pop < 150 ) bornTax *= 2;
  if ( pop < 200 ) bornTax *= 1.5;
  if ( pop < 250 ) bornTax *= 1.5;
  if ( pop < 300 ) bornTax *= 1.5;
  var born = Math.round( pop*bornTax + Math.random() );
  var dieTax = 0.002 - hospEffect + pollution/1000;
  var die = Math.round( pop*dieTax + Math.random()*0.7 );
  if ( (pop+born-die) > houses.length*10 )
    born = houses.length*10 - pop + die;
  var game = this;
  console.log(this.date, 'Die:'+die, 'Born:'+born );
  arrayRand(houses).forEach(function(house) {
    if ( house.dwellers > 1 && die > 0) { house.dwellers--; die-- }
  });
  arrayRand(houses).forEach(function(house) {
    if ( house.dwellers < 10 && born > 0) { house.dwellers++; born-- }
  });
};

SimLand.prototype.collectTaxes = function() {
  var total = 0;
  for ( var x=0; x<this.landSize; x++ ) {
    for ( var y=0; y<this.landSize; y++ ) {
      var square = this.squares[x][y];
      var gameThing = gameThings[square.type];
      if ( gameThing && gameThing.taxType ) {
        var rate = this.taxes[gameThing.taxType];
        if ( gameThing.taxType == 'individual' ) {
          total += rate * square.dwellers;
        } else {
          if ( gameThing.taxType == 'commerce' ) {
            var workers = this.calcWorkersFor(square);
            var jobs = gameThing.employs;
            total += rate * workers / jobs;
          } else {
            var product = ( gameThing.goods ? 'goods' : 'food');
            var production = this.calcProductionFor(square)[product];
            var potential = gameThing[product];
            total += rate * production / potential;
          }
        }
      }
    }
  }
  total = round2(total);
  console.log(this.date, 'Total tax earn: '+total);
  this.money += total;
};

SimLand.prototype.calcWorkersFor = function(square) {
  var cacheIndex = 'workersFor-'+square.x+'-'+square.y;
  if ( !this.cache[cacheIndex] ) {
    var squareGameThing = gameThings[square.type];
    var pop = this.countPopulation();
    var totalJobs = 0;
    var totalPrioJobs = 0;
    for ( var x=0; x<this.landSize; x++ ) {
      for ( var y=0; y<this.landSize; y++ ) {
        var sq = this.squares[x][y];
        var sqGameThing = gameThings[sq.type];
        if (sqGameThing && sqGameThing.employs) {
          totalJobs += sqGameThing.employs;
          if (sqGameThing.priorityJob) totalPrioJobs += sqGameThing.employs;
        }
      }
    }
    if ( pop*0.8 > totalJobs ) { // 80% of the population can work
      this.cache[cacheIndex] = squareGameThing.employs;
    } else {
      var deltaJobs = totalJobs - totalPrioJobs;
      if ( pop*0.8 > totalPrioJobs*2 ) {
        if ( squareGameThing.priorityJob )
          this.cache[cacheIndex] = squareGameThing.employs;
        else {
          var x = (pop*0.8) - totalPrioJobs;
          this.cache[cacheIndex] = Math.floor(squareGameThing.employs*(x/deltaJobs));
        }
      } else {  // A random foreign may take job easily:
        this.cache[cacheIndex] = Math.round(Math.random()) +
          Math.round(squareGameThing.employs*(pop/totalJobs));
      }
    }
  }
  return this.cache[cacheIndex];
};

SimLand.prototype.calcRequiredPower = function() {
  if (!this.cache.requiredPower) {
    this.cache.requiredPower = 0;
    for ( var x=0; x<this.landSize; x++ ) {
      for ( var y=0; y<this.landSize; y++ ) {
        var square = this.squares[x][y];
        var gameThing = gameThings[square.type];
        if ( gameThing && gameThing.needPower ) {
          this.cache.requiredPower += gameThing.needPower;
        }
      }
    }
  }
  return this.cache.requiredPower
};

SimLand.prototype.calcProducedPower = function() {
  if (!this.cache.producedPower) {
    this.cache.producedPower = 0;
    for ( var x=0; x<this.landSize; x++ ) {
      for ( var y=0; y<this.landSize; y++ ) {
        var square = this.squares[x][y];
        var gameThing = gameThings[square.type];
        if ( gameThing && gameThing.power ) {
          this.cache.producedPower += gameThing.power;
        }
      }
    }
  }
  return this.cache.producedPower
};

SimLand.prototype.calcRequiredGoods = function() {
  if (!this.cache.requiredGoods) {
    this.cache.requiredGoods = 0;
    for ( var x=0; x<this.landSize; x++ ) {
      for ( var y=0; y<this.landSize; y++ ) {
        var square = this.squares[x][y];
        var gameThing = gameThings[square.type];
        if ( gameThing && gameThing.needGoods ) {
          this.cache.requiredGoods += gameThing.needGoods;
        }
      }
    }
  }
  return this.cache.requiredGoods
};

SimLand.prototype.calcRequiredGoodsOrFood = function() {
  if (!this.cache.requiredGoodsOrFood) {
    this.cache.requiredGoodsOrFood = 0;
    for ( var x=0; x<this.landSize; x++ ) {
      for ( var y=0; y<this.landSize; y++ ) {
        var square = this.squares[x][y];
        var gameThing = gameThings[square.type];
        if ( gameThing && gameThing.needGoodsOrFood ) {
          this.cache.requiredGoodsOrFood += gameThing.needGoodsOrFood;
        }
      }
    }
  }
  return this.cache.requiredGoodsOrFood
};

SimLand.prototype.calcProductionFor = function(square) {
  var cacheIndex = 'productionFor-'+square.x+'-'+square.y;
  var consumption = { food:0, goods:0, money:0 };
  if ( !this.cache[cacheIndex] ) {
    var txt = '';
    var gameThing = gameThings[square.type];
    if ( !gameThing || gameThing.type == 'tree' ) {
      this.cache[cacheIndex] = { report:'', goods:0, food:0, consumption:consumption };
      return this.cache[cacheIndex];
    }
    if ( square.type == 'house' ) {
      var pop = this.countPopulation();
      var pctFood = this.foodStock / pop;
      if ( pctFood > 1 ) pctFood = 1
      var homeFood = Math.round( square.dwellers * pctFood * 10 ) / 10;
      txt += 'Receiving '+homeFood+' food units, '+
              Math.round(pctFood*100)+'% of the required.';
      consumption.food = homeFood;
    } else {
      var workers = this.calcWorkersFor(square);
      var pctJobs = Math.round( 100 * workers / gameThing.employs );
      txt += 'Employing '+workers+' workers, '+pctJobs+'% of the required.';
    }
    if ( gameThing.needPower ) {
      var reqPower = this.calcRequiredPower();
      var totPower = this.calcProducedPower();
      var pctPower = Math.round( 100 * totPower / reqPower );
      if ( pctPower > 100 ) pctPower = 100;
      txt += '<br>Receiving '+pctPower+'% of the required power.';
    }
    var pctInput = 100, goods = 0, food = 0;
    if ( gameThing.needGoods || gameThing.needGoodsOrFood ) {
      // That uses someother production
      var needed = ( gameThing.needGoods ? 'needGoods' : 'needGoodsOrFood' );
      var reqGoods = this.calcRequiredGoods();
      pctInput = Math.round( 100 * this.goodsStock / reqGoods );
      consumption.goods = gameThing[needed] * pctInput / 100;
      if ( pctInput < 3 ) pctInput = 3; // raw material can be collected
      if ( gameThing.needGoodsOrFood && pctInput<100 ) {
        var reqGoF = this.calcRequiredGoodsOrFood();
        var pop = this.countPopulation();
        var pctFood = Math.round( 100 * (this.foodStock-pop) / reqGoF );
        if ( pctFood < 0 ) pctFood = 0;
        pctFood = ( ((100-pctInput)<pctFood) ? 100-pctInput : pctFood);
        consumption.food = gameThing.needGoodsOrFood * pctFood / 100;
        if ( pctInput < 4 && pctFood < 3 ) pctFood = 3; // food can be collected
        pctInput += pctFood;
        if ( pctInput > 100 ) pctInput = 100;
      }
      var goodsOrFood = (gameThing.needGoodsOrFood ? 'goods or food' : 'goods');
      txt += '<br>Receiving '+pctInput+'% of the required '+goodsOrFood+'.';
    }
    if ( gameThing.goods ) {
      // That really produces some goods
      goods = gameThing.goods * (pctJobs*pctPower*pctInput) / (100*100*10);
      goods = Math.round(goods) / 10;
      var pct = Math.round( 100 * goods / gameThing.goods );
      txt += '<br>Produceing '+goods+' goods. ('+pct+'% of the potential)';
    }
    if ( gameThing.food ) {
      // That really produces some food
      food = gameThing.food * (pctJobs*pctPower*pctInput) / (100*100*10);
      food = Math.round(food) / 10;
      var pct = Math.round( 100 * food / gameThing.food );
      // Sum the half of complementary (because plants magically grows naturally)
      food += (100-pct) * gameThing.food / 200;
      pct = Math.round( 100 * food / gameThing.food );
      txt += '<br>Produceing '+food+' food. ('+pct+'% of the potential)';
    }
    if ( gameThing.maintenance ) {
      consumption.money = gameThing.maintenance;
      txt += '<br>Maintenance costs $'+gameThing.maintenance;
    }
    if ( gameThing.power ) txt += '<br>Power generation: '+gameThing.power+'⚡';
    if ( gameThing.pollution ) txt += '<br>Pollution: '+gameThing.pollution+'uP';
    this.cache[cacheIndex] = { report:txt, goods:goods, food:food, consumption:consumption };
  }
  return this.cache[cacheIndex];
};

/** @private */
function createInitialCity(gameObj, x, y) {
  gameObj.squares[x-1][y].add('road', true);
  gameObj.squares[x][y].add('road', true);
  gameObj.squares[x+1][y].add('road', true);
  gameObj.squares[x-1][y-1].add('farm', true);
  gameObj.squares[x][y-1].add('house', true).dwellers = 5;
  gameObj.squares[x+1][y-1].add('house', true).dwellers = 5;
  gameObj.squares[x-1][y-2].add('house', true).dwellers = 5;
  gameObj.squares[x][y-2].add('house', true).dwellers = 5;
  gameObj.squares[x+1][y-2].add('house', true).dwellers = 5;
  gameObj.squares[x-1][y+1].add('factory', true);
  gameObj.squares[x][y+1].add('shopping', true);
  gameObj.squares[x+1][y+1].add('powerCoal', true);
  /* Extra
  gameObj.squares[x+1][y-1].add('hospital', true);
  gameObj.squares[x+3][y+3].add('powerWind', true);
  gameObj.squares[x+4][y+4].add('silo', true);
  gameObj.squares[x+5][y+5].add('school', true);
  gameObj.squares[x+6][y+6].add('sport', true);
  */
}

/** @private */
function makeControls(gameObj) {
  var ctrlBox = makeEl('div', {
    class: 'ctrlBoxBorder',
    parent: gameObj.baseEl.parentNode,
    style: 'z-index:'+(gameObj.landSize+20)
  });
  ctrlBox = makeEl('div', {
    class: 'ctrlBox',
    parent: ctrlBox
  });
  var btId = 'opacity-bt-'+Math.random()+'-';
  //// Create Opacity Options for Game Elements ////////////////////////////////
  var btEv = 'onclick="this.parentNode.setObjOpct(this.value)"';
  var divObjOpct = makeEl('div', {
    class: 'opt gameObjOpacity',
    parent: ctrlBox,
    innerHTML: 'Objects opacity:<br>'+
               '<input type="radio" name="'+btId+'GOO" id="'+btId+'GOO-O"'+
               ' value="opaque" '+btEv+' checked>'+
               '<label for="'+btId+'GOO-O">Opaque</label>'+
               '<input type="radio" name="'+btId+'GOO" id="'+btId+'GOO-T"'+
               ' value="translucent" '+btEv+'>'+
               '<label for="'+btId+'GOO-T">Translucent</label>'+
               '<input type="radio" name="'+btId+'GOO" id="'+btId+'GOO-G"'+
               ' value="glass" '+btEv+'>'+
               '<label for="'+btId+'GOO-G">Glass</label>'
  });
  gameObj.baseEl.className += ' objOpacity-opaque';
  divObjOpct.setObjOpct = function(val){
    gameObj.baseEl.className = gameObj.baseEl.className.replace(
      /objOpacity-[^ ]+/, 'objOpacity-'+val
    );
  };
  //// Create Display Square Type Options //////////////////////////////////////
  var btEv = 'onclick="this.parentNode.setDisplayType(this.value)"';
  var divDisplayType = makeEl('div', {
    class: 'opt squareTypeView',
    parent: ctrlBox,
    innerHTML: 'Display square type:<br>'+
               '<input type="radio" name="'+btId+'DST" id="'+btId+'DST-N"'+
               ' value="none" '+btEv+'>'+
               '<label for="'+btId+'DST-N">None</label>'+
               '<input type="radio" name="'+btId+'DST" id="'+btId+'DST-C"'+
               ' value="color" '+btEv+' checked>'+
               '<label for="'+btId+'DST-C">Square color</label>'
  });
  gameObj.baseEl.className += ' displaySquareType-color';
  divDisplayType.setDisplayType = function(val){
    gameObj.baseEl.className = gameObj.baseEl.className.replace(
      /displaySquareType-[^ ]+/, 'displaySquareType-'+val
    );
  };
  //// Create Speed Options for the passing of time ////////////////////////////
  var btEv = 'onclick="this.parentNode.setDelay(this.value)"';
  var divMonthDelay = makeEl('div', {
    class: 'opt gameMonthDelay',
    parent: ctrlBox,
    innerHTML: 'Game speed:<br>'+
               '<input type="radio" name="'+btId+'GMD" id="'+btId+'GMD-1"'+
               ' value="30" '+btEv+'>'+
               '<label for="'+btId+'GMD-1">Turtle</label>'+
               '<input type="radio" name="'+btId+'GMD" id="'+btId+'GMD-2"'+
               ' value="10" '+btEv+' checked>'+
               '<label for="'+btId+'GMD-2">Lhama</label>'+
               '<input type="radio" name="'+btId+'GMD" id="'+btId+'GMD-3"'+
               ' value="3" '+btEv+'>'+
               '<label for="'+btId+'GMD-3">Puma</label>'
  });
  divMonthDelay.setDelay = function(val){
    gameObj.monthSecsDelay = parseInt(val);
    clearTimeout(gameObj.ticTimeout);
    gameObj.ticTimeout = setTimeout(
      function(){ gameObj.tic() },
      gameObj.monthSecsDelay*1000
    );
  };
  //// Create Show Info Box Option /////////////////////////////////////////////
  var btEv = 'onclick="this.parentNode.setShowInfoBox(this.checked)"';
  var divShowInfo = makeEl('div', {
    class: 'opt showInfoBox',
    parent: ctrlBox,
    innerHTML: '<input type="checkbox" id="'+btId+'SIB" '+btEv+' checked>'+
               '<label for="'+btId+'SIB">Show Info Box</label>'
  });
  divShowInfo.setShowInfoBox = function(show) {
    gameObj.infoBox.style.display = ( show ? 'block' : 'none' );
  };
  //// Create Taxes Dialog /////////////////////////////////////////////////////
  var divTaxes = makeEl('div', { class: 'bt openTaxes', parent: ctrlBox });
  var btTaxes = makeEl('button', { parent: divTaxes, innerHTML: 'Open taxes dialog' });
  btTaxes.onclick = function(){ openTaxesDialog(gameObj); }
  //// Create Sadness Report ///////////////////////////////////////////////////
  var divSad = makeEl('div', { class: 'bt openSadnessReport', parent: ctrlBox });
  var btSad = makeEl('button', { parent: divSad, innerHTML: 'Open (happy|sad)ness report' });
  btSad.onclick = function(){ gameObj.displaySadnessReport(); }
  //// Create Help Dialog //////////////////////////////////////////////////////
  var divHelp = makeEl('div', { class: 'bt openHelp', parent: ctrlBox });
  var btHelp = makeEl('button', { parent: divHelp, innerHTML: 'Open Help' });
  btHelp.onclick = function(){ gameObj.displayHelp(); }

  //////////////////////////////////////////////////////////////////////////////
  //// Building Options Box ////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////////////////
  var buildOptsBox = gameObj.buildOptsBox = makeEl('div', {
    class: 'buildOptsBoxBorder',
    parent: gameObj.baseEl.parentNode,
    style: 'z-index:'+(gameObj.landSize+20)
  });
  buildOptsBox = makeEl('div', {
    class: 'buildOptsBox',
    parent: buildOptsBox
  });
  for ( var toolName in gameThings ) {
    var tool = gameThings[toolName];
    if ( !tool.parent ) {
      var extraHint = '';
      if ( tool.cost ) extraHint += ' - Cost: $'+tool.cost;
      var bt = makeEl('div', {
        parent: buildOptsBox,
        title: tool.hint + extraHint,
        innerHTML: tool.fName
      });
      tool.menuItem = bt;
      bt.toolName = toolName;
      bt.onclick = function(){ gameObj.setTool(this.toolName) };
    }
  }

  //////////////////////////////////////////////////////////////////////////////
  //// Info Box ////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////////////////
  var infoBox = gameObj.infoBox = makeEl('div', {
    class: 'infoBox',
    parent: gameObj.baseEl.parentNode,
    style: 'z-index:'+(gameObj.landSize+15),
    innerHTML : 'No info'
  });
  gameObj.baseEl.onmouseover = function () {
    gameObj.infoBox.innerHTML = 'Nothing';
  }

  //////////////////////////////////////////////////////////////////////////////
  //// Status Box //////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////////////////
  var statusBox = gameObj.statusBox = makeEl('div', {
    class: 'status',
    parent: gameObj.baseEl.parentNode,
    style: 'z-index:'+(gameObj.landSize+25),
    innerHTML : 'No status'
  });
}

var gameThings = {
  pointer:  { fName:'Pointer', hint:'Select and see things' },
  clear:    { fName:'Clear',   hint:'Destroy and clear square definition',
              cost: 10 },
  tree:     { fName:'Trees',   hint:'Plant trees', pollution: -15,
              desc:'So green, so clean...', cost: 10 },
  road:     { fName:'Road',    hint:'Connect places and enable transportation',
              cost: 50, maintenance: 0.1, needPower: 1 },
  country:  { fName:'Countryside', hint:'For food production',
              cost: 5 },
  power:    { fName:'Power Plant', hint:'Select a kind of power generator' },
  resid:    { fName:'Residential Area', hint:'Where to leave',
              cost: 20 },
  house:    { fName:'House', hint:'Home, Sweet Home', parent: 'resid',
              pollution: 10, needPower: 1, lives:10, taxType:'individual' },
  commerce: { fName:'Commercial Area', hint:'Where to buy and trade',
              cost: 20 },
  shopping: { fName:'Shopping Center', hint:'Where to buy and trade',
              pollution: 10, needPower: 5, employs: 20, serves: 200,
              needGoodsOrFood: 100, parent: 'commerce', taxType:'commerce' },
  industry: { fName:'Industrial Area', hint:'Where to produce',
              cost: 20 },
  factory: { fName:'Factory', hint:'Nothing is lost or created, all is transformed',
              pollution: 100, needPower: 10, employs: 16, goods: 100,
              needGoodsOrFood: 100, parent: 'industry', taxType:'industry' },
  pubServ:  { fName:'Public Service', hint:'Organize, protect and help people' },

  farm:     { fName:'Farm',  hint:'For food production', parent: 'country',
              pollution: 1, needPower: 5, needGoods: 10, food: 50, employs: 2,
              taxType:'farming' },
  silo:     { fName:'Silo',  hint:'For food storage',    parent: 'country',
              needPower: 1, needGoods: 5, food: 50, employs: 2,
              taxType:'farming' },
              /* silo helps a farm, but the code will not explicit this */

  hospital: { fName:'Hospital',     hint:'Medical attention',  parent:'pubServ',
              cost: 1000, maintenance: 10, pollution: 50, needPower: 1,
              employs: 20, priorityJob: true, serves: 60, needGoods: 150 },
  school:   { fName:'School',       hint:'To grow up brains',  parent:'pubServ',
              cost: 500, maintenance: 10, pollution: 20, needPower: 1,
              employs: 15, priorityJob: true, serves: 100, needGoods: 100 },
  police:   { fName:'Police',       hint:'Protect the people', parent:'pubServ',
              cost: 1000, maintenance: 5, pollution: 30, needPower: 1,
              employs: 15, priorityJob: true, needGoods: 60 },
  sport:    { fName:'Sports Court', hint:'Heath and Fun',      parent:'pubServ',
              cost: 100, maintenance: 0.1, needPower: 1,
              employs: 1, serves: 100, needGoods: 1 },

  powerCoal: { fName:'Coal Power Plant',  hint:'Cheap pollution plant',
               parent:'power',
               cost: 1000, maintenance: 8, pollution:500, power: 100,
               employs: 15, priorityJob: true, needGoods: 100 },
  powerWind: { fName:'Wind Power Plant',  hint:'Sustainable power plant',
               parent:'power',
               cost: 3000, maintenance: 3, pollution:1, power: 50,
               employs: 5, priorityJob: true, needGoods: 10 },
};

for( type in gameThings ) {
  if ( gameThings[type].employs ) gameThings[type].info = function(square) {
    var resp = square.game.calcProductionFor(square);
    return resp.report;
  }
}

gameThings.house.info = function(square) {
  var txt = 'There is '+square.dwellers+' persons living here.'
  if (square.dwellers == gameThings.house.lives) txt += ' (Maximum!)'
  txt += '<br>'+ square.game.calcProductionFor(square).report;
  return txt;
};

gameThings.power.onSelect = function(gameObj) {
  var win = createWindow('Select a Power Plant');
  win.className += ' powerPlantSelect';
  for ( var buildingName in gameThings ) {
    var building = gameThings[buildingName];
    if ( building.parent == 'power' ) {
      var bt = makeEl('div', {
        parent: win, class: 'option',
        innerHTML: '<b>'+building.fName+'</b>'+
                   ' &nbsp; <small>($'+building.cost+')</small>'+
                   '<br>'+building.hint+
                   '<br>Generates '+building.power+'⚡'
      });
      bt.buildingName = buildingName;
      bt.onclick = function(){ gameObj.setTool(this.buildingName); win.close() };
    }
  }
};

gameThings.pubServ.onSelect = function(gameObj) {
  var win = createWindow('Select a Public Service');
  win.className += ' pubServSelect';
  for ( var buildingName in gameThings ) {
    var building = gameThings[buildingName];
    if ( building.parent == 'pubServ' ) {
      var bt = makeEl('div', {
        parent: win, class: 'option',
        innerHTML: '<b>'+building.fName+'</b>'+
                   ' &nbsp; <small>($'+building.cost+')</small>'+
                   '<br>'+building.hint+
                   '<br>Maintenance: $'+building.maintenance
      });
      bt.buildingName = buildingName;
      bt.onclick = function(){ gameObj.setTool(this.buildingName); win.close() };
    }
  }
}

function createWindow(title, closeCallback) {
  var blackBlock = makeEl('div', {
    class: 'blackBlock',
    parent: document.body,
    style: 'z-index:'+(9999)
  });
  var baseDiv = makeEl('div', { class: 'window', parent: blackBlock });
  makeEl('h2', { class: 'title', parent: baseDiv, innerHTML: title });
  var btClose = makeEl('div', { class: 'windowClose', parent: baseDiv, innerHTML:'✖' });
  baseDiv.close = function () {
    document.body.removeChild(blackBlock);
    if ( closeCallback ) closeCallback();
  }
  btClose.onclick = function(){ baseDiv.close() };
  return baseDiv;
}

function openTaxesDialog(gameObj) {
  var win = createWindow('Set Taxes');
  makeEl('div', { parent: win, innerHTML: 'Individual: <input size="3">' });
  makeEl('div', { parent: win, innerHTML: 'Commerce: <input size="3">' });
  makeEl('div', { parent: win, innerHTML: 'Industry: <input size="3">' });
  makeEl('div', { parent: win, innerHTML: 'Farming: <input size="3">' });
  var inputs = win.getElementsByTagName('input');
  var orig = {};
  inputs[0].value = orig.individual = gameObj.taxes.individual;
  inputs[1].value = orig.commerce   = gameObj.taxes.commerce;
  inputs[2].value = orig.industry   = gameObj.taxes.industry;
  inputs[3].value = orig.farming    = gameObj.taxes.farming;
  makeEl('button', { parent: win, innerHTML: 'Ok', style: 'font-weight:bold' })
    .onclick = function () {
      gameObj.taxes.individual = parseFloat(inputs[0].value);
      gameObj.taxes.commerce = parseFloat(inputs[1].value);
      gameObj.taxes.industry = parseFloat(inputs[2].value);
      gameObj.taxes.farming    = parseFloat(inputs[3].value);
      for( var type in gameObj.taxes ) {
        if ( isNaN(gameObj.taxes[type]) ) {
          gameObj.taxes[type] = orig[type];
          alert('The new '+type+' value was not a number. Restoring original.');
        }
      }
      win.close();
    };
  makeEl('button', { parent: win, innerHTML: 'Cancel' })
    .onclick = function () { win.close() };
}

var currentMenuItem = null;
SimLand.prototype.setTool = function(toolName) {
  if ( currentMenuItem ) currentMenuItem.className = '';
  var menuItem = gameThings[toolName].menuItem;
  if ( !menuItem ) menuItem = gameThings[gameThings[toolName].parent].menuItem;
  if ( menuItem ) {
    currentMenuItem = menuItem;
    currentMenuItem.className = 'selected';
  }
  this.currentTool = toolName;
  this.updateStatus();
  if ( gameThings[toolName].onSelect )
    gameThings[toolName].onSelect(this);
};

SimLand.prototype.updateStatus = function() {
  this.statusBox.innerHTML =
    'Active tool: <b>'+gameThings[this.currentTool].fName+'</b>'+
    ' &nbsp; &nbsp; '+
    'Money: <b>$'+round2str(this.money)+'</b>'+
    ' &nbsp; &nbsp; '+
    'Date: <b>'+this.date[0]+'/'+months[this.date[1]]+'</b>'+
    ' &nbsp; &nbsp; '+
    'Population: <b>'+this.countPopulation()+'</b>'+
    ' &nbsp; &nbsp; '+
    'Pollution: <b>'+this.calcPollution()+'</b>'+
    ' &nbsp; &nbsp; '+
    '<div id="happiness">Happiness: <b>'+this.calcHappiness(true)+'</b></div>';
};

SimLand.prototype.countPopulation = function() {
  if ( !this.cache.population ) {
    this.cache.population = 0;
    var game = this;
    this.getSquareByType('house').forEach(function(house) {
      game.cache.population += house.dwellers;
    });
  }
  return this.cache.population;
};

SimLand.prototype.calcPollution = function() {
  if ( !this.cache.pollution ) {
    var total = 0;
    for ( var x=0; x<this.landSize; x++ ) {
      for ( var y=0; y<this.landSize; y++ ) {
        var thing = gameThings[this.squares[x][y].type];
        if ( thing && thing.pollution ) total += thing.pollution ;
      }
    }
    this.cache.pollution = (total<0)? 0 : total;
  }
  return this.cache.pollution
};

SimLand.prototype.buildings = function() {
  var squareList = [];
  for ( var x=0; x<this.landSize; x++ ) {
    for ( var y=0; y<this.landSize; y++ ) {
      var type = this.squares[x][y].type;
      var gameThing = gameThings[type];
      if ( gameThing && type != 'tree' && type != 'road' ) {
        squareList.push(this.squares[x][y]);
      }
    }
  }
  return squareList;
}

SimLand.prototype.buildingsWhitoutRoad = function() {
  var total = 0;
  var game = this;
  this.buildings().forEach(function(building) {
    var hasRoad = false;
    [ [building.x-1,building.y], [building.x+1,building.y],
      [building.x,building.y-1], [building.x,building.y+1]
    ].forEach(function(pos) {
      var neighbor = null;
      if ( game.squares[pos[0]] ) neighbor = game.squares[pos[0]][pos[1]];
      if ( neighbor && neighbor.type == 'road' ) hasRoad = true;
    });
    if ( !hasRoad ) total++;
  });
  return total;
};

SimLand.prototype.calcHappiness = function(whithFace) {
  if ( !this.cache.happiness ) {
    this.sadnessReport = [];
    var pollutionSad = round2(this.calcPollution()/2000);
    this.sadnessReport.push([ 'pollution', pollutionSad ]);
    var transportSad = round2(this.buildingsWhitoutRoad()/(this.buildings().length*2));
    if ( this.buildings().length == 0 ) transportSad = 0;
    this.sadnessReport.push([ 'transportation', transportSad ]);
    var taxSum = 0;
    for ( var type in this.taxes ) { taxSum += this.taxes[type] }
    var taxSad = round2( (taxSum-10) / 20 );
    this.sadnessReport.push([ 'taxes', taxSad ]);
    var pop = this.countPopulation();
    var starveSad = round2( (1 - this.foodStock/pop) / 1.8 );
    if ( starveSad < 0 ) starveSad = 0;
    this.sadnessReport.push([ 'food production', starveSad ]);
    var goodsSad = (1 - this.goodsStock/pop) / 5;
    if ( pop < 150 ) goodsSad /= (150-pop);
    if ( goodsSad < 0 ) goodsSad = 0;
    goodsSad = round2(goodsSad);
    this.sadnessReport.push([ 'goods production', goodsSad ]);
    var houses = this.getSquareByType('house').length;
    var fullHouseSad = round2( ((pop/houses)-4) / 30 );
    if ( houses == 0 ) fullHouseSad = 0.9;
    this.sadnessReport.push([ 'residential area size', fullHouseSad ]);
    var hospitals = this.getSquareByType('hospital').length;
    var healthSad = ( 1 - (hospitals/(pop/200)) ) / 1.5;
    if ( pop < 300 ) healthSad /= (300-pop);
    healthSad = round2(healthSad);
    if ( healthSad < 0 ) healthSad = 0;
    this.sadnessReport.push([ 'health service', healthSad ]);
    var schools = this.getSquareByType('school').length;
    var educationSad = ( 1 - (schools/(pop/200)) ) / 2;
    if ( pop < 300 ) educationSad /= (300-pop);
    educationSad = round2(educationSad);
    if ( educationSad < 0 ) educationSad = 0;
    this.sadnessReport.push([ 'educational level', educationSad ]);
    var policeDeps = this.getSquareByType('police').length;
    var eduFactor = 200*educationSad;
    var criminalitySad = ( 1 - (policeDeps/(pop/(200-eduFactor))) ) / 1.5;
    if ( pop < 300 ) criminalitySad /= (300-pop);
    criminalitySad = round2(criminalitySad);
    if ( criminalitySad < 0 ) criminalitySad = 0;
    this.sadnessReport.push([ 'criminality level', criminalitySad ]);
    var sportCourts = this.getSquareByType('sport').length;
    var sportSad = ( 1 - (sportCourts/(pop/300)) ) / 2;
    if ( pop < 300 ) sportSad /= (300-pop);
    if ( sportSad < 0 ) sportSad = 0;
    sportSad = round2(sportSad);
    this.sadnessReport.push([ 'sports promotion', sportSad ]);
    var shoppings = this.getSquareByType('shopping');
    var shoppingPresence = shoppings.length/(pop/100);
    var game=this, workers=0, jobs=0;
    shoppings.forEach(function(shopping) {
      workers += game.calcWorkersFor(shopping);
      jobs += gameThings.shopping.employs;
    });
    var shoppingSad = ( 1 - (shoppingPresence/(jobs-workers)) ) / 3;
    if ( pop < 200 ) shoppingSad /= (200-pop);
    if ( shoppingSad < 0 ) shoppingSad = 0;
    shoppingSad = round2(shoppingSad);
    this.sadnessReport.push([ 'commerce options', shoppingSad ]);
    // TODO: powerSad
    //var happiness = round2( 1 - pollutionSad - starveSad - transportSad - ... );
    var happiness = 1;
    this.sadnessReport.forEach(function(sad){ happiness -= sad[1] });
    happiness = round2(happiness);
    if ( happiness < 0 ) happiness = 0;
    if ( happiness > 1 ) happiness = 1;
    console.log( this.date, 'happiness:'+happiness, this.sadnessReport.join(' | ') );
    this.cache.happiness = happiness;
  }
  var face = ['😫','😡','😠','😞','😐','😌','😊','😃','😄'];
  if ( whithFace ) {
    if ( whithFace == 'faceOnly' )
      return face[Math.round((face.length-1)*this.cache.happiness)];
    return this.cache.happiness +
           '<span>'+face[Math.round((face.length-1)*this.cache.happiness)]+'</span>';
  }
  else return this.cache.happiness;
};

SimLand.prototype.displaySadnessReport = function() {
  var report = this.sadnessReport.sort(function(a,b){ return b[1] - a[1] });
  var happiness = this.calcHappiness();
  var happinessFace = this.calcHappiness('faceOnly');
  clearTimeout(this.ticTimeout);
  var game = this;
  var title = (happiness<=0.5) ? 'Sadness Report' : 'Happiness Report';
  var win = createWindow(title, function() {
    if ( !game.gameover )
      game.ticTimeout = setTimeout(function(){ game.tic() }, game.monthSecsDelay*1000);
  });
  var txt = '<div class="date">'+ this.date[0]+'/'+months[this.date[1]] +'</div>';
  if ( happinessFace == '😐' ) txt += '<h2>The people is "poker faced"</h2>';
  else {
    if ( happiness > 0.5 ) {
      if ( happiness >= 0.8 ) txt += '<h2>The people is very happy!</h2>'
      else txt += '<h2>The people is happy</h2>'
    } else {
      if ( happiness <= 0.1 ) txt += '<h2>The people want to kill you!</h2>'
      else if ( happiness <= 0.2 ) txt += '<h2>The people is very sad!</h2>'
      else txt += '<h2>The people is sad</h2>'
    }
  }
  txt += '<div class="face">'+happinessFace+'</div><ul>';
  report.forEach(function(item) {
    if ( item[1] == 0 )
      txt += '<li><b>There is no problem with '+item[0]+'!</b> 😃</li>';
    else
      txt += '<li><b>'+item[0]+'</b> is unacceptable for' +
             ' <b>'+round2str(item[1]*100)+'%</b> of the people.</li>';
  });
  txt += '</ul>';
  makeEl('div', { class:'sadnessReport', innerHTML:txt, parent:win });
};

SimLand.prototype.sadGameOver = function() {
  this.setTool('pointer');
  this.gameover = true;
  this.buildOptsBox.style.display = 'none';
  var game = this;
  var win = createWindow('Game Over', function(){
    makeEl('div', { class:'gameover', innerHTML:'Game Over', parent:game.baseEl });
  });
  makeEl('div', {
    class: 'gameoverInfo',
    innerHTML: '<p>The people happiness become 0.</p>'+
               '<p>Your ass was kicked until your death.</p>',
    parent: win
  });
};

SimLand.prototype.displayHelp = function() {
  clearTimeout(this.ticTimeout);
  var game = this;
  var win = createWindow('Help', function() {
    if ( !game.gameover )
      game.ticTimeout = setTimeout(function(){ game.tic() }, game.monthSecsDelay*1000);
  });
  makeEl('div', { parent: win, innerHTML:
    '<h3>Building</h3>'+
    '<p>Any public service has a maintenance cost, for you to pay.</p>'+
    '<p>A house, a industry, or any other private initiative will be built '+
    'only if there are demand and manpower.</p>'
  });
};

SimLand.prototype.getSquareByType = function(type) {
  var selectedSquares = [];
  for ( var x=0; x<this.landSize; x++ ) {
    for ( var y=0; y<this.landSize; y++ ) {
      if ( this.squares[x][y].type == type )
        selectedSquares.push(this.squares[x][y]);
    }
  }
  return selectedSquares;
};

/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *\
 *                                 Square                                    *
\* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * */

/** @class Square */
function Square(game, x, y) {
  this.game = game;
  this.x = x;
  this.y = y;
  this.type = 'grass';
  var oddClass = ( ((x*game.landSize+y)%2)==0 ? 'odd' : 'even' );
  var squareV = this.visibleEl = makeEl('div', { // visible square
    class: 'square '+oddClass,
    parent: game.landEl,
    style: 'z-index:'+(game.landSize-y)
  });
  var squareE = this.eventEl = makeEl('div', { // event catcher square
    class: 'square',
    parent: game.eventCatcher,
    style: 'z-index:'+(game.landSize-y)
  });
  squareV.gameSquare = squareE.gameSquare = this;
  this.classNameOrig = squareV.className;
  squareV.className += ' grass';
  var gameSquare = this;
  squareE.onmouseover = function(ev){ gameSquare.onMouseOver(); ev.stopPropagation() };
  squareE.onmouseout = function(){ gameSquare.onMouseOut() };
  squareE.onclick = function(){ gameSquare.onClick() };
}

Square.prototype.getLat = function() {
  var lat = Math.floor( (this.x+1) - (this.game.landSize/2) );
  if ( lat == 0 ) {
    return '0.0&deg;';
  } else {
    if ( lat < 0 ) return Math.abs(lat/10)+'&deg; North';
    else return (lat/10)+'&deg; South';
  }
}

Square.prototype.getLon = function() {
  var lon = Math.floor( (this.y+1) - (this.game.landSize/2) );
  if ( lon == 0 ) {
    return '0.0&deg;';
  } else {
    if ( lon < 0 ) return Math.abs(lon/10)+'&deg; West';
    else return (lon/10)+'&deg; East';
  }
}

Square.prototype.onMouseOver = function() {
  this.visibleEl.className += ' hover';
  var fName = this.type;
  var description = 'Nothing to see here';
  var gameThing = gameThings[this.type];
  if ( gameThing ) {
    description = ( gameThing.desc ? gameThing.desc : gameThing.hint ); 
    fName = gameThing.fName;
    if ( gameThing.info )
      description += '<div>'+gameThing.info(this)+'</div>';
  }
  this.game.infoBox.innerHTML =
    '<div>Location: Lat '+this.getLat()+', Lon '+this.getLon()+'</div>'+
    '<div>Type: <b>'+fName+'</b></div>'+
    '<div>'+description+'</div>'+
    '<div>Global goods stock: '+this.game.goodsStock+'</div>'+
    '<div>Global food stock: '+this.game.foodStock+'</div>';
};

Square.prototype.onMouseOut = function() {
  this.visibleEl.className = this.classNameOrig +' '+ this.type;
};

Square.prototype.onClick = function() {
  if ( this.game.currentTool == 'clear' ) {
    this.clear();
    return;
  }
  if ( gameThings[this.game.currentTool].add ) {
    if ( this.type != 'grass' && this.type != 'tree' ) {
      var win = createWindow('Replace building?');
      var bName = gameThings[this.type].fName;
      makeEl('p', { parent:win,
        innerHTML:'This place has a "'+bName+'".<br>Do you want to destroy it?'
      });
      var me = this;
      makeEl('button', { parent:win, innerHTML:'Yes' })
        .onclick = function(){
          me.add(me.game.currentTool);
          win.close();
        };
      makeEl('button', { parent:win, innerHTML:'No' })
        .onclick = function(){ win.close() };
    } else {
      this.add(this.game.currentTool);
    }
  };
};

Square.prototype.clear = function(gameLoad) {
  if ( !gameLoad && this.type != 'grass' ) {
    if ( this.game.money < gameThings.clear.cost ) {
      alert('You can\'t pay for destruct and clear this area.'+
            '\n($'+gameThings.clear.cost+')');
      return;
    }
    this.game.money -= gameThings.clear.cost;
  }
  this.type = 'grass';
  this.visibleEl.className = this.classNameOrig +' '+ this.type;
  while( this.visibleEl.firstChild )
    this.visibleEl.removeChild( this.visibleEl.firstChild );
  var squares = this.game.squares;
  var x=this.x, y=this.y;
  if ( squares[x-1] && squares[x-1][y] && squares[x-1][y].type == 'road' )
    gameThings.road.update(squares[x-1][y]);
  if ( squares[x+1] && squares[x+1][y] && squares[x+1][y].type == 'road' )
    gameThings.road.update(squares[x+1][y]);
  if ( squares[x][y-1] && squares[x][y-1].type == 'road' )
    gameThings.road.update(squares[x][y-1]);
  if ( squares[x][y+1] && squares[x][y+1].type == 'road' )
    gameThings.road.update(squares[x][y+1]);
};

Square.prototype.add = function(type, gameLoad) {
  var gameThing = gameThings[type];
  if ( !gameLoad ) {
    if ( gameThing.cost ) {
      if ( this.game.money < gameThing.cost ) {
        alert('You can\'t pay for a '+gameThing.fName+'.\n($'+gameThing.cost+')');
        return;
      }
      this.game.money -= gameThing.cost;
      this.game.updateStatus();
    }
  }
  this.clear(gameLoad);
  gameThing.add(this);
  this.visibleEl.className = this.classNameOrig +' '+ this.type;
  return this;
};

gameThings.tree.add = function(square) {
  square.type = 'tree';
  var trees = makeEl('div',
    { class:'gameObj tree', parent:square.visibleEl }
  );
  makeEl('div', { class:'piece tree1', parent:trees });
  makeEl('div', { class:'piece tree2', parent:trees });
  makeEl('div', { class:'piece tree3', parent:trees });
};

gameThings.road.add = function(square) {
  square.type = 'road';
  var group = makeEl('div', { class:'gameObj', parent:square.visibleEl });
  makeEl('div', { class:'piece north', parent:group });
  makeEl('div', { class:'piece south', parent:group });
  makeEl('div', { class:'piece west',  parent:group });
  makeEl('div', { class:'piece east',  parent:group });
  var squares = square.game.squares;
  var x=square.x, y=square.y;
  this.update(square);
  if ( squares[x-1] && squares[x-1][y] && squares[x-1][y].type == 'road' )
    this.update(squares[x-1][y]);
  if ( squares[x+1] && squares[x+1][y] && squares[x+1][y].type == 'road' )
    this.update(squares[x+1][y]);
  if ( squares[x][y-1] && squares[x][y-1].type == 'road' )
    this.update(squares[x][y-1]);
  if ( squares[x][y+1] && squares[x][y+1].type == 'road' )
    this.update(squares[x][y+1]);
};

gameThings.road.update = function(square) {
  var squares = square.game.squares;
  var x=square.x, y=square.y;
  var className = 'gameObj';
  if ( squares[x-1] && squares[x-1][y] && squares[x-1][y].type == 'road' )
    className += ' connWest';
  if ( squares[x+1] && squares[x+1][y] && squares[x+1][y].type == 'road' )
    className += ' connEast';
  if ( squares[x][y-1] && squares[x][y-1].type == 'road' )
    className += ' connNorth';
  if ( squares[x][y+1] && squares[x][y+1].type == 'road' )
    className += ' connSouth';
  if ( className == 'gameObj' ) className = 'gameObj noConn';
  square.visibleEl.firstChild.className = className;
};

gameThings.resid.add = function(square) {
  square.type = 'resid';
}
gameThings.country.add = function(square) {
  square.type = 'country';
}
gameThings.industry.add = function(square) {
  square.type = 'industry';
}
gameThings.commerce.add = function(square) {
  square.type = 'commerce';
}

gameThings.farm.add = function(square) {
  square.type = 'farm';
  makeEl('div', { class:'gameObj piece fence1', parent:square.visibleEl });
  makeEl('div', { class:'gameObj piece fence2', parent:square.visibleEl });
  makeEl('div', { class:'gameObj piece fence3', parent:square.visibleEl });
  makeEl('div', { class:'gameObj piece fence4', parent:square.visibleEl });
};

gameThings.silo.add = function(square) {
  square.type = 'silo';
  makeEl('div', { class:'gameObj piece p1', parent:square.visibleEl,
                  innerHTML:'<div class="piece p2"></div>' });
};

addBaseBuilding = function(square, type) {
  square.type = type;
  var base = makeEl('div',
    { class:'gameObj building', parent:square.visibleEl }
  );
  return {
    base:  base,
    face1: makeEl('div', { class:'piece face1', parent:base }),
    face2: makeEl('div', { class:'piece face2', parent:base }),
    top:   makeEl('div', { class:'piece top',   parent:base })
  };
};

gameThings.factory.add = function(square) {
  addBaseBuilding(square, 'factory').top.innerHTML =
  '<div class="piece chimney"></div><div class="smoke">...</div>';
};
gameThings.house.add = function(square) {
  square.dwellers = 0;
  addBaseBuilding(square, 'house').top.innerHTML =
  '<div class="roof1"></div><div class="roof2"></div>';
};
gameThings.shopping.add = function(square) {
  addBaseBuilding(square, 'shopping').top.innerHTML='$';
};
gameThings.hospital.add = function(square) {
  addBaseBuilding(square, 'hospital').top.innerHTML='✚';
};
gameThings.police.add = function(square) {
  addBaseBuilding(square, 'police').top.innerHTML='★';
};
gameThings.school.add = function(square) {
  addBaseBuilding(square, 'school').top.innerHTML='<span>School</span>';
};
gameThings.powerCoal.add = function(square) {
  var building = addBaseBuilding(square, 'powerCoal')
  building.top.innerHTML = '<div class="piece chimney"></div><div class="smoke">...</div>';
  building.face1.innerHTML = '⌁';
  building.face2.innerHTML = '⌁';
};

gameThings.powerWind.add = function(square) {
  square.type = 'powerWind';
  var basis = makeEl('div', { class:'gameObj building piece basis', parent:square.visibleEl });
  var helixG = makeEl('div', { class:'helixGroup', parent:basis });
  makeEl('div', { class:'piece helix1', parent:helixG });
  makeEl('div', { class:'piece helix2', parent:helixG });
  makeEl('div', { class:'piece helix3', parent:helixG });
};

gameThings.sport.add = function(square) {
  square.type = 'sport';
  makeEl('div', { class:'gameObj piece', parent:square.visibleEl });
};

})(this);
