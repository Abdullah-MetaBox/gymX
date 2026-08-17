import { IMPORT_FIELDS, type ImportField } from './fields';

/**
 * The downloadable CSV template.
 *
 * Built from IMPORT_FIELDS so the header cannot drift from what the importer
 * maps against — a hand-written header goes stale the first time a field is
 * added, and the resulting failure reads as "the import is broken" rather than
 * "the template is out of date".
 */

/** Sample rows, valid against every rule the importer enforces. */
export const SAMPLE_ROWS: Record<ImportField, string>[] = [
  {
    firstName: 'Anil',
    lastName: 'Ramdhani',
    email: 'anil.ramdhani@example.com',
    phone: '+230 5757 1001',
    dateOfBirth: '1979-04-02',
    nic: 'R7904021234567',
    address: 'Royal Road, Grand Baie',
    gender: 'male',
    joinedAt: '2024-03-01',
    medicalNote: '',
    emergencyContactName: 'Sunita Ramdhani',
    emergencyContactPhone: '+230 5757 1002',
  },
  {
    // Everything optional left blank: only the two names are required, and
    // joinedAt defaults to today when absent.
    firstName: 'Sunita',
    lastName: 'Ramdhani',
    email: '',
    phone: '',
    dateOfBirth: '',
    nic: '',
    address: '',
    gender: 'female',
    joinedAt: '',
    medicalNote: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
  },
];

/** RFC 4180: quote every field, and double any quote inside it. */
function csvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

export function buildTemplateCsv(): string {
  const lines = [
    IMPORT_FIELDS.map(csvCell).join(','),
    ...SAMPLE_ROWS.map((row) => IMPORT_FIELDS.map((field) => csvCell(row[field])).join(',')),
  ];

  // A BOM so Excel opens it as UTF-8. Without it a name like "Ramgoolam-Émile"
  // arrives mangled, and whoever is importing has no reason to suspect the
  // template rather than their own data.
  return `﻿${lines.join('\r\n')}\r\n`;
}

export const TEMPLATE_FILENAME = 'gymx-members-template.csv';
