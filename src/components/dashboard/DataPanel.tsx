import { useRef, useState } from 'react';
import { exportBackupJson, exportSessionsCsv, importBackupFile } from '@/lib/exporters';
import { Button, Card } from '@/components/ui';
import { useT } from '@/i18n';

/**
 * Your data, in your hands. Progress lives in this browser's storage, so an
 * export is both the analysis dataset (CSV) and the safety net against a
 * cleared browser or a switch of device (JSON backup).
 */
export function DataPanel({ hasSessions }: { hasSessions: boolean }) {
  const { t } = useT();
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);

  const onImport = async (file: File) => {
    const result = await importBackupFile(file);
    setStatus(result.ok ? t('data.imported', { n: result.sessions }) : t('data.importError'));
    if (result.ok) setTimeout(() => window.location.reload(), 900);
  };

  return (
    <Card>
      <h2 className="mb-1 text-sm font-semibold text-slate-400">{t('data.title')}</h2>
      <p className="mb-3 text-xs text-slate-500">{t('data.hint')}</p>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" disabled={!hasSessions} onClick={exportSessionsCsv}>
          ⬇ {t('data.exportCsv')}
        </Button>
        <Button variant="secondary" disabled={!hasSessions} onClick={exportBackupJson}>
          ⬇ {t('data.exportBackup')}
        </Button>
        <Button variant="ghost" onClick={() => fileRef.current?.click()}>
          ⬆ {t('data.import')}
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void onImport(file);
            e.target.value = '';
          }}
        />
      </div>
      {status && <p className="mt-2 text-xs text-slate-400">{status}</p>}
    </Card>
  );
}
