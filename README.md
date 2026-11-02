# Image-to-3D SaaS Platform

A cloud-native, serverless Image-to-3D SaaS platform (Lupa.art alternative). Outsources 3D generation to third-party AI APIs (Tripo3D / Hyper3D Rodin) with zero GPU self-hosting, browser-based WebGL previewing (React-Three-Fiber), and automated serverless mesh decimation.

## Documentation

- [Product Requirements Document (PRD)](./PRD.md)
- [Architecture & Tech Stack Document](./ARCHITECTURE.md)
- [Project Progress Report](./PROJECT_PROGRESS_REPORT.md)

## Tech Stack Overview

- **Frontend:** Next.js 15 (App Router), React-Three-Fiber, Drei, Tailwind CSS, shadcn/ui
- **Backend / Compute:** Vercel Serverless Functions, AWS Lambda (headless `gltf-transform` decimation worker)
- **Database:** Neon Postgres (Drizzle ORM)
- **Storage:** Cloudflare R2 (zero-egress S3-compatible storage)
- **Queue / State:** Upstash QStash & Redis (distributed semaphore for concurrency control)
- **Auth & Billing:** Clerk, Stripe Checkout
- **3D Providers:** Tripo3D (v3.1 web tier), Hyper3D Rodin Gen-2.5 (premium tier), Meshy-7.1 (failover)
