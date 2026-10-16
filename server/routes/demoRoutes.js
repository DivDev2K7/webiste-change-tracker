import { Router } from 'express';

const DEFAULT_STATE = Object.freeze({
  productName: 'Aurora Wireless Headphones',
  price: '$129.00',
  description: 'Immersive sound, all-day comfort, and 40 hours of battery life.',
  status: 'In stock'
});

export const DEMO_URL = process.env.DEMO_URL || 'http://localhost:5000/demo';

let state = { ...DEFAULT_STATE };

const router = Router();

router.get('/', (req, res) => {
  res.type('html').send(PAGE);
});

router.get('/state', (req, res) => {
  res.json(state);
});

router.put('/state', (req, res) => {
  const fields = Object.keys(DEFAULT_STATE);
  if (!req.body || fields.some((field) => typeof req.body[field] !== 'string')) {
    return res.status(400).json({ error: 'All demo fields must be strings' });
  }

  const limits = { productName: 100, price: 40, description: 1000, status: 60 };
  const updated = {};
  for (const field of fields) {
    const value = req.body[field].trim();
    if (!value || value.length > limits[field]) {
      return res.status(400).json({ error: `${field} must be between 1 and ${limits[field]} characters` });
    }
    updated[field] = value;
  }

  state = updated;
  res.json(state);
});

router.post('/reset', (req, res) => {
  state = { ...DEFAULT_STATE };
  res.json(state);
});

