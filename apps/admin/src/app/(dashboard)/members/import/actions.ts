'use server';

import { NotFoundError } from '@gymx/core/errors';
import { formatMemberCode, importJobs, importRows, members } from '@gymx/db';
import { eq, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import Papa from 'papaparse';
import { z } from 'zod';
import { defineAction } from '../../../../lib/action';

/** CSV field names the import recognises. */
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

export interface ImportRowResult {
  rowNo: number;
  status: 'ok' | 'error' | 'duplicate' | 'skipped';
  errors: string[];
  raw: Record<string, string>;
  memberCode?: string;
}

const importSchema = z.object({
  csvText: z.string().min(1).max(5_000_000),
  mapping: z.record(z.string()),
  dryRun: z.coerce.boolean().default(true),
});

export const importMembersAction = defineAction(
  importSchema,
  {
    permission: { action: 'create', subject: 'import_job' },
  },
  async (input, { db, actor }) => {
    const gymId = actor.gymId!;

    const parsed = Papa.parse<Record<string, string>>(input.csvText, {
      header: true,
      skipEmptyLines: true,
    });

    const rows = parsed.data;
    const results: ImportRowResult[] = [];

    // Fetch the current max seq once; we'll increment in-memory for the batch.
    const seqResult = await db
      .select({ maxSeq: sql<number>`COALESCE(MAX(member_seq), 0)` })
      .from(members)
      .where(eq(members.gymId, gymId));
    let maxSeq = seqResult[0]?.maxSeq ?? 0;

    // Collect emails already in the gym so we can detect duplicates without
    // a per-row query — the whole import runs in one transaction.
    const existingEmails = new Set(
      (await db.select({ email: members.email }).from(members).where(eq(members.gymId, gymId)))
        .map((r) => r.email?.toLowerCase())
        .filter(Boolean),
    );

    const rowResults: { seq: number; values: typeof members.$inferInsert }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const raw = rows[i] as Record<string, string>;
      const rowNo = i + 1;
      const errors: string[] = [];

      const get = (field: ImportField) => {
        const col = input.mapping[field];
        return col ? (raw[col] ?? '').trim() : '';
      };

      const firstName = get('firstName');
      const lastName = get('lastName');

      if (!firstName) errors.push('First name is required');
      if (!lastName) errors.push('Last name is required');

      const email = get('email').toLowerCase() || null;
      if (email && existingEmails.has(email)) {
        results.push({ rowNo, status: 'duplicate', errors: [`Duplicate email: ${email}`], raw });
        continue;
      }

      const dateOfBirth = get('dateOfBirth') || null;
      const joinedAt: string = get('joinedAt') || new Date().toISOString().split('T')[0]!;

      if (dateOfBirth && !/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) {
        errors.push('Date of birth must be YYYY-MM-DD');
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(joinedAt)) {
        errors.push('Joined date must be YYYY-MM-DD');
      }

      const rawGender = get('gender').toLowerCase();
      const gender = ['male', 'female'].includes(rawGender)
        ? (rawGender as 'male' | 'female')
        : null;

      if (errors.length > 0) {
        results.push({ rowNo, status: 'error', errors, raw });
        continue;
      }

      maxSeq += 1;
      if (email) existingEmails.add(email);

      rowResults.push({
        seq: maxSeq,
        values: {
          gymId,
          memberSeq: maxSeq,
          firstName,
          lastName,
          email,
          phone: get('phone') || null,
          dateOfBirth,
          gender,
          nic: get('nic') || null,
          address: get('address') || null,
          joinedAt,
          medicalNote: get('medicalNote') || null,
          emergencyContactName: get('emergencyContactName') || null,
          emergencyContactPhone: get('emergencyContactPhone') || null,
          locale: 'en',
          status: 'active',
        },
      });

      results.push({
        rowNo,
        status: 'ok',
        errors: [],
        raw,
        memberCode: formatMemberCode(maxSeq as number),
      });
    }

    const okCount = results.filter((r) => r.status === 'ok').length;
    const errorCount = results.filter((r) => r.status === 'error').length;
    const duplicateCount = results.filter((r) => r.status === 'duplicate').length;

    if (!input.dryRun && rowResults.length > 0) {
      // Insert in batches of 100 to avoid parameter limits.
      const batchSize = 100;
      for (let i = 0; i < rowResults.length; i += batchSize) {
        const batch = rowResults.slice(i, i + batchSize);
        await db.insert(members).values(batch.map((r) => r.values));
      }

      // Record the import job.
      const [job] = await db
        .insert(importJobs)
        .values({
          gymId,
          kind: 'members',
          fileKey: 'inline',
          mapping: input.mapping,
          dryRun: false,
          status: 'done',
          totalRows: rows.length,
          okRows: okCount,
          errorRows: errorCount + duplicateCount,
          createdBy: actor.userId,
          completedAt: new Date(),
        })
        .returning();

      if (job) {
        const rowInserts = results.map((r) => ({
          gymId,
          importJobId: job.id,
          rowNo: r.rowNo,
          raw: r.raw,
          status: r.status,
          errors: r.errors.length ? r.errors : null,
          entityId: null,
        }));
        if (rowInserts.length > 0) {
          const batchSize = 100;
          for (let i = 0; i < rowInserts.length; i += batchSize) {
            await db.insert(importRows).values(rowInserts.slice(i, i + batchSize));
          }
        }
      }

      revalidatePath('/members');
    }

    return { results, okCount, errorCount, duplicateCount, dryRun: input.dryRun };
  },
);
