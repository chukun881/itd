# Furniture 3D Draft Tool (MVP)

Internal, invite-only web app for a furniture factory pilot. The factory gets
pictures of furniture to make (online photos or the customer's design pictures,
never the real piece) and draws each one in Autodesk Inventor from scratch. This
app turns a picture into a **3D draft** to refine instead.

A user uploads a main photo (front or 3/4 view), optional extra photos of the
same piece, the piece type, and the overall size if the customer gave one. The
app runs fal.ai (optional Bria background removal, which can keep only one piece
of a set, then Hunyuan 3D v3.1 Pro in geometry mode), makes the mesh left/right
symmetric, sizes it (customer size, or the typical height of the piece type), and
returns STEP, STL, OBJ and GLB in mm.

The STEP file is faceted (one flat face per triangle), not parametric CAD. It is a
draft to model over, not production CAD.

## Stack

Next.js 15, own email/password login (scrypt, signed cookie, no sign-up), Neon Postgres + Drizzle, Cloudflare R2
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

## Users

There is no sign-up. Create users (prints a random password once) and reset passwords:

```bash
node --env-file=.env.local scripts/create-user.mjs sister@example.com --name "Sister"
node --env-file=.env.local scripts/create-user.mjs sister@example.com --reset
```

Admins are the emails in `ADMIN_EMAILS`. Five wrong passwords lock an account for
15 minutes. A reset also signs the user out on every device.

## Pilot scripts (Python)

```bash
python3 -m venv .venv-cad && .venv-cad/bin/pip install -r scripts/requirements-cad.txt
.venv-cad/bin/python scripts/pilot.py --name chair01 --front photo.jpg --w 490 --d 550 --h 850
.venv-cad/bin/python scripts/mesh_to_cad.py model.glb out/ chair01 --height-mm 850   # STL/OBJ/STEP
```

Branch flow: `feat/*` -> PR into `dev` -> `dev` -> `main`.