const PAGE = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Product demo | ChangeWatch</title>
  <style>
    :root { color-scheme: light; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #172033; background: #edf4ff; }
    * { box-sizing: border-box; }
    body { min-height: 100vh; margin: 0; display: grid; place-items: center; padding: 32px 18px; background: radial-gradient(ellipse at 15% 10%, #d9eaff 0, transparent 45%), radial-gradient(ellipse at 90% 85%, #e8ddff 0, transparent 42%), #f6f8fc; }
    main { width: min(100%, 680px); }
    .eyebrow { margin: 0 0 14px; color: #4b6b9a; font-size: 12px; font-weight: 700; letter-spacing: .16em; text-transform: uppercase; }
    .card { padding: clamp(24px, 6vw, 46px); border: 1px solid rgba(255,255,255,.85); border-radius: 28px; background: rgba(255,255,255,.72); box-shadow: 0 24px 80px rgba(46,72,116,.14), inset 0 1px rgba(255,255,255,.9); backdrop-filter: blur(22px); -webkit-backdrop-filter: blur(22px); }
    .top { display: flex; align-items: center; justify-content: space-between; gap: 18px; }
    h1 { margin: 0; font-size: clamp(27px, 5vw, 38px); letter-spacing: -.04em; line-height: 1.15; }
    .admin { flex: none; border: 1px solid #dce4f0; border-radius: 999px; padding: 10px 16px; color: #294b7a; background: rgba(255,255,255,.65); font: inherit; font-size: 13px; font-weight: 650; cursor: pointer; }
    .admin:hover, .secondary:hover { background: #fff; }
    .price { margin: 18px 0 12px; color: #155bc0; font-size: 30px; font-weight: 750; letter-spacing: -.03em; }
    .description { margin: 0; max-width: 54ch; color: #58657a; font-size: 16px; line-height: 1.7; }
    .status { display: inline-flex; align-items: center; gap: 9px; margin-top: 24px; border: 1px solid #cfe9db; border-radius: 999px; padding: 9px 14px; color: #187342; background: rgba(230,248,238,.8); font-size: 13px; font-weight: 650; }
    .status.value { display: inline-flex; }
    .status:before { width: 8px; height: 8px; border-radius: 50%; background: #28a565; content: ""; }
    .fields { display: grid; gap: 21px; }
    .field label { display: block; margin-bottom: 7px; color: #758198; font-size: 11px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; }
    .value { display: block; overflow-wrap: anywhere; }
    .field input, .field textarea { display: none; width: 100%; border: 1px solid #d7dfec; border-radius: 12px; padding: 12px 14px; color: #172033; background: rgba(255,255,255,.8); font: inherit; font-size: 15px; }
    .field textarea { min-height: 96px; resize: vertical; }
    .editing .value { display: none; }
    .editing .field input, .editing .field textarea { display: block; }
    .editing .status { display: block; width: max-content; border-color: transparent; padding: 0; color: #172033; background: none; font: inherit; }
    .editing .status:before { display: none; }
    .actions { display: none; gap: 10px; margin-top: 30px; }
    .editing .actions { display: flex; }
    .action { border: 0; border-radius: 999px; padding: 11px 19px; font: inherit; font-size: 14px; font-weight: 650; cursor: pointer; }
    .primary { color: white; background: #0c5dc7; }
    .primary:hover { background: #0a4aa0; }
    .secondary { border: 1px solid #dce4f0; color: #294b7a; background: rgba(255,255,255,.65); }
    .notice { min-height: 20px; margin: 17px 0 0; color: #5d6675; font-size: 13px; }
    .notice.error { color: #bf3028; }
    @media (max-width: 480px) { .top { align-items: flex-start; } .admin { padding: 9px 12px; } }
  </style>
</head>
<body>
  <main>
    <p class="eyebrow">ChangeWatch · Live demo</p>
    <section class="card" id="card" aria-label="Demo product">
      <div class="top">
        <h1 class="value" data-value="productName">Aurora Wireless Headphones</h1>
        <button class="admin" id="toggle" type="button" aria-pressed="false">Admin: off</button>
      </div>
      <div class="fields">
        <div class="field">
          <label for="productNameInput">Product name</label>
          <input id="productNameInput" data-input="productName" maxlength="100">
        </div>
        <div class="field">
          <label for="priceInput">Price</label>
          <p class="price value" data-value="price">$129.00</p>
          <input id="priceInput" data-input="price" maxlength="40">
        </div>
        <div class="field">
          <label for="descriptionInput">Description</label>
          <p class="description value" data-value="description">Immersive sound, all-day comfort, and 40 hours of battery life.</p>
          <textarea id="descriptionInput" data-input="description" maxlength="1000"></textarea>
        </div>
        <div class="field">
          <label for="statusInput">Status</label>
          <p class="status value" data-value="status">In stock</p>
          <input id="statusInput" data-input="status" maxlength="60">
        </div>
      </div>
      <div class="actions">
        <button class="action primary" id="save" type="button">Save</button>
        <button class="action secondary" id="reset" type="button">Reset</button>
      </div>
      <p class="notice" id="notice" role="status" aria-live="polite"></p>
    </section>
  </main>
  <script>
    const card = document.getElementById('card');
    const toggle = document.getElementById('toggle');
    const notice = document.getElementById('notice');
    const fields = ['productName', 'price', 'description', 'status'];
    let values;

    function render(next) {
      values = next;
      for (const field of fields) {
        document.querySelector('[data-value="' + field + '"]').textContent = values[field];
        document.querySelector('[data-input="' + field + '"]').value = values[field];
      }
    }

    async function request(path, options) {
      const response = await fetch(path, options);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'The demo could not be updated.');
      return data;
    }

    function showError(error) {
      notice.textContent = error.message;
      notice.classList.add('error');
    }

    toggle.addEventListener('click', () => {
      const editing = card.classList.toggle('editing');
      toggle.textContent = editing ? 'Admin: on' : 'Admin: off';
      toggle.setAttribute('aria-pressed', String(editing));
      notice.textContent = '';
      notice.classList.remove('error');
      if (editing && values) render(values);
    });

    document.getElementById('save').addEventListener('click', async () => {
      const next = Object.fromEntries(fields.map((field) => [field, document.querySelector('[data-input="' + field + '"]').value]));
      try {
        render(await request('/demo/state', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(next) }));
        card.classList.remove('editing');
        toggle.textContent = 'Admin: off';
        toggle.setAttribute('aria-pressed', 'false');
        notice.textContent = 'Changes saved for this server session.';
        notice.classList.remove('error');
      } catch (error) {
        showError(error);
      }
    });

    document.getElementById('reset').addEventListener('click', async () => {
      try {
        render(await request('/demo/reset', { method: 'POST' }));
        card.classList.remove('editing');
        toggle.textContent = 'Admin: off';
        toggle.setAttribute('aria-pressed', 'false');
        notice.textContent = 'Demo content reset to its defaults.';
        notice.classList.remove('error');
      } catch (error) {
        showError(error);
      }
    });

    request('/demo/state').then(render).catch(showError);
  </script>
</body>
</html>`;

export default router;
