import type { DailyBackup } from './BackupDialog'

export interface HabitItem {
  id: string
  name: string
}

export interface HabitState {
  panicLevel: number
  slipDates: string[]
  cleanDates?: string[]
  trackedDates?: string[]
  moodValues?: Record<string, number>
}

export interface AppSnapshot {
  habits: HabitItem[]
  habitStates: Record<string, HabitState>
  firstUsedDate: string
  activeHabitId: string
  backups: DailyBackup[]
  savedAt: string
}

export const SAFETY_SNAPSHOT_KEY = 'habit-tracker-safety-backup'

/**
 * Checks if the current local habits are just the initial default placeholders
 * (e.g. fresh browser installation with dummy 'news' habit and no real user check-ins).
 */
export function isDefaultSeedData(
  habits: HabitItem[],
  habitStates: Record<string, HabitState>
): boolean {
  if (habits.length !== 2) return false
  const habit1 = habits.find((h) => h.id === 'habit-1')
  const habitMood = habits.find((h) => h.id === 'habit-mood')
  if (!habit1 || !habitMood || habit1.name !== 'news' || habitMood.name !== 'mood') {
    return false
  }

  const state1 = habitStates['habit-1']
  // If user recorded clean check-ins, it is not untouched seed data
  if (state1?.cleanDates && state1.cleanDates.length > 0) return false

  const stateMood = habitStates['habit-mood']
  // If user recorded moods, it is not untouched seed data
  if (stateMood?.moodValues && Object.keys(stateMood.moodValues).length > 0) return false

  return true
}

/**
 * Creates a safety snapshot of local storage data before any cloud sync or restore.
 */
export function createLocalSafetySnapshot(snapshot: Omit<AppSnapshot, 'savedAt'>): void {
  try {
    const fullSnapshot: AppSnapshot = {
      ...snapshot,
      savedAt: new Date().toISOString(),
    }
    localStorage.setItem(SAFETY_SNAPSHOT_KEY, JSON.stringify(fullSnapshot))
  } catch (err) {
    console.warn('Could not save safety snapshot to localStorage:', err)
  }
}

/**
 * Merges two lists of habits by unique ID.
 */
export function mergeHabitLists(local: HabitItem[], remote: HabitItem[]): HabitItem[] {
  const map = new Map<string, HabitItem>()
  local.forEach((h) => map.set(h.id, h))
  remote.forEach((h) => {
    const existing = map.get(h.id)
    if (existing) {
      map.set(h.id, { id: h.id, name: h.name || existing.name })
    } else {
      map.set(h.id, h)
    }
  })
  return Array.from(map.values())
}

/**
 * Merges habit states: combines slip dates, clean dates, tracked dates, and mood values.
 */
export function mergeHabitStates(
  local: Record<string, HabitState>,
  remote: Record<string, HabitState>
): Record<string, HabitState> {
  const merged: Record<string, HabitState> = { ...local }

  Object.entries(remote).forEach(([id, rState]) => {
    const lState = merged[id] ?? {
      panicLevel: 0,
      slipDates: [],
      cleanDates: [],
      trackedDates: [],
      moodValues: {},
    }

    const localClean = lState.cleanDates ?? (lState.trackedDates ?? []).filter((d) => !lState.slipDates.includes(d))
    const remoteClean = rState.cleanDates ?? (rState.trackedDates ?? []).filter((d) => !rState.slipDates.includes(d))

    const combinedSlips = Array.from(new Set([...(lState.slipDates ?? []), ...(rState.slipDates ?? [])])).sort()
    const combinedClean = Array.from(new Set([...localClean, ...remoteClean])).sort()
    const combinedTracked = Array.from(new Set([
      ...(lState.trackedDates ?? []),
      ...(rState.trackedDates ?? []),
      ...combinedSlips,
      ...combinedClean,
    ])).sort()

    merged[id] = {
      panicLevel: Math.max(lState.panicLevel ?? 0, rState.panicLevel ?? 0),
      slipDates: combinedSlips,
      cleanDates: combinedClean,
      trackedDates: combinedTracked,
      moodValues: {
        ...(lState.moodValues ?? {}),
        ...(rState.moodValues ?? {}),
      },
    }
  })

  return merged
}

/**
 * Merges daily backup snapshots without duplicates, keeping up to maxBackups.
 */
export function mergeDailyBackups(
  local: DailyBackup[],
  remote: DailyBackup[],
  maxBackups: number
): DailyBackup[] {
  const map = new Map<string, DailyBackup>()
  local.forEach((b) => map.set(b.id, b))
  remote.forEach((b) => map.set(b.id, b))
  return Array.from(map.values())
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, maxBackups)
}
