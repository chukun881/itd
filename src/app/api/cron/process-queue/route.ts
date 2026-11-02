import { NextRequest, NextResponse } from 'next/server';
import { POST as processQueue } from '@/app/api/queue/process/route';

export async function GET(req: NextRequest) {
  return processQueue(req);
}
