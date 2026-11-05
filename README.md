# Furniture 3D Reference Tool (MVP)

Internal, invite-only web app for a furniture factory pilot. A user uploads
photos of a piece (front required; back, left, right optional) plus its real
size in mm. The app generates an AI 3D mesh with fal.ai (optional Bria
background removal, then Hunyuan 3D v3.1 Pro in geometry mode), makes it
left/right symmetric, stretches it to the exact width x depth x height, and
returns GLB, STL and OBJ files the designer traces over in Autodesk Inventor.

The output is a **reference mesh, not production CAD**.

## Stack

Next.js 15, Clerk (sign-up disabled), Neon Postgres + Drizzle, Cloudflare R2
(private bucket), fal.ai, React-Three-Fiber, gltf-transform. Hosted on Vercel.

## Development

```bash
cp .env.example .env.local   # fill in the values
npm install
npm run dev                  # http://localhost:3001
npm run check                # lint + typecheck + tests (run before every merge)
npm run db:generate          # after a schema change; commit the migration
npm run db:migrate           # apply migrations (never db:push outside local dev)
```

## Pilot scripts (Python)

```bash
python3 -m venv .venv-cad && .venv-cad/bin/pip install -r scripts/requirements-cad.txt
.venv-cad/bin/python scripts/pilot.py --name chair01 --front photo.jpg --w 490 --d 550 --h 850
.venv-cad/bin/python scripts/mesh_to_cad.py model.glb out/ chair01 --height-mm 850   # STL/OBJ/STEP
```

Branch flow: `feat/*` -> PR into `dev` -> `dev` -> `main`.
