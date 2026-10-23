const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const uiLayer = document.getElementById('ui-layer');

let network = new Network();
let world = new World();
let camera = new Camera();
let localPlayer = { id: null, name: '', x: 0, y: 0, color: '', inGame: false, moving: false };
let remotePlayers = {};
let currentCabinet = null;
let currentLeaderboardGameIndex = 0;

const input = new Input(canvas);
let isExitConfirmOpen = false;

// We need to resize canvas to full window
function resize() {
    // If playing a game, keep standard Arcade ratio (1024x768)
    // object-fit: contain in CSS will scale it to screen while maintaining aspect ratio
    if (typeof currentState !== 'undefined' && currentState === STATES.PLAYING_GAME) {
        canvas.width = 1024;
        canvas.height = 768;
    } else {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
}
window.addEventListener('resize', resize);

const STATES = {
    NAME_ENTRY: 0,
    CONNECTING: 1,
    WORLD: 2,
    PLAYING_GAME: 3,
    LEADERBOARD: 4
};

let currentState = STATES.NAME_ENTRY;
let activeGame = null;
let lastTime = 0;

const GAMES_PER_PAGE = 6;
const allGames = [
    { key: 'game1', name: 'Basketball', class: BasketballGame },
    { key: 'game2', name: 'Whack-A-Mole', class: WhackAMoleGame },
    { key: 'game3', name: 'Boxing', class: BoxingGame },
    { key: 'game4', name: 'Claw Machine', class: ClawMachineGame },
    { key: 'game5', name: 'Quik Drop', class: BallDropGame },
    { key: 'game6', name: 'Color Match', class: ColorMatchGame },
    { key: 'game7', name: 'Pop the Lock', class: PopTheLockGame },
    { key: 'game8', name: 'Slot Machine', class: SlotMachineGame },
    { key: 'game9', name: 'Pachinko', class: PachinkoGame },
    { key: 'game10', name: 'Lane Roller', class: PushCarGame },
    { key: 'game11', name: 'Stacker', class: StackerGame },
    { key: 'game12', name: 'Zombie Snatcher', class: ZombieSnatcherGame }
];

function setUI(html) {
    uiLayer.innerHTML = html;
}

function switchState(newState) {
    currentState = newState;
    resize();
    
    switch(newState) {
        case STATES.NAME_ENTRY:
            setUI(`
                <div class="menu-screen name-entry-screen">
                    <h1 class="title">Arcade World</h1>
                    <p style="color: #fff; margin-bottom: 20px; font-family: Inter;">Enter your name to join:</p>
                    <input type="text" id="playerName" class="arcade-input" placeholder="Your Name" maxlength="15" autofocus>
                    <button class="btn" style="margin-top:20px" onclick="joinServer()">Enter Arcade</button>
                </div>
            `);
            setTimeout(() => {
                const nameInput = document.getElementById('playerName');
                if(nameInput) {
                    nameInput.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter') joinServer();
                    });
                }
            }, 100);
            break;
            
        case STATES.CONNECTING:
            setUI(`
                <div class="menu-screen connecting-screen">
                    <h2 class="title" style="font-size: 2.5rem;">Connecting...</h2>
                </div>
            `);
            break;
            
        case STATES.WORLD:
            setUI('');
            break;
            
        case STATES.PLAYING_GAME:
            setUI('');
            break;

        case STATES.LEADERBOARD:
            showLeaderboardUI();
            break;
    }
}

function joinServer() {
    const nameInput = document.getElementById('playerName');
    const name = nameInput.value.trim() || 'Player' + Math.floor(Math.random() * 1000);
    const skin = Store.getActiveSkin();
    localPlayer.skin = skin;
    
    switchState(STATES.CONNECTING);
    
    setupNetworkCallbacks();
    network.connect(name, skin);
}

