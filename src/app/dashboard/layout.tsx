import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();

  if (!userId) {
    redirect('/sign-in');
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <nav className="border-b bg-white dark:bg-gray-900 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold">
            Image to <span className="text-blue-600">3D</span>
          </h1>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto p-6">{children}</main>
    </div>
  );
}
