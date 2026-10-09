class Camera {
    constructor() {
        this.x = 0;
        this.y = 0;
    }
    follow(targetX, targetY, canvasW, canvasH, worldW, worldH) {
        this.x = targetX - canvasW / 2;
        this.y = targetY - canvasH / 2;
        this.x = Math.max(0, Math.min(this.x, worldW - canvasW));
        this.y = Math.max(0, Math.min(this.y, worldH - canvasH));
    }
}

class World {
    constructor() {
        this.width = 1600;
        this.height = 1400;
        // Spawn OUTSIDE arcade, in front of the entrance (entrance gap x=150-350, bottom wall y=1080)
        this.spawnPoint = { x: 250, y: 1200 };
        this.walls = [];
        this.cabinets = [];
        this.zones = [];
        // Leaderboard sign is outside the arcade, below the entrance
        this.leaderboardSign = { x: 500, y: 1180, w: 160, h: 40 };

        this.carpetImg = new Image();
        this.carpetImg.src = 'assets/carpet.png';
        this.carpetImg.onload = () => {
            this.carpetLoaded = true;
        };

        this.setupWorld();
    }

    setupWorld() {
        const buildingX = 100, buildingY = 100, buildingW = 1400, buildingH = 1000;
        const wallThickness = 20;
        
        // Outer boundaries (invisible)
        this.walls.push({ x: 0, y: 0, w: this.width, h: 10 });
        this.walls.push({ x: 0, y: this.height - 10, w: this.width, h: 10 });
        this.walls.push({ x: 0, y: 0, w: 10, h: this.height });
        this.walls.push({ x: this.width - 10, y: 0, w: 10, h: this.height });

        // Building Walls
        this.walls.push({ x: buildingX, y: buildingY, w: buildingW, h: wallThickness }); // Top
        this.walls.push({ x: buildingX, y: buildingY, w: wallThickness, h: buildingH }); // Left
        this.walls.push({ x: buildingX + buildingW - wallThickness, y: buildingY, w: wallThickness, h: buildingH }); // Right
        
        // Bottom wall with entrance on the LEFT side
        const entranceW = 200;
        const entranceX = 150; // entrance gap: x=150 to x=350
        this.walls.push({ x: buildingX, y: buildingY + buildingH - wallThickness, w: entranceX - buildingX, h: wallThickness });
        this.walls.push({ x: entranceX + entranceW, y: buildingY + buildingH - wallThickness, w: buildingX + buildingW - (entranceX + entranceW), h: wallThickness });
        this.ticketShop = {
            x: 1290, y: 470, w: 190, h: 250,    // bounding box against the right wall (1480 - 190 = 1290)
            color: '#ffcc00',
        };
        this.ticketShop.npcX = this.ticketShop.x + 66;
        this.ticketShop.npcY = this.ticketShop.y + 140;

        // Keep ticketPrizeZone reference for backwards compat but redirect
        this.ticketPrizeZone = null;

        const gameDefs = [
            { key: 'game1', name: 'Basketball', color: '#e67e22', index: 0 },
            { key: 'game2', name: 'Whack-A-Mole', color: '#ff007f', index: 1 },
            { key: 'game3', name: 'Boxing', color: '#00ccff', index: 2 },
            { key: 'game4', name: 'Claw Machine', color: '#b829ea', index: 3 },
            { key: 'game5', name: 'Quik Drop', color: '#ffcc00', index: 4 },
            { key: 'game6', name: 'Color Match', color: '#00cc44', index: 5 },
            { key: 'game7', name: 'Pop the Lock', color: '#ff4444', index: 6 },
            { key: 'game8', name: 'Slot Machine', color: '#45a29e', index: 7 },
            { key: 'game9', name: 'Pachinko', color: '#ff00ff', index: 8 },
            { key: 'game10', name: 'Lane Roller', color: '#ff6600', index: 9 },
            { key: 'game11', name: 'Stacker', color: '#00ffcc', index: 10 },
            { key: 'game12', name: 'Zombie Snatcher', color: '#7cfc00', index: 11 }
        ];

        // LEFT WALL: machines go DOWN (dy=+55), sát tường trái (x=160 center, wall at x=100-120)
        // Whack-A-Mole (top of left wall): y=175 → 175,230,285,340,395  (all inside: 175>120 ✓, 395<1080 ✓)
        // Pachinko (middle of left wall):  y=490 → 490,545,600,655,710  ✓
        // Basketball (bottom of left wall): y=810 → 810,865,920,975,1030 (1030+25=1055 < 1080 ✓)
        //
        // TOP WALL: machines go RIGHT (dx=+50), sát tường trên (y=160 center, wall at y=100-120)
        // Interior x: 120 to 1480. 4 groups, each 5*50=250px wide. Start at 200,530,860,1190.
        // Pop the Lock: x=200,250,300,350,400
        // Ball Drop:    x=530,580,630,680,730
        // Color Match:  x=860,910,960,1010,1060
        // Stacker:      x=1190,1240,1290,1340,1390 (1390+25=1415 < 1480 ✓)
        //
        // RIGHT WALL: machines go DOWN (dy=+55), sát tường phải (x=1440 center, wall at x=1480-1500)
        // Push Car (top): y=200 → 200,255,310,365,420 ✓ (gap before ticket prize at y=470)
        // Boxing (bottom): y=760 → 760,815,870,925,980 (980+25=1005 < 1080 ✓)
        //
        // CENTER: 2x5 horizontal
        // Slot Machine: y=520, x=650,720,790,860,930
        let placements = [
            // LEFT WALL — going DOWN
            { def: gameDefs.find(g => g.key === 'game2'), startX: 160, startY: 210, dx: 0, dy: 55, facing: 'right', labelOff: { x: 90, y: 0 } },
            { def: gameDefs.find(g => g.key === 'game9'), startX: 160, startY: 505, dx: 0, dy: 55, facing: 'right', labelOff: { x: 90, y: 0 } },
            { def: gameDefs.find(g => g.key === 'game1'), startX: 160, startY: 800, dx: 0, dy: 55, facing: 'right', labelOff: { x: 90, y: 0 } },

            // TOP WALL — going RIGHT
            { def: gameDefs.find(g => g.key === 'game7'), startX: 240, startY: 160, dx: 50, dy: 0, facing: 'down', labelOff: { x: 0, y: 70 } },
            { def: gameDefs.find(g => g.key === 'game5'), startX: 530, startY: 160, dx: 50, dy: 0, facing: 'down', labelOff: { x: 0, y: 70 } },
            { def: gameDefs.find(g => g.key === 'game6'), startX: 820, startY: 160, dx: 50, dy: 0, facing: 'down', labelOff: { x: 0, y: 70 } },
            { def: gameDefs.find(g => g.key === 'game11'), startX: 1110, startY: 160, dx: 50, dy: 0, facing: 'down', labelOff: { x: 0, y: 70 } },

            // RIGHT WALL — going DOWN
            { def: gameDefs.find(g => g.key === 'game10'), startX: 1440, startY: 200, dx: 0, dy: 55, facing: 'left', labelOff: { x: -90, y: 0 } },
            { def: gameDefs.find(g => g.key === 'game3'), startX: 1440, startY: 760, dx: 0, dy: 55, facing: 'left', labelOff: { x: -90, y: 0 } },

            // CENTER — horizontal
            { def: gameDefs.find(g => g.key === 'game12'), startX: 650, startY: 340, dx: 70, dy: 0, facing: 'down', labelOff: { x: 0, y: 65 } },
            { def: gameDefs.find(g => g.key === 'game8'), startX: 650, startY: 520, dx: 70, dy: 0, facing: 'down', labelOff: { x: 0, y: 65 } },
            { def: gameDefs.find(g => g.key === 'game4'), startX: 650, startY: 700, dx: 70, dy: 0, facing: 'down', labelOff: { x: 0, y: 65 } }
        ];

        for (let p of placements) {
            // Zone label at center of the group + offset
            let count = p.count || 5;
            let midX = p.startX + p.dx * (count / 2 - 0.5) + p.labelOff.x;
            let midY = p.startY + p.dy * (count / 2 - 0.5) + p.labelOff.y;
            this.zones.push({ name: p.def.name, color: p.def.color, x: midX, y: midY });

            for (let i = 0; i < count; i++) {
                let w = (p.facing === 'down') ? 50 : 40;
                let h = (p.facing === 'down') ? 40 : 50;
                this.cabinets.push({
                    id: p.def.key + '_' + i,
                    x: p.startX + p.dx * i,
                    y: p.startY + p.dy * i,
                    w: w, h: h,
                    facing: p.facing,
                    gameIndex: p.def.index,
                    gameName: p.def.name,
                    gameKey: p.def.key,
                    zoneColor: p.def.color,
                    occupied: false,
                    occupiedBy: null
                });
            }
        }
    }

    update(dt, player, input) {
        let speed = 250;
        let dx = 0, dy = 0;
        
        // Use w/a/s/d or arrows
        if (input.keys['KeyW'] || input.keys['ArrowUp']) dy -= speed;
        if (input.keys['KeyS'] || input.keys['ArrowDown']) dy += speed;
        if (input.keys['KeyA'] || input.keys['ArrowLeft']) dx -= speed;
        if (input.keys['KeyD'] || input.keys['ArrowRight']) dx += speed;

        if (dx !== 0 && dy !== 0) {
            let inv = 1 / Math.sqrt(2);
            dx *= inv; dy *= inv;
        }

        // Apply movement logic (wobble based on move state could be added here)
        player.moving = (dx !== 0 || dy !== 0);

        let newX = player.x + dx * dt;
        let newY = player.y + dy * dt;

        // Collision logic (AABB)
        let pw = 20, ph = 20; 
        
        let canMoveX = true, canMoveY = true;
        
        // Check walls
        for (let w of this.walls) {
            if (newX - pw/2 < w.x + w.w && newX + pw/2 > w.x && player.y - ph/2 < w.y + w.h && player.y + ph/2 > w.y) canMoveX = false;
            if (player.x - pw/2 < w.x + w.w && player.x + pw/2 > w.x && newY - ph/2 < w.y + w.h && newY + ph/2 > w.y) canMoveY = false;
        }

        // Check cabinets
        for (let c of this.cabinets) {
            if (newX - pw/2 < c.x + c.w/2 && newX + pw/2 > c.x - c.w/2 && player.y - ph/2 < c.y + c.h/2 && player.y + ph/2 > c.y - c.h/2) canMoveX = false;
            if (player.x - pw/2 < c.x + c.w/2 && player.x + pw/2 > c.x - c.w/2 && newY - ph/2 < c.y + c.h/2 && newY + ph/2 > c.y - c.h/2) canMoveY = false;
        }

        // Check ticket shop
        if (this.ticketShop) {
            let ts = this.ticketShop;
            if (newX - pw/2 < ts.x + ts.w && newX + pw/2 > ts.x && player.y - ph/2 < ts.y + ts.h && player.y + ph/2 > ts.y) canMoveX = false;
            if (player.x - pw/2 < ts.x + ts.w && player.x + pw/2 > ts.x && newY - ph/2 < ts.y + ts.h && newY + ph/2 > ts.y) canMoveY = false;
        }

        // Check leaderboard
        let lb = this.leaderboardSign;
        if (newX - pw/2 < lb.x + lb.w && newX + pw/2 > lb.x && player.y - ph/2 < lb.y + lb.h && player.y + ph/2 > lb.y) canMoveX = false;
        if (player.x - pw/2 < lb.x + lb.w && player.x + pw/2 > lb.x && newY - ph/2 < lb.y + lb.h && newY + ph/2 > lb.y) canMoveY = false;

        if (canMoveX) player.x = newX;
        if (canMoveY) player.y = newY;
    }

