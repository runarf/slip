import { useEffect, useState } from 'react'

export interface BackupHabit {
  id: string
  name: string
}

export interface BackupHabitState {
  panicLevel: number
  slipDates: string[]
  cleanDates?: string[]
  trackedDates?: string[]
  moodValues?: Record<string, number>
}

export interface DailyBackup {
  id: string
  date: string
  createdAt: string
  activeHabitId: string
  firstUsedDate?: string
  habits: BackupHabit[]
  habitStates: Record<string, BackupHabitState>
}

interface BackupDialogProps {
  backups: DailyBackup[]
  onRestore: (backup: DailyBackup) => void
}

export default function BackupDialog({ backups, onRestore }: BackupDialogProps): JSX.Element {
  const [open, setOpen] = useState(false)
  const [restoreConfirmId, setRestoreConfirmId] = useState<string | null>(null)
  const [restoredId, setRestoredId] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [open])

  const confirmRestore = (backup: DailyBackup): void => {
    if (restoreConfirmId !== backup.id) {
      setRestoreConfirmId(backup.id)
      setRestoredId(null)
      return
    }

    onRestore(backup)
    setRestoreConfirmId(null)
    setRestoredId(backup.id)
  }

  return (
    <>
      <button
        type="button"
        className="tab-button backup-toggle"
        onClick={() => setOpen(true)}
        aria-label="Open backups"
        title="Backups"
      >
        💾
      </button>
      {open && (
        <div className="backup-overlay" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setOpen(false)
        }}>
          <section className="backup-dialog" role="dialog" aria-modal="true" aria-labelledby="backup-title">
            <header className="backup-heading">
              <h2 id="backup-title">Backups</h2>
              <button type="button" className="backup-close" onClick={() => setOpen(false)} aria-label="Close backups">×</button>
            </header>
            <p className="backup-description">Automatic backups are saved on this device once per day while online. Up to 30 backups are kept.</p>
            {backups.length === 0 ? (
              <p className="backup-empty">No backups yet. A backup is created when the app is online.</p>
            ) : (
              <ul className="backup-list">
                {backups.map((backup) => (
                  <li key={backup.id} className="backup-item">
                    <div className="backup-details">
                      <strong>{backup.date}</strong>
                      <span>{new Date(backup.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
                    </div>
                    <button type="button" className="backup-restore" onClick={() => confirmRestore(backup)}>
                      {restoreConfirmId === backup.id ? 'Confirm restore' : 'Restore'}
                    </button>
                    {restoredId === backup.id && <span className="backup-restored" role="status">Restored</span>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </>
  )
}