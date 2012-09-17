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
};

Square.prototype.getLon = function() {
  var lon = Math.floor( (this.y+1) - (this.game.landSize/2) );
  if ( lon == 0 ) {
    return '0.0&deg;';
  } else {
    if ( lon < 0 ) return Math.abs(lon/10)+'&deg; West';
    else return (lon/10)+'&deg; East';
  }
};

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
      return false;
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
  return true;
};

Square.prototype.add = function(type, gameLoad) {
  var gameThing = gameThings[type];
  if ( !this.clear(gameLoad) ) return this;
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
  gameThing.add(this);
  this.visibleEl.className = this.classNameOrig +' '+ this.type;
  return this;
};
