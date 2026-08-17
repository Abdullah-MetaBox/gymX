import Papa from 'papaparse';
import { describe, expect, it } from 'vitest';
import { IMPORT_FIELDS, REQUIRED_IMPORT_FIELDS } from './fields';
import { buildTemplateCsv, SAMPLE_ROWS } from './template';

/**
 * The template and the importer have to agree. They are separate code paths
 * that meet only in the user's spreadsheet, so a drift between them surfaces as
 * "the import is broken" long after the change that caused it.
 */

const parsed = () =>
  Papa.parse<Record<string, string>>(buildTemplateCsv().replace(/^﻿/, ''), {
    header: true,
    skipEmptyLines: true,
  });

describe('member import template', () => {
  it('has exactly the columns the importer maps against', () => {
    expect(parsed().meta.fields).toEqual([...IMPORT_FIELDS]);
  });

  it('parses with the same CSV reader the wizard uses', () => {
    expect(parsed().errors).toEqual([]);
  });

  it('ships sample rows so the file is not just a header', () => {
    expect(parsed().data.length).toBeGreaterThan(0);
  });

  it('starts with a BOM, so Excel reads it as UTF-8', () => {
    expect(buildTemplateCsv().charCodeAt(0)).toBe(0xfeff);
  });

  it('uses CRLF line endings', () => {
    expect(buildTemplateCsv()).toContain('\r\n');
  });
});

describe('sample rows satisfy the importer', () => {
  it.each(SAMPLE_ROWS.map((row, i) => [i, row] as const))('row %i is importable', (_i, row) => {
    // Mirrors the validation in actions.ts: both names present, ISO dates, and
    // a gender the importer recognises (blank is allowed and becomes null).
    for (const field of REQUIRED_IMPORT_FIELDS) {
      expect(row[field]).not.toBe('');
    }
    for (const field of ['dateOfBirth', 'joinedAt'] as const) {
      if (row[field]) expect(row[field]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
    if (row.gender) expect(['male', 'female']).toContain(row.gender.toLowerCase());
  });

  it('demonstrates that only the two names are mandatory', () => {
    const minimal = SAMPLE_ROWS.find((row) => row.email === '' && row.joinedAt === '');
    expect(minimal, 'expected a row exercising the all-optional-blank case').toBeDefined();
  });

  it('quotes and escapes correctly when a value contains a comma or a quote', () => {
    // The address column carries a comma in row 0 — if quoting were wrong, the
    // parse above would shift every later column by one.
    const [first] = parsed().data;
    expect(first?.address).toBe('Royal Road, Grand Baie');
  });
});
