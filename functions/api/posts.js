// 게시판 API (Cloudflare Pages Functions)
// 필요한 설정: D1 바인딩 이름 DB, 환경변수(Secret) BOARD_PASS
// 비밀번호는 코드에 넣지 않고 요청 헤더 x-board-pass 로 받아서 BOARD_PASS 와 비교

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });

const ensureTable = db =>
  db.prepare(`CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`).run();

export async function onRequest({ request, env }) {
  if (!env.DB || !env.BOARD_PASS) return json({ error: 'setup' }, 500);
  if ((request.headers.get('x-board-pass') || '') !== env.BOARD_PASS) return json({ error: 'pass' }, 401);

  await ensureTable(env.DB);

  if (request.method === 'GET') {
    const { results } = await env.DB
      .prepare('SELECT id, name, body, created_at FROM posts ORDER BY id DESC LIMIT 200')
      .all();
    return json({ posts: results });
  }

  if (request.method === 'POST') {
    let data;
    try { data = await request.json(); } catch { return json({ error: 'bad' }, 400); }
    const name = String(data.name || '').trim().slice(0, 20);
    const body = String(data.body || '').trim().slice(0, 1000);
    if (!name || !body) return json({ error: 'empty' }, 400);
    await env.DB.prepare('INSERT INTO posts (name, body) VALUES (?, ?)').bind(name, body).run();
    return json({ ok: true }, 201);
  }

  if (request.method === 'DELETE') {
    const id = Number(new URL(request.url).searchParams.get('id'));
    if (!Number.isInteger(id) || id <= 0) return json({ error: 'bad' }, 400);
    await env.DB.prepare('DELETE FROM posts WHERE id = ?').bind(id).run();
    return json({ ok: true });
  }

  return json({ error: 'method' }, 405);
}
