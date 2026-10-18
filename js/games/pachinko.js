class PachinkoGame {
    constructor() {
        this.gameKey = 'game9';
        this.score = 0;
        this.isGameOver = false;
        this.timer = new Timer(90, () => { this.isGameOver = true; });

        // Board geometry
        this.cx = 512; this.cy = 400; this.r = 315;
        this.railStart = Math.PI * 0.62;
        this.pinR = 3;
        this.scale = 0.85;

        // Physics
        this.ballR = 6;
        this.G = 900;
        this.maxLaunch = 1800;
        this.ballsLeft = 100;
        this.balls = [];

        // Power lever (screen coords, like Lane Roller)
        this.leverX = 900; this.leverTrackY = 250; this.leverTrackH = 300;
        this.leverBallR = 14; this.leverBallY = this.leverTrackY;
        this.forcePercent = 0; this.dragging = false;

        this.setupSpiral();

        // Center box (start chucker / screen)
        this.box = { x: this.cx - 45, y: 325, w: 90, h: 75 };
        this.wheels = [
            { x: this.cx - 130, y: 230 }, { x: this.cx + 130, y: 230 },
            { x: this.cx - 215, y: 375 }, { x: this.cx - 85, y: 385 },
            { x: this.cx + 85, y: 385 }, { x: this.cx + 215, y: 375 }
        ].map(w => ({ ...w, angle: -Math.PI / 2, omega: 0, len: 20, inertia: 250 }));
        this.topPocket = { x: this.cx, y: 228 };
        this.tulips = [{ x: this.cx - 185, y: 535 }, { x: this.cx + 185, y: 535 }];
        this.greenPockets = [{ x: this.cx - 110, y: 605 }, { x: this.cx + 110, y: 605 }];
        this.attacker = { x: this.cx, y: 590 };
        this.chute = { x: this.cx, y: 470 };

        // Out hole: wider, at the very bottom, fully inside the wall
        const bottomR = this.radAt(Math.PI * 2.5) - 6, hw = 90, hh = 8;
        const oy = this.sy + Math.sqrt(bottomR * bottomR - hw * hw) - hh;
        this.outHole = { x: this.sx, y: oy };
        // Drain arc hugging the bottom of the wall
        this.drainAng = Math.PI * 2.5; this.drainHalf = 0.4;

        // Scoring pockets (rects in board coords)
        const R = (c, w, h, oy, color) => ({ x: c.x - w / 2, y: c.y - oy, w, h, color });
        this.pockets = [
            { ...R(this.topPocket, 44, 20, 10, '#ff007f'), pts: 5 },
            { ...this.box, color: '#ffcc00', pts: 10 },
            { ...R(this.chute, 28, 28, 14, '#66fcf1'), pts: 200 },
            ...this.tulips.map(t => ({ ...R(t, 44, 36, 15, '#ff007f'), pts: 20 })),
            ...this.greenPockets.map(g => ({ ...R(g, 32, 24, 12, '#39ff14'), pts: 30 })),
            { ...R(this.attacker, 60, 50, 22, '#ffcc00'), pts: 50 }
        ];

        this.pegs = [];
        this.setupPegs();
    }

    setupSpiral() {
        const { cx, cy, r } = this;
        const gapA = 0.7;
        const a0 = this.railStart, a1 = Math.PI * 1.5 - gapA + Math.PI * 2;
        const outR = r + 50;
        this.a0 = a0; this.a1 = a1;
        this.entryAng = Math.PI * 1.5 - gapA; // past here the ball is inside the playfield
        this.radAt = ang => outR + (r - outR) * (ang - a0) / (a1 - a0);
        let ox = 0, oy = 0;
        for (let i = 0; i < 120; i++) {
            const ang = a1 - Math.PI * 2 + Math.PI * 2 * i / 120, e = this.radAt(ang) - r;
            ox += e * Math.cos(ang) / 60; oy += e * Math.sin(ang) / 60;
        }
        this.sx = cx - ox; this.sy = cy - oy;
        const pt = ang => [this.sx + Math.cos(ang) * this.radAt(ang), this.sy + Math.sin(ang) * this.radAt(ang)];
        this.pt = pt;

        // Tail geometry
        const [p0x, p0y] = pt(a0);
        const ty = p0y + 35;
        const dx = Math.sin(a0), dy = -Math.cos(a0);
        const ctrlX = p0x + dx * (ty - p0y) / dy;
        this.tail = { ty, ctrlX, p0x, p0y, endX: this.sx + r };

        // Rail path the ball rides: tail (right -> left), curve, then the spiral
        const raw = [];
        raw.push([this.sx + r, ty, null]);
        raw.push([ctrlX + 60, ty, null]);
        for (let i = 1; i <= 20; i++) {
            const t = i / 20, u = 1 - t;
            raw.push([u * u * (ctrlX + 60) + 2 * u * t * ctrlX + t * t * p0x,
                      u * u * ty + 2 * u * t * ty + t * t * p0y, null]);
        }
        const steps = 240;
        for (let i = 1; i <= steps; i++) {
            const ang = a0 + (a1 - a0) * i / steps;
            const [x, y] = pt(ang); raw.push([x, y, ang]);
        }
        let s = 0;
        this.path = raw.map((p, i) => {
            if (i) s += Math.hypot(p[0] - raw[i - 1][0], p[1] - raw[i - 1][1]);
            return { x: p[0], y: p[1], ang: p[2], s };
        });
        this.pathLen = s;
        this.tailLen = this.path.find(p => p.ang !== null).s;
    }

    // Position + unit tangent on the rail at distance s
    railAt(s) {
        const P = this.path;
        let i = 1;
        while (i < P.length - 1 && P[i].s < s) i++;
        const a = P[i - 1], b = P[i], seg = (b.s - a.s) || 1, f = (s - a.s) / seg;
        const tx = (b.x - a.x) / seg, ty = (b.y - a.y) / seg;
        const ang = b.ang === null ? null : (a.ang ?? b.ang) + ((b.ang - (a.ang ?? b.ang)) * f);
        return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, tx, ty, ang };
    }

    setupPegs() {
        const pegs = [];
        const blockers = [
            ...this.wheels.map(w => ({ ...w, d: 38 })),
            { ...this.topPocket, d: 40 },
            ...this.tulips.map(t => ({ ...t, d: 45 })),
            ...this.greenPockets.map(g => ({ ...g, d: 30 })),
            { ...this.attacker, d: 55 },
            { ...this.chute, d: 40 },
            { ...this.outHole, d: 45 }
        ];
        const b = this.box;
        const free = (x, y) => {
            const dx = x - this.cx, dy = y - this.cy;
            if (Math.sqrt(dx * dx + dy * dy) > this.r - 30) return false;
            if (y < 130 || y > 650) return false;
            if (x > b.x - 15 && x < b.x + b.w + 15 && y > b.y - 30 && y < b.y + b.h + 15) return false;
            return blockers.every(o => Math.hypot(x - o.x, y - o.y) > o.d);
        };
        const gap = 56;
        for (let row = 0; row * gap * 0.75 < 560; row++) {
            const y = 130 + row * gap * 0.75;
            const off = row % 2 ? gap / 2 : 0;
            for (let dx = off; dx <= 300; dx += gap) {
                if (!free(this.cx + dx, y)) continue;
                pegs.push({ x: this.cx + dx, y });
                if (dx > 0) pegs.push({ x: this.cx - dx, y });
            }
        }
        const line = (x1, y1, x2, y2, n) => {
            for (let i = 0; i <= n; i++) pegs.push({ x: x1 + (x2 - x1) * i / n, y: y1 + (y2 - y1) * i / n });
        };
        line(this.cx - 45, 200, this.cx - 25, 190, 1);
        line(this.cx + 25, 190, this.cx + 45, 200, 1);
        [-1, 1].forEach(s => line(this.cx + s * 85, 480, this.cx + s * 95, 550, 2));
        this.pegs = pegs;
    }

    init() { this.timer.start(); }

    update(dt, input) {
        if (this.isGameOver) return;
        this.timer.update(dt);

        // Lever drag -> launch on release
        if (input.mouse.justPressed && this.ballsLeft > 0) {
            const onExit = input.mouse.x > canvas.width - 90 && input.mouse.y < 65;
            if (!onExit) { this.dragging = true; this.dragStartY = input.mouse.y; }
        }
        if (this.dragging) {
            const y = this.leverTrackY + (input.mouse.y - this.dragStartY);
            this.leverBallY = Math.max(this.leverTrackY, Math.min(this.leverTrackY + this.leverTrackH, y));
            this.forcePercent = (this.leverBallY - this.leverTrackY) / this.leverTrackH;
            if (!input.mouse.down) {
                this.dragging = false;
                if (this.forcePercent > 0.05 && this.ballsLeft > 0) {
                    this.ballsLeft--;
                    this.balls.push({ rail: true, s: 0, v: this.maxLaunch * this.forcePercent });
                }
                this.forcePercent = 0;
                this.leverBallY = this.leverTrackY;
            }
        }

        const sub = 4, h = Math.min(dt, 0.05) / sub;
        for (let k = 0; k < sub; k++) {
            this.balls.forEach(b => b.done || this.stepBall(b, h));
            for (const w of this.wheels) { w.angle += w.omega * h; w.omega *= 1 - 1.5 * h; }
        }
        this.balls = this.balls.filter(b => !b.done);

        if (this.ballsLeft === 0 && this.balls.length === 0) this.isGameOver = true;
    }

    stepBall(b, h) {
        const br = this.ballR, G = this.G;
        if (b.rail) {
            const p = this.railAt(b.s);
            b.v += G * p.ty * h;          // gravity along the rail
            b.v -= b.v * 0.12 * h;        // rolling friction
            b.s += b.v * h;
            if (b.s <= this.tailLen && b.v <= 0) {  // rolled back out -> refund
                b.done = true; this.ballsLeft++; return;
            }
            if (b.s >= this.pathLen) b.s = this.pathLen - 1;
            const q = this.railAt(b.s);
            const nx = -q.ty, ny = q.tx;  // inward normal
            b.x = q.x + nx * br; b.y = q.y + ny * br;
            // Detach once inside the playfield and too slow to hug the wall
            if (q.ang !== null && q.ang > this.entryAng + 0.1) {
                const R = this.radAt(q.ang);
                const N = b.v * b.v / R - G * ny;
                if (N < 0 || b.s >= this.pathLen - 2) {
                    b.rail = false; b.vx = q.tx * b.v; b.vy = q.ty * b.v;
                }
            }
            return;
        }

        // Free flight
        b.vy += G * h;
        b.x += b.vx * h; b.y += b.vy * h;

        // Playfield wall (inner lap of the spiral)
        const dx = b.x - this.sx, dy = b.y - this.sy, d = Math.hypot(dx, dy);
        let ang = Math.atan2(dy, dx);
        while (ang < this.a1 - Math.PI * 2) ang += Math.PI * 2;
        while (ang >= this.a1) ang -= Math.PI * 2;
        const R = this.radAt(ang) - br;
        if (d > R) {
            // Bottom drain arc: a spent (slow) ball disappears on touch
            if (Math.abs(ang - this.drainAng) < this.drainHalf && Math.hypot(b.vx, b.vy) < 350) {
                b.done = true; return;
            }
            if (Math.abs(ang - this.drainAng) < this.drainHalf) { b.vx *= 0.8; b.vy *= 0.8; }
            this.bounce(b, -dx / d, -dy / d, d - R, 0.5);
        }

        // Pegs and rotors
        for (const p of this.pegs) this.hitCircle(b, p, this.pinR + 1);
        for (const w of this.wheels) this.hitRotor(b, w);

        // Scoring cups: walls on both sides + bottom, score only once inside
        for (const pk of this.pockets) {
            const L = pk.x, Rt = pk.x + pk.w, T = pk.y, B = pk.y + pk.h;
            this.hitSeg(b, L, T, L, B); this.hitSeg(b, Rt, T, Rt, B); this.hitSeg(b, L, B, Rt, B);
            if (b.x > L && b.x < Rt && b.y > T + pk.h * 0.5 && b.y < B) {
                this.score += pk.pts; b.done = true; return;
            }
        }
        if (b.y > 900) b.done = true;
    }

    hitCircle(b, c, cr) {
        const dx = b.x - c.x, dy = b.y - c.y, d = Math.hypot(dx, dy), min = cr + this.ballR;
        if (d < min && d > 0) this.bounce(b, dx / d, dy / d, min - d, 0.5);
    }

    hitSeg(b, x1, y1, x2, y2) {
        const ex = x2 - x1, ey = y2 - y1, L2 = ex * ex + ey * ey;
        const t = Math.max(0, Math.min(1, ((b.x - x1) * ex + (b.y - y1) * ey) / L2));
        const px = x1 + ex * t, py = y1 + ey * t;
        const dx = b.x - px, dy = b.y - py, d = Math.hypot(dx, dy);
        if (d < this.ballR && d > 0) this.bounce(b, dx / d, dy / d, this.ballR - d, 0.4);
    }

    // 5-blade rotor: ball pushes blades, gravity on the ball turns it
    hitRotor(b, w) {
        this.hitCircle(b, w, 5);
        for (let i = 0; i < 5; i++) {
            const a = w.angle + i * Math.PI * 2 / 5;
            const tx = w.x + Math.cos(a) * w.len, ty = w.y + Math.sin(a) * w.len;
            const ex = tx - w.x, ey = ty - w.y;
            const t = Math.max(0, Math.min(1, ((b.x - w.x) * ex + (b.y - w.y) * ey) / (w.len * w.len)));
            const px = w.x + ex * t, py = w.y + ey * t;
            const dx = b.x - px, dy = b.y - py, d = Math.hypot(dx, dy);
            if (d >= this.ballR || d === 0) continue;
            const nx = dx / d, ny = dy / d, rx = px - w.x, ry = py - w.y;
            b.x += nx * (this.ballR - d); b.y += ny * (this.ballR - d);
            // Blade surface velocity at contact point
            const bvx = -w.omega * ry, bvy = w.omega * rx;
            const vn = (b.vx - bvx) * nx + (b.vy - bvy) * ny;
            if (vn < 0) {
                const rn = rx * ny - ry * nx;
                const j = -(1.3) * vn / (1 + rn * rn / w.inertia);
                b.vx += j * nx; b.vy += j * ny;
                w.omega -= j * rn / w.inertia;
            }
        }
    }

    bounce(b, nx, ny, pen, e) {
        b.x += nx * pen; b.y += ny * pen;
        const vn = b.vx * nx + b.vy * ny;
        if (vn < 0) { b.vx -= (1 + e) * vn * nx; b.vy -= (1 + e) * vn * ny; }
    }

    inRect(b, r) { return b.x > r.x && b.x < r.x + r.w && b.y > r.y && b.y < r.y + r.h; }

    drawWheel(ctx, w) {
        ctx.strokeStyle = '#66fcf1'; ctx.lineWidth = 3; ctx.lineCap = 'round';
        ctx.shadowBlur = 8; ctx.shadowColor = '#66fcf1';
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
            const a = w.angle + i * Math.PI * 2 / 5;
            ctx.moveTo(w.x, w.y); ctx.lineTo(w.x + Math.cos(a) * w.len, w.y + Math.sin(a) * w.len);
        }
        ctx.stroke(); ctx.shadowBlur = 0; ctx.lineCap = 'butt';
        ctx.beginPath(); ctx.arc(w.x, w.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = '#39ff14'; ctx.fill();
    }

    drawSpring(ctx) {
        const { endX, ty } = this.tail, y = ty - this.ballR;
        const len = 60 - 35 * this.forcePercent, x0 = endX + 4;
        ctx.strokeStyle = '#999'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(x0, y);
        for (let i = 1; i <= 8; i++) ctx.lineTo(x0 + len * i / 8, y + (i % 2 ? -6 : 6));
        ctx.stroke();
        ctx.fillStyle = '#999'; ctx.fillRect(x0 + len, y - 10, 6, 20);
        if (this.ballsLeft > 0) {
            ctx.fillStyle = '#e0e0e0';
            ctx.beginPath(); ctx.arc(endX - 4 + 35 * this.forcePercent * 0, y, this.ballR, 0, Math.PI * 2); ctx.fill();
        }
    }

    draw(ctx) {
        const { cx, cy, r, a0, a1 } = this;
        ctx.save();
        ctx.translate(cx, cy); ctx.scale(this.scale, this.scale); ctx.translate(-cx, -cy);
        const pt = this.pt;

        ctx.beginPath();
        for (let i = 0; i <= 120; i++) {
            const [px, py] = pt(a1 - Math.PI * 2 + Math.PI * 2 * i / 120);
            i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
        }
        ctx.closePath();
        ctx.fillStyle = 'rgba(30,40,60,0.4)'; ctx.fill();

        // Tail + spiral wall
        const t = this.tail;
        ctx.beginPath();
        ctx.moveTo(t.endX, t.ty);
        ctx.lineTo(t.ctrlX + 60, t.ty);
        ctx.quadraticCurveTo(t.ctrlX, t.ty, t.p0x, t.p0y);
        for (let i = 0; i <= 240; i++) {
            const [px, py] = pt(a0 + (a1 - a0) * i / 240);
            ctx.lineTo(px, py);
        }
        ctx.strokeStyle = '#66fcf1'; ctx.lineWidth = 3;
        ctx.shadowBlur = 15; ctx.shadowColor = '#66fcf1'; ctx.stroke(); ctx.shadowBlur = 0;

        this.drawSpring(ctx);

        ctx.fillStyle = '#b829ea'; ctx.shadowBlur = 6; ctx.shadowColor = '#b829ea';
        for (const p of this.pegs) { ctx.beginPath(); ctx.arc(p.x, p.y, this.pinR + 1, 0, Math.PI * 2); ctx.fill(); }
        ctx.shadowBlur = 0;

        this.wheels.forEach(w => this.drawWheel(ctx, w));

        const glowRect = (x, y, w, h, color) => {
            ctx.fillStyle = 'rgba(10,15,25,0.8)'; ctx.fillRect(x, y, w, h);
            ctx.strokeStyle = color; ctx.lineWidth = 2;
            ctx.shadowBlur = 10; ctx.shadowColor = color;
            ctx.strokeRect(x, y, w, h); ctx.shadowBlur = 0;
        };
        for (const pk of this.pockets) {
            ctx.fillStyle = 'rgba(10,15,25,0.8)'; ctx.fillRect(pk.x, pk.y, pk.w, pk.h);
            ctx.strokeStyle = pk.color; ctx.lineWidth = 2; ctx.shadowBlur = 10; ctx.shadowColor = pk.color;
            ctx.beginPath(); ctx.moveTo(pk.x, pk.y); ctx.lineTo(pk.x, pk.y + pk.h);
            ctx.lineTo(pk.x + pk.w, pk.y + pk.h); ctx.lineTo(pk.x + pk.w, pk.y); ctx.stroke();
            ctx.shadowBlur = 0;
        }
        // Drain arc
        ctx.beginPath();
        for (let i = 0; i <= 40; i++) {
            const a = this.drainAng - this.drainHalf + 2 * this.drainHalf * i / 40, rr = this.radAt(a) - 5;
            const x = this.sx + Math.cos(a) * rr, y = this.sy + Math.sin(a) * rr;
            i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.strokeStyle = '#ff4444'; ctx.lineWidth = 5; ctx.shadowBlur = 12; ctx.shadowColor = '#ff4444';
        ctx.stroke(); ctx.shadowBlur = 0;

        // Balls
        ctx.fillStyle = '#e0e0e0'; ctx.shadowBlur = 6; ctx.shadowColor = '#fff';
        for (const b of this.balls) {
            if (b.x === undefined) continue;
            ctx.beginPath(); ctx.arc(b.x, b.y, this.ballR, 0, Math.PI * 2); ctx.fill();
        }
        ctx.shadowBlur = 0;
        ctx.restore();

        // Power lever
        const T = this.leverTrackY, H = this.leverTrackH, bx = this.leverX - 38, bw = 26;
        ctx.fillStyle = '#333';
        ctx.fillRect(this.leverX - 4, T, 8, H);
        const grad = ctx.createLinearGradient(0, T, 0, T + H);
        grad.addColorStop(0, '#00ff44'); grad.addColorStop(0.3, '#00b33c');
        grad.addColorStop(0.6, '#cc6600'); grad.addColorStop(0.85, '#ff0000'); grad.addColorStop(1, '#ff0000');
        ctx.fillStyle = grad;
        ctx.fillRect(bx, T, bw, H * this.forcePercent);
        ctx.strokeStyle = '#45a29e'; ctx.lineWidth = 1;
        ctx.strokeRect(bx, T, bw, H);
        ctx.beginPath(); ctx.arc(this.leverX, this.leverBallY, this.leverBallR, 0, Math.PI * 2);
        ctx.fillStyle = '#ff3b30'; ctx.shadowBlur = 12; ctx.shadowColor = '#ff3b30'; ctx.fill(); ctx.shadowBlur = 0;

        drawHUD(this.score, this.timer.getFormattedTime());
        ctx.font = '20px Orbitron'; ctx.fillStyle = '#fff'; ctx.textAlign = 'right';
        ctx.fillText(`Balls: ${this.ballsLeft}`, canvas.width - 40, 90);
    }
}
