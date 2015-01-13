/**
* This file is part of MolView (http://molview.org)
* Copyright (c) 2014, 2015 Herman Bergwerf
*
* MolView is free software: you can redistribute it and/or modify
* it under the terms of the GNU Affero General Public License as published by
* the Free Software Foundation, either version 3 of the License, or
* (at your option) any later version.
*
* MolView is distributed in the hope that it will be useful,
* but WITHOUT ANY WARRANTY; without even the implied warranty of
* MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
* GNU Affero General Public License for more details.
*
* You should have received a copy of the GNU Affero General Public License
* along with MolView.  If not, see <http://www.gnu.org/licenses/>.
*/

/**
 * Calculated the angle for a new bond from this atom by calculating all
 * segments between existing bonds and dividing the largest segment by two
 *
 * @param  {Integer} n Optional number of new segments the larges segment
 *                     should be divided in
 * @return {Float} (if n === undefined) or {Array}
 */
MPAtom.prototype.calculateNewBondAngle = function(n)
{
	if(this.bonds.length == 0) return 0;

	//create bond map with bond angles
	var bondMap = [];
	for(var i = 0; i < this.bonds.length; i++)
	{
		bondMap.push({
			i: this.bonds[i],
			a: this.mp.mol.bonds[this.bonds[i]].getAngle(this)
		});
	}

	//sort bondMap in ascending bond angle order
	bondMap.sort(function(a, b)
	{
		return a.a - b.a;
	});

	//convert bondMap to sections
	var sections = [];
	for(var i = 0; i < bondMap.length; i++)
	{
		var from = i == 0 ? bondMap.length - 1 : i - 1;
		var to = i;
		sections.push({
			from: from,
			to: to,
			a: angleBetween(bondMap[from].a, bondMap[to].a)
		});
	}

	//find larges section
	var largest = 0;//skip i = 0 since it is already used for the first comparison
	for(var i = 1; i < sections.length; i++)
	{
		if(sections[i].a > sections[largest].a)
		{
			largest = i;
		}
	}

	//find new bond angle
	if(n === undefined)
	{
		return bondMap[sections[largest].from].a + sections[largest].a / 2;
	}
	else
	{
		var p = n !== undefined ? n + 1 : 2;
		var a = sections[largest].a / (n + 1);
		var ret = [];
		for(var i = 1; i <= n; i++)
		{
			ret.push(bondMap[sections[largest].from].a + i * a);
		}
		return ret;
	}
}

/**
 * Returns MPAtom area as a line with a surrounding area defined by a radius
 * (area border: d(P, line) = r) and the label drawing box outline
 *
 * @return {Object} Area line or point:
 *                  { from: { x: 0, y: 0 }} or
 *                  { from: { x: 0, y: 0 }, to: { x: 0, y: 0 } }
 *                  Label drawing box:
 *                  { offsetLeft: 0, offsetTop: 0 }
 */
MPAtom.prototype.calculateCenterLine = function()
{
	if(this.mp.s.atom.miniLabel)
	{
		return {
			text: { offsetLeft: 0, offsetTop: 0 },
			area: { point: this.center }
		};
	}

	var scale = this.mp.s.atom.scale;
	var text = {};

	this.mp.setFont("element");
	text.labelWidth = this.isVisible() ? this.mp.ctx.measureText("" + this.element).width : 0;
	var w = text.labelWidth;

	if(this.isotope > 0)
	{
		this.mp.setFont("isotope");
		text.isotopeHeight = this.mp.s.fonts.isotope.fontSize * scale;
		text.isotopeWidth = this.mp.ctx.measureText("" + this.isotope).width +
				this.mp.s.atom.isotope.padding * scale;//padding before element label
		w += text.isotopeWidth;
	}

	if(this.charge != 0)
	{
		this.mp.setFont("charge");
		text.chargeHeight = this.mp.s.fonts.charge.fontSize * scale;
		text.chargeWidth = this.mp.ctx.measureText("" + this.getChargeLabel()).width;

		//add padding between element and charge
		text.labelWidth += this.mp.s.atom.charge.padding * scale;

		//add chargeWidth to total width + additional label padding
		w += text.chargeWidth + this.mp.s.atom.charge.padding * scale;
	}

	var h = this.mp.s.fonts.element.fontSize * scale;
	var halfw = w / 2;
	text.offsetLeft = -halfw;
	text.offsetTop = h / 2;

	if(w > this.mp.s.atom.circleClamp)
	{
		var pad = this.mp.s.atom.radius * scale - h / 2;
		return {
			text: text,
			area: {
				half: halfw + pad,
				left: { x: this.center.x - halfw + pad, y: this.center.y },
				right: { x: this.center.x + halfw - pad, y: this.center.y }
			}
		};
	}
	else
	{
		return {
			text: text,
			area: { point: this.center }
		};
	}
}

