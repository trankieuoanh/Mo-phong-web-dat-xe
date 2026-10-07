// OSRM gia: N request dau tra 500, sau do chuyen tiep sang OSRM that. Dung de kiem thu loi + "Thu lai".
const http = require('http');
const FAILS = Number(process.env.FAILS || 3);
let n = 0;
http.createServer(async (req, res) => {
  n += 1;
  if (n <= FAILS) { console.log(`fake-osrm #${n}: 500`); res.writeHead(500); res.end('boom'); return; }
  try {
    const upstream = await fetch('https://router.project-osrm.org' + req.url);
    res.writeHead(upstream.status, { 'content-type': 'application/json' });
    res.end(await upstream.text());
    console.log(`fake-osrm #${n}: proxied ${upstream.status}`);
  } catch (e) { res.writeHead(502); res.end('x'); }
}).listen(4590, () => console.log('fake osrm :4590'));
