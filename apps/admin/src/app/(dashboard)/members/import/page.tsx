import { requirePageAccess } from '../../../../lib/session';
import { ImportWizard } from './import-wizard';

/**
 * Server page wrapping the client wizard.
 *
 * The wizard used to BE the page, marked 'use client'. A client page importing
 * a server action at module scope put a module reference across the RSC
 * boundary — "Only plain objects can be passed to Client Components" — and the
 * route 500'd on cold compile. Splitting it is the shape Next expects anyway,
 * and it gives the route its own permission gate rather than leaning on the
 * layout's.
 */
export default async function ImportMembersPage() {
  await requirePageAccess('create', 'import_job');
  return <ImportWizard />;
}