function setupNetworkCallbacks() {
    network.onWelcome = (data) => {
        localPlayer.id = data.id;
        localPlayer.x = data.x;
        localPlayer.y = data.y;
        localPlayer.color = data.color;
        localPlayer.name = data.players[data.id].name;
        localPlayer.skin = data.players[data.id].skin || Store.getActiveSkin();
        
        remotePlayers = {};
        for (let id in data.players) {
            if (id !== localPlayer.id) {
                let p = data.players[id];
                remotePlayers[id] = { ...p, targetX: p.x, targetY: p.y };
            }
        }
        
        switchState(STATES.WORLD);
    };
    
    network.onPlayerJoined = (p) => {
        remotePlayers[p.id] = { ...p, targetX: p.x, targetY: p.y };
    };
    
    network.onPlayerLeft = (data) => {
        if (remotePlayers[data.id]) {
            delete remotePlayers[data.id];
        }
    };
    
    network.onPlayerMoved = (data) => {
        if (remotePlayers[data.id]) {
            remotePlayers[data.id].targetX = data.x;
            remotePlayers[data.id].targetY = data.y;
        }
    };

    network.onPlayerSkinChanged = (data) => {
        if (data.id === localPlayer.id) {
            localPlayer.skin = data.skin;
        } else if (remotePlayers[data.id]) {
            remotePlayers[data.id].skin = data.skin;
        }
    };

    network.onPlayerStartedGame = (data) => {
        if (data.id === localPlayer.id) return;
        if (remotePlayers[data.id]) remotePlayers[data.id].inGame = true;
    };

    network.onPlayerEndedGame = (data) => {
        if (data.id === localPlayer.id) return;
        if (remotePlayers[data.id]) remotePlayers[data.id].inGame = false;
    };

    network.onLeaderboard = (data) => {
        if (currentState === STATES.LEADERBOARD) {
            renderLeaderboardTable(data.scores);
        }
    };
}

function showLeaderboardUI() {
    let game = allGames[currentLeaderboardGameIndex];
    
    setUI(`
        <div class="menu-screen leaderboard-panel" style="width: 600px;">
            <div style="display:flex; justify-content: space-between; width: 100%; align-items: center; margin-bottom: 20px;">
                <button class="page-arrow" onclick="changeLeaderboardGame(-1)">❮</button>
                <h2 class="title" style="font-size: 2.2rem; margin: 0;">${game.name}</h2>
                <button class="page-arrow" onclick="changeLeaderboardGame(1)">❯</button>
            </div>
            <div id="leaderboard-table-container">
                <p style="color:#fff; font-family:Inter;">Loading...</p>
            </div>
            <button class="btn" style="margin-top: 25px; padding: 10px 30px; font-size: 1.2rem;" onclick="closeLeaderboard()">Close (ESC)</button>
        </div>
    `);
    
    network.requestLeaderboard(game.key);
}

function changeLeaderboardGame(dir) {
    currentLeaderboardGameIndex += dir;
    if (currentLeaderboardGameIndex < 0) currentLeaderboardGameIndex = allGames.length - 1;
    if (currentLeaderboardGameIndex >= allGames.length) currentLeaderboardGameIndex = 0;
    
    let game = allGames[currentLeaderboardGameIndex];
    document.querySelector('.leaderboard-panel h2.title').innerText = game.name;
    document.getElementById('leaderboard-table-container').innerHTML = '<p style="color:#fff; font-family:Inter;">Loading...</p>';
    
    network.requestLeaderboard(game.key);
}

function renderLeaderboardTable(scores) {
    const container = document.getElementById('leaderboard-table-container');
    if (!container) return;
    
    if (!scores || scores.length === 0) {
        container.innerHTML = '<p style="color:#aaa; font-family:Inter;">No scores yet. Be the first!</p>';
        return;
    }
    
    let html = `
        <table style="width:100%; border-collapse: collapse; font-family: Inter; color: #fff;">
            <tr style="border-bottom: 2px solid #66fcf1; text-align: left;">
                <th style="padding: 10px; color: #66fcf1; font-family: Orbitron;">Rank</th>
                <th style="padding: 10px; color: #66fcf1; font-family: Orbitron;">Name</th>
                <th style="padding: 10px; color: #66fcf1; font-family: Orbitron; text-align: right;">Score</th>
            </tr>
    `;
    
    scores.forEach((s, i) => {
        let color = i === 0 ? '#ffcc00' : i === 1 ? '#c0c0c0' : i === 2 ? '#cd7f32' : '#fff';
        html += `
            <tr style="border-bottom: 1px solid #333;">
                <td style="padding: 10px; color: ${color}; font-weight: bold;">#${i+1}</td>
                <td style="padding: 10px; color: ${color};">${s.name}</td>
                <td style="padding: 10px; text-align: right; color: ${color}; font-family: Orbitron;">${s.score}</td>
            </tr>
        `;
    });
    
    html += '</table>';
    container.innerHTML = html;
}

function closeLeaderboard() {
    switchState(STATES.WORLD);
}

