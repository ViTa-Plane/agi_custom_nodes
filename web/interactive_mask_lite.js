import { app } from "/scripts/app.js";

app.registerExtension({
    name: "agi.InteractiveLatentMask",
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeData.name === "InteractiveLatentMask") {
            
            nodeType.prototype.onNodeCreated = function () {
                const MAX_SIZE = 256; 
                const canvas = document.createElement("canvas");
                canvas.style.display = "block";
                canvas.style.margin = "10px auto";
                canvas.style.border = "1px solid #666";
                canvas.style.backgroundColor = "#000";

                this.canvasWidget = this.addDOMWidget("mask_canvas", "canvas", canvas);
                this.drawing = false;
                this.dragging = false;
                this.currW = 512;
                this.currH = 512;
                this.setSize([300, 480]); 

                const getW = (name) => this.widgets.find(w => w.name === name);

                this.drawMask = () => {
                    const ctx = canvas.getContext("2d");
                    if (!ctx) return;

                    const x = getW("x").value, y = getW("y").value;
                    const w = getW("width").value, h = getW("height").value;
                    const val = getW("value").value;
                    const bg = getW("outer_value").value;

                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    
                    // Background
                    ctx.fillStyle = `rgb(${bg*255},${bg*255},${bg*255})`;
                    ctx.fillRect(0, 0, canvas.width, canvas.height);

                    // Grid (64px = 8 latent pixels)
                    ctx.beginPath();
                    ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
                    for (let gx = 64; gx < canvas.width; gx += 64) {
                        ctx.moveTo(gx, 0); ctx.lineTo(gx, canvas.height);
                    }
                    for (let gy = 64; gy < canvas.height; gy += 64) {
                        ctx.moveTo(0, gy); ctx.lineTo(canvas.width, gy);
                    }
                    ctx.stroke();

                    // Active Mask Area
                    ctx.fillStyle = `rgb(${val*255},${val*255},${val*255})`;
                    ctx.fillRect(x, y, w, h);
                    ctx.strokeStyle = "#00ffcc";
                    ctx.lineWidth = 2;
                    ctx.strokeRect(x, y, w, h);
                };

                this.updateCanvasSize = (w, h) => {
                    if (!w || !h) return;
                    this.currW = w; this.currH = h;
                    canvas.width = w; canvas.height = h;
                    let dH = w > h ? (h / w) * MAX_SIZE : MAX_SIZE;
                    let dW = w > h ? MAX_SIZE : (w / h) * MAX_SIZE;
                    canvas.style.width = `${Math.round(dW)}px`;
                    canvas.style.height = `${Math.round(dH)}px`;
                    this.drawMask();
                };

                canvas.addEventListener("mousedown", (e) => {
                    const rect = canvas.getBoundingClientRect();
                    const mx = (e.clientX - rect.left) * (canvas.width / rect.width);
                    const my = (e.clientY - rect.top) * (canvas.height / rect.height);
                    
                    const x = getW("x").value, y = getW("y").value;
                    const w = getW("width").value, h = getW("height").value;

                    if (mx >= x && mx <= x + w && my >= y && my <= y + h) {
                        this.dragging = true;
                        this.dragOffset = { x: mx - x, y: my - y };
                    } else {
                        this.drawing = true;
                        this.startPos = { x: mx, y: my };
                    }
                });

                window.addEventListener("mousemove", (e) => {
                    if (!this.drawing && !this.dragging) return;
                    const rect = canvas.getBoundingClientRect();
                    const mx = (e.clientX - rect.left) * (canvas.width / rect.width);
                    const my = (e.clientY - rect.top) * (canvas.height / rect.height);

                    if (this.dragging) {
                        getW("x").value = Math.max(0, Math.min(canvas.width - getW("width").value, Math.round(mx - this.dragOffset.x)));
                        getW("y").value = Math.max(0, Math.min(canvas.height - getW("height").value, Math.round(my - this.dragOffset.y)));
                    } else if (this.drawing) {
                        const nx = Math.max(0, Math.round(Math.min(this.startPos.x, mx)));
                        const ny = Math.max(0, Math.round(Math.min(this.startPos.y, my)));
                        getW("x").value = nx;
                        getW("y").value = ny;
                        getW("width").value = Math.round(Math.min(canvas.width - nx, Math.abs(mx - this.startPos.x)));
                        getW("height").value = Math.round(Math.min(canvas.height - ny, Math.abs(my - this.startPos.y)));
                    }
                    this.drawMask();
                });

                window.addEventListener("mouseup", () => { this.drawing = false; this.dragging = false; });

                // Link widget changes to canvas refresh
                setTimeout(() => {
                    this.widgets.forEach(w => {
                        const old = w.callback;
                        w.callback = (...args) => { if(old) old.apply(w, args); this.drawMask(); };
                    });
                    this.updateCanvasSize(this.currW, this.currH);
                }, 100);
            };

            nodeType.prototype.onSerialize = function (o) { o.customData = { currW: this.currW, currH: this.currH }; };
            nodeType.prototype.onConfigure = function (o) {
                if (o.customData) { this.currW = o.customData.currW; this.currH = o.customData.currH; }
                setTimeout(() => this.updateCanvasSize(this.currW, this.currH), 200);
            };

            nodeType.prototype.onDrawForeground = function (ctx) {
                if (this.flags.collapsed) return;
                ctx.save();
                ctx.font = "10px sans-serif"; ctx.fillStyle = "#FFF"; ctx.textAlign = "center";
                ctx.fillText(`${this.currW} x ${this.currH}`, this.size[0] / 2, this.size[1] - 10);
                ctx.restore();
            };

            const onExecuted = nodeType.prototype.onExecuted;
            nodeType.prototype.onExecuted = function (message) {
                onExecuted?.apply(this, arguments);
                if (message?.dims) this.updateCanvasSize(message.dims[0], message.dims[1]);
            };
        }
    },
});