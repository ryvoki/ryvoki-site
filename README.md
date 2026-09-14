# Ryvoki site

Personal landing page + crypto-only project store. Static HTML/CSS/JS, no build step, hosted free on Cloudflare Pages with a tiny serverless API for orders and license keys.

```
public/                 the website (this folder is what gets deployed)
  index.html            landing page: socials, player card, featured project
  projects/index.html   store grid
  projects/view.html    project detail page (served at /p/<slug>)
  order/index.html      "waiting for payment" -> shows the license key
  license/index.html    recover a key by order ID / email, or check a key
  data/site.json        YOUR NAME, SOCIALS, LINKS      <-- edit this
  data/projects.json    YOUR PRODUCTS AND PRICES        <-- edit this
  assets/               css, js, images
functions/              Cloudflare Pages Functions (the API), TypeScript
  api/checkout.ts       creates an order + NOWPayments invoice
  api/ipn.ts            NOWPayments webhook -> issues the key when paid
  api/order/[id].ts     order status (+ key once paid)
  api/license/verify.ts the desktop app calls this to activate a key
  api/license/lookup.ts key recovery
  api/admin/*           issue keys, list orders, mark paid, revoke (needs ADMIN_TOKEN)
schema.sql              database tables (Cloudflare D1 = SQLite)
wrangler.toml           Cloudflare config
scripts/                key generator, badge resizer
```

## Run it on your PC

```powershell
npm install          # once
npm run db:local     # once, creates the local database
npm run dev          # http://localhost:8788
```

`.dev.vars` holds local secrets and is git-ignored. Copy `.dev.vars.example` if it is missing.

## Edit your content

- `public/data/site.json` – handle, tagline, bio, Blood Strike UID and region (both optional, hidden when empty), social links (leave a URL empty to hide that chip), the main button (`primaryCta`), footer note. Nothing on the landing page needs regular updating.
- `public/data/projects.json` – one object per project. `status` is `available` or `coming-soon`. `priceUsd: 0` means free. `download` is the public download link (GitHub Releases). `image` is a path under `public/assets/img/`.
- Avatar: drop a square image into `public/assets/img/avatar.jpg` and set `"avatar": "/assets/img/avatar.jpg"`.

Edit, save, refresh. No build.

## Go live (all free except the domain)

### 1. GitHub
1. Create a GitHub account if you don't have one, then a new **public** repo called `ryvoki-site` (public so release downloads work without a login).
2. In this folder:
   ```powershell
   git add .
   git commit -m "Ryvoki site"
   git remote add origin https://github.com/YOUR-USERNAME/ryvoki-site.git
   git push -u origin main
   ```

### 2. Cloudflare Pages (already done, here for reference)
The project `ryvoki-site` is deployed by **direct upload**, not by watching GitHub. After any change:
```powershell
git add . ; git commit -m "what changed" ; git push     # keeps GitHub as the backup copy
npm run deploy                                          # puts it live at ryvoki.com in ~10 seconds
```
`npx wrangler login` once per PC before the first deploy.

### 3. Database (D1) (already done)
`ryvoki-db` exists and its ID is in `wrangler.toml`. If the tables ever need re-creating: `npm run db:remote`.
Secrets are uploaded with `set-secrets.ps1` (see the comment at the top of that file).

### 4. Payments (NOWPayments)
1. Sign up at nowpayments.io. Add your **payout wallet** (the coin you want to receive; auto-convert is optional).
2. **Store settings -> API keys** -> create an API key.
3. **Store settings -> IPN** -> generate an **IPN secret**.
4. In Cloudflare Pages -> **Settings -> Environment variables** (Production) add:
   - `NOWPAYMENTS_API_KEY` = the API key (mark as **secret**)
   - `NOWPAYMENTS_IPN_SECRET` = the IPN secret (secret)
   - `ADMIN_TOKEN` = a long random string only you know (secret)
   - `LICENSE_SIGNING_KEY` = the contents of `signing-key.private.json` (secret)