/**
 * _calculateBondVertices wrapper with origin atom index as argument
 * @param  {Integer} from Origin atom index
 * @param  {Array}   ends
 * @return {Array}        Calculated ends
 */
MPAtom.prototype.calculateBondVertices = function(from, ends)
{
	var begin = this.mp.mol.atoms[from].center;
	return this._calculateBondVertices(begin, ends);
}

/**
 * Calculate bond attach vertices for a bond from $begin to $this.center
 * @param  {MPPoint} begin Origin point
 * @param  {Array}   ends  Requested end vertices perpendicular to the end of line $begin$this.center
 *                         (values are in counter clockwise direction)
 * @return {Array}         Calculated ends
 */
MPAtom.prototype._calculateBondVertices = function(begin, ends)
{
	//TODO: implement bonding site for collapsed groups (only left or right)
	this.validate();

	if(begin.x == this.center.x
			|| this.hidden)//provide fallback
	{
		var ret = [];
		var r = this.isVisible() ? this.mp.s.atom.radius : 0;
		var below = begin.y < this.center.y;
		for(var i = 0; i < ends.length; i++)
		{
			ret.push(MPPFO({
				x: this.center.x + (below ? ends[i] : -ends[i]),//counter clockwise
				y: this.center.y + (below ? -r : r)
			}));
		}
		return ret;
	}
	else if(begin.y == this.center.y)
	{
		var ret = [];
		var r = this.isVisible() ? this.line.area.half  || this.mp.s.atom.radius : 0;
		var right = begin.x > this.center.x;
		for(var i = 0; i < ends.length; i++)
		{
			ret.push(MPPFO({
				x: this.center.x + (right ? r : -r),
				y: this.center.y + (right ? ends[i] : -ends[i])//counter clockwise
			}));
		}
		return ret;
	}
	else if(!this.isVisible())
	{
		if(ends.length == 1 && ends[0] == 0)
		{
			return [{ x: this.center.x, y: this.center.y }];
		}
		else
		{
			var dx = begin.x - this.center.x;
			var dy = begin.y - this.center.y;
			var d = Math.sqrt(dx * dx + dy * dy);
			var A = dx / d;//dx = a = A * c = d
			var B = dy / d;//dy = b = B * c = d

			var ret = [];
			for(var i = 0; i < ends.length; i++)
			{
				ret.push(MPPFO({
					x: -B * ends[i],
					y: A * ends[i]
				}));
			}

			//translate to real center
			for(var i = 0; i < ret.length; i++)
			{
				ret[i].x += this.center.x;
				ret[i].y += this.center.y;
			}

			return ret;
		}
	}
	else
	{
		var ac = this.center;//aligin center
		var bc = this.center;//bond center
		var tdir = 1;//tangent direction

		if(this.line.area.left && begin.x < this.center.x)
		{
			ac = this.line.area.left;
		}
		else if(this.line.area.right && begin.x > this.center.x)
		{
			ac = this.line.area.right;
			tdir = -1;
		}

		var acbc = Math.abs(ac.x - bc.x);//distance between align center and bond center
		var r = this.mp.s.atom.radius;
		var dx = begin.x - bc.x;
		var dy = begin.y - bc.y;
		var d = Math.sqrt(dx * dx + dy * dy);
		var A = dx / d;//dx = a = A * c = d
		var B = dy / d;//dy = b = B * c = d

		//alignCenter tangent crossing with bond line
		var td = (tdir > 0 ? r - A * acbc : r + A * acbc);
		var tx = A * td;
		var ty = B * td;

		var x = bc.x + tx;
		var y = bc.y + ty;

		var ret = [];
		for(var i = 0; i < ends.length; i++)
		{
			ret.push(MPPFO({
				x: x - B * ends[i],
				y: y + A * ends[i]
			}));
		}
		return ret;
	}
}

/**
 * Refines bond display for a more sophisticated skeletal display
 */
MPAtom.prototype.refineBonds = function()
{
	//create bond map with bond angles
	var bondMap = [];
	for(var i = 0; i < this.bonds.length; i++)
	{
		bondMap.push({
			i: this.bonds[i],
			a: this.mp.mol.bonds[this.bonds[i]].getAngle(this)
		});
	}

	//convert bondMap to sections
	var sections = [];
	for(var i = 0; i < bondMap.length; i++)
	{
		var from = i == 0 ? bondMap.length - 1 : i - 1;
		var to = i;
		sections.push({
			from: from,
			to: to,
			a: angleBetween(bondMap[from].a, bondMap[to].a)
		});
	}

	//loop trough sections
	for(var i = 0; i < sections.length; i++)
	{
		//calculate if section should be refined

		//refine section
	}
}
