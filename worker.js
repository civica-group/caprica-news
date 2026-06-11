const BRANDS = [
  'civicaNews','The Telegram','StateLine','InsideStory','Caprica Now','The Sentinel',
  'WorldDesk','GlobalWire','Dispatch','Meridian','WorldView','ForeignAffairs',
  'regions.news','Caille Times','Montiablo Times','CapitalNow','The Chronicle','LocalGovernment'
];

const enc = new TextEncoder();
function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8' } });
}
function cookie(name, value, maxAge = 604800) {
  return `${name}=${value}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`;
}
function getCookie(req, name) {
  const raw = req.headers.get('cookie') || '';
  return raw.split(';').map(x => x.trim()).find(x => x.startsWith(name + '='))?.split('=').slice(1).join('=');
}
function b64url(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf))).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
}
async function sha256(text) {
  return b64url(await crypto.subtle.digest('SHA-256', enc.encode(text)));
}
async function passwordHash(password, salt = crypto.randomUUID()) {
  return `${salt}:${await sha256(salt + ':' + password)}`;
}
async function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  return await sha256(salt + ':' + password) === hash;
}
async function sign(payload, secret) {
  const header = b64url(enc.encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const body = b64url(enc.encode(JSON.stringify(payload)));
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = b64url(await crypto.subtle.sign('HMAC', key, enc.encode(`${header}.${body}`)));
  return `${header}.${body}.${sig}`;
}
async function verify(token, secret) {
  if (!token) return null;
  const [h,b,s] = token.split('.');
  if (!h || !b || !s) return null;
  const expected = await sign(JSON.parse(atob(b.replaceAll('-','+').replaceAll('_','/'))), secret);
  if (expected !== token) return null;
  const payload = JSON.parse(atob(b.replaceAll('-','+').replaceAll('_','/')));
  if (payload.exp < Date.now()) return null;
  return payload;
}
function slugify(title) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'').slice(0,80) + '-' + Math.random().toString(36).slice(2,6);
}
async function me(req, env) { return await verify(getCookie(req, 'cmg_session'), env.JWT_SECRET || 'dev-secret-change-me'); }
async function requireUser(req, env) { const u = await me(req, env); if (!u) throw new Response('Unauthorized', {status:401}); return u; }
async function requireAdmin(req, env) { const u = await requireUser(req, env); if (!['admin','editor'].includes(u.role)) throw new Response('Forbidden', {status:403}); return u; }

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    try {
      if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(req);

      if (url.pathname === '/api/brands') return json({ brands: BRANDS });

      if (url.pathname === '/api/auth/bootstrap-admin' && req.method === 'POST') {
        const body = await req.json();
        if (!env.SETUP_SECRET || body.setupSecret !== env.SETUP_SECRET) return json({ error: 'Bad setup secret' }, 403);
        const hash = await passwordHash(body.password);
        await env.DB.prepare('INSERT OR REPLACE INTO users(email,password_hash,role,brand) VALUES(?,?,?,?)')
          .bind(body.email, hash, 'admin', 'Caprica Media Group').run();
        return json({ ok: true });
      }

      if (url.pathname === '/api/auth/login' && req.method === 'POST') {
        const body = await req.json();
        const user = await env.DB.prepare('SELECT * FROM users WHERE email=?').bind(body.email).first();
        if (!user || !(await verifyPassword(body.password, user.password_hash))) return json({ error: 'Invalid login' }, 401);
        const token = await sign({ email: user.email, role: user.role, brand: user.brand, exp: Date.now() + 604800000 }, env.JWT_SECRET || 'dev-secret-change-me');
        return new Response(JSON.stringify({ ok: true, user: { email: user.email, role: user.role, brand: user.brand }}), { headers: { 'content-type':'application/json', 'set-cookie': cookie('cmg_session', token) }});
      }

      if (url.pathname === '/api/auth/logout' && req.method === 'POST') return new Response('{}', { headers: { 'set-cookie': cookie('cmg_session', '', 0), 'content-type':'application/json' }});
      if (url.pathname === '/api/auth/me') return json({ user: await me(req, env) });

      if (url.pathname === '/api/users' && req.method === 'POST') {
        const u = await requireAdmin(req, env);
        if (u.role !== 'admin') return json({ error:'Admin only' }, 403);
        const body = await req.json();
        const hash = await passwordHash(body.password);
        await env.DB.prepare('INSERT INTO users(email,password_hash,role,brand) VALUES(?,?,?,?)')
          .bind(body.email, hash, body.role || 'writer', body.brand || 'civicaNews').run();
        return json({ ok:true });
      }

      if (url.pathname === '/api/posts' && req.method === 'GET') {
        const status = url.searchParams.get('status') || 'published';
        const brand = url.searchParams.get('brand');
        let q = 'SELECT id,slug,title,dek,brand,category,status,author_email,created_at,published_at FROM posts WHERE status=?';
        const binds = [status];
        if (brand) { q += ' AND brand=?'; binds.push(brand); }
        q += ' ORDER BY COALESCE(published_at, created_at) DESC LIMIT 80';
        const rows = await env.DB.prepare(q).bind(...binds).all();
        return json(rows.results || []);
      }

      if (url.pathname.match(/^\/api\/posts\/[^/]+$/) && req.method === 'GET') {
        const slug = decodeURIComponent(url.pathname.split('/').pop());
        const post = await env.DB.prepare('SELECT * FROM posts WHERE slug=?').bind(slug).first();
        if (!post) return json({ error:'Not found' }, 404);
        return json(post);
      }

      if (url.pathname === '/api/admin/posts' && req.method === 'GET') {
        await requireUser(req, env);
        const rows = await env.DB.prepare('SELECT id,slug,title,dek,brand,category,status,author_email,created_at,published_at FROM posts ORDER BY updated_at DESC LIMIT 100').all();
        return json(rows.results || []);
      }

      if (url.pathname === '/api/admin/posts' && req.method === 'POST') {
        const u = await requireUser(req, env);
        const body = await req.json();
        const status = ['admin','editor'].includes(u.role) && body.status === 'published' ? 'published' : 'draft';
        const brand = u.role === 'admin' ? (body.brand || u.brand) : u.brand;
        const slug = slugify(body.title);
        await env.DB.prepare('INSERT INTO posts(slug,title,dek,body,brand,category,status,author_email,published_at) VALUES(?,?,?,?,?,?,?,?,?)')
          .bind(slug, body.title, body.dek || '', body.body || '', brand, body.category || 'News', status, u.email, status === 'published' ? new Date().toISOString() : null).run();
        return json({ ok:true, slug });
      }

      return json({ error: 'Not found' }, 404);
    } catch (e) {
      if (e instanceof Response) return e;
      return json({ error: e.message || 'Server error' }, 500);
    }
  }
};
