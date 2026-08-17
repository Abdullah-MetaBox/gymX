import { can } from '@gymx/core/auth';
import { NextResponse } from 'next/server';
import {
  buildTemplateCsv,
  TEMPLATE_FILENAME,
} from '../../../lib/member-import/template';
import { getActiveContext } from '../../../lib/session';

/**
 * The CSV template for the member import.
 *
 * The import wizard has always linked here; the route did not exist, so the
 * link 404'd. Gated on the same permission as the import itself — offering a
 * template to someone who cannot import is just a slower dead end.
 */
export async function GET() {
  const context = await getActiveContext();
  if (!context) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  }
  if (!can(context.actor.role, 'create', 'member')) {
    return NextResponse.json({ error: 'You may not import members.' }, { status: 403 });
  }

  return new NextResponse(buildTemplateCsv(), {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${TEMPLATE_FILENAME}"`,
      'Cache-Control': 'no-store',
    },
  });
}
