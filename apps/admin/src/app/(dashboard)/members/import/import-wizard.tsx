'use client';

import { useTranslations } from 'next-intl';
import Papa from 'papaparse';
import { useRef, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Field,
  PageHeader,
  Select,
  Table,
  Td,
  Th,
} from '../../../../components/ui/index';
import { type ImportRowResult, importMembers } from './actions';
import { IMPORT_FIELDS, type ImportField, REQUIRED_IMPORT_FIELDS } from '../../../../lib/member-import/fields';

const REQUIRED_FIELDS: readonly ImportField[] = REQUIRED_IMPORT_FIELDS;

type Step = 'upload' | 'map' | 'preview' | 'done';

export function ImportWizard() {
  const t = useTranslations();
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>('upload');
  const [headers, setHeaders] = useState<string[]>([]);
  const [csvText, setCsvText] = useState('');
  const [previewRows, setPreviewRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Partial<Record<ImportField, string>>>({});
  const [results, setResults] = useState<ImportRowResult[]>([]);
  const [summary, setSummary] = useState({ ok: 0, errors: 0, duplicates: 0 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const parsed = Papa.parse<Record<string, string>>(text, {
        header: true,
        skipEmptyLines: true,
        preview: 5,
      });
      const allParsed = Papa.parse<Record<string, string>>(text, {
        header: true,
        skipEmptyLines: true,
      });
      setCsvText(text);
      setHeaders(parsed.meta.fields ?? []);
      setPreviewRows(parsed.data);

      // Auto-map headers that match field names (case-insensitive).
      const autoMap: Partial<Record<ImportField, string>> = {};
      for (const field of IMPORT_FIELDS) {
        const match = (parsed.meta.fields ?? []).find(
          (h) => h.toLowerCase().replace(/[^a-z]/g, '') === field.toLowerCase(),
        );
        if (match) autoMap[field] = match;
      }
      setMapping(autoMap);
      setStep('map');
    };
    reader.readAsText(file);
  }

  async function handlePreview() {
    if (!REQUIRED_FIELDS.every((f) => mapping[f])) {
      setError(t('import.mapRequired'));
      return;
    }
    setError('');
    setBusy(true);
    try {
      const res = await importMembers({ csvText, mapping, dryRun: true });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setResults(res.data.results.slice(0, 50));
      setSummary({
        ok: res.data.okCount,
        errors: res.data.errorCount,
        duplicates: res.data.duplicateCount,
      });
      setStep('preview');
    } finally {
      setBusy(false);
    }
  }

  async function handleImport() {
    setBusy(true);
    try {
      const res = await importMembers({ csvText, mapping, dryRun: false });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setSummary({
        ok: res.data.okCount,
        errors: res.data.errorCount,
        duplicates: res.data.duplicateCount,
      });
      setStep('done');
    } finally {
      setBusy(false);
    }
  }

  const STATUS_TONE = {
    ok: 'success',
    error: 'danger',
    duplicate: 'warning',
    skipped: 'neutral',
  } as const;

  return (
    <>
      <PageHeader title={t('import.title')} subtitle={t('import.subtitle')} />

      {/* Step 1: Upload */}
      {step === 'upload' && (
        <Card className="max-w-lg">
          <CardBody className="space-y-4">
            <p className="text-sm text-muted">
              Export your members from Google Sheets as CSV (File → Download → CSV). The first row
              must be column headers.
            </p>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileChange}
              className="block w-full text-sm text-muted file:mr-3 file:rounded-lg file:border file:border-[var(--color-border)] file:bg-[var(--color-surface-2)] file:px-3 file:py-1.5 file:text-sm file:font-medium"
            />
            <a
              href="/api/import-template"
              className="text-[var(--color-primary)] text-sm hover:underline underline-offset-2"
            >
              {t('import.downloadTemplate')}
            </a>
          </CardBody>
        </Card>
      )}

      {/* Step 2: Map columns */}
      {step === 'map' && (
        <div className="max-w-2xl space-y-5">
          {error && <Alert tone="danger">{error}</Alert>}
          <Card>
            <CardHeader>
              <CardTitle>{t('import.mapping')}</CardTitle>
            </CardHeader>
            <CardBody className="space-y-3">
              <p className="text-muted text-sm">{t('import.mappingHelp')}</p>
              {IMPORT_FIELDS.map((field) => (
                <div key={field} className="flex items-center gap-3">
                  <label className="w-48 text-sm shrink-0">
                    {t(`import.fields.${field}`)}
                    {REQUIRED_FIELDS.includes(field as ImportField) && (
                      <span className="ml-0.5 text-[var(--color-denied)]">*</span>
                    )}
                  </label>
                  <Select
                    value={mapping[field] ?? ''}
                    onChange={(e) =>
                      setMapping((m) => ({ ...m, [field]: e.target.value || undefined }))
                    }
                    className="flex-1"
                  >
                    <option value="">{t('import.selectColumn')}</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </Select>
                </div>
              ))}
            </CardBody>
          </Card>

          {previewRows.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>
                  {t('import.preview')} (first {previewRows.length} rows)
                </CardTitle>
              </CardHeader>
              <div className="overflow-x-auto">
                <Table>
                  <thead>
                    <tr>
                      {headers.slice(0, 6).map((h) => (
                        <Th key={h}>{h}</Th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row, i) => (
                      <tr key={i}>
                        {headers.slice(0, 6).map((h) => (
                          <Td key={h} className="text-muted max-w-[120px] truncate">
                            {row[h] ?? ''}
                          </Td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            </Card>
          )}

          <div className="flex gap-3">
            <Button onClick={handlePreview} disabled={busy}>
              {busy ? t('common.loading') : `Preview import →`}
            </Button>
            <Button variant="secondary" onClick={() => setStep('upload')}>
              {t('common.back')}
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Preview results */}
      {step === 'preview' && (
        <div className="space-y-5">
          <Alert tone="info">
            {summary.ok} rows OK · {summary.errors} errors · {summary.duplicates} duplicates
          </Alert>
          {error && <Alert tone="danger">{error}</Alert>}

          <Card className="overflow-hidden">
            <Table>
              <thead>
                <tr>
                  <Th>#</Th>
                  <Th>Status</Th>
                  <Th>Name</Th>
                  <Th>Details / Errors</Th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr key={r.rowNo}>
                    <Td className="text-muted font-mono text-xs">{r.rowNo}</Td>
                    <Td>
                      <Badge tone={STATUS_TONE[r.status]}>
                        {r.status === 'ok'
                          ? t('import.rowOk')
                          : r.status === 'error'
                            ? t('import.rowError')
                            : r.status === 'duplicate'
                              ? t('import.rowDuplicate')
                              : t('import.rowSkipped')}
                      </Badge>
                    </Td>
                    <Td>
                      {`${r.raw[mapping.firstName ?? ''] ?? ''} ${r.raw[mapping.lastName ?? ''] ?? ''}`.trim()}
                      {r.status === 'ok' && r.memberCode && ` → ${r.memberCode}`}
                    </Td>
                    <Td className="text-muted text-xs">{r.errors.join('; ') || '—'}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>

          <div className="flex gap-3">
            <Button onClick={handleImport} disabled={busy || summary.ok === 0}>
              {busy
                ? t('import.importing')
                : `${t('import.importBtn').replace('{count}', String(summary.ok))}`}
            </Button>
            <Button variant="secondary" onClick={() => setStep('map')}>
              {t('common.back')}
            </Button>
          </div>
        </div>
      )}

      {/* Step 4: Done */}
      {step === 'done' && (
        <div className="max-w-lg space-y-4">
          <Alert tone="info">
            {t('import.done')} — {summary.ok} imported, {summary.errors} errors,{' '}
            {summary.duplicates} duplicates.
          </Alert>
          <div className="flex gap-3">
            <a href="/members">
              <Button>View members</Button>
            </a>
            <Button
              variant="secondary"
              onClick={() => {
                setStep('upload');
                setCsvText('');
                setMapping({});
              }}
            >
              Import another file
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
