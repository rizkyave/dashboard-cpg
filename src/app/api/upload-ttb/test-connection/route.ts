import { NextResponse } from 'next/server';
import { getR2Client, getR2Config, isR2Configured } from '@/utils/r2Client';
import { ListObjectsV2Command } from '@aws-sdk/client-s3';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return handleTest();
}

export async function POST() {
  return handleTest();
}

async function handleTest() {
  try {
    const config = getR2Config();

    if (!isR2Configured()) {
      return NextResponse.json(
        {
          success: false,
          error: 'Kredensial Cloudflare R2 belum lengkap di environment variables.',
          isConfigured: false,
        },
        { status: 400 }
      );
    }

    const startTime = Date.now();
    const client = getR2Client();
    const res = await client.send(
      new ListObjectsV2Command({
        Bucket: config.bucketName,
        MaxKeys: 5,
      })
    );
    const latencyMs = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      message: `Database Cloudflare Storage (${config.bucketName}) terhubung normal!`,
      bucket: config.bucketName,
      endpoint: config.endpoint,
      objectCountSample: (res.Contents || []).length,
      latencyMs,
    });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: (err as Error).message,
      },
      { status: 500 }
    );
  }
}
