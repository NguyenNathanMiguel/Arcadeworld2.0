class SkeeBallGame {
    constructor() {
        this.gameKey = 'game13';
        this.score = 0;
        this.isGameOver = false;

        this.timer = new Timer(60, () => { this.isGameOver = true; });

        this.ballsLeft = 9;
        this.maxBalls = 9;
        this.ballRadius = 16;

        this.gravity = 1400; // px/s^2

        // --- RAMP GEOMETRY ---
        // Straight section: right (960,622) → curve start (580,580)
        this.rampRightX      = 960;
        this.rampRightY      = 622;
        this.rampCurveStartX = 580;
        this.rampCurveStartY = 580;
        // Ski-jump quadratic bezier: P0=(580,580) C=(520,580) P1=(460,490)
        this.rampControlX = 520;
        this.rampControlY = 580;
        this.rampLipX     = 460;
        this.rampLipY     = 490;
        this.rampBottomY  = 660;

        // Straight slope: dy/dx (positive = rises leftward)
        // slopeM = (580-622)/(580-960) = -42/-380 ≈ 0.1105
        this.slopeM = (this.rampCurveStartY - this.rampRightY) /
                      (this.rampCurveStartX - this.rampRightX);
        this.slopeB = this.rampRightY - this.slopeM * this.rampRightX;

        // Stopper bar
        this.stopperX      = 960;
        this.stopperTop    = 540;
        this.stopperBottom = 660;

        // Ball start position sitting on straight ramp surface
        this.startPos = new Vector(
            880,
            this.slopeM * 880 + this.slopeB - this.ballRadius
        );

        // Balls pool
        this.balls = [];
        for (let i = 0; i < this.maxBalls; i++) {
            this.balls.push({
                pos:        new Vector(this.startPos.x, this.startPos.y),
                vel:        new Vector(0, 0),
                radius:     this.ballRadius,
                state:      'waiting',
                scored:     false,
                scorePts:   0,
                _resetTimer: null
            });
        }
        this.balls[0].state = 'ready';

        // --- TARGET HOLES ---
        this.spineTopX    = 70;
        this.spineTopY    = 110;
        this.spineBottomX = 170;
        this.spineBottomY = 460;
        this.spineWidth   = 18;

        // bottomEndX of each hole = topEndX of the hole below it (flush step edges)
        this.holes = [
            { pts: 100, color: '#ffcc00', fillColor: 'rgba(255,204,0,0.06)',   topY: 120, bottomY: 158, topEndX: 130, bottomEndX: 165 },
            { pts: 50,  color: '#ff007f', fillColor: 'rgba(255,0,127,0.06)',   topY: 174, bottomY: 218, topEndX: 165, bottomEndX: 200 },
            { pts: 30,  color: '#00ffff', fillColor: 'rgba(0,255,255,0.06)',   topY: 234, bottomY: 286, topEndX: 200, bottomEndX: 235 },
            { pts: 20,  color: '#00ff66', fillColor: 'rgba(0,255,102,0.06)',   topY: 302, bottomY: 362, topEndX: 235, bottomEndX: 270 },
            { pts: 10,  color: '#ff8800', fillColor: 'rgba(255,136,0,0.06)',   topY: 378, bottomY: 448, topEndX: 270, bottomEndX: 370 }
        ];
        this.initHoles();

        // Drag
        this.draggingBall = null;
        this.dragStart    = new Vector(0, 0);

        // Floating score popups
        this.floatTexts = [];
    }

    // --- RAMP SURFACE Y at position x ---
    // Straight section: linear
    // Curved section: quadratic bezier (see derivation in comments)
    // Bezier x(t) = 580 - 120t  →  t = (580-x)/120
    // Bezier y(t) = 580 - 90t²
    getSurfaceY(x) {
        if (x >= this.rampCurveStartX) {
            return this.slopeM * x + this.slopeB;
        } else if (x >= this.rampLipX) {
            const t = (this.rampCurveStartX - x) / (this.rampCurveStartX - this.rampLipX); // 0→1
            return 580 - 90 * t * t;
        }
        return null;
    }

    // --- SLOPE (dy/dx, positive = rising leftward) at x ---
    // Straight: constant slopeM ≈ 0.11
    // Curve: dy/dt = -180t, dx/dt = -120 → dy/dx = 1.5t  (0 to 1.5)
    getSlopeAt(x) {
        if (x >= this.rampCurveStartX) {
            return this.slopeM;
        } else {
            const t = (this.rampCurveStartX - x) / (this.rampCurveStartX - this.rampLipX);
            return 1.5 * t;
        }
    }

    initHoles() {
        const getSpineX = (y) => {
            const ratio = (y - this.spineTopY) / (this.spineBottomY - this.spineTopY);
            return this.spineTopX + (this.spineBottomX - this.spineTopX) * ratio;
        };
        for (let h of this.holes) {
            h.topStartX    = getSpineX(h.topY);
            h.bottomStartX = getSpineX(h.bottomY);
        }
    }

    // --- PHYSICAL BAR COLLISION (acts like a solid wall with bounce and friction) ---
    collideBar(b, x1, y0, x2) {
        const cx = Math.max(x1, Math.min(x2, b.pos.x));
        const cy = y0;
        const dx = b.pos.x - cx;
        const dy = b.pos.y - cy;
        const distSq = dx * dx + dy * dy;
        const r = b.radius;

        if (distSq < r * r) {
            const dist = Math.sqrt(distSq);
            let nx = 0, ny = -1;
            if (dist > 0.001) {
                nx = dx / dist;
                ny = dy / dist;
            }
            const pen = r - dist;
            b.pos.x += nx * pen;
            b.pos.y += ny * pen;

            const vDot = b.vel.x * nx + b.vel.y * ny;
            if (vDot < 0) {
                const restitution = 0.35;
                b.vel.x -= (1 + restitution) * vDot * nx;
                b.vel.y -= (1 + restitution) * vDot * ny;

                // If ball is on top of the bar (floor)
                if (ny < -0.7) {
                    b.vel.x *= 0.97; // rolling friction
                    if (Math.abs(b.vel.y) < 45) b.vel.y = 0; // settle on surface
                }
            }
            return true;
        }
        return false;
    }

    spawnNextBall() {
        for (let b of this.balls) {
            if (b.state === 'waiting') {
                b.state = 'ready';
                b.pos   = new Vector(this.startPos.x, this.startPos.y);
                b.vel   = new Vector(0, 0);
                b.scored = false;
                b._resetTimer = null;
                break;
            }
        }
    }

    init() {
        this.score = 0;
        this.isGameOver = false;
        this.ballsLeft  = this.maxBalls;
        this.balls.forEach((b, i) => {
            b.pos = new Vector(this.startPos.x, this.startPos.y);
            b.vel = new Vector(0, 0);
            b.state  = (i === 0) ? 'ready' : 'waiting';
            b.scored = false;
            b._resetTimer = null;
        });
        this.draggingBall = null;
        this.floatTexts   = [];
        this.timer.start();
    }

    update(dt, input) {
        if (this.isGameOver) return;
        this.timer.update(dt);

        // --- DRAG INPUT ---
        if (input.mouse.justPressed && !this.draggingBall) {
            const mx = input.mouse.x, my = input.mouse.y;
            for (let b of this.balls) {
                if (b.state === 'ready') {
                    if (Math.hypot(mx - b.pos.x, my - b.pos.y) < b.radius + 30) {
                        this.draggingBall = b;
                        this.dragStart    = new Vector(mx, my);
                        break;
                    }
                }
            }
        }

        if (this.draggingBall && input.mouse.justReleased) {
            const mx = input.mouse.x, my = input.mouse.y;
            const pullDist = Math.hypot(this.dragStart.x - mx, this.dragStart.y - my);

            if (pullDist > 10) {
                // Speed proportional to pull, max 1600 px/s
                const speed = Math.min(pullDist * 6.5, 1600);
                // Direction: left along straight slope surface
                const tanLen = Math.sqrt(1 + this.slopeM * this.slopeM);
                this.draggingBall.vel.x = (-1 / tanLen) * speed;
                this.draggingBall.vel.y = (-this.slopeM / tanLen) * speed; // upward
                this.draggingBall.state = 'rolling';
                this.ballsLeft--;
            }
            this.draggingBall = null;
        }

        // --- BALL PHYSICS ---
        for (let b of this.balls) {
            if (b.state === 'rolling') {
                const slope = this.getSlopeAt(b.pos.x);
                const angle = Math.atan(Math.abs(slope));

                // Decelerate: gravity component up slope + small friction
                const decel = this.gravity * Math.sin(angle) + 20;
                const speed = Math.hypot(b.vel.x, b.vel.y);
                const newSpeed = Math.max(0, speed - decel * dt);

                if (newSpeed === 0) {
                    // Ball stalled → reset after delay
                    b.state = 'dead';
                } else {
                    // Velocity along surface tangent pointing left-upward
                    const tanLen = Math.sqrt(1 + slope * slope);
                    b.vel.x = (-1 / tanLen) * newSpeed;
                    b.vel.y = (-slope / tanLen) * newSpeed; // negative = upward

                    b.pos.x += b.vel.x * dt;

                    // Snap ball to ramp surface (no teleport)
                    const surfY = this.getSurfaceY(b.pos.x);
                    if (surfY !== null) {
                        b.pos.y = surfY - b.radius;
                    }

                    // Reached the lip → launch into air with lip tangent direction
                    if (b.pos.x <= this.rampLipX) {
                        b.pos.x = this.rampLipX;
                        b.pos.y = this.rampLipY - b.radius;
                        // Lip tangent: slope=1.5 (steepest point of curve)
                        const lipSlope = 1.5;
                        const lipTanLen = Math.sqrt(1 + lipSlope * lipSlope);
                        b.vel.x = (-1 / lipTanLen) * newSpeed;
                        b.vel.y = (-lipSlope / lipTanLen) * newSpeed; // strong upward component
                        b.state = 'airborne';
                    }
                }

            } else if (b.state === 'airborne') {
                // --- 1. Projectile motion ---
                b.vel.y += this.gravity * dt;
                b.pos.x += b.vel.x * dt;
                b.pos.y += b.vel.y * dt;

                // --- 2. Bar collisions (horizontal bars act as solid walls) ---
                for (let h of this.holes) {
                    this.collideBar(b, h.topStartX, h.topY, h.topEndX);
                    this.collideBar(b, h.bottomStartX, h.bottomY, h.bottomEndX);

                    // Once inside the hole cavity, give a gentle inward roll towards the cyan spine
                    if (b.pos.x >= h.bottomStartX && b.pos.x <= h.bottomEndX &&
                        b.pos.y >= h.topY && b.pos.y <= h.bottomY) {
                        if (b.vel.x > -150) {
                            b.vel.x -= 200 * dt; // gentle inward slope pull
                        }
                    }
                }

                // Roof bumper collision
                this.collideBar(b, this.spineTopX - 10, this.spineTopY, this.spineTopX + 60);

                // Ramp surface collision while falling from above — ball went back, treat as dead
                if (b.pos.x >= this.rampCurveStartX && b.pos.x <= this.rampRightX) {
                    const surfY = this.slopeM * b.pos.x + this.slopeB;
                    if (b.pos.y + b.radius >= surfY) {
                        // Ball returned to ramp surface → reset immediately
                        b.state = 'dead';
                    }
                }

                // --- 3. Spine wall (thành xanh dương): ONLY scores when touching the cyan spine! ---
                const spineRatio = (b.pos.y - this.spineTopY) / (this.spineBottomY - this.spineTopY);
                if (b.pos.y >= this.spineTopY - 15 && b.pos.y <= this.spineBottomY + 25) {
                    const cRatio = Math.max(0, Math.min(1, spineRatio));
                    const spineFaceX = this.spineTopX + (this.spineBottomX - this.spineTopX) * cRatio;

                    if (b.pos.x - b.radius <= spineFaceX) {
                        b.pos.x = spineFaceX + b.radius;

                        // Check which hole it entered
                        let hitHole = null;
                        for (let h of this.holes) {
                            if (b.pos.y >= h.topY && b.pos.y <= h.bottomY) {
                                hitHole = h;
                                break;
                            }
                        }

                        if (hitHole) {
                            // ✅ Hit cyan spine wall inside a hole -> SCORE!
                            b.scored   = true;
                            b.scorePts = hitHole.pts;
                            b.state    = 'scored';
                            this.score += hitHole.pts;
                            b.vel.x = 0;
                            b.vel.y = 0;
                            this.floatTexts.push({
                                x: spineFaceX + 45,
                                y: b.pos.y,
                                text: `+${hitHole.pts}`,
                                color: hitHole.color,
                                life: 1.2,
                                maxLife: 1.2
                            });
                        } else {
                            // Hit cyan spine outside any hole -> bounce off
                            if (b.vel.x < 0) {
                                b.vel.x = Math.abs(b.vel.x) * 0.45;
                                b.vel.y *= 0.7;
                            }
                        }
                    }
                }

                // --- 4. Out of bounds ---
                if (b.pos.y > 800 || b.pos.x < -30) {
                    b.state = 'dead';
                }

            } else if (b.state === 'scored' || b.state === 'dead') {
                if (!b._resetTimer) b._resetTimer = 0.7;
                b._resetTimer -= dt;
                if (b._resetTimer <= 0) {
                    b._resetTimer = null;
                    b.state = 'done';
                    this.spawnNextBall();
                }
            }
        }

        // Floating texts
        this.floatTexts = this.floatTexts.filter(t => t.life > 0);
        for (let t of this.floatTexts) {
            t.life -= dt;
            t.y    -= 55 * dt;
        }

        // Game over when all balls used and none active
        const remaining = this.balls.filter(b => b.state === 'waiting' || b.state === 'ready' ||
                                                  b.state === 'rolling' || b.state === 'airborne').length;
        if (this.ballsLeft === 0 && remaining === 0) {
            setTimeout(() => { this.isGameOver = true; }, 500);
        }
    }

    draw(ctx) {
        // Background
        ctx.fillStyle = '#222';
        ctx.fillRect(0, 0, 1024, 768);

        // Slanted spine
        ctx.fillStyle   = '#2a2a2a';
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth   = 3;
        ctx.shadowColor = '#00ffff';
        ctx.shadowBlur  = 10;
        ctx.beginPath();
        ctx.moveTo(this.spineTopX, this.spineTopY);
        ctx.lineTo(this.spineBottomX, this.spineBottomY);
        ctx.lineTo(this.spineBottomX - this.spineWidth, this.spineBottomY);
        ctx.lineTo(this.spineTopX - this.spineWidth, this.spineTopY);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Target holes
        for (let h of this.holes) {
            ctx.fillStyle = h.fillColor;
            ctx.beginPath();
            ctx.moveTo(h.topStartX, h.topY);
            ctx.lineTo(h.topEndX, h.topY);
            ctx.lineTo(h.bottomEndX, h.bottomY);
            ctx.lineTo(h.bottomStartX, h.bottomY);
            ctx.closePath();
            ctx.fill();

            ctx.strokeStyle = h.color;
            ctx.lineWidth   = 3;
            ctx.lineCap     = 'round';
            ctx.shadowColor = h.color;
            ctx.shadowBlur  = 8;

            ctx.beginPath();
            ctx.moveTo(h.topStartX, h.topY);
            ctx.lineTo(h.topEndX, h.topY);
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(h.bottomStartX, h.bottomY);
            ctx.lineTo(h.bottomEndX, h.bottomY);
            ctx.stroke();
            ctx.shadowBlur = 0;

            const midY     = (h.topY + h.bottomY) / 2;
            const fontSize = Math.max(14, Math.min(18, Math.round((h.bottomY - h.topY) * 0.4)));
            ctx.fillStyle     = h.color;
            ctx.font          = `bold ${fontSize}px Orbitron`;
            ctx.textAlign     = 'left';
            ctx.textBaseline  = 'middle';
            ctx.shadowColor   = h.color;
            ctx.shadowBlur    = 6;
            ctx.fillText(`${h.pts}`, h.topStartX + 14, midY);
            ctx.shadowBlur    = 0;
            ctx.textBaseline  = 'alphabetic';
        }

        // Ramp body
        ctx.beginPath();
        ctx.moveTo(this.rampRightX, this.rampRightY);
        ctx.lineTo(this.rampCurveStartX, this.rampCurveStartY);
        ctx.quadraticCurveTo(this.rampControlX, this.rampControlY, this.rampLipX, this.rampLipY);
        ctx.lineTo(this.rampLipX, this.rampBottomY);
        ctx.lineTo(this.rampRightX, this.rampBottomY);
        ctx.closePath();
        ctx.fillStyle = '#2a2a2a';
        ctx.fill();

        // Ramp top edge (cyan unified)
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth   = 3;
        ctx.shadowColor = '#00ffff';
        ctx.shadowBlur  = 10;
        ctx.beginPath();
        ctx.moveTo(this.rampRightX, this.rampRightY);
        ctx.lineTo(this.rampCurveStartX, this.rampCurveStartY);
        ctx.quadraticCurveTo(this.rampControlX, this.rampControlY, this.rampLipX, this.rampLipY);
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Stopper bar
        ctx.fillStyle   = '#111';
        ctx.shadowColor = '#00ff00';
        ctx.shadowBlur  = 8;
        ctx.fillRect(this.stopperX, this.stopperTop, 20, this.stopperBottom - this.stopperTop);
        ctx.strokeStyle = '#00ff00';
        ctx.lineWidth   = 2;
        ctx.strokeRect(this.stopperX, this.stopperTop, 20, this.stopperBottom - this.stopperTop);
        ctx.shadowBlur  = 0;

        // Balls
        let readyBall = null;
        for (let b of this.balls) {
            if (b.state === 'done' || b.state === 'waiting') continue;
            ctx.globalAlpha = (b.state === 'scored') ? 0.4 : 1.0;
            ctx.shadowColor = '#FF8C00';
            ctx.shadowBlur  = b.state === 'ready' ? 18 : 8;
            ctx.fillStyle   = '#FF8C00';
            ctx.beginPath();
            ctx.arc(b.pos.x, b.pos.y, b.radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur  = 0;
            ctx.globalAlpha = 1.0;
            if (b.state === 'ready') readyBall = b;
        }

        // Drag aim line
        if (this.draggingBall && input.mouse.down) {
            const mx = input.mouse.x, my = input.mouse.y;
            const fx = this.draggingBall.pos.x + (this.dragStart.x - mx);
            const fy = this.draggingBall.pos.y + (this.dragStart.y - my);
            ctx.setLineDash([8, 6]);
            ctx.beginPath();
            ctx.moveTo(this.draggingBall.pos.x, this.draggingBall.pos.y);
            ctx.lineTo(fx, fy);
            ctx.strokeStyle = '#66fcf1';
            ctx.lineWidth   = 3;
            ctx.stroke();
            ctx.setLineDash([]);
        }

        // Floating score texts
        for (let t of this.floatTexts) {
            ctx.globalAlpha = Math.max(0, t.life / t.maxLife);
            ctx.fillStyle   = t.color;
            ctx.font        = 'bold 28px Orbitron';
            ctx.textAlign   = 'center';
            ctx.shadowColor = t.color;
            ctx.shadowBlur  = 12;
            ctx.fillText(t.text, t.x, t.y);
            ctx.shadowBlur  = 0;
            ctx.globalAlpha = 1.0;
        }

        // HUD
        drawHUD(this.score, this.timer.getFormattedTime());

        if (readyBall && !this.draggingBall) {
            ctx.fillStyle = '#66fcf1';
            ctx.font      = '16px Inter';
            ctx.textAlign = 'center';
            ctx.fillText('Drag ball backward and release to launch!', readyBall.pos.x, readyBall.pos.y - 35);
        }

        const remaining = this.balls.filter(b => b.state === 'waiting' || b.state === 'ready').length;
        ctx.fillStyle = '#fff';
        ctx.font      = '16px Orbitron';
        ctx.textAlign = 'right';
        ctx.fillText('Balls: ' + remaining + '/' + this.maxBalls, 980, 90);
    }
}
