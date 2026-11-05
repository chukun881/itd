> **Superseded (2026-11-05).** This document describes the original public SaaS plan. The project is now an internal, invite-only furniture reference-mesh tool built on fal.ai. See README.md.

# Product Requirements Document (PRD)
## Image-to-3D SaaS Platform (Lupa.art Clone)

**Version:** 0.1 — Draft  
**Date:** 2026-11-01  
**Status:** Research & Architecture Phase  

---

## 1. Executive Summary

Build a **web-based SaaS product** that lets users upload a 2D image and receive a textured 3D model (`.glb`) they can preview in the browser, download, and use commercially. The 3D generation itself is **fully outsourced** to a third-party AI API (no self-hosted GPUs). The entire platform runs on **serverless cloud infrastructure**, designed for cost efficiency, horizontal scalability, and fast time-to-market.

### Core Value Proposition
- Zero GPU infrastructure ownership — 100% API-driven 3D generation.
- Two-tier output quality: a **fast/cheap web preview** tier and a **premium high-poly** tier.
- Browser-native 3D rendering (WebGL) — no plugins, no downloads to preview.

---

## 2. Problem Statement & Goals

### 2.1 Problem Statement
Existing platforms like Lupa.art, Meshy, and Tripo bundle their AI models with their frontend, creating **vendor lock-in** and preventing white-label or customized experiences. Creators, e-commerce sellers, and game developers need a **branded, embeddable, API-agnostic** Image-to-3D experience that:
- Works entirely in the browser (mobile included).
- Offers predictable per-generation pricing.
- Does not require the operator to own or manage GPU hardware.

### 2.2 Objectives & Key Results (OKRs)

| Objective | Key Result |
| :--- | :--- |
| Ship a usable MVP | Users can upload an image and download a `.glb` within 90s end-to-end |
| Cost-efficient operations | COGS per generation ≤ \$0.50 on the cheap tier |
| Mobile-friendly 3D | Compressed `.glb` ≤ 5 MB; renders at ≥ 30 FPS on mid-range phones |
| Credit-based monetization | Users purchase credits; 1 credit = 1 generation (cheap tier) |
| Fraud protection | ≤ 0.1% of generations are from fraudulent/bot traffic |

---

## 3. User Personas & Use Cases

### 3.1 Target Users

| Persona | Needs | Willingness to Pay |
| :--- | :--- | :--- |
| **E-Commerce Seller** | Quick 3D product mockups from product photos | Medium — wants bulk discounts |
| **Indie Game Developer** | Fast asset prototyping with clean topology | High — needs premium output |
| **Architect / Interior Designer** | Furniture & object 3D models from catalog images | Medium |
| **Social Media Creator** | Novelty 3D content from selfies/art | Low — uses free tier |

### 3.2 Core Use Cases / User Stories

1. **As a** user, **I want to** upload a product photo and receive a 3D model in < 60s, **so that** I can preview it in AR on my website.
2. **As a** user, **I want to** choose between a "Fast" and "Premium" generation tier, **so that** I can balance cost vs. quality.
3. **As a** user, **I want to** rotate and inspect the 3D model in my browser before downloading, **so that** I know what I'm paying for.
4. **As an** admin, **I want to** see generation costs per API provider in real time, **so that** I can switch providers if costs spike.

---

## 4. Scope & Features

### 4.1 In Scope (MVP)

| Feature | Details |
| :--- | :--- |
| Image Upload | Accept `.jpg`, `.png`, `.webp`; max 10 MB; client-side resize to ≤ 2048px |
| 3D Generation (Cheap Tier) | Tripo v3.1 — mesh + standard texture (~\$0.30/gen) |
| 3D Generation (Premium Tier) | Rodin Gen-2.5 High or Tripo P1.0 — high-poly + PBR (~\$0.50–\$1.50/gen) |
| 3D Viewer | React-Three-Fiber (R3F) `.glb` viewer with orbit controls, lighting |
| Mesh Compression Pipeline | Serverless `gltf-transform` → Draco/Meshopt compression before delivery |
| Download | `.glb` (web), `.usdz` (Apple AR), `.obj` (legacy) |
| Credit System | Prepaid credits; Stripe Checkout integration |
| Auth | Email + OAuth (Google/GitHub) via Clerk or Supabase Auth |
| Generation History | Dashboard showing past generations with thumbnails |

