/* entekhab.net — TradingView webhook receiver (Cloudflare Worker).

   TradingView alert → POST https://<worker>/tv  → the alert is kept (last 200, Cloudflare KV) and, when the owner has
   set TG_TOKEN and TG_CHAT, forwarded to Telegram. The site reads GET https://<worker>/alerts and shows the feed in Pine
   Studio (/studio/).

   Bindings (set in the Cloudflare dashboard, never in this file):
     ALERTS    KV namespace (required)
     HOOK_KEY  secret, optional: when set, an alert must carry it, either as ?key=… in the URL or "key" in a JSON body
     TG_TOKEN  secret, optional: Telegram bot token, to forward alerts
     TG_CHAT   variable, optional: the Telegram chat or channel id to forward to

   TradingView "Message" can be plain text or JSON, e.g.
     {"symbol":"{{ticker}}","tf":"{{interval}}","price":{{close}},"text":"EMA cross up","key":"…"} */

const MAX = 200, CORS = { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS', 'access-control-allow-headers': 'content-type' };
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...CORS } });
const clip = (s, n) => String(s == null ? '' : s).slice(0, n);

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

    if (req.method === 'GET' && url.pathname === '/alerts') {
      const list = JSON.parse((await env.ALERTS.get('list')) || '[]');
      const n = Math.min(MAX, Math.max(1, +url.searchParams.get('limit') || 50));
      return json({ alerts: list.slice(0, n), count: list.length });
    }

    if (req.method === 'POST' && url.pathname === '/tv') {
      const raw = clip(await req.text(), 4000);
      let body = null;
      try { body = JSON.parse(raw); } catch (e) { /* plain-text message */ }
      if (env.HOOK_KEY) {
        const k = url.searchParams.get('key') || (body && body.key);
        if (k !== env.HOOK_KEY) return json({ ok: false, error: 'bad key' }, 403);
      }
      // a small guard against floods: at most 30 alerts a minute
      const minute = Math.floor(Date.now() / 60000), rk = 'rate:' + minute;
      const used = +((await env.ALERTS.get(rk)) || 0);
      if (used >= 30) return json({ ok: false, error: 'rate limited' }, 429);
      await env.ALERTS.put(rk, String(used + 1), { expirationTtl: 120 });

      const a = {
        at: Date.now(),
        symbol: clip(body && (body.symbol || body.ticker), 40),
        tf: clip(body && (body.tf || body.interval), 12),
        price: body && isFinite(+body.price) ? +body.price : null,
        side: clip(body && (body.side || body.action), 16),
        text: clip(body ? (body.text || body.message || body.comment || '') : raw, 600)
      };
      if (!a.text && body) a.text = clip(JSON.stringify(Object.fromEntries(Object.entries(body).filter(([k]) => k !== 'key'))), 600);
      const list = JSON.parse((await env.ALERTS.get('list')) || '[]');
      list.unshift(a);
      await env.ALERTS.put('list', JSON.stringify(list.slice(0, MAX)));

      if (env.TG_TOKEN && env.TG_CHAT) {
        const head = [a.symbol, a.tf, a.side].filter(Boolean).join(' · ');
        const msg = '🔔 TradingView' + (head ? '\n' + head : '') + (a.price != null ? '\n$' + a.price : '') + (a.text ? '\n' + a.text : '');
        try {
          await fetch(`https://api.telegram.org/bot${env.TG_TOKEN}/sendMessage`, {
            method: 'POST', headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ chat_id: env.TG_CHAT, text: msg, disable_web_page_preview: true })
          });
        } catch (e) { /* the alert is stored even if Telegram is unreachable */ }
      }
      return json({ ok: true });
    }

    if (url.pathname === '/') return json({ service: 'entekhab.net TradingView webhook', post: '/tv', feed: '/alerts' });
    return json({ ok: false, error: 'not found' }, 404);
  }
};
