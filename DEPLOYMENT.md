# Deploying Sahyatri on AWS — a guide for non-technical founders

Two AWS paths, both point-and-click. Option A is the simplest and cheapest way
to get live; Option B is the "grows with you" managed setup. Either way, blank
integration keys never break the app — Razorpay/SMS/DigiLocker run in safe demo
mode until you add real keys.

---

## Option A (recommended to start): Amazon Lightsail — one server, one command

Everything (app + database + automatic HTTPS) runs on a single server.
~$10–20/month. Time: ~20 minutes.

1. **Create the server**: lightsail.aws.amazon.com → **Create instance** →
   pick a region near your users (e.g. Mumbai `ap-south-1`) → **Linux/Unix →
   Ubuntu 24.04** → choose the **$10 (2 GB)** plan or larger → *(optional)*
   expand **Add launch script** and paste the contents of
   `deploy/aws/lightsail-launch.sh` → **Create instance**.

2. **Open the ports**: on the instance page → **Networking** tab → under
   IPv4 Firewall, make sure **HTTP (80)** and **HTTPS (443)** are added.
   Also click **Attach static IP** (free while attached) so your address
   never changes.

3. **Put the code on the server**: click the orange **Connect using SSH**
   button (a terminal opens in your browser) and run:
   ```bash
   sudo -i
   mkdir -p /opt/sahyatri && cd /opt/sahyatri
   git clone https://github.com/YOUR-USERNAME/sahyatri .   # or upload the zip and: unzip sahyatri.zip
   cp .env.production.example .env
   nano .env    # set DB_PASSWORD and AUTH_SECRET to long random strings; save Ctrl+O, exit Ctrl+X
   docker compose -f docker-compose.prod.yml up -d --build
   ```
   The first build takes a few minutes. The stack creates the database tables
   and demo accounts automatically on first start.

4. **Visit your static IP** in a browser — the app is live over HTTP.

5. **Add your domain + free HTTPS**: at your domain registrar, create an
   **A record** pointing to the static IP. Then on the server:
   ```bash
   nano /opt/sahyatri/.env        # change DOMAIN=":80" to DOMAIN="yourdomain.com"
   docker compose -f docker-compose.prod.yml up -d
   ```
   Certificates are issued automatically (Caddy + Let's Encrypt). Done.

**Updating later**: `cd /opt/sahyatri && git pull && docker compose -f docker-compose.prod.yml up -d --build`
**Backups**: Lightsail instance page → **Snapshots** → enable automatic snapshots.

## Option B (managed & scalable): App Runner + RDS PostgreSQL

App and database are separate managed services — AWS patches, scales, and
restarts things for you. ~$25–50/month to start.

1. **Database**: console.aws.amazon.com/rds → **Create database** →
   PostgreSQL → **Easy create** → **Free tier / db.t4g.micro** →
   set a master password → Create. When ready, open it and note the
   **Endpoint**. Under **Connectivity → Security group → Inbound rules**,
   allow PostgreSQL access for the app (simplest while testing: from anywhere
   `0.0.0.0/0`, then tighten later or use a VPC connector).
   Your `DATABASE_URL` is:
   `postgresql://postgres:YOUR-PASSWORD@YOUR-ENDPOINT:5432/postgres`

2. **App**: push this folder to GitHub, and copy `deploy/aws/apprunner.yaml`
   to the repo root as `apprunner.yaml`. Then console.aws.amazon.com/apprunner →
   **Create service** → **Source: GitHub** (connect your account, pick the repo,
   enable automatic deploys) → **Use a configuration file** →
   under **Environment variables** add:
   - `DATABASE_URL` = the string from step 1
   - `AUTH_SECRET` = a long random string
   → set **Health check path** to `/api/health` → **Create & deploy**.

3. The run command in `apprunner.yaml` creates/updates the database tables on
   every deploy automatically (safe to run repeatedly). To load the demo
   accounts once, either register through the app's own signup page, or have
   anyone with Node run `npm run db:seed` locally with the RDS `DATABASE_URL`
   in `.env`.

4. App Runner gives you a public HTTPS URL immediately; add your own domain
   under **Custom domains** (it walks you through the DNS records).

## Option C: any plain EC2 box

Identical to Option A from step 3 onward — Ubuntu + the same commands.
Open ports 80/443 in the instance's Security Group instead of Lightsail's
firewall tab.

---

## The environment variables, explained

| Variable | What it is | Where to get it |
|---|---|---|
| `DB_PASSWORD` | Password for the bundled database (Option A) | Make up a long random string |
| `DATABASE_URL` | Full database address (Option B) | Shown by RDS after creation |
| `AUTH_SECRET` | Signs login sessions | Make up a long random string; never share |
| `DOMAIN` | Your domain for automatic HTTPS (Option A) | Your registrar; leave `:80` to test by IP |
| `RAZORPAY_KEY_ID/SECRET` | Payments (PRD §14) | razorpay.com → API Keys. **Blank = demo mode** |
| `TWOFACTOR_API_KEY` | SMS (PRD §15) | 2factor.in. Blank = SMS printed to logs |
| `DIGILOCKER_CLIENT_ID` | KYC document verification | DigiLocker partner portal. Blank = manual review by your KYC Approver |

## Going live checklist

- [ ] Remove/replace the demo accounts
- [ ] Strong `AUTH_SECRET` and `DB_PASSWORD`
- [ ] Domain + HTTPS working (padlock in the browser) — also unlocks the
      installable mobile app (PWA): phones will offer "Add to Home Screen"
- [ ] Razorpay live keys when you're ready to charge booking fees
- [ ] 2Factor.in key so riders get real SMS
- [ ] Log in as Super Admin → review quotas, booking fees, fare rates (all
      editable from the admin panel, no developer needed)
- [ ] Option A: enable Lightsail automatic snapshots · Option B: RDS automated
      backups are on by default

## When something goes wrong

- **Site unreachable** → Option A: ports 80/443 not open in the firewall tab,
  or containers stopped (`docker compose -f docker-compose.prod.yml ps`).
- **"database unreachable" at /api/health** → wrong `DATABASE_URL`/`DB_PASSWORD`,
  or (Option B) the RDS security group doesn't allow the app in.
- **HTTPS not working** → the A record hasn't propagated yet (wait 10–30 min),
  or `DOMAIN` in `.env` doesn't exactly match the domain in the browser.
- **App Runner build fails** → check the service's build logs; almost always a
  missing environment variable.