5. Redeploy (Deployments -> Retry, or push any commit).
6. Test with a real small purchase, or use the sandbox: NOWPayments has a separate sandbox at `api-sandbox.nowpayments.io/v1` with its own keys; set `NOWPAYMENTS_API_BASE` to that in a **Preview** environment if you want to test without real coins.

How a sale works: buyer clicks **Buy with crypto** -> we create an order (`ORD-XXXXXXXX`) and a NOWPayments invoice -> buyer pays on the hosted invoice page -> NOWPayments calls `/api/ipn` -> when status is `finished` we generate a key and store it -> the buyer's order page (which polls every 5 s) shows the key. NOWPayments fee is 0.5% (1% if auto-converting between coins).

### 5. Domain
1. All of `ryvoki.com / .xyz / .dev / .gg / .io / .net / .app / .lol` were unregistered on 2026-09-14.
2. Cheapest and simplest: Cloudflare dashboard -> **Domain Registration** -> **Register domain** -> `ryvoki.com` (about $10/yr at cost, no markup, renews at the same price).
3. Pages project -> **Custom domains** -> add `ryvoki.com` and `www.ryvoki.com`. Because the domain is on Cloudflare, DNS is set up automatically. HTTPS is automatic.
4. Rebuild the tracker if `LicenseConfig.DefaultServer` in the app doesn't match the domain you bought.

### 6. Downloads
Upload the tracker zip made by `package.ps1` in the tracker project (`dist\Ryvoki-Blood-Strike-Rank-Tracker-v1.0.0-win-x64.zip`, ~59 MB) to a **GitHub Release** on any repo (public releases are free, 2 GB per file). Paste the asset URL into `projects.json` -> `download`. The app itself asks for the license key, so the download can be public.

## Admin: keys and orders from your terminal

Replace `TOKEN` with your `ADMIN_TOKEN` and the host with your site (locally: `http://localhost:8788`).

```powershell
# list recent orders (with keys)
curl -H "Authorization: Bearer TOKEN" https://ryvoki.com/api/admin/orders

# hand out a key (giveaway / someone paid you directly)
curl -X POST -H "Authorization: Bearer TOKEN" -H "content-type: application/json" -d "{\"product\":\"rank-tracker\",\"note\":\"giveaway\"}" https://ryvoki.com/api/admin/issue

# revoke a key (or restore it with \"restore\":true)
curl -X POST -H "Authorization: Bearer TOKEN" -H "content-type: application/json" -d "{\"key\":\"RYV-XXXXX-XXXXX-XXXXX-XXXXX\"}" https://ryvoki.com/api/admin/revoke

# mark an order paid by hand
curl -X POST -H "Authorization: Bearer TOKEN" -H "content-type: application/json" -d "{\"orderId\":\"ORD-XXXXXXXX\"}" https://ryvoki.com/api/admin/mark-paid
```

## Test the whole purchase flow locally, no crypto

```powershell
# 1. make a fake pending order
curl -X POST -H "Authorization: Bearer dev-admin-token-change-me" -H "content-type: application/json" -d "{\"product\":\"rank-tracker\"}" http://localhost:8788/api/admin/test-order
# 2. open http://localhost:8788/order/?id=ORD-...   (it will sit on "waiting")
# 3. mark it paid
curl -X POST -H "Authorization: Bearer dev-admin-token-change-me" -H "content-type: application/json" -d "{\"orderId\":\"ORD-...\"}" http://localhost:8788/api/admin/mark-paid
# 4. the order page flips to "Paid" and shows the key within 5 seconds
```

## License keys, in one paragraph

Keys look like `RYV-K7M2P-Q9XW3-R4TB8-N6HZC` and are random (no 0/O/1/I so they are easy to type). Each key is tied to one product and allows 3 PCs by default. The desktop app sends `{key, product, machineId}` to `/api/license/verify`; the server records the machine and returns a token signed with an ECDSA P-256 key that expires in 7 days, so the app only needs internet about once a week. The public half of that key gets embedded in the app; the private half lives only in Cloudflare as `LICENSE_SIGNING_KEY`.
