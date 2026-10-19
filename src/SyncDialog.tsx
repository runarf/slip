import { useEffect, useState } from 'react'

interface SyncHabit {
  id: string
  name: string
}

interface SyncHabitState {
  slipDates: string[]
  cleanDates?: string[]
  trackedDates?: string[]
  moodValues?: Record<string, number>
}

export interface SyncPayload {
  format: 'habit-tracker-sync'
  version: 1
  exportedAt: string
  firstUsedDate?: string
  habits: SyncHabit[]
  habitStates: Record<string, SyncHabitState>
}

interface SyncDialogProps {
  habits: SyncHabit[]
  habitStates: Record<string, SyncHabitState>
  firstUsedDate: string
  onMerge: (payload: SyncPayload) => void
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isDateKey(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function isSyncPayload(value: unknown): value is SyncPayload {
  if (!isRecord(value) || value.format !== 'habit-tracker-sync' || value.version !== 1) return false
  if (typeof value.exportedAt !== 'string' || Number.isNaN(Date.parse(value.exportedAt))) return false
  if (value.firstUsedDate !== undefined && (typeof value.firstUsedDate !== 'string' || !isDateKey(value.firstUsedDate))) return false
  if (!Array.isArray(value.habits) || !value.habits.every((habit) =>
    isRecord(habit) && typeof habit.id === 'string' && typeof habit.name === 'string')) return false
  if (!isRecord(value.habitStates)) return false

  return Object.values(value.habitStates).every((state) => {
    if (!isRecord(state) || !Array.isArray(state.slipDates)
      || !state.slipDates.every((date) => typeof date === 'string' && isDateKey(date))) return false
    if (state.cleanDates !== undefined && (!Array.isArray(state.cleanDates)
      || !state.cleanDates.every((date) => typeof date === 'string' && isDateKey(date)))) return false
    if (state.trackedDates !== undefined && (!Array.isArray(state.trackedDates)
      || !state.trackedDates.every((date) => typeof date === 'string' && isDateKey(date)))) return false

    if (state.moodValues === undefined) return true
    return isRecord(state.moodValues) && Object.entries(state.moodValues).every(([date, mood]) =>
      isDateKey(date) && Number.isInteger(mood) && Number(mood) >= 1 && Number(mood) <= 5)
  })
}

export default function SyncDialog({ habits, habitStates, firstUsedDate, onMerge }: SyncDialogProps): JSX.Element {
  const [open, setOpen] = useState(false)
  const [pastedJson, setPastedJson] = useState('')
  const [incoming, setIncoming] = useState<SyncPayload | null>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!open) return
    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [open])

  const createPayload = (): SyncPayload => ({
    format: 'habit-tracker-sync',
    version: 1,
    exportedAt: new Date().toISOString(),
    firstUsedDate,
    habits,
    habitStates: Object.fromEntries(Object.entries(habitStates).map(([id, state]) => [id, {
      slipDates: state.slipDates,
      cleanDates: state.cleanDates
        ?? (state.trackedDates ?? []).filter((date) => !state.slipDates.includes(date)),
      trackedDates: state.trackedDates ?? [...state.slipDates, ...(state.cleanDates ?? [])],
      moodValues: state.moodValues ?? {},
    }])),
  })

  const copySyncData = async (): Promise<void> => {
    const json = JSON.stringify(createPayload(), null, 2)
    setError('')
    setMessage('')
    try {
      await navigator.clipboard.writeText(json)
      setMessage('Sync data copied to clipboard.')
    } catch {
      setError('Could not access the clipboard. Check browser permissions and try again.')
    }
  }

  const parseSyncData = (): void => {
    setError('')
    setMessage('')
    setIncoming(null)
    try {
      const parsed: unknown = JSON.parse(pastedJson)
      if (!isSyncPayload(parsed)) throw new Error('Invalid sync data')
      setIncoming(parsed)
    } catch {
      setError('This JSON is invalid or uses an unsupported sync format.')
    }
  }

  const importSyncData = (): void => {
    if (!incoming) return
    onMerge(incoming)
    setIncoming(null)
    setMessage('Sync data merged.')
  }

  const localHabitsById = new Map(habits.map((habit) => [habit.id, habit]))
  const newHabitCount = incoming?.habits.filter((habit) => !localHabitsById.has(habit.id)).length ?? 0
  const newCleanCount = incoming
    ? Object.entries(incoming.habitStates).reduce((total, [id, state]) => {
      const localState = habitStates[id]
      const localClean = localState?.cleanDates
        ?? (localState?.trackedDates ?? []).filter((date) => !(localState?.slipDates ?? []).includes(date))
      const remoteClean = state.cleanDates
        ?? (state.trackedDates ?? []).filter((date) => !state.slipDates.includes(date))
      const localDates = new Set(localClean)
      return total + remoteClean.filter((date) => !localDates.has(date)).length
    }, 0)
    : 0
  const moodChanges = incoming
    ? Object.entries(incoming.habitStates).reduce((total, [id, state]) => {
      const localMoods = habitStates[id]?.moodValues ?? {}
      return total + Object.entries(state.moodValues ?? {}).filter(([date, mood]) => localMoods[date] !== mood).length
    }, 0)
    : 0

  return (
    <>
      <button type="button" className="tab-button sync-toggle" onClick={() => {
        setOpen(true)
        setError('')
        setMessage('')
      }} aria-label="Sync between devices" title="Sync between devices">
        🔄
      </button>
      {open && (
        <div className="sync-overlay" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setOpen(false)
        }}>
          <section className="sync-dialog" role="dialog" aria-modal="true" aria-labelledby="sync-title">
            <header className="sync-heading">
              <h2 id="sync-title">Sync between devices</h2>
              <button type="button" className="sync-close" onClick={() => setOpen(false)} aria-label="Close sync dialog">×</button>
            </header>
            <p className="sync-description">Copy your tracker data here, then paste it on the other device. Importing merges the data; it won’t replace your tracker.</p>
            <button type="button" className="sync-action" onClick={() => void copySyncData()}>📋 Copy sync data</button>
            <label className="sync-label" htmlFor="sync-json">Paste sync data</label>
            <textarea
              id="sync-json"
              className="sync-textarea"
              value={pastedJson}
              onChange={(event) => {
                setPastedJson(event.target.value)
                setIncoming(null)
                setError('')
                setMessage('')
              }}
              placeholder="Paste copied JSON here"
              spellCheck={false}
            />
            <button type="button" className="sync-action" onClick={parseSyncData} disabled={!pastedJson.trim()}>Review import</button>
            {incoming && (
              <div className="sync-preview" aria-live="polite">
                <strong>Ready to merge</strong>
                <span>{newHabitCount} new habits · {newCleanCount} clean-day overrides · {moodChanges} mood entries added or updated</span>
                <span>Days default to slipped; clean dates are preserved when importing.</span>
                <button type="button" className="sync-action" onClick={importSyncData}>📥 Import and merge</button>
              </div>
            )}
            {error && <p className="sync-error" role="alert">{error}</p>}
            {message && <p className="sync-message" role="status">{message}</p>}
          </section>
        </div>
      )}
    </>
  )
}