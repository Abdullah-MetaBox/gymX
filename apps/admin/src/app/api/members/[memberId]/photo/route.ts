import { can } from '@gymx/core/auth';
import { members } from '@gymx/db';
import { getStorage, tenantKey } from '@gymx/storage';
import { eq } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';
import { queryInGym } from '../../../../../lib/action';
import { sniffImage } from '../../../../../lib/image-upload';
import { getActiveContext } from '../../../../../lib/session';

/**
 * Upload a member's photo.
 *
 * Deliberately not a `prefix` parameter on /api/upload: a client-supplied prefix
 * is a key-forgery surface, and this route needs three things the generic one
 * cannot have — an update:member check, the caller's own gym id for the key, and
 * proof the member belongs to that gym.
 *
 * Returns the key AND the url. The key is what deletes the object later; the
 * storage adapter appends a random suffix, so it is not the key we pass in.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ memberId: string }> },
) {
  const { memberId } = await params;

  const context = await getActiveContext();
  if (!context) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  }
  if (!can(context.actor.role, 'update', 'member')) {
    return NextResponse.json({ error: 'You may not edit members.' }, { status: 403 });
  }
  const gymId = context.actor.gymId;
  if (!gymId) {
    return NextResponse.json({ error: 'Select a gym first.' }, { status: 400 });
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

  // RLS decides whether this member is visible; a member of another gym reads
  // as "not found" rather than leaking that the id exists.
  const exists = await queryInGym({ action: 'read', subject: 'member' }, (db) =>
    db
      .select({ id: members.id })
      .from(members)
      .where(eq(members.id, memberId))
      .limit(1)
      .then((rows) => rows.length > 0),
  );
  if (!exists) {
    return NextResponse.json({ error: 'Member not found.' }, { status: 404 });
  }

  try {
    const stored = await getStorage().put(
      tenantKey(gymId, 'members', memberId, `photo.${sniffed.image.extension}`),
      sniffed.image.bytes,
      { contentType: sniffed.image.contentType },
    );
    return NextResponse.json({ key: stored.key, url: stored.url });
  } catch (error) {
    console.error('[members.photo] upload failed', error);
    return NextResponse.json({ error: 'Could not store the photo.' }, { status: 500 });
  }
}
