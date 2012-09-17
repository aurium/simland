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

function arrayRand(array) {
  return array.sort(function(){ return Math.random()-0.5 });
}

function round2(number) {
  return Math.round(number*100)/100;
}

function round2str(number) {
  // Force two decimals only:
  return round2(number).toString().replace(/(\...).*/,'$1');
}

var months = 'Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split(' ');