    getNearestInteractable(px, py) {
        let nearest = null;
        let minDist = 70; // Interaction range

        // Check cabinets
        for (let c of this.cabinets) {
            let dist = Math.hypot(px - c.x, py - c.y);
            if (dist < minDist) {
                minDist = dist;
                nearest = { type: 'cabinet', target: c };
            }
        }

        // Check leaderboard
        let lbCenter = { x: this.leaderboardSign.x + this.leaderboardSign.w/2, y: this.leaderboardSign.y + this.leaderboardSign.h/2 };
        let lbDist = Math.hypot(px - lbCenter.x, py - lbCenter.y);
        if (lbDist < 90 && lbDist < minDist) {
            nearest = { type: 'leaderboard' };
        }

        // Check ticket shop NPC
        let ts = this.ticketShop;
        let tsDist = Math.hypot(px - ts.npcX, py - ts.npcY);
        if (tsDist < 80 && tsDist < minDist) {
            nearest = { type: 'ticketshop' };
        }

        return nearest;
    }

    draw(ctx, camera, remotePlayers, localPlayer) {
        ctx.save();
        ctx.translate(-camera.x, -camera.y);

        // Floor - Outdoor
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, 0, this.width, this.height);

        // Floor - Building
        const bX = 100, bY = 100, bW = 1400, bH = 1000;
        
