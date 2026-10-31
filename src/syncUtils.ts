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
  if (habits.length < 1 || habits.length > 2) return false
  const habit1 = habits.find((h) => h.id === 'habit-1')
  const habitMood = habits.find((h) => h.id === 'habit-mood')
  if (!habit1 || habit1.name !== 'news') {
    return false
  }
  if ((habits.length === 2 && !habitMood) || (habitMood && habitMood.name !== 'mood')) {
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
 * Merges habit states: combines slip dates, clean dates, tracked dates, and mood values.
 */
export function mergeHabitStates(
  local: Record<string, HabitState>,
  remote: Record<string, Partial<HabitState> & Pick<HabitState, 'slipDates'>>
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
 * Merges all habits with the same non-empty, case-insensitive name and combines their states.
 */
export function mergeHabitData(
  localHabits: HabitItem[],
  localStates: Record<string, HabitState>,
  remoteHabits: HabitItem[],
  remoteStates: Record<string, Partial<HabitState> & Pick<HabitState, 'slipDates'>>
): { habits: HabitItem[]; habitStates: Record<string, HabitState> } {
  const parents = new Map<string, string>()
  const find = (id: string): string => {
    const parent = parents.get(id)
    if (!parent) {
      parents.set(id, id)
      return id
    }
    if (parent === id) return id
    const root = find(parent)
    parents.set(id, root)
    return root
  }
  const union = (left: string, right: string): void => {
    const leftRoot = find(left)
    const rightRoot = find(right)
    if (leftRoot !== rightRoot) parents.set(rightRoot, leftRoot)
  }

  const habitLists = [localHabits, remoteHabits].map((habits) =>
    habits.filter((habit) => habit.id !== 'habit-mood'),
  )
  const allHabits = habitLists.flat()
  const firstIdByName = new Map<string, string>()
  allHabits.forEach((habit) => {
    find(habit.id)
    const name = habit.name.trim().toLowerCase()
    if (!name) return
    const firstId = firstIdByName.get(name)
    if (firstId) {
      union(firstId, habit.id)
    } else {
      firstIdByName.set(name, habit.id)
    }
  })

  const canonicalIdByRoot = new Map<string, string>()
  habitLists.forEach((list) => {
    list.forEach((habit) => {
      const root = find(habit.id)
      if (!canonicalIdByRoot.has(root)) canonicalIdByRoot.set(root, habit.id)
    })
  })

  const mergedHabits = new Map<string, HabitItem>()
  localHabits.forEach((habit) => {
    const id = canonicalIdByRoot.get(find(habit.id)) ?? habit.id
    if (!mergedHabits.has(id)) mergedHabits.set(id, { ...habit, id })
  })
  remoteHabits.forEach((habit) => {
    const id = canonicalIdByRoot.get(find(habit.id)) ?? habit.id
    const existing = mergedHabits.get(id)
    if (existing) {
      if (habit.id === id && habit.name) mergedHabits.set(id, { ...existing, name: habit.name })
    } else {
      mergedHabits.set(id, { ...habit, id })
    }
  })

  let habitStates: Record<string, HabitState> = {}
  const stateLists = [localStates, remoteStates]
  stateLists.forEach((states) => {
    Object.entries(states).forEach(([sourceId, state]) => {
      const id = canonicalIdByRoot.get(find(sourceId)) ?? sourceId
      habitStates = mergeHabitStates(habitStates, { [id]: state })
    })
  })

  return { habits: Array.from(mergedHabits.values()), habitStates }
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
