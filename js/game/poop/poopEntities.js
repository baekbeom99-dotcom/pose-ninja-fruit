/**
 * Poop Dodge Mode Entities
 * Head-X controlled character (with 033-038 sprites & slippery ice physics),
 * varied falling poops (Normal, Giant, Fast, Elephant, Rainbow), and bonus items.
 */

export const POOP_SPRITE_IDS = ['033', '034', '035', '036', '037', '038'];

export const DropType = {
  POOP_NORMAL: 'POOP_NORMAL',
  POOP_GIANT: 'POOP_GIANT',
  POOP_FAST: 'POOP_FAST',
  POOP_ELEPHANT: 'POOP_ELEPHANT',
  POOP_RAINBOW: 'POOP_RAINBOW',
  TOILET_PAPER: 'TOILET_PAPER',
  UMBRELLA: 'UMBRELLA',
  HEART: 'HEART'
};

export function isHazardType(type) {
  return (
    type === DropType.POOP_NORMAL ||
    type === DropType.POOP_GIANT ||
    type === DropType.POOP_FAST ||
    type === DropType.POOP_ELEPHANT
  );
}

export class FallingDrop {
  constructor(x, y, type = DropType.POOP_NORMAL, level = 1, vx = 0) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.type = type;
    this.isHazardous = isHazardType(type);
    this.isDead = false;
    this.wobblePhase = Math.random() * Math.PI * 2;
    this.rotation = 0;

    if (type === DropType.POOP_ELEPHANT) {
      // Huge mega elephant poop (unlocked past Lv5)
      this.radius = 68;
      this.vy = 160 + level * 14;
      this.gravity = 220;
      this.points = 5;
      this.warningTimer = 0.75;
    } else if (type === DropType.POOP_GIANT) {
      this.radius = 44; // +30% (was 34)
      this.vy = 185 + level * 22;
      this.gravity = 240;
      this.points = 3;
      this.warningTimer = 0.65;
    } else if (type === DropType.POOP_FAST) {
      this.radius = 26; // +30% (was 20)
      this.vy = 320 + level * 32;
      this.gravity = 320;
      this.points = 2;
      this.warningTimer = 0;
    } else if (type === DropType.POOP_RAINBOW) {
      // Collectible Rainbow Poop awarding bonus points
      this.radius = 31;
      this.vy = 195 + level * 12;
      this.gravity = 65;
      this.points = 25;
      this.warningTimer = 0;
    } else if (type === DropType.TOILET_PAPER) {
      this.radius = 29; // +30% (was 22)
      this.vy = 200 + level * 12;
      this.gravity = 60;
      this.points = 15;
      this.warningTimer = 0;
    } else if (type === DropType.UMBRELLA || type === DropType.HEART) {
      this.radius = 29; // +30% (was 22)
      this.vy = 190 + level * 10;
      this.gravity = 50;
      this.points = 5;
      this.warningTimer = 0;
    } else {
      // POOP_NORMAL
      this.radius = 29; // +30% (was 22)
      this.vy = 220 + level * 26 + Math.random() * 65;
      this.gravity = 260;
      this.points = 1;
      this.warningTimer = 0;
    }
  }

  update(dt, canvasWidth = 1280) {
    this.wobblePhase += dt * 7;

    if (this.warningTimer > 0) {
      this.warningTimer = Math.max(0, this.warningTimer - dt);
      return;
    }

    this.vy += this.gravity * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    if (this.vx !== 0) {
      this.rotation = Math.max(-0.4, Math.min(0.4, this.vx / 450));
      if (this.x < this.radius && this.vx < 0) {
        this.x = this.radius;
        this.vx *= -1;
      } else if (this.x > canvasWidth - this.radius && this.vx > 0) {
        this.x = canvasWidth - this.radius;
        this.vx *= -1;
      }
    }
  }
}

export class PoopPlayer {
  constructor(startX = 640, groundY = 660) {
    this.x = startX;
    this.targetX = startX;
    this.y = groundY;
    this.radius = 34; // +30% (was 26)
    this.vx = 0;
    this.tilt = 0;
    this.smoothFactor = 0.2;

    this.invulnerableTimer = 0;
    this.shieldTimer = 0;
    this.isOnIce = false;
    this.expression = 'NORMAL'; // 'NORMAL', 'HAPPY', 'OUCH'
    this.expressionTimer = 0;
    this.runAnim = 0;
    this.walkFrame = 0;
  }

  reset(startX, groundY) {
    this.x = startX;
    this.targetX = startX;
    this.y = groundY;
    this.vx = 0;
    this.tilt = 0;
    this.invulnerableTimer = 0;
    this.shieldTimer = 0;
    this.isOnIce = false;
    this.expression = 'NORMAL';
    this.expressionTimer = 0;
    this.runAnim = 0;
    this.walkFrame = 0;
  }

  setExpression(expr, duration = 0.75) {
    this.expression = expr;
    this.expressionTimer = duration;
  }

  update(dt, targetX, canvasWidth = 1280, groundY = 660, onIce = false) {
    const minX = this.radius + 14;
    const maxX = Math.max(minX, canvasWidth - this.radius - 14);
    this.y = groundY;
    this.isOnIce = !!onIce;

    if (targetX !== undefined && targetX !== null && !Number.isNaN(targetX)) {
      this.targetX = Math.max(minX, Math.min(maxX, targetX));
    }

    const safeDt = Math.max(0.001, Math.min(dt || 0.016, 0.1));
    const prevX = this.x;

    if (this.isOnIce) {
      // Slippery ice momentum: sluggish traction causes overshooting & sliding!
      const desiredDiff = this.targetX - this.x;
      const iceAccel = desiredDiff * 16;
      const damp = Math.pow(0.28, safeDt); // preserves sliding inertia across frames
      this.vx = this.vx * damp + iceAccel * safeDt * 3.8;
      this.vx = Math.max(-920, Math.min(920, this.vx));
      this.x += this.vx * safeDt;
      if (this.x < minX) {
        this.x = minX;
        this.vx *= -0.35;
      } else if (this.x > maxX) {
        this.x = maxX;
        this.vx *= -0.35;
      }
    } else {
      const blend = 1 - Math.exp(-12 * safeDt);
      this.x += (this.targetX - this.x) * blend;
      this.x = Math.max(minX, Math.min(maxX, this.x));
      this.vx = (this.x - prevX) / safeDt;
    }

    this.tilt = Math.max(-0.28, Math.min(0.28, this.vx / 950));
    const moved = Math.abs(this.x - prevX);
    this.runAnim += moved * 0.22;
    this.walkFrame = (this.walkFrame + moved * 0.055) % 4;

    if (this.invulnerableTimer > 0) {
      this.invulnerableTimer = Math.max(0, this.invulnerableTimer - dt);
    }
    if (this.shieldTimer > 0) {
      this.shieldTimer = Math.max(0, this.shieldTimer - dt);
    }
    if (this.expressionTimer > 0) {
      this.expressionTimer = Math.max(0, this.expressionTimer - dt);
      if (this.expressionTimer <= 0) {
        this.expression = 'NORMAL';
      }
    }
  }

  collidesWith(drop) {
    const dx = this.x - drop.x;
    const dy = (this.y - 8) - drop.y;
    const effectiveRadius = (this.shieldTimer > 0 ? this.radius + 16 : this.radius) + drop.radius * 0.85;
    return dx * dx + dy * dy <= effectiveRadius * effectiveRadius;
  }
}