        if (this.carpetLoaded && !this.carpetPattern) {
            this.carpetPattern = ctx.createPattern(this.carpetImg, 'repeat');
        }

        if (this.carpetPattern) {
            ctx.fillStyle = this.carpetPattern;
            ctx.save();
            ctx.translate(bX, bY);
            ctx.fillRect(0, 0, bW, bH);
            ctx.restore();
        } else {
            ctx.fillStyle = '#252535';
            ctx.fillRect(bX, bY, bW, bH);
        }

        // Grid (subtle) - Only outside the building
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let x = 0; x <= this.width; x += 100) { 
            // draw lines but skip the building interior
            if (x > bX && x < bX + bW) {
                ctx.moveTo(x, 0); ctx.lineTo(x, bY);
                ctx.moveTo(x, bY + bH); ctx.lineTo(x, this.height);
            } else {
                ctx.moveTo(x, 0); ctx.lineTo(x, this.height);
            }
        }
        for (let y = 0; y <= this.height; y += 100) { 
            if (y > bY && y < bY + bH) {
                ctx.moveTo(0, y); ctx.lineTo(bX, y);
                ctx.moveTo(bX + bW, y); ctx.lineTo(this.width, y);
            } else {
                ctx.moveTo(0, y); ctx.lineTo(this.width, y); 
            }
        }
        ctx.stroke();

        // Walls
        ctx.fillStyle = '#111';
        for (let w of this.walls) {
            ctx.fillRect(w.x, w.y, w.w, w.h);
        }
        ctx.strokeStyle = '#66fcf1';
        ctx.lineWidth = 2;
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#66fcf1';
        for (let w of this.walls) {
            ctx.strokeRect(w.x, w.y, w.w, w.h);
        }
        ctx.shadowBlur = 0;

        // Draw Ticket Prize Shop
        TicketPrize.drawZone(ctx, this.ticketShop, this.drawPlayer.bind(this));

        // Zones Labels removed as requested

        // Cabinets
        for (let c of this.cabinets) {
            this.drawCabinet(ctx, c);
        }

        // Leaderboard Sign
        let lb = this.leaderboardSign;
        ctx.fillStyle = '#333';
        ctx.fillRect(lb.x, lb.y, lb.w, lb.h);
        ctx.strokeStyle = '#ff007f';
        ctx.lineWidth = 3;
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#ff007f';
        ctx.strokeRect(lb.x, lb.y, lb.w, lb.h);
        ctx.shadowBlur = 0;
        ctx.font = '20px Orbitron';
        ctx.fillStyle = '#ff007f';
        ctx.textAlign = 'center';
        ctx.fillText('LEADERBOARD', lb.x + lb.w/2, lb.y + 28);

        // Collect all players to sort and draw
        let allPlayers = [localPlayer];
        for (let id in remotePlayers) {
            allPlayers.push(remotePlayers[id]);
        }
        allPlayers.sort((a, b) => a.y - b.y);

        const time = Date.now() / 1000;

        for (let p of allPlayers) {
            this.drawPlayer(ctx, p, time);
        }

        // Draw interaction prompt for local player
        let interactable = this.getNearestInteractable(localPlayer.x, localPlayer.y);
        if (interactable) {
            let px = localPlayer.x;
            let py = localPlayer.y - 45;
            ctx.textAlign = 'center';
            ctx.shadowBlur = 5;
            ctx.shadowColor = '#66fcf1';
            
            if (interactable.type === 'cabinet') {
                ctx.font = 'bold 16px Orbitron';
                ctx.fillStyle = interactable.target.zoneColor;
                ctx.fillText(interactable.target.gameName, px, py - 18);
            } else if (interactable.type === 'ticketshop') {
                ctx.font = 'bold 16px Orbitron';
                ctx.fillStyle = '#ffcc00';
                ctx.fillText('Ticket Prize Shop', px, py - 18);
            }
            
            ctx.font = '14px Orbitron';
            ctx.fillStyle = '#fff';
            ctx.fillText("Press 'E' to interact", px, py);
            ctx.shadowBlur = 0;
        }

        ctx.restore();
    }

    drawCabinet(ctx, c) {
        ctx.save();
        ctx.translate(c.x, c.y);
        
        // Rotate based on facing direction
        // Default orientation: screen faces DOWN (toward positive Y)
        if (c.facing === 'right') ctx.rotate(-Math.PI/2);
        else if (c.facing === 'left') ctx.rotate(Math.PI/2);
        else if (c.facing === 'up') ctx.rotate(Math.PI);
        // 'down' = no rotation
        
        let w = c.w;
        let h = c.h;
        let col = c.zoneColor;
        
        // === CABINET BODY (dark box) ===
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(-w/2, -h/2, w, h);
        
        // === SCREEN (top portion, glowing) ===
        let screenH = h * 0.45;
        let screenPad = 4;
        
        // Screen background glow
        ctx.shadowColor = col;
        ctx.shadowBlur = 8;
        ctx.fillStyle = col;
        ctx.globalAlpha = 0.15;
        ctx.fillRect(-w/2 + screenPad, -h/2 + screenPad, w - screenPad*2, screenH);
        ctx.globalAlpha = 1.0;
        
        // Screen border
        ctx.strokeStyle = col;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(-w/2 + screenPad, -h/2 + screenPad, w - screenPad*2, screenH);
        ctx.shadowBlur = 0;
        
        // === CONTROL PANEL (middle strip) ===
        let panelY = -h/2 + screenPad + screenH + 3;
        let panelH = h * 0.2;
        ctx.fillStyle = '#2a2a3e';
        ctx.fillRect(-w/2 + 3, panelY, w - 6, panelH);
        
        // Buttons on control panel (2 small dots)
        let btnR = 2.5;
        ctx.fillStyle = col;
        ctx.shadowColor = col;
        ctx.shadowBlur = 4;
        ctx.beginPath();
        ctx.arc(-w/6, panelY + panelH/2, btnR, 0, Math.PI*2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(w/6, panelY + panelH/2, btnR, 0, Math.PI*2);
        ctx.fill();
        ctx.shadowBlur = 0;
        
        // === BASE (bottom portion, darker) ===
        let baseY = panelY + panelH + 2;
        let baseH = h/2 - (baseY) + h/2 - 2;
        if (baseH > 2) {
            ctx.fillStyle = '#111';
            ctx.fillRect(-w/2 + 2, baseY, w - 4, baseH);
        }
        
        // === NEON TRIM (outer border glow) ===
        ctx.strokeStyle = col;
        ctx.lineWidth = 1.5;
        ctx.shadowColor = col;
        ctx.shadowBlur = 6;
        ctx.strokeRect(-w/2, -h/2, w, h);
        ctx.shadowBlur = 0;
        
        // === TOP MARQUEE (thin colored bar at very top) ===
        ctx.fillStyle = col;
        ctx.shadowColor = col;
        ctx.shadowBlur = 5;
        ctx.fillRect(-w/2 + 2, -h/2 + 1, w - 4, 3);
        ctx.shadowBlur = 0;
        
        ctx.restore();
    }

    drawPlayer(ctx, p, time) {
        if (p.inGame) {
            ctx.globalAlpha = 0.3;
        }

        let wobble = 0;
        if (p.moving || (p.targetX !== undefined && (Math.abs(p.x - p.targetX) > 1 || Math.abs(p.y - p.targetY) > 1))) {
            wobble = Math.sin(time * 15) * 0.2;
        }

        // Draw shadow
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.beginPath();
        ctx.ellipse(p.x, p.y + 10, 12, 6, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(wobble);

        // Simple rectangular body and circular head
        ctx.fillStyle = p.color;
        
        // Body (Rectangle)
        ctx.fillRect(-10, -10, 20, 20);
        
        // Head (Circle)
        ctx.beginPath();
        ctx.arc(0, -15, 8, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();

        // Name
        ctx.font = '12px Inter';
        ctx.textAlign = 'center';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 3;
        ctx.strokeText(p.name, p.x, p.y - 30);
        ctx.fillStyle = '#fff';
        ctx.fillText(p.name, p.x, p.y - 30);

        ctx.globalAlpha = 1;
    }
}
