class BallDropGame {
    constructor() {
        this.gameKey = 'game5';
        this.score = 0;
        this.isGameOver = false;
        // 30 seconds timer
        this.timer = new Timer(30, () => { this.isGameOver = true; });
        
        // 8 moving buckets, spaced out more
        this.buckets = [];
        this.bucketSpacing = 400;
        for(let i=0; i<8; i++) {
            this.buckets.push({
                x: i * this.bucketSpacing,
                y: 600,
                w: 120,
                h: 150
            });
        }
        this.bucketSpeed = 150;
        
        this.balls = [];
        this.ballsLeft = 60;
        
        this.tubeX = 512;
        this.tubeY = 100;
        this.gravity = 1500; // Faster gravity
    }

    init() {
        this.timer.start();
    }

    update(dt, input) {
        if(this.isGameOver) return;

        this.timer.update(dt);

        // Update buckets
        for(let b of this.buckets) {
            b.x += this.bucketSpeed * dt;
            if(b.x > 1024 + 200) {
                b.x -= 8 * this.bucketSpacing; // loop back
            }
        }

        // Spawn ball
        if (input.isKeyJustPressed('Space') && this.ballsLeft > 0) {
            this.balls.push({
                x: this.tubeX,
                y: this.tubeY + 40,
                vx: 0,
                vy: 0,
                radius: 15,
                active: true
            });
            this.ballsLeft--;
        }

        // Update balls
        for(let ball of this.balls) {
            if(!ball.active) continue;
            
            ball.vy += this.gravity * dt;
            ball.x += ball.vx * dt;
            ball.y += ball.vy * dt;
            
            // Wall bounce constraints
            if (ball.x < ball.radius) {
                ball.x = ball.radius;
                ball.vx *= -0.5;
            } else if (ball.x > 1024 - ball.radius) {
                ball.x = 1024 - ball.radius;
                ball.vx *= -0.5;
            }

            // Check collision with buckets
            for(let b of this.buckets) {
                let walls = [
                    {x: b.x, y: b.y, w: 8, h: b.h}, // Left wall
                    {x: b.x + b.w - 8, y: b.y, w: 8, h: b.h} // Right wall
                ];
                
                for (let wall of walls) {
                    // AABB collision
                    if (ball.x + ball.radius > wall.x && 
                        ball.x - ball.radius < wall.x + wall.w &&
                        ball.y + ball.radius > wall.y &&
                        ball.y - ball.radius < wall.y + wall.h) {
                        
                        let dx = ball.x - (wall.x + wall.w / 2);
                        let dy = ball.y - (wall.y + wall.h / 2);
                        
                        if (Math.abs(dy) > Math.abs(dx) && dy < 0) {
                            // Hit top of wall
                            ball.y = wall.y - ball.radius;
                            ball.vy *= -0.6;
                            if (Math.abs(ball.vx) < 20) ball.vx = (Math.random() - 0.5) * 150;
                            ball.vx += this.bucketSpeed * 0.3;
                        } else {
                            // Hit side of wall
                            if (dx > 0) {
                                ball.x = wall.x + wall.w + ball.radius;
                                ball.vx = Math.abs(ball.vx) * 0.5 + 50 + this.bucketSpeed * 0.8;
                            } else {
                                ball.x = wall.x - ball.radius;
                                ball.vx = -Math.abs(ball.vx) * 0.5 - 50;
                            }
                        }
                    }
                }
                
                // Score condition: inside bucket and below half height
                if (ball.x > b.x + 8 && ball.x < b.x + b.w - 8 && ball.y > b.y + b.h / 2) {
                    this.score++;
                    ball.active = false;
                    break;
                }
            }

            // Missed
            if(ball.y > 768 + ball.radius) {
                ball.active = false;
            }
        }

        // End condition: time ran out OR all balls used and none active
        if(this.ballsLeft === 0 && this.balls.every(b => !b.active)) {
            this.isGameOver = true;
        }
    }

    draw(ctx) {
        // Draw top tube
        drawRect(ctx, this.tubeX - 30, 0, 60, this.tubeY, '#2a2a35');
        drawRect(ctx, this.tubeX - 35, this.tubeY, 70, 20, '#66fcf1', {blur: 10, color: '#66fcf1'});

        // Draw buckets
        for(let b of this.buckets) {
            drawRect(ctx, b.x, b.y, b.w, b.h, '#ff007f', {blur: 15, color: '#ff007f'});
            ctx.fillStyle = '#000';
            ctx.fillRect(b.x + 8, b.y, b.w - 16, b.h - 8);
        }

        // Draw balls
        for(let ball of this.balls) {
            if(ball.active) {
                drawCircle(ctx, ball.x, ball.y, ball.radius, '#b829ea');
            }
        }

        drawHUD(this.score, this.timer.getFormattedTime());
        
        ctx.font = '20px Orbitron';
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'right';
        ctx.fillText(`Balls Left: ${this.ballsLeft}`, canvas.width - 40, 90);

        if (this.ballsLeft > 0) {
            ctx.fillStyle = '#66fcf1';
            ctx.font = '20px Inter';
            ctx.textAlign = 'center';
            ctx.fillText("Press SPACE to drop a ball!", canvas.width/2, 50);
        }
    }
}
