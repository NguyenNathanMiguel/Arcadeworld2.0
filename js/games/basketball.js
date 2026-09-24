class BasketballGame {
    constructor() {
        this.gameKey = 'game1';
        this.isGameOver = false;
        this.score = 0;
        
        this.timer = new Timer(90, () => { this.isGameOver = true; });

        this.startPos = new Vector(750, 450);
        this.balls = [];
        for (let i = 0; i < 3; i++) {
            this.balls.push({
                pos: new Vector(this.startPos.x, this.startPos.y),
                vel: new Vector(0, 0),
                radius: 20,
                state: 'ready',
                scored: false
            });
        }
        
        this.gravity = 1500;
        this.slopeFriction = 0.3;
        
        this.hoopY = 250;
        this.hoopLeft = 150;
        this.hoopRight = 250;
        
        this.backboardX = 100;
        this.backboardTop = 150;
        this.backboardBottom = 300;
        
        this.backWallX = 60;
        this.backWallTop = 200;
        this.backWallBottom = 580;
        
        this.platformLeftX = 60;
        this.platformLeftTopY = 480;
        this.platformLeftBottomY = 600;
        this.platformRightX = 770;
        this.platformRightTopY = 560;
        this.platformRightBottomY = 600;
        
        this.stopperX = 770;
        this.stopperTop = 500;
        this.stopperBottom = 600;

        this.draggingBall = null;
        this.dragStart = new Vector(0, 0);
    }

    init() {
        this.isGameOver = false;
        this.score = 0;
        this.balls.forEach(b => {
            b.pos = new Vector(this.startPos.x, this.startPos.y);
            b.vel = new Vector(0, 0);
            b.state = 'ready';
            b.scored = false;
        });
        this.draggingBall = null;
        this.timer.start();
    }

    update(dt, input) {
        if (this.isGameOver) return;
        this.timer.update(dt);

        if (input.mouse.justPressed && !this.draggingBall) {
            let mx = input.mouse.x, my = input.mouse.y;
            for (let b of this.balls) {
                if (b.state === 'ready') {
                    let dx = mx - b.pos.x, dy = my - b.pos.y;
                    if (Math.sqrt(dx*dx + dy*dy) < b.radius + 20) {
                        this.draggingBall = b;
                        this.dragStart = new Vector(mx, my);
                        break;
                    }
                }
            }
        }

        if (this.draggingBall && !input.mouse.down) {
            let mx = input.mouse.x, my = input.mouse.y;
            let dragDx = this.dragStart.x - mx;
            let dragDy = this.dragStart.y - my;
            let dragDist = Math.sqrt(dragDx*dragDx + dragDy*dragDy);
            if (dragDist > 15) {
                // Enough drag → throw
                let forceX = dragDx * 4.5;
                let forceY = dragDy * 4.5;
                this.draggingBall.vel = new Vector(forceX, forceY);
                this.draggingBall.state = 'thrown';
                this.draggingBall.scored = false;
            }
            // Too small drag → cancel, ball stays ready
            this.draggingBall = null;
        }

        let platM = (this.platformRightTopY - this.platformLeftTopY) / (this.platformRightX - this.platformLeftX);
        let platB = this.platformLeftTopY - platM * this.platformLeftX;

        for (let b of this.balls) {
            if (b.state === 'ready') {
                b.pos = new Vector(this.startPos.x, this.startPos.y);
                b.vel = new Vector(0, 0);
            } else if (b.state === 'thrown') {
                let oldY = b.pos.y;
                b.vel.y += this.gravity * dt;
                b.pos.x += b.vel.x * dt;
                b.pos.y += b.vel.y * dt;

                if (b.pos.x - b.radius < this.backWallX && b.pos.y > this.backWallTop && b.pos.y < this.backWallBottom) {
                    b.pos.x = this.backWallX + b.radius;
                    b.vel.x *= -0.7;
                }
                if (b.pos.x - b.radius < this.backboardX && b.pos.y > this.backboardTop && b.pos.y < this.backboardBottom) {
                    b.pos.x = this.backboardX + b.radius;
                    b.vel.x *= -0.6;
                }

                // Stopper front collision - INSTANT RESET
                if (b.pos.x + b.radius > this.stopperX && b.pos.y > this.stopperTop && b.pos.y < this.stopperBottom) {
                    b.pos = new Vector(this.startPos.x, this.startPos.y);
                    b.vel = new Vector(0, 0);
                    b.state = 'ready';
                    continue; // Skip rest of loop for this ball
                }

                let checkRim = (rimX, rimY) => {
                    let dx = b.pos.x - rimX, dy = b.pos.y - rimY;
                    let dist = Math.sqrt(dx*dx + dy*dy);
                    if (dist < b.radius) {
                        let nx = dx/dist, ny = dy/dist;
                        let dot = b.vel.x * nx + b.vel.y * ny;
                        if (dot < 0) {
                            b.vel.x -= 2 * dot * nx * 0.7;
                            b.vel.y -= 2 * dot * ny * 0.7;
                        }
                        b.pos.x = rimX + nx * b.radius;
                        b.pos.y = rimY + ny * b.radius;
                    }
                };
                checkRim(this.hoopLeft, this.hoopY);
                checkRim(this.hoopRight, this.hoopY);

                if (oldY < this.hoopY && b.pos.y >= this.hoopY && b.pos.x > this.hoopLeft && b.pos.x < this.hoopRight && b.vel.y > 0) {
                    if (!b.scored) { this.score++; b.scored = true; }
                }

                let surfaceY = platM * b.pos.x + platB;
                if (b.pos.x > this.platformLeftX && b.pos.x < this.stopperX + 20) {
                    if (b.pos.y + b.radius > surfaceY) {
                        b.pos.y = surfaceY - b.radius;
                        // Transition to rolling: keep horizontal momentum, zero out vertical
                        b.vel.x = b.vel.x * 0.6; // lose some energy on bounce
                        b.vel.y = 0;
                        b.state = 'rolling';
                    }
                }
                if (b.pos.y > 800) { b.state = 'returning'; }

            } else if (b.state === 'rolling') {
                // Slope gravity: g * sin(angle), pulls downhill (positive X direction)
                let sinSlope = platM / Math.sqrt(1 + platM * platM);
                let slopeAccel = this.gravity * sinSlope;

                b.vel.x += slopeAccel * dt;

                // Small rolling friction (must be less than slope accel so ball always rolls down)
                let friction = 40;
                if (b.vel.x > 0) {
                    b.vel.x = Math.max(0, b.vel.x - friction * dt);
                } else if (b.vel.x < 0) {
                    b.vel.x = Math.min(0, b.vel.x + friction * dt);
                }

                b.pos.x += b.vel.x * dt;
                b.pos.y = platM * b.pos.x + platB - b.radius;

                // Hit stopper → reset to player
                if (b.pos.x >= this.stopperX - b.radius) {
                    b.pos = new Vector(this.startPos.x, this.startPos.y);
                    b.vel = new Vector(0, 0);
                    b.state = 'ready';
                }
                // Rolled off left edge
                if (b.pos.x < this.platformLeftX) {
                    b.state = 'returning';
                }
            } else if (b.state === 'returning') {
                // Keep this as a fallback if ball falls out of bounds
                b.pos = new Vector(this.startPos.x, this.startPos.y);
                b.vel = new Vector(0, 0);
                b.state = 'ready';
            }
        }
    }

    draw(ctx) {
        ctx.fillStyle = '#222';
        ctx.fillRect(0, 0, 1024, 768);

        ctx.fillStyle = '#444';
        ctx.shadowColor = 'cyan'; ctx.shadowBlur = 5;
        ctx.fillRect(this.backWallX, this.backWallTop, 20, this.backWallBottom - this.backWallTop);
        ctx.shadowBlur = 0;

        // Platform (metallic dark ramp)
        ctx.beginPath();
        ctx.moveTo(this.platformLeftX, this.platformLeftTopY);
        ctx.lineTo(this.platformRightX, this.platformRightTopY);
        ctx.lineTo(this.platformRightX, this.platformRightBottomY);
        ctx.lineTo(this.platformLeftX, this.platformLeftBottomY);
        ctx.closePath();
        ctx.fillStyle = '#2a2a2a';
        ctx.fill();
        
        // Platform top border (cyan glow)
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = 3;
        ctx.shadowColor = '#00ffff';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.moveTo(this.platformLeftX, this.platformLeftTopY);
        ctx.lineTo(this.platformRightX, this.platformRightTopY);
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Stopper bar (thick barrier)
        ctx.fillStyle = '#111'; 
        ctx.shadowColor = '#00ff00'; 
        ctx.shadowBlur = 8;
        ctx.fillRect(this.stopperX, this.stopperTop, 20, this.stopperBottom - this.stopperTop);
        ctx.strokeStyle = '#00ff00';
        ctx.lineWidth = 2;
        ctx.strokeRect(this.stopperX, this.stopperTop, 20, this.stopperBottom - this.stopperTop);
        ctx.shadowBlur = 0;

        ctx.fillStyle = 'white'; ctx.shadowColor = 'white'; ctx.shadowBlur = 10;
        ctx.fillRect(this.backboardX, this.backboardTop, 15, this.backboardBottom - this.backboardTop);
        ctx.shadowBlur = 0;
        
        ctx.fillStyle = 'red';
        ctx.fillRect(this.hoopLeft, this.hoopY, this.hoopRight - this.hoopLeft, 5);
        ctx.beginPath(); ctx.arc(this.hoopLeft, this.hoopY, 5, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(this.hoopRight, this.hoopY, 5, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = 'white'; ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(this.hoopLeft, this.hoopY);
        ctx.lineTo(this.hoopLeft+20, this.hoopY+60);
        ctx.lineTo(this.hoopRight-20, this.hoopY+60);
        ctx.lineTo(this.hoopRight, this.hoopY);
        ctx.stroke();

        let readyCount = 0;
        for (let b of this.balls) {
            ctx.globalAlpha = (b.state === 'ready') ? 1.0 : 0.8;
            // Ball shadow
            ctx.shadowColor = '#FF8C00';
            ctx.shadowBlur = (b.state === 'ready') ? 15 : 5;
            ctx.fillStyle = '#FF8C00';
            ctx.beginPath(); ctx.arc(b.pos.x, b.pos.y, b.radius, 0, Math.PI*2); ctx.fill();
            ctx.shadowBlur = 0;
            ctx.globalAlpha = 1.0;
            if (b.state === 'ready') readyCount++;
        }

        if (this.draggingBall && input.mouse.down) {
            let mx = input.mouse.x, my = input.mouse.y;
            let fx = this.draggingBall.pos.x + (this.dragStart.x - mx);
            let fy = this.draggingBall.pos.y + (this.dragStart.y - my);
            ctx.beginPath();
            ctx.moveTo(this.draggingBall.pos.x, this.draggingBall.pos.y);
            ctx.lineTo(fx, fy);
            ctx.strokeStyle = '#66fcf1'; ctx.lineWidth = 3;
            ctx.stroke();
        }

        drawHUD(this.score, this.timer.getFormattedTime());
        
        if (readyCount > 0 && !this.draggingBall) {
            ctx.fillStyle = '#66fcf1'; ctx.font = '16px Inter'; ctx.textAlign = 'center';
            ctx.fillText('Drag to aim and release!', this.startPos.x, this.startPos.y - 40);
        }
        ctx.fillStyle = '#fff'; ctx.font = '16px Orbitron'; ctx.textAlign = 'right';
        ctx.fillText('Balls: ' + readyCount + '/3', 980, 90);
    }
}
