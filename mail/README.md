# Ryvoki Mail

Your own email for `@ryvoki.com`, running on the free tiers of Cloudflare and Resend, read and written with a custom Windows app.

```
mail/worker/    Cloudflare Worker "ryvoki-mail": receives every email for ryvoki.com, stores it, and serves the API
mail/desktop/   Windows app "Ryvoki Mail" (.NET 9 WinForms) that talks to that API
```

How mail flows:

- **Receiving:** Cloudflare Email Routing (free) has a catch-all rule for `*@ryvoki.com` set to "Send to a Worker: ryvoki-mail". The worker parses the message, saves the parsed body and attachments in KV and the index row in the `ryvoki-db` database (tables `mail_messages`), and optionally forwards a copy to `FORWARD_TO`.
- **Sending:** the desktop app calls the worker, which sends through Resend (free: 3,000 emails/month, 100/day) as any `@ryvoki.com` address. Resend signs with DKIM so mail lands in inboxes, not spam.
- **The app** only ever talks to `https://mail-api.ryvoki.com` with a bearer token. No IMAP, no passwords, no Google.

## One-time setup

### A. Receiving (Cloudflare dashboard, ~5 minutes)
1. Cloudflare → **ryvoki.com** → **Email** → **Email Routing** → **Get started** / **Enable**. It adds the MX and SPF records itself.
2. **Destination addresses** → add your Gmail and click the verification link it emails you. (Only needed if you want a copy forwarded; otherwise skip.)
3. **Routing rules** → **Catch-all address** → action **Send to a Worker** → pick **ryvoki-mail** → Save. Everything sent to any `@ryvoki.com` address now lands in the app.

### B. Sending (Resend, ~10 minutes)
1. Sign up at resend.com (free). **Domains** → **Add domain** → `ryvoki.com`, region closest to you.
2. Resend shows 3 DNS records (DKIM TXT, an MX and a TXT for a `send.` subdomain). Add each in Cloudflare → ryvoki.com → **DNS** → **Records** → **Add record**, copying name, type and value exactly. Back in Resend click **Verify**; it usually turns green in a minute.
3. **API Keys** → **Create API key** (Sending access, domain ryvoki.com). Copy it.

### C. Secrets (you run this; it never shows the values)
```powershell
powershell -ExecutionPolicy Bypass -File "C:\Users\austi\Desktop\ryvoki-site\mail\worker\set-secrets.ps1"
```
It uploads the app token from `mail-token.txt` and asks for the Resend key.

### D. The desktop app
Build once: `dotnet publish mail/desktop/RyvokiMail.csproj -c Release -r win-x64 --self-contained -p:PublishSingleFile=true -o mail/desktop/dist`
Run `mail\desktop\dist\Ryvoki Mail.exe`. First start asks for the server (`https://mail-api.ryvoki.com`) and the token from `mail-token.txt`. The token is stored encrypted for your Windows account.

## Contact form
The website's `/contact` page posts to `functions/api/contact.ts` on the Pages project, which writes the message into the same database and KV store (the Pages project has the `BLOBS` binding too). Submissions show up in the app's inbox as `[Contact] ...` from the visitor, and **Reply** goes to the email they typed. Spam defence: a hidden honeypot field, a 3-second minimum fill time, and 5 messages per hour per IP.

## Everyday use
- Folders: Inbox, Starred, Sent, Archive, Trash. Delete moves to Trash; Delete again in Trash removes it for good.
- Compose (Ctrl+N), Reply (Ctrl+R), Reply all, Forward with attachments, Search (Ctrl+F), Refresh (F5).
- The **From** box on compose accepts any `@ryvoki.com` address, so `support@ryvoki.com` works without any setup.
- Remote images in HTML mail are blocked until you click **Load images**.
- New mail shows a Windows notification while the app is open (checks every 60 s).

## Operating notes
- Worker changes: `cd mail/worker` then `npx wrangler deploy`.
- Storage: KV free tier is 1 GB and 1,000 writes/day; each inbound mail costs 2 + (attachments) writes. Plenty for a personal business inbox. Move to R2 later if it ever fills.
- The worker also accepts `FORWARD_TO` in `wrangler.toml` to keep a Gmail copy of everything inbound (address must be verified in Email Routing).
