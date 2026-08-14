import { can } from '@gymx/core/auth';
import { getStorage } from '@gymx/storage';
import { type NextRequest, NextResponse } from 'next/server';
import { sniffImage } from '../../../lib/image-upload';
import { getActiveContext } from '../../../lib/session';

/**
 * Gym logo upload.
 *
 * Previously this gated on "is signed in" alone, trusted the client's
 * content-type (so an SVG could be stored and served), and built its key from
 * the unsanitised filename. Member photos have their own route — see
 * /api/members/[memberId]/photo — because they need tenant scoping this one
 * does not.
 */
export async function POST(request: NextRequest) {
  const context = await getActiveContext();
  if (!context) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  }
  if (!can(context.actor.role, 'update', 'gym')) {
    return NextResponse.json({ error: 'You may not change branding.' }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file provided.' }, { status: 400 });
  }

  const sniffed = await sniffImage(file);
  if (!sniffed.ok) {
    return NextResponse.json({ error: sniffed.error }, { status: sniffed.status });
  }

  try {
    // The adapter appends a random suffix, so a fixed name cannot collide.
    const stored = await getStorage().put(
      `logos/${context.actor.gymId ?? 'platform'}/logo.${sniffed.image.extension}`,
      sniffed.image.bytes,
      { contentType: sniffed.image.contentType },
    );
    return NextResponse.json({ url: stored.url, key: stored.key });
  } catch (error) {
    console.error('[upload] logo upload failed', error);
    return NextResponse.json({ error: 'Could not store the image.' }, { status: 500 });
  }
}
