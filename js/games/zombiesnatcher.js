class ZombieSnatcherGame {
    constructor() {
        this.gameKey = 'game12';
        this.isGameOver = false;
        this.score = 0;
        this.flipsLeft = 3;
        
        this.cx = 512;
        this.cy = 340;
        this.outerRadius = 260;
        this.hubRadius = 50;
        
        this.discAngle = 0;
        this.discSpeed = 0.6;
        
        // Hole at bottom (6 o'clock = PI/2)
        this.holeAngle = Math.PI / 2;
        this.holeHalfArc = 0.15; // smaller hole
        
        // Flipper
        this.flipperState = 'idle';
        this.flipperTimer = 0;
        this.flipperDuration = 0.55; // slower swing
        
        // Pivot is on the outer rim, bottom right (around 4-5 o'clock)
        this.pivotAngle = Math.PI * 0.25;
        this.pivotX = this.cx + this.outerRadius * Math.cos(this.pivotAngle);
        this.pivotY = this.cy + this.outerRadius * Math.sin(this.pivotAngle);
        this.armLength = 220;
        
        // Arm angles - rest is pointing up-left into the disc, swing sweeps down-left across the hole
        this.restArmAngle = Math.PI * 1.15;
        this.swingArmAngle = Math.PI * 0.85;
        this.currentArmAngle = this.restArmAngle;
        
        this.blackBallRadius = 12;
        this.brainRadius = 22;
        
        this.flashEffects = [];
        this.gameOverTimer = undefined;
        
        this.balls = [];
        this.initBalls();
    }
    
    initBalls() {
        const types = [
            { pts: 20, count: 5, color: '#aaaaaa' },
            { pts: 50, count: 4, color: '#00cc44' },
            { pts: 100, count: 3, color: '#3399ff' },
            { pts: 250, count: 2, color: '#9b59b6' },
            { pts: 500, count: 1, color: '#ffcc00' }
        ];
        
        for (let t of types) {
            for (let i = 0; i < t.count; i++) {
                let baseAngle = Math.random() * Math.PI * 2;
                let dist = 90 + Math.random() * 130;
                this.balls.push({
                    baseAngle: baseAngle,
                    distance: dist,
                    // Physics position (for when being pushed)
                    px: 0, py: 0,
                    vx: 0, vy: 0,
                    pts: t.pts,
                    color: t.color,
                    scored: false,
                    pushed: false // whether currently being pushed by physics
                });
            }
        }
    }
    
    init() {}
    
    getBallWorldPos(b) {
        if (b.pushed) {
            return { x: b.px, y: b.py };
        }
        let curAng = b.baseAngle + this.discAngle;
        return {
            x: this.cx + b.distance * Math.cos(curAng),
            y: this.cy + b.distance * Math.sin(curAng)
        };
    }
    
    update(dt, input) {
        if (this.isGameOver) return;
        
        if (this.gameOverTimer !== undefined) {
            this.gameOverTimer -= dt;
            if (this.gameOverTimer <= 0) { this.isGameOver = true; }
        }
        
        this.discAngle += dt * this.discSpeed;
        
        // Update flash effects
        for (let f of this.flashEffects) { f.timer -= dt; }
        this.flashEffects = this.flashEffects.filter(f => f.timer > 0);
        
        // Flipper logic
        if (this.flipperState === 'idle') {
            if (input.isKeyJustPressed('Space') && this.flipsLeft > 0) {
                this.flipperState = 'swinging';
                this.flipperTimer = 0;
                this.flipsLeft--;
            }
        } else if (this.flipperState === 'swinging') {
            this.flipperTimer += dt;
            let t = Math.min(this.flipperTimer / this.flipperDuration, 1);
            let eased = t * (2 - t); // ease out
            this.currentArmAngle = this.restArmAngle + (this.swingArmAngle - this.restArmAngle) * eased;
            
            this.applyFlipperPhysics(dt);
            
            if (t >= 1) {
                this.flipperState = 'returning';
                this.flipperTimer = 0;
            }
        } else if (this.flipperState === 'returning') {
            this.flipperTimer += dt;
            let t = Math.min(this.flipperTimer / (this.flipperDuration * 1.5), 1);
            let eased = t * t; // ease in
            this.currentArmAngle = this.swingArmAngle + (this.restArmAngle - this.swingArmAngle) * eased;
            
            if (t >= 1) {
                this.flipperState = 'idle';
                this.flipperTimer = 0;
                if (this.flipsLeft <= 0 && this.gameOverTimer === undefined) {
                    this.gameOverTimer = 1.5;
                }
            }
        }
        
        // Update pushed balls physics
        for (let b of this.balls) {
            if (b.pushed && !b.scored) {
                // Apply velocity
                b.px += b.vx * dt;
                b.py += b.vy * dt;
                
                // Friction
                b.vx *= 0.96;
                b.vy *= 0.96;
                
                // Check if ball went through hole
                let dx = b.px - this.cx;
                let dy = b.py - this.cy;
                let dist = Math.sqrt(dx*dx + dy*dy);
                
                if (dist > this.outerRadius - this.brainRadius) {
                    // Check if it's aligned with the hole
                    let exitAngle = Math.atan2(dy, dx);
                    let diff = exitAngle - this.holeAngle;
                    while (diff > Math.PI) diff -= Math.PI * 2;
                    while (diff < -Math.PI) diff += Math.PI * 2;
                    
                    if (Math.abs(diff) < this.holeHalfArc) {
                        // It's in the hole, let it pass through
                        if (dist > this.outerRadius + this.brainRadius) {
                            // Scored! Ball went completely through hole
                            b.scored = true;
                            this.score += b.pts;
                            this.flashEffects.push({ x: b.px, y: b.py, timer: 0.5, pts: b.pts });
                        }
                    } else {
                        // Hit the solid wall - bounce back immediately to prevent clipping
                        let angle = Math.atan2(dy, dx);
                        b.px = this.cx + (this.outerRadius - this.brainRadius) * Math.cos(angle);
                        b.py = this.cy + (this.outerRadius - this.brainRadius) * Math.sin(angle);
                        b.vx *= -0.5;
                        b.vy *= -0.5;
                    }
                }
                
                // Hub collision
                if (dist < this.hubRadius + this.brainRadius) {
                    let angle = Math.atan2(dy, dx);
                    b.px = this.cx + (this.hubRadius + this.brainRadius + 2) * Math.cos(angle);
                    b.py = this.cy + (this.hubRadius + this.brainRadius + 2) * Math.sin(angle);
                    b.vx *= -0.3;
                    b.vy *= -0.3;
                }
                
                // If velocity is very low, re-attach to disc
                if (Math.abs(b.vx) < 5 && Math.abs(b.vy) < 5 && this.flipperState === 'idle') {
                    let angle = Math.atan2(b.py - this.cy, b.px - this.cx);
                    b.baseAngle = angle - this.discAngle;
                    b.distance = dist;
                    b.pushed = false;
                    b.vx = 0;
                    b.vy = 0;
                }
            }
        }
    }
    
    applyFlipperPhysics(dt) {
        let fx = this.pivotX + this.armLength * Math.cos(this.currentArmAngle);
        let fy = this.pivotY + this.armLength * Math.sin(this.currentArmAngle);
        
        for (let b of this.balls) {
            if (b.scored) continue;
            
            let pos = this.getBallWorldPos(b);
            let dx = pos.x - fx;
            let dy = pos.y - fy;
            let dist = Math.sqrt(dx*dx + dy*dy);
            let touchDist = this.blackBallRadius + this.brainRadius;
            
            if (dist < touchDist) {
                // Push the brain ball away from the black ball
                if (dist < 1) dist = 1;
                let nx = dx / dist;
                let ny = dy / dist;
                
                // Calculate flipper velocity for push force
                let pushForce = 600;
                
                if (!b.pushed) {
                    // Detach from disc and give it physics
                    b.pushed = true;
                    b.px = pos.x;
                    b.py = pos.y;
                }
                
                // Separate
                b.px = fx + nx * (touchDist + 2);
                b.py = fy + ny * (touchDist + 2);
                
                // Apply push force
                b.vx += nx * pushForce * dt * 30;
                b.vy += ny * pushForce * dt * 30;
            }
        }
    }
    
    normalizeAngle(a) {
        while (a > Math.PI) a -= Math.PI * 2;
        while (a < -Math.PI) a += Math.PI * 2;
        return a;
    }
    
    draw(ctx) {
        ctx.fillStyle = '#050505';
        ctx.fillRect(0, 0, 1024, 768);
        
        // Disc base
        let grad = ctx.createRadialGradient(this.cx, this.cy, this.hubRadius, this.cx, this.cy, this.outerRadius);
        grad.addColorStop(0, '#111111');
        grad.addColorStop(1, '#1a1a1a');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(this.cx, this.cy, this.outerRadius, 0, Math.PI * 2);
        ctx.fill();
        
        // Disc rim (with gap for hole)
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = 3;
        ctx.shadowColor = '#00ffff';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(this.cx, this.cy, this.outerRadius, this.holeAngle + this.holeHalfArc, this.holeAngle - this.holeHalfArc);
        ctx.stroke();
        ctx.shadowBlur = 0;
        
        // Hole glow markers
        let holeLeftAngle = this.holeAngle - this.holeHalfArc;
        let holeRightAngle = this.holeAngle + this.holeHalfArc;
        ctx.strokeStyle = '#ffff00';
        ctx.lineWidth = 6;
        ctx.shadowColor = '#00ff00';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(this.cx, this.cy, this.outerRadius, holeLeftAngle - 0.06, holeLeftAngle);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(this.cx, this.cy, this.outerRadius, holeRightAngle, holeRightAngle + 0.06);
        ctx.stroke();
        ctx.shadowBlur = 0;
        
        // Hub
        ctx.fillStyle = '#0a0a0a';
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(this.cx, this.cy, this.hubRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        
        // Draw brain balls
        for (let b of this.balls) {
            let pos = this.getBallWorldPos(b);
            
            ctx.globalAlpha = b.scored ? 0.15 : 1.0;
            
            ctx.fillStyle = b.color;
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, this.brainRadius, 0, Math.PI * 2);
            ctx.fill();
            
            // Brain pattern
            ctx.strokeStyle = 'rgba(255, 100, 200, 0.7)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(pos.x - 6, pos.y - 8);
            ctx.quadraticCurveTo(pos.x - 12, pos.y, pos.x - 6, pos.y + 8);
            ctx.moveTo(pos.x + 6, pos.y - 8);
            ctx.quadraticCurveTo(pos.x + 12, pos.y, pos.x + 6, pos.y + 8);
            ctx.moveTo(pos.x, pos.y - 12);
            ctx.lineTo(pos.x, pos.y + 10);
            ctx.stroke();
            
            // Points text
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 13px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.shadowColor = '#000';
            ctx.shadowBlur = 3;
            ctx.fillText(b.pts, pos.x, pos.y);
            ctx.shadowBlur = 0;
            
            ctx.globalAlpha = 1.0;
        }
        
        // Flipper arm
        let fx = this.pivotX + this.armLength * Math.cos(this.currentArmAngle);
        let fy = this.pivotY + this.armLength * Math.sin(this.currentArmAngle);
        
        ctx.strokeStyle = '#666';
        ctx.lineWidth = 5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(this.pivotX, this.pivotY);
        ctx.lineTo(fx, fy);
        ctx.stroke();
        
        // Pivot circle
        ctx.fillStyle = '#444';
        ctx.beginPath();
        ctx.arc(this.pivotX, this.pivotY, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#666';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Black ball at end
        ctx.fillStyle = '#111';
        ctx.strokeStyle = '#555';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(fx, fy, this.blackBallRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        
        // Flash effects (score popups)
        for (let f of this.flashEffects) {
            ctx.globalAlpha = f.timer / 0.5;
            ctx.fillStyle = '#ffff00';
            ctx.font = 'bold 30px Orbitron';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.shadowColor = '#ff0';
            ctx.shadowBlur = 10;
            ctx.fillText('+' + f.pts, f.x, f.y - (0.5 - f.timer) * 60);
            ctx.shadowBlur = 0;
            ctx.globalAlpha = 1.0;
        }
        
        // HUD
        drawHUD(this.score, null);
        
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 22px Orbitron';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText('Flips: ' + this.flipsLeft + '/3', 980, 90);
        
        ctx.fillStyle = '#66fcf1';
        ctx.font = '18px Inter';
        ctx.textAlign = 'center';
        ctx.fillText('Press SPACE to flip!', 512, 730);
    }
}
