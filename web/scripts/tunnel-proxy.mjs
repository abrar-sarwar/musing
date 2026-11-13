// one door for a phone that is not on this mac's network. the tunnel points here, and this
// sends each request to the right local server: database paths to supabase, the rest to next.
//   node web/scripts/tunnel-proxy.mjs        (started for you by ./tunnel.sh)
import http from "node:http";
import net from "node:net";

const PORT = Number(process.env.PROXY_PORT ?? 3080);
const API = { host: "127.0.0.1", port: Number(process.env.API_PORT ?? 3000) };
const DB = { host: "127.0.0.1", port: Number(process.env.SUPABASE_PORT ?? 56321) };
const target = (url = "/") => (/^\/(rest|realtime|auth|storage|graphql)\//.test(url) ? DB : API);

const server = http.createServer((req, res) => {
  const t = target(req.url);
  const up = http.request({ ...t, method: req.method, path: req.url, headers: { ...req.headers, host: `localhost:${t.port}` } }, (r) => {
    res.writeHead(r.statusCode ?? 502, r.headers);
    r.pipe(res); // streams, so muse's server-sent events arrive as they are written
  });
  up.on("error", () => {
    if (!res.headersSent) res.writeHead(502, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: false, error: `nothing is listening on port ${t.port} on the laptop` }));
  });
  req.pipe(up);
});

// websockets (supabase realtime): hand the raw connection through
server.on("upgrade", (req, socket, head) => {
  const t = target(req.url);
  const up = net.connect(t.port, t.host, () => {
    const headers = Object.entries({ ...req.headers, host: `localhost:${t.port}` }).map(([k, v]) => `${k}: ${v}`).join("\r\n");
    up.write(`${req.method} ${req.url} HTTP/1.1\r\n${headers}\r\n\r\n`);
    if (head.length) up.write(head);
    socket.pipe(up).pipe(socket);
  });
  const close = () => { socket.destroy(); up.destroy(); };
  up.on("error", close);
  socket.on("error", close);
});

server.listen(PORT, "127.0.0.1", () => console.log(`proxy on :${PORT} -> api :${API.port}, database :${DB.port}`));
