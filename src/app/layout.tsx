import type { Metadata } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import { Toaster } from 'sonner';
import './globals.css';

export const metadata: Metadata = {
  title: 'Image to 3D — AI-Powered 3D Model Generation',
  description:
    'Upload any image and get a textured 3D model in seconds. Preview in your browser, download as GLB/USDZ/OBJ.',
  keywords: ['image to 3d', '3d model generator', 'ai 3d', 'glb', '3d printing', 'webgl'],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className="min-h-screen antialiased">
          {children}
          <Toaster position="bottom-right" richColors />
        </body>
      </html>
    </ClerkProvider>
  );
}
