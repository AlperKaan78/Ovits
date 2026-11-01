// No dependencies. Localhost only, path traversal protected.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.png':'image/png','.md':'text/plain; charset=utf-8'};
module.exports=http.createServer((req,res)=>{let file;try{const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(pathname==='/favicon.ico'){res.writeHead(204).end();return;}file=path.resolve(root,'.'+pathname);}catch{res.writeHead(400).end();return;}
if(file!==root&&!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}if(file===root)file=path.join(root,'assets','three-preview.html');
fs.readFile(file,(error,data)=>{if(error){res.writeHead(404).end('Not found');return;}res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'}).end(data);});
}).listen(Number(process.env.PREVIEW_PORT)||4173,'127.0.0.1',()=>console.log('Three.js preview: http://127.0.0.1:'+(Number(process.env.PREVIEW_PORT)||4173)+'/assets/three-preview.html'));
