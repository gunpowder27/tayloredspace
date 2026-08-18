import WebSocket from "ws";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const targets = async () => fetch("http://127.0.0.1:9222/json").then((response) => response.json());
let sequence = 0;
const connect = (target) => {
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  const pending = new Map();
  socket.on("message", (raw) => { const message = JSON.parse(String(raw)); if (message.id && pending.has(message.id)) { pending.get(message.id)(message); pending.delete(message.id); } });
  return new Promise((resolve) => socket.on("open", () => resolve({ socket, call(method, params = {}) { return new Promise((done) => { const id = ++sequence; pending.set(id, done); socket.send(JSON.stringify({ id, method, params })); }); } })));
};

await sleep(2000);
let list = await targets();
const worker = list.find((target) => target.type === "service_worker" && target.url.startsWith("chrome-extension://"));
if (!worker) throw new Error(`Extension service worker not found: ${list.map((item) => `${item.type}:${item.url}`).join(", ")}`);
const extensionId = new URL(worker.url).host;
await fetch(`http://127.0.0.1:9222/json/new?chrome-extension://${extensionId}/popup.html`, { method: "PUT" });
await sleep(1500);
list = await targets();
const product = list.find((target) => target.url.includes("test-product.html"));
const popup = list.find((target) => target.url === `chrome-extension://${extensionId}/popup.html`);
const board = list.find((target) => target.url === "http://localhost:3000/");
if (!product || !popup || !board) throw new Error(`Expected product, popup, and board targets: ${list.map((item) => `${item.type}:${item.url}`).join(", ")}`);

await fetch(`http://127.0.0.1:9222/json/activate/${product.id}`);
const productClient = await connect(product);
await productClient.call("Runtime.evaluate", { expression: "window.focus()" });
const popupClient = await connect(popup);
await popupClient.call("Runtime.evaluate", { expression: "document.querySelector('button').click()" });
await sleep(2500);
const popupText = await popupClient.call("Runtime.evaluate", { expression: "document.body.innerText", returnByValue: true });
const boardClient = await connect(board);
const boardText = await boardClient.call("Runtime.evaluate", { expression: "document.body.innerText", returnByValue: true });
const count = await boardClient.call("Runtime.evaluate", { expression: "indexedDB.databases().then(dbs => dbs.some(db => db.name === 'tayloredspace'))", awaitPromise: true, returnByValue: true });
await boardClient.call("Page.reload");
await sleep(2000);
const reloadText = await boardClient.call("Runtime.evaluate", { expression: "document.body.innerText", returnByValue: true });

const result = { extensionId, popup: popupText.result?.result?.value, board: boardText.result?.result?.value, indexedDbCreated: count.result?.result?.value, afterReload: reloadText.result?.result?.value };
console.log(JSON.stringify(result, null, 2));
if (!String(result.popup).includes("Saved to your board") || !String(result.board).includes("product added from the extension") || !result.indexedDbCreated || !String(result.afterReload).includes("Phase 0 Test Chair")) process.exitCode = 1;
