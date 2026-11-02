import Link from 'next/link';
import {
  Sparkles,
  ArrowRight,
  Box,
  Layers,
  Zap,
  Shield,
  Download,
  Smartphone,
  CheckCircle2,
} from 'lucide-react';
import { CREDIT_PACKS } from '@/lib/constants';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-neutral-950 text-white selection:bg-blue-600 selection:text-white">
      {/* Navigation Bar */}
      <nav className="border-b border-neutral-800/80 bg-neutral-950/80 backdrop-blur-md sticky top-0 z-50 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-bold text-xl tracking-tight">
            <Box className="h-6 w-6 text-blue-500" />
            <span>
              Image<span className="text-blue-500">2</span>3D
            </span>
          </Link>

          <div className="flex items-center gap-4">
            <Link
              href="/pricing"
              className="text-sm font-medium text-neutral-400 hover:text-white transition-colors"
            >
              Pricing
            </Link>
            <Link
              href="/dashboard"
              className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-500 transition-colors"
            >
              Go to Studio
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-24 pb-20 px-6 text-center overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.12),transparent_70%)] pointer-events-none" />

        <div className="max-w-4xl mx-auto relative z-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-4 py-1.5 text-xs font-semibold text-blue-400 mb-8 backdrop-blur-sm">
            <Sparkles className="h-3.5 w-3.5" />
            <span>AI-Powered 3D Generation Platform</span>
          </div>

          <h1 className="text-5xl sm:text-7xl font-extrabold tracking-tight leading-[1.1] mb-6">
            Turn Any 2D Photo Into a <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300">Textured 3D Model</span>
          </h1>

          <p className="text-lg sm:text-xl text-neutral-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            Upload an image, preview a clean textured `.glb` directly in your browser, and download
            production-ready 3D assets in seconds. Zero GPUs required.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/dashboard"
              className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-8 py-4 text-sm font-bold text-white shadow-lg shadow-blue-600/30 hover:bg-blue-500 hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              <span>Launch Generation Studio</span>
              <ArrowRight className="h-4 w-4" />
            </Link>

            <Link
              href="/pricing"
              className="w-full sm:w-auto rounded-2xl border border-neutral-800 bg-neutral-900/60 px-8 py-4 text-sm font-semibold text-neutral-300 hover:bg-neutral-800/80 transition-colors"
            >
              View Credit Packs
            </Link>
          </div>
        </div>
      </section>

      {/* 3-Step Flow */}
      <section className="py-20 px-6 border-t border-neutral-900 bg-neutral-900/20">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-xs font-bold tracking-widest text-blue-500 uppercase">
              How It Works
            </h2>
            <p className="mt-2 text-3xl font-extrabold sm:text-4xl">
              From flat image to WebGL 3D in 3 simple steps
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="rounded-3xl border border-neutral-800 bg-neutral-900/50 p-8">
              <div className="h-12 w-12 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-400 font-bold text-lg mb-6">
                1
              </div>
              <h3 className="text-lg font-bold mb-2">Upload Photo</h3>
              <p className="text-sm text-neutral-400 leading-relaxed">
                Upload any JPG, PNG, or WebP photo. Client-side downscaling prepares the asset for direct
                secure cloud storage.
              </p>
            </div>

            <div className="rounded-3xl border border-neutral-800 bg-neutral-900/50 p-8">
              <div className="h-12 w-12 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-400 font-bold text-lg mb-6">
                2
              </div>
              <h3 className="text-lg font-bold mb-2">AI Mesh Synthesis</h3>
              <p className="text-sm text-neutral-400 leading-relaxed">
                Outsourced neural networks reconstruct quad topology and generate PBR diffuse and
                metallic maps in &lt;60s.
              </p>
            </div>

            <div className="rounded-3xl border border-neutral-800 bg-neutral-900/50 p-8">
              <div className="h-12 w-12 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-400 font-bold text-lg mb-6">
                3
              </div>
              <h3 className="text-lg font-bold mb-2">Inspect & Download</h3>
              <p className="text-sm text-neutral-400 leading-relaxed">
                Rotate, zoom, and test wireframe in your browser. Download optimized `.glb` models ready
                for game engines and AR.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Highlights Grid */}
      <section className="py-20 px-6 border-t border-neutral-900">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-xs font-bold tracking-widest text-blue-500 uppercase">
              Built for Performance
            </h2>
            <p className="mt-2 text-3xl font-extrabold sm:text-4xl">
              Production-Ready 3D Features
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="rounded-2xl border border-neutral-800/80 bg-neutral-900/30 p-6">
              <Smartphone className="h-6 w-6 text-blue-400 mb-4" />
              <h3 className="text-base font-bold mb-2">Mobile Decimation Worker</h3>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Automatic Meshopt decimation and Draco compression guarantee models load under 5MB at
                &ge;30 FPS without crashing mobile browsers.
              </p>
            </div>

            <div className="rounded-2xl border border-neutral-800/80 bg-neutral-900/30 p-6">
              <Zap className="h-6 w-6 text-amber-400 mb-4" />
              <h3 className="text-base font-bold mb-2">Dual Quality Tiers</h3>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Choose between cheap Standard Web preview tier (~$0.30) and high-poly Premium tier
                with production topology.
              </p>
            </div>

            <div className="rounded-2xl border border-neutral-800/80 bg-neutral-900/30 p-6">
              <Shield className="h-6 w-6 text-green-400 mb-4" />
              <h3 className="text-base font-bold mb-2">Atomic Credit Safety</h3>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Single-query SQL credit verification and automatic refund rollbacks if any 3D provider
                ever encounters an error.
              </p>
            </div>

            <div className="rounded-2xl border border-neutral-800/80 bg-neutral-900/30 p-6">
              <Layers className="h-6 w-6 text-purple-400 mb-4" />
              <h3 className="text-base font-bold mb-2">Browser 3D Inspection</h3>
              <p className="text-xs text-neutral-400 leading-relaxed">
                WebGL Orbit controls, real-time wireframe toggle, environment lighting presets, and
                shadow casting via Three.js.
              </p>
            </div>

            <div className="rounded-2xl border border-neutral-800/80 bg-neutral-900/30 p-6">
              <Download className="h-6 w-6 text-cyan-400 mb-4" />
              <h3 className="text-base font-bold mb-2">Universal Formats</h3>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Standard `.glb` binaries with embedded textures work seamlessly in Blender, Unity,
                Unreal Engine, and WebXR.
              </p>
            </div>

            <div className="rounded-2xl border border-neutral-800/80 bg-neutral-900/30 p-6">
              <CheckCircle2 className="h-6 w-6 text-blue-400 mb-4" />
              <h3 className="text-base font-bold mb-2">Commercial Rights</h3>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Every generated model is 100% yours to use in commercial e-commerce, indie video games,
                or client presentations.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Preview */}
      <section className="py-20 px-6 border-t border-neutral-900 bg-neutral-900/20">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-extrabold mb-4">Pay As You Go. No Subscriptions.</h2>
          <p className="text-neutral-400 text-sm mb-12">
            Buy credit packs when you need them. Unused credits never expire.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {CREDIT_PACKS.map((pack) => (
              <div
                key={pack.id}
                className="rounded-2xl border border-neutral-800 bg-neutral-900/80 p-6 flex flex-col justify-between"
              >
                <div>
                  <h3 className="font-bold text-base">{pack.label}</h3>
                  <p className="text-2xl font-extrabold text-blue-400 my-3">{pack.priceLabel}</p>
                  <p className="text-xs text-neutral-400">
                    {(pack.price / 100 / pack.credits).toFixed(2)} per generation
                  </p>
                </div>
                <Link
                  href="/pricing"
                  className="mt-6 block rounded-xl bg-neutral-800 py-2.5 text-xs font-semibold hover:bg-neutral-700 transition-colors"
                >
                  Get Started
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-neutral-900 py-10 px-6 text-center text-xs text-neutral-500">
        <p>&copy; {new Date().getFullYear()} Image23D SaaS. Built on Next.js 15, Three.js, and serverless cloud architecture.</p>
      </footer>
    </div>
  );
}