### 4.2 Out of Scope / Future Considerations

- Text-to-3D generation.
- Auto-rigging and animation.
- Multi-image / turntable-based reconstruction.
- Self-hosted AI model inference.
- Native mobile apps (iOS/Android).
- Real-time collaborative editing.
- Marketplace for selling generated models.

---

## 5. Functional Requirements

### FR-1: Image Upload & Validation
- Client resizes image to max 2048×2048 before upload.
- Backend validates MIME type (`image/jpeg`, `image/png`, `image/webp`) and file size (≤ 10 MB).
- File is uploaded **directly to object storage** via presigned PUT URL (no file traversal through serverless function).

### FR-2: Generation Job Submission
- Backend deducts 1 credit from user balance (atomic DB transaction).
- Backend submits image URL to the selected 3D API provider.
- Returns a `job_id` to the frontend immediately.

### FR-3: Async Job Tracking
- Backend receives webhook `POST` from API provider on job completion/failure.
- On success: downloads the raw `.glb` from provider CDN → runs compression pipeline → uploads optimized `.glb` to object storage → updates DB row → pushes status to frontend via SSE/WebSocket.
- On failure: refunds 1 credit to user balance → pushes error to frontend.

### FR-4: 3D Preview & Download
- Frontend loads `.glb` from object storage CDN via signed URL (1-hour expiry).
- Viewer: orbit, zoom, pan, environment lighting presets.
- Download button generates a fresh presigned GET URL.

### FR-5: Credit System & Billing
- Users buy credit packs (e.g., 10 credits / \$5, 50 credits / \$20, 200 credits / \$70).
- Stripe Checkout webhook confirms payment → credits added to DB.
- Admin dashboard shows credit burn rate and revenue.

---

## 6. Non-Functional Requirements

- **Performance:** End-to-end generation < 90s (cheap tier), < 180s (premium tier). 3D viewer loads in < 3s on 4G.
- **Scalability & Reliability:** Handle 500 concurrent generation requests via server-side queue. 99.9% uptime target. Auto-scaling serverless functions.
- **Usability & Accessibility:** Mobile-responsive viewer. WCAG 2.1 AA for all non-3D UI.
- **Security & Compliance:** All uploads encrypted at rest (AES-256). Presigned URLs expire. Rate limiting on generation endpoint. GDPR-compliant user data handling.

---

## 7. Assumptions & Dependencies

| Assumption | Risk if Wrong |
| :--- | :--- |
| Tripo/Rodin APIs remain publicly available and priced similarly | Must swap providers; architecture must be provider-agnostic |
| `.glb` is the universal web 3D format | If USDZ or another format dominates, viewer needs updating |
| Serverless functions can run `gltf-transform` in < 30s | May need a dedicated container (ECS/Cloud Run) for heavy meshes |
| Cloudflare R2 egress is truly free | If pricing changes, switch to S3 with CloudFront |

---

## 8. Open Questions & Risks

| # | Question | Owner | Status |
| :--- | :--- | :--- | :--- |
| 1 | Which Tripo model version to default to (v3.1 vs P1.0)? | Product | Open |
| 2 | Do we need a free tier? If so, how many free generations? | Product | Open |
| 3 | What is the acceptable mesh polygon budget for mobile? | Engineering | Open — needs benchmarking |
| 4 | Should we support multi-image input (front+back) for better quality? | Product | Deferred to v2 |
| 5 | API provider goes down — do we have a hot failover to a second provider? | Engineering | Open |
