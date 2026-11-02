# Image-to-3D SaaS Platform: Production Setup & Action Checklist

Your application MVP is **100% developed, typed, and compiled**. You can test it locally right now in **Demo/Mock mode** by running:
```bash
cd itd
npm run dev
```

To take this platform into live production with real AI 3D generation, database storage, and payments, work through the following checklist.

---

## 1. Third-Party API Keys & Accounts (Priority 1)

### 1.1 Tripo3D API (Primary 3D Generation Engine)
- **Account:** Sign up at [platform.tripo3d.ai](https://platform.tripo3d.ai).
- **Cost:** ~$0.30 per generation on Standard tier ($10 buys ~33 generations for testing).
- **Action:** Generate an API Key in the Tripo Developer Console.
- **Config:** Set `TRIPO_API_KEY=tsk_your_real_key_here` in `.env.local` (and in your Vercel project settings).

### 1.2 Neon Postgres (Serverless Database)
- **Account:** Sign up at [neon.tech](https://neon.tech) (Free tier available: 0.5 GB storage).
- **Action:**
  1. Create a project named `image-to-3d`.
  2. Copy the pooled connection string (starts with `postgresql://...`).
- **Config:** Set `DATABASE_URL` in `.env.local`.
- **Database Migration:** Once added, push the database schema by running:
  ```bash
  npm run db:push
  ```

### 1.3 Cloudflare R2 (Object Storage with ZERO Egress Fees)
- **Account:** Sign up at [dash.cloudflare.com](https://dash.cloudflare.com) > R2.
- **Cost:** Free tier includes 10 GB storage and 10 million read operations per month.
- **Action:**
  1. Create a bucket named `image-to-3d`.
  2. In R2 Settings, enable **Public Access** or connect a custom domain (e.g., `models.yourdomain.com`).
  3. Under **CORS Policy**, paste this configuration to allow direct browser uploads:
     ```json
     [
       {
         "AllowedOrigins": ["http://localhost:3000", "https://yourdomain.com"],
         "AllowedMethods": ["GET", "PUT"],
         "AllowedHeaders": ["Content-Type", "Content-Length"],
         "ExposeHeaders": ["ETag"],
         "MaxAgeSeconds": 3600
       }
     ]
     ```
  4. Go to **Manage R2 API Tokens** > **Create API Token** (Object Read & Write permissions).
- **Config:** Set `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, and `R2_PUBLIC_URL` in `.env.local`.

### 1.4 Clerk (Authentication & User Management)
- **Account:** Sign up at [clerk.com](https://clerk.com) (Free tier up to 10,000 monthly active users).
- **Action:**
  1. Create an application (enable Email + Google OAuth).
  2. Copy your **Publishable Key** and **Secret Key**.
- **Config:** Set `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` in `.env.local`.

---

## 2. Monetization & Queueing (Priority 2)

### 2.1 Stripe (Credit Pack Payments)
- **Account:** Sign up at [stripe.com](https://stripe.com).
- **Action:**
  1. In Developers > API keys, copy your **Publishable key** and **Secret key**.
  2. In Developers > Webhooks, add an endpoint: `https://yourdomain.com/api/webhook/stripe`.
  3. Select event: `checkout.session.completed`.
  4. Copy the **Signing secret** (`whsec_...`).
- **Config:** Set `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_SECRET_KEY`, and `STRIPE_WEBHOOK_SECRET` in `.env.local`.

### 2.2 Upstash Redis (Distributed Concurrency Semaphore & Rate Limiting)
- **Account:** Sign up at [console.upstash.com](https://console.upstash.com) (Free tier includes 10,000 commands/day).
- **Action:**
  1. Create a serverless Redis database (Region: US East / same as your Vercel deployment).
  2. Copy the **REST URL** and **REST Token**.
- **Config:** Set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` in `.env.local`.

---

## 3. Custom Domain & Deployment (Priority 3)

### 3.1 Domain Name
- Purchase your domain from any registrar (e.g. Cloudflare Registrar, Namecheap, Google Domains / Squarespace) — typical cost: $10–$15/year.
- Point nameservers to Cloudflare (recommended for zero-latency CDN integration with R2).

### 3.2 Vercel Deployment
1. Push this repository to your GitHub account (`chukun881/itd`).
2. Go to [vercel.com](https://vercel.com) > **Add New Project** > Import `itd`.
3. Add the environment variables from your `.env.local` to the Vercel Project Settings.
4. Deploy! Vercel will automatically configure SSL, edge middleware, and serverless functions.
