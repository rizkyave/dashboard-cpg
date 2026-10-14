import { NextRequest, NextResponse } from 'next/server';
import { pingGoogleDriveAppsScript, DEFAULT_DRIVE_FOLDER_ID } from '@/utils/googleDriveAppsScript';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const scriptUrl =
      (body.scriptUrl as string) ||
      process.env.GOOGLE_DRIVE_SCRIPT_URL ||
      '';

    const folderId = (body.folderId as string) || process.env.GOOGLE_DRIVE_TTB_FOLDER_ID || DEFAULT_DRIVE_FOLDER_ID;

    if (!scriptUrl) {
      return NextResponse.json(
        {
          success: false,
          error: 'URL Google Apps Script belum diisi.',
        },
        { status: 400 }
      );
    }

    const startTime = Date.now();
    const result = await pingGoogleDriveAppsScript(scriptUrl, folderId);
    const latencyMs = Date.now() - startTime;

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Gagal tersambung ke Google Apps Script.',
          latencyMs,
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      message: result.message || 'Database Google Drive terhubung!',
      latencyMs,
      folderId,
      spreadsheetUrl: result.spreadsheetUrl,
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
