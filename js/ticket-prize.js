// Ticket Prize artwork and catalog. Purchases/ticket balances are intentionally not enabled yet.
const TicketPrize = {
    items: [
        { id: 'hat', name: 'Hat', category: 'ACCESSORY', price: 500, color: '#ffcc00' },
        { id: 'tank', name: 'Tank Top', category: 'OUTFIT', price: 1000, color: '#66fcf1' },
        { id: 'among', name: 'Crewmate Skin', category: 'SKIN', price: 5000, color: '#b829ea' },
        { id: 'jersey', name: 'Red Jersey #7', category: 'OUTFIT', price: 7000, color: '#ff5574' },
        { id: 'rainbow', name: 'Rainbow Skin', category: 'EASTER EGG (1.2x)', price: 0, color: '#ff00ff', secret: true }
    ],

    hat(ctx) {
        ctx.fillStyle = '#ffcc00';
        ctx.beginPath();
        ctx.roundRect(-9, -28, 18, 9, [5, 5, 0, 0]);
        ctx.fill();
        ctx.fillStyle = '#c88822';
        ctx.fillRect(-9, -22, 18, 3);
        ctx.fillStyle = '#ffdc65';
        ctx.fillRect(-13, -19, 26, 3);
    },

    crewmate(ctx, color) {
        ctx.lineJoin = 'round';
        ctx.strokeStyle = '#141522';
        ctx.lineWidth = 2.5;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.roundRect(-14, -7, 8, 22, 4);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.roundRect(-9, -21, 23, 40, [12, 12, 9, 9]);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#95e3f3';
        ctx.beginPath();
        ctx.roundRect(-2, -15, 19, 11, 5);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#e6fbff';
        ctx.fillRect(2, -13, 9, 3);
    },

    bear(ctx, color) {
        ctx.fillStyle = color;
        for (const [x, y, r] of [[-10, -17, 6], [10, -17, 6], [0, -9, 13]]) {
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.beginPath();
        ctx.roundRect(-12, 2, 24, 22, 10);
        ctx.fill();
        ctx.fillStyle = '#28202b';
        ctx.fillRect(-6, -12, 3, 3);
        ctx.fillRect(4, -12, 3, 3);
    },

    drawZone(ctx, zone, drawPlayer) {
        ctx.save();
        ctx.translate(zone.x, zone.y);
        ctx.fillStyle = '#171824';
        ctx.beginPath();
        ctx.roundRect(0, 0, zone.w, zone.h, 10);
        ctx.fill();
        ctx.strokeStyle = '#72582d';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Toy-filled shelves behind the attendant, on the wall side.
        for (let row = 0; row < 3; row++) {
            const y = 64 + row * 70;
            ctx.fillStyle = '#302b3b';
            ctx.fillRect(104, y - 32, 68, 62);
            for (let col = 0; col < 2; col++) {
                ctx.save();
                ctx.translate(121 + col * 34, y);
                ctx.scale(0.62, 0.62);
                if ((row + col) % 2 === 0) this.crewmate(ctx, ['#ff5574', '#66fcf1', '#b829ea'][row]);
                else this.bear(ctx, row === 1 ? '#dba3cf' : '#b98052');
                ctx.restore();
            }
            ctx.fillStyle = '#dba754';
            ctx.fillRect(103, y + 24, 70, 5);
        }
        drawPlayer(ctx, { x: 66, y: 140, color: '#999da8', name: '', moving: false }, 0);
        ctx.save();
        ctx.translate(66, 140);
        this.hat(ctx);
        ctx.restore();

        // Half-circle counter faces the aisle to the left; the straight edge is behind it.
        ctx.save();
        ctx.translate(74, 140);
        ctx.fillStyle = '#533750';
        ctx.beginPath();
        ctx.ellipse(0, 5, 66, 92, 0, Math.PI / 2, Math.PI * 1.5);
        ctx.ellipse(0, 5, 42, 68, 0, Math.PI * 1.5, Math.PI / 2, true);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#af7144';
        ctx.strokeStyle = '#ffcc00';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(0, 0, 66, 92, 0, Math.PI / 2, Math.PI * 1.5);
        ctx.ellipse(0, 0, 42, 68, 0, Math.PI * 1.5, Math.PI / 2, true);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();

        ctx.fillStyle = '#262231';
        ctx.fillRect(10, 6, zone.w - 20, 22);
        ctx.font = 'bold 12px Orbitron, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffdc65';
        ctx.fillText('TICKET PRIZE', zone.w / 2, 22);
        ctx.restore();
    },

    drawSkin(ctx, item, playerColor) {
        ctx.save();
        ctx.translate(110, 90);
        ctx.fillStyle = '#10111c';
        ctx.beginPath();
        ctx.ellipse(0, 46, 49, 10, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.scale(2.3, 2.3);
        if (item.id === 'among') {
            this.crewmate(ctx, '#e74b65');
        } else if (item.id === 'rainbow') {
            const grad = ctx.createLinearGradient(-10, -25, 10, 10);
            grad.addColorStop(0, '#ff0055');
            grad.addColorStop(0.25, '#ffcc00');
            grad.addColorStop(0.5, '#00ff66');
            grad.addColorStop(0.75, '#00ccff');
            grad.addColorStop(1, '#cc00ff');
            ctx.shadowColor = '#ff00ff';
            ctx.shadowBlur = 10;
            ctx.fillStyle = grad;
            ctx.fillRect(-10, -10, 20, 20);
            ctx.beginPath();
            ctx.arc(0, -15, 8, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
        } else {
            // Base mannequin matches the gray attendant on display at the counter.
            ctx.fillStyle = '#999da8';
            ctx.fillRect(-10, -10, 20, 20);
            ctx.beginPath();
            ctx.arc(0, -15, 8, 0, Math.PI * 2);
            ctx.fill();
            if (item.id === 'hat') this.hat(ctx);
            if (item.id === 'tank') {
                ctx.fillStyle = '#f5f1de';
                ctx.fillRect(-10, -10, 20, 20);
                ctx.fillStyle = '#999da8';
                ctx.fillRect(-10, -10, 3, 5);
                ctx.fillRect(7, -10, 3, 5);
                ctx.beginPath();
                ctx.moveTo(-3, -10);
                ctx.lineTo(3, -10);
                ctx.lineTo(0, -5);
                ctx.closePath();
                ctx.fill();
                ctx.fillStyle = '#f5f1de';
                ctx.fillRect(-4, -10, 2, 3);
                ctx.fillRect(2, -10, 2, 3);
            }
            if (item.id === 'jersey') {
                ctx.fillStyle = '#df304b';
                ctx.fillRect(-10, -10, 20, 20);
                ctx.fillRect(-14, -10, 6, 6);
                ctx.fillRect(8, -10, 6, 6);
                ctx.fillStyle = '#fff3df';
                ctx.fillRect(-3, -10, 6, 2);
                ctx.font = 'bold 14px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('7', 0, 3);
                ctx.textBaseline = 'alphabetic';
            }
        }
        ctx.restore();
    },

    _renderShop(uiLayer, playerColor, onClose) {
        const ticks = Store.getTicks();
        const activeSkin = Store.getActiveSkin();

        uiLayer.innerHTML = `
            <div class="prize-store-backdrop">
                <section class="prize-store" role="dialog" aria-modal="true" aria-labelledby="prize-store-title" aria-describedby="prize-store-note">
                    <header class="prize-store-header">
                        <div>
                            <p class="prize-store-eyebrow">TICKET PRIZE / PLAYER SKINS</p>
                            <h2 id="prize-store-title">SKIN STORE<span>Change your look. Enter the game.</span></h2>
                        </div>
                        <div style="display:flex; flex-direction:column; align-items:flex-end; gap:6px;">
                            <p class="prize-store-balance">🎟 <strong>${ticks.toLocaleString('en-US')}</strong> ticks</p>
                            <button class="prize-store-close" type="button" aria-label="Close shop">×</button>
                        </div>
                    </header>
                    <div class="prize-store-grid">
                        ${this.items.map((item, index) => {
                            const owned = Store.hasItem(item.id);
                            const isActive = activeSkin === item.id;
                            let btnHtml;
                            let priceHtml;
                            if (isActive) {
                                btnHtml = `<button type="button" class="prize-btn-equipped" disabled>Equipped</button>`;
                            } else if (owned) {
                                btnHtml = `<button type="button" class="prize-btn-equip" data-skin-id="${item.id}">Equip</button>`;
                            } else if (item.secret) {
                                btnHtml = `<button type="button" class="prize-btn-buy prize-btn-cant-afford" disabled style="opacity:0.5; cursor:not-allowed;">Locked</button>`;
                            } else {
                                const canAfford = ticks >= item.price;
                                btnHtml = `<button type="button" class="prize-btn-buy${canAfford ? '' : ' prize-btn-cant-afford'}" data-skin-id="${item.id}" data-price="${item.price}" ${canAfford ? '' : 'disabled'}>Buy</button>`;
                            }

                            if (item.secret) {
                                priceHtml = owned ? `<span style="color:#66fcf1; font-weight:bold;">UNLOCKED (+1.2x)</span>` : `<span style="color:#ff00ff;">Secret Room</span>`;
                            } else {
                                priceHtml = `${item.price.toLocaleString('en-US')} <span>tick</span>`;
                            }

                            const glowStyle = isActive ? 'box-shadow: 0 0 0 3px #66fcf1, 0 0 16px #66fcf1;' : (item.id === 'rainbow' && owned ? 'box-shadow: 0 0 0 2px #ff00ff, 0 0 14px rgba(255,0,255,0.6);' : '');
                            return `
                            <article class="prize-item" style="--item-color:${item.color}">
                                <div class="prize-item-art" style="${glowStyle}"><span class="prize-item-number">0${index + 1}</span><canvas width="220" height="160" data-skin="${item.id}" role="img" aria-label="${item.name}"></canvas></div>
                                <div class="prize-item-details"><p class="prize-item-category">${item.category}</p><h3>${item.name}</h3><p class="prize-item-price">${priceHtml}</p>${btnHtml}</div>
                            </article>`;
                        }).join('')}
                    </div>
                    <footer class="prize-store-footer"><p id="prize-store-note"><span>i</span> Buy skins with tickets earned from games. Equip to change your look!</p><span class="prize-store-hint">ESC to close</span></footer>
                </section>
            </div>`;

        for (const item of this.items) {
            this.drawSkin(uiLayer.querySelector(`[data-skin="${item.id}"]`).getContext('2d'), item, playerColor);
        }

        const closeButton = uiLayer.querySelector('.prize-store-close');
        closeButton.addEventListener('click', onClose);
        closeButton.focus();

        // Buy buttons
        uiLayer.querySelectorAll('.prize-btn-buy').forEach(btn => {
            btn.addEventListener('click', () => {
                const skinId = btn.dataset.skinId;
                const price = parseInt(btn.dataset.price);
                if (Store.getTicks() >= price) {
                    Store.spendTicks(price);
                    Store.grantItem(skinId);
                    Store.setActiveSkin(skinId);
                    if (typeof localPlayer !== 'undefined' && localPlayer) localPlayer.skin = skinId;
                    if (typeof network !== 'undefined' && network) network.sendSkinChange(skinId);
                    this._renderShop(uiLayer, playerColor, onClose);
                }
            });
        });

        // Equip buttons
        uiLayer.querySelectorAll('.prize-btn-equip').forEach(btn => {
            btn.addEventListener('click', () => {
                const skinId = btn.dataset.skinId;
                Store.setActiveSkin(skinId);
                if (typeof localPlayer !== 'undefined' && localPlayer) localPlayer.skin = skinId;
                if (typeof network !== 'undefined' && network) network.sendSkinChange(skinId);
                this._renderShop(uiLayer, playerColor, onClose);
            });
        });
    },

    open(uiLayer, playerColor, onClose) {
        this._renderShop(uiLayer, playerColor, onClose);
    }
};