window.addEventListener('keydown', (e) => {
    if (e.code === 'Escape' && currentState === STATES.LEADERBOARD) {
        closeLeaderboard();
    }
});

function startGameAtCabinet(cabinet) {
    currentCabinet = cabinet;
    const GameClass = allGames[cabinet.gameIndex].class;
    activeGame = new GameClass();
    
    canvas.width = 1024;
    canvas.height = 768;
    
    activeGame.init();
    localPlayer.inGame = true;
    network.sendStartGame(cabinet.id);
    
    switchState(STATES.PLAYING_GAME);
}

function drawHUD(score, timeFormatted) {
    ctx.font = '30px Orbitron';
    ctx.fillStyle = '#fff';
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#66fcf1';
    ctx.textAlign = 'left';
    ctx.fillText(`Score: ${score}`, 40, 50);
    if(timeFormatted) {
        ctx.textAlign = 'right';
        ctx.fillText(`Time: ${timeFormatted}`, canvas.width - 100, 50);
    }
    ctx.shadowBlur = 0;

    // Exit Button (Cyberpunk style)
    let btnW = 60;
    let btnH = 30;
    let btnX = canvas.width - 20 - btnW; // Right-aligned with 20px padding
    let btnY = 25;
    
    ctx.fillStyle = 'rgba(231, 76, 60, 0.1)'; 
    ctx.fillRect(btnX, btnY, btnW, btnH);
    ctx.strokeStyle = '#e74c3c';
    ctx.lineWidth = 2;
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#e74c3c';
    ctx.strokeRect(btnX, btnY, btnW, btnH);
    
    ctx.fillStyle = '#e74c3c';
    ctx.font = '13px Orbitron';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('EXIT', btnX + btnW/2, btnY + btnH/2);
    ctx.shadowBlur = 0;
    ctx.textBaseline = 'alphabetic';
}

function getTickMultiplier(gameKey) {
    const multipliers = {
        'game1': 10,  // Basketball
        'game2': 5,   // Whack-A-Mole
        'game5': 10,  // Quik Drop
        'game4': 10,  // Claw Machine
    };
    return multipliers[gameKey] || 1;
}

function showGameOver(score, gameKey) {
    network.sendEndGame(gameKey, score);
    localPlayer.inGame = false;
    
    const isHigh = score > 0 && Store.setHighScore(gameKey, score);

    const multiplier = getTickMultiplier(gameKey);
    let ticksEarned = score * multiplier;

    // Rainbow Skin Bonus: 1.2x tickets in all games, rounded to integer
    const hasRainbow = (Store.getActiveSkin() === 'rainbow');
    if (hasRainbow) {
        ticksEarned = Math.round(ticksEarned * 1.2);
    }

    Store.addTicks(ticksEarned);
    const totalTicks = Store.getTicks();
    
    setUI(`
        <div class="menu-screen">
            <h2 class="title" style="font-size: 4rem;">Game Over</h2>
            <p style="font-size: 2rem; color: #fff; margin-bottom: 10px;">Score: <span style="color: #66fcf1">${score}</span></p>
            <p style="font-size: 1.5rem; color: #ffcc00; margin-bottom: 6px;">Tickets earned: <strong>${ticksEarned.toLocaleString('en-US')} ticks</strong>${hasRainbow ? ' <span style="color:#ff00ff; font-size:1.1rem; text-shadow:0 0 8px #ff00ff;">(1.2x Rainbow Bonus!)</span>' : ''}</p>
            <p style="font-size: 1.2rem; color: #66fcf1; margin-bottom: 20px;">Total: <strong>${totalTicks.toLocaleString('en-US')} ticks</strong></p>
            ${isHigh ? '<p style="font-size: 1.5rem; color: #ff007f; margin-bottom: 20px; animation: pulsate 1s infinite alternate;">New Local High Score!</p>' : ''}
            <button class="btn" onclick="backToWorld()">Back to Arcade</button>
        </div>
    `);
    activeGame = null;
}

function showToast(message) {
    let toast = document.getElementById('gameToast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'gameToast';
        toast.style.cssText = 'position:fixed; top:35px; left:50%; transform:translateX(-50%); background:rgba(15,15,30,0.95); border:2px solid #ff00ff; color:#fff; padding:14px 28px; border-radius:10px; font-family:Orbitron, sans-serif; font-size:16px; z-index:999999; box-shadow:0 0 25px rgba(255,0,255,0.7); pointer-events:none; transition:opacity 0.4s ease, transform 0.4s ease; text-align:center; line-height:1.5;';
        document.body.appendChild(toast);
    }
    toast.innerHTML = message;
    toast.style.opacity = '1';
    toast.style.transform = 'translateX(-50%) translateY(0)';
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(-50%) translateY(-10px)';
    }, 3500);
}


