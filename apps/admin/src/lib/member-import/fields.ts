/**
 * The CSV columns the member import understands.
 *
 * Kept out of actions.ts because that file is `'use server'`, which may only
 * export async functions — a runtime value exported from there survives on
 * bundler tolerance rather than on the contract, and would break without
 * warning. Both the import wizard and /api/import-template read it from here,
 * so the template's header cannot drift from what the importer maps against.
 */
export const IMPORT_FIELDS = [
  'firstName',
  'lastName',
  'email',
  'phone',
  'dateOfBirth',
  'nic',
  'address',
  'gender',
  'joinedAt',
  'medicalNote',
  'emergencyContactName',
  'emergencyContactPhone',
] as const;

export type ImportField = (typeof IMPORT_FIELDS)[number];

/** Columns without which a row cannot be imported at all. */
export const REQUIRED_IMPORT_FIELDS: readonly ImportField[] = ['firstName', 'lastName'];