function backToWorld() {
    resize();
    switchState(STATES.WORLD);
}

function interpolateRemotePlayers(dt) {
    for (let id in remotePlayers) {
        let p = remotePlayers[id];
        p.x += (p.targetX - p.x) * 10 * dt;
        p.y += (p.targetY - p.y) * 10 * dt;
    }
}

function gameLoop(timestamp) {
    const dt = Math.min((timestamp - lastTime) / 1000, 0.1);
    lastTime = timestamp;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (currentState === STATES.WORLD || currentState === STATES.LEADERBOARD) {
        if (currentState === STATES.WORLD) {
            let oldX = localPlayer.x, oldY = localPlayer.y;
            world.update(dt, localPlayer, input);
            if (localPlayer.x !== oldX || localPlayer.y !== oldY) {
                network.sendMove(localPlayer.x, localPlayer.y);
            }
            
            if (input.isKeyJustPressed('KeyE')) {
                let interactable = world.getNearestInteractable(localPlayer.x, localPlayer.y);
                if (interactable) {
                    if (interactable.type === 'cabinet') {
                        startGameAtCabinet(interactable.target);
                    } else if (interactable.type === 'leaderboard') {
                        switchState(STATES.LEADERBOARD);
                    } else if (interactable.type === 'ticketshop') {
                        const closeShop = () => {
                            setUI('');
                            window.removeEventListener('keydown', escHandler);
                        };
                        TicketPrize.open(uiLayer, localPlayer.color, closeShop);
                        const escHandler = (e) => {
                            if (e.code === 'Escape') closeShop();
                        };
                        window.addEventListener('keydown', escHandler);
                    } else if (interactable.type === 'easterEgg') {
                        localPlayer.lastNormalPos = { x: localPlayer.x, y: localPlayer.y };
                        localPlayer.x = interactable.target.destX;
                        localPlayer.y = interactable.target.destY;
                        network.sendMove(localPlayer.x, localPlayer.y);
                    } else if (interactable.type === 'easterEggExit') {
                        let dest = localPlayer.lastNormalPos || interactable.target;
                        localPlayer.x = dest.destX || dest.x;
                        localPlayer.y = dest.destY || dest.y;
                        network.sendMove(localPlayer.x, localPlayer.y);
                    } else if (interactable.type === 'secretReward') {
                        if (!Store.hasItem('rainbow')) {
                            Store.grantItem('rainbow');
                            Store.setActiveSkin('rainbow');
                            localPlayer.skin = 'rainbow';
                            if (typeof network !== 'undefined' && network) {
                                network.sendSkinChange('rainbow');
                            }
                            showToast('🌈 Rainbow Skin Claimed & Equipped!<br><span style="color:#66fcf1; font-size:14px;">Bonus: 1.2x Tickets in all games!</span>');
                        } else {
                            const isEquipped = (Store.getActiveSkin() === 'rainbow');
                            const nextSkin = isEquipped ? null : 'rainbow';
                            Store.setActiveSkin(nextSkin);
                            localPlayer.skin = nextSkin;
                            if (typeof network !== 'undefined' && network) {
                                network.sendSkinChange(nextSkin);
                            }
                            showToast(nextSkin ? '🌈 Rainbow Skin Equipped (+1.2x Tickets)' : 'Rainbow Skin Unequipped');
                        }
                    }
                }
            }
        }
        
        interpolateRemotePlayers(dt);
        let zoom = 1.8;
        let viewW = canvas.width / zoom;
        let viewH = canvas.height / zoom;
        
        let inSecretRoom = (localPlayer.x >= 1700);
        if (inSecretRoom) {
            // Camera follows player inside the secret room out in the void (bounded to secret area)
            camera.follow(localPlayer.x, localPlayer.y, viewW, viewH, world.width, world.height, 1650, 0);
        } else {
            // Main arcade map — clamped strictly to 1600x1400 so camera NEVER pans past the blue wall!
            camera.follow(localPlayer.x, localPlayer.y, viewW, viewH, world.mapWidth, world.mapHeight, 0, 0);
        }
        
        ctx.save();
        ctx.scale(zoom, zoom);
        world.draw(ctx, camera, remotePlayers, localPlayer);
        ctx.restore();
    } 
    else if (currentState === STATES.PLAYING_GAME) {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        if (activeGame) {
            if (isExitConfirmOpen) {
                // Draw game in background, paused
                activeGame.draw(ctx);
                
                // Draw overlay and confirmation popup
                ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                
                let boxW = 450;
                let boxH = 220;
                let boxX = canvas.width/2 - boxW/2;
                let boxY = canvas.height/2 - boxH/2;

                // Cyberpunk panel
                ctx.fillStyle = 'rgba(10, 10, 20, 0.9)';
                ctx.fillRect(boxX, boxY, boxW, boxH);
                ctx.strokeStyle = '#00ffff';
                ctx.lineWidth = 3;
                ctx.shadowBlur = 15;
                ctx.shadowColor = '#00ffff';
                ctx.strokeRect(boxX, boxY, boxW, boxH);
                ctx.shadowBlur = 0;
                
                // Draw some tech accents
                ctx.beginPath();
                ctx.moveTo(boxX - 5, boxY + 20); ctx.lineTo(boxX + 20, boxY - 5);
                ctx.moveTo(boxX + boxW + 5, boxY + boxH - 20); ctx.lineTo(boxX + boxW - 20, boxY + boxH + 5);
                ctx.strokeStyle = '#ff007f';
                ctx.lineWidth = 4;
                ctx.stroke();

                ctx.fillStyle = '#fff';
                ctx.font = '22px Orbitron';
                ctx.textAlign = 'center';
                ctx.fillText('ABORT MISSION?', canvas.width/2, boxY + 60);
                
                ctx.fillStyle = '#ff4444';
                ctx.font = '14px Inter';
                ctx.fillText('Warning: Exiting now will result in a score of 0.', canvas.width/2, boxY + 95);
                
                // Back/Resume Button
                ctx.fillStyle = 'rgba(0, 255, 255, 0.15)';
                ctx.fillRect(canvas.width/2 - 160, boxY + 140, 140, 45);
                ctx.strokeStyle = '#00ffff';
                ctx.strokeRect(canvas.width/2 - 160, boxY + 140, 140, 45);
                ctx.fillStyle = '#00ffff';
                ctx.font = '16px Orbitron';
                ctx.fillText('RESUME', canvas.width/2 - 90, boxY + 168);
                
                // Exit/Abort Button
                ctx.fillStyle = 'rgba(255, 0, 127, 0.15)';
                ctx.fillRect(canvas.width/2 + 20, boxY + 140, 140, 45);
                ctx.strokeStyle = '#ff007f';
                ctx.strokeRect(canvas.width/2 + 20, boxY + 140, 140, 45);
                ctx.fillStyle = '#ff007f';
                ctx.fillText('ABORT', canvas.width/2 + 90, boxY + 168);
                
                if (input.mouse.justPressed) {
                    let mx = input.mouse.x;
                    let my = input.mouse.y;
                    
                    // Click Resume
                    if (mx >= canvas.width/2 - 160 && mx <= canvas.width/2 - 20 && my >= boxY + 140 && my <= boxY + 185) {
                        isExitConfirmOpen = false;
                    }
                    // Click Abort
                    else if (mx >= canvas.width/2 + 20 && mx <= canvas.width/2 + 160 && my >= boxY + 140 && my <= boxY + 185) {
                        isExitConfirmOpen = false;
                        activeGame.score = 0; // Punish for early exit
                        activeGame.isGameOver = true;
                    }
                }
            } else {
                // Check Exit button click (Rect: canvas.width - 80, 25, 60, 30)
                if (input.mouse.justPressed) {
                    let mx = input.mouse.x;
                    let my = input.mouse.y;
                    if (mx >= canvas.width - 80 && mx <= canvas.width - 20 && my >= 25 && my <= 55) {
                        isExitConfirmOpen = true;
                    }
                }

                activeGame.update(dt, input);
                activeGame.draw(ctx);
                if (activeGame.isGameOver) {
                    showGameOver(activeGame.score, activeGame.gameKey);
                }
            }
        }
    }

    input.update();
    requestAnimationFrame(gameLoop);
}

// Init
switchState(STATES.NAME_ENTRY);
requestAnimationFrame(gameLoop);
