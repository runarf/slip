import { useEffect, useRef, useState } from 'react'
import BackupDialog, { type DailyBackup } from './BackupDialog'
import SyncDialog, { type SyncPayload } from './SyncDialog'
import './App.css'

const HABIT_KEY = 'habit-tracker-habit'
const SLIPS_KEY = 'habit-tracker-slip-dates'
const HABITS_KEY = 'habit-tracker-habits'
const THEME_KEY = 'habit-tracker-theme'
const REMINDER_KEY = 'habit-tracker-reminder'
const REMINDER_TIME_KEY = 'habit-tracker-reminder-time'
const REMINDER_LAST_TRIGGER_KEY = 'habit-tracker-reminder-last-trigger'
const BACKUPS_KEY = 'habit-tracker-daily-backups'
const FIRST_USED_KEY = 'habit-tracker-first-used-date'
const MAX_BACKUPS = 30

interface HabitItem {
  id: string
  name: string
}

interface HabitState {
  panicLevel: number
  slipDates: string[]
  cleanDates?: string[]
  trackedDates?: string[]
  moodValues?: Record<string, number>
}

function formatKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function getLastSevenDays(): Date[] {
  const days: Date[] = []
  const today = new Date()

  for (let i = 6; i >= 0; i -= 1) {
    const date = new Date(today)
    date.setDate(today.getDate() - i)
    days.push(date)
  }

  return days
}

function getLocalDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getHabitHistoryDays(firstUsedDate: string): Date[] {
  const firstDay = new Date(`${firstUsedDate}T12:00:00`)
  if (Number.isNaN(firstDay.getTime())) return []

  firstDay.setDate(firstDay.getDate() - 6)
  const today = new Date()
  today.setHours(12, 0, 0, 0)
  const days: Date[] = []

  for (const date = firstDay; date <= today; date.setDate(date.getDate() + 1)) {
    days.push(new Date(date))
  }

  return days
}

function loadBackups(): DailyBackup[] {
  try {
    const saved = localStorage.getItem(BACKUPS_KEY)
    if (!saved) return []
    const parsed: unknown = JSON.parse(saved)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((backup): backup is DailyBackup =>
      !!backup
      && typeof backup.id === 'string'
      && typeof backup.date === 'string'
      && typeof backup.createdAt === 'string'
      && typeof backup.activeHabitId === 'string'
      && Array.isArray(backup.habits)
      && !!backup.habitStates
      && typeof backup.habitStates === 'object',
    ).slice(0, MAX_BACKUPS)
  } catch {
    return []
  }
}

function App(): JSX.Element {
  const [habits, setHabits] = useState<HabitItem[]>(() => {
    const saved = localStorage.getItem(HABITS_KEY)

    if (saved) {
      const parsed = JSON.parse(saved) as HabitItem[]
      if (parsed.length > 0) {
        return parsed
      }
    }

    return [
      { id: 'habit-1', name: 'news' },
      { id: 'habit-mood', name: 'mood' },
    ]
  })

  const [activeHabitId, setActiveHabitId] = useState<string>(() => {
    const saved = localStorage.getItem(HABIT_KEY)

    if (saved) {
      return saved
    }

    return 'habit-1'
  })

  const [habitStates, setHabitStates] = useState<Record<string, HabitState>>(() => {
    const saved = localStorage.getItem(SLIPS_KEY)
    const initialSlipDates = getLastSevenDays().map((date) => getLocalDateKey(date))
    const fallbackState: HabitState = {
      panicLevel: 0,
      slipDates: initialSlipDates,
      cleanDates: [],
      trackedDates: initialSlipDates,
      moodValues: {},
    }

    if (!saved) {
      return {
        'habit-1': fallbackState,
        'habit-mood': { panicLevel: 0, slipDates: [], cleanDates: [], trackedDates: [], moodValues: {} },
      }
    }

    try {
      const parsed = JSON.parse(saved) as Record<string, HabitState>
      if (parsed && parsed['habit-1']) {
        const normalized = Object.fromEntries(Object.entries(parsed).map(([id, state]) => {
          const cleanDates = state.cleanDates
            ?? (state.trackedDates ?? []).filter((date) => !(state.slipDates ?? []).includes(date))
          const trackedDates = [...new Set([...(state.trackedDates ?? []), ...(state.slipDates ?? []), ...cleanDates])]
          return [id, { ...state, cleanDates, trackedDates }]
        }))
        return {
          ...normalized,
          'habit-mood': {
            panicLevel: parsed['habit-mood']?.panicLevel ?? 0,
            slipDates: parsed['habit-mood']?.slipDates ?? [],
            cleanDates: parsed['habit-mood']?.cleanDates ?? (parsed['habit-mood']?.trackedDates ?? []).filter((date) => !(parsed['habit-mood']?.slipDates ?? []).includes(date)),
            trackedDates: [...new Set([...(parsed['habit-mood']?.trackedDates ?? []), ...(parsed['habit-mood']?.slipDates ?? []), ...(parsed['habit-mood']?.cleanDates ?? [])])],
            moodValues: parsed['habit-mood']?.moodValues ?? {},
          },
        }
      }
    } catch {
      // ignore invalid data and fall back below
    }

    return {
      'habit-1': fallbackState,
      'habit-mood': { panicLevel: 0, slipDates: [], cleanDates: [], trackedDates: [], moodValues: {} },
    }
  })
  const [backups, setBackups] = useState<DailyBackup[]>(loadBackups)
  const [firstUsedDate, setFirstUsedDate] = useState(() =>
    localStorage.getItem(FIRST_USED_KEY) ?? getLocalDateKey(new Date()),
  )

  const [bursts, setBursts] = useState<Array<{ id: number; x: number; emoji: string }>>([])
  const [floatingText, setFloatingText] = useState<Array<{ id: number; x: number; text: string; tone: 'dark' | 'positive' }>>([])
  const [draggedHabitId, setDraggedHabitId] = useState<string | null>(null)
  const [shareCopied, setShareCopied] = useState(false)
  const [deleteConfirming, setDeleteConfirming] = useState(false)
  const [deleteConfirmed, setDeleteConfirmed] = useState(false)
  const [reminderConfirming, setReminderConfirming] = useState(false)
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem(THEME_KEY)
    return saved ? saved === 'dark' : false
  })
  const [reminderEnabled, setReminderEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem(REMINDER_KEY)
    return saved ? saved === 'true' : false
  })
  const [reminderTime, setReminderTime] = useState<string>(() => {
    const saved = localStorage.getItem(REMINDER_TIME_KEY)
    return saved || '20:00'
  })
  const [reminderError, setReminderError] = useState<string>('')
  const [reminderHourMenuOpen, setReminderHourMenuOpen] = useState(false)
  const [lastReminderTrigger, setLastReminderTrigger] = useState<string | null>(() => {
    const saved = localStorage.getItem(REMINDER_LAST_TRIGGER_KEY)
    return saved || null
  })

  const draggedHabitRef = useRef<string | null>(null)
  const dragTargetRef = useRef<string | null>(null)
  const didDragTabRef = useRef(false)
  const clickWindowRef = useRef<number[]>([])
  const reminderHourSelectRef = useRef<HTMLDivElement | null>(null)
  const reminderHourOptions = Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, '0'))

  useEffect(() => {
    if (!reminderHourMenuOpen) {
      return
    }

    const handlePointerDown = (event: MouseEvent): void => {
      const target = event.target as Node | null
      if (!target || !reminderHourSelectRef.current || reminderHourSelectRef.current.contains(target)) {
        return
      }

      setReminderHourMenuOpen(false)
    }

    document.addEventListener('mousedown', handlePointerDown)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
    }
  }, [reminderHourMenuOpen])

  const recentDays = getLastSevenDays()
  const activeHabit = habits.find((habit) => habit.id === activeHabitId) ?? habits[0]
  const activeState = habitStates[activeHabitId] ?? { panicLevel: 0, slipDates: [], cleanDates: [], moodValues: {} }
  const panicLevel = activeState.panicLevel
  const slipDates = activeState.slipDates
  const cleanDates = activeState.cleanDates ?? (activeState.trackedDates ?? []).filter((date) => !slipDates.includes(date))
  const trackedDates = activeState.trackedDates ?? [...slipDates, ...cleanDates]
  const historyDays = getHabitHistoryDays(firstUsedDate)
  const trackedHabitDays = historyDays
    .map((date) => {
      const dateKey = getLocalDateKey(date)
      return { dateKey, date, tracked: trackedDates.includes(dateKey), slipped: !cleanDates.includes(dateKey) }
    })
  const isMoodTab = activeHabitId === 'habit-mood'
  const moodOptions = [
    { value: 1, emoji: '😞', label: 'Awful' },
    { value: 2, emoji: '😕', label: 'Low' },
    { value: 3, emoji: '🙂', label: 'Okay' },
    { value: 4, emoji: '😊', label: 'Good' },
    { value: 5, emoji: '😄', label: 'Great' },
  ]
  useEffect(() => {
    setHabits((current) => {
      const hasMoodTab = current.some((habit) => habit.id === 'habit-mood')
      if (hasMoodTab) {
        return current
      }

      return [...current, { id: 'habit-mood', name: 'mood' }]
    })

    setHabitStates((current) => {
      if (current['habit-mood']) {
        return current
      }

      return {
        ...current,
        'habit-mood': {
          panicLevel: 0,
          slipDates: [],
          cleanDates: [],
        },
      }
    })
  }, [])

  useEffect(() => {
    localStorage.setItem(HABITS_KEY, JSON.stringify(habits))
  }, [habits])

  useEffect(() => {
    localStorage.setItem(HABIT_KEY, activeHabitId)
  }, [activeHabitId])

  useEffect(() => {
    localStorage.setItem(FIRST_USED_KEY, firstUsedDate)
  }, [firstUsedDate])

  useEffect(() => {
    localStorage.setItem(THEME_KEY, darkMode ? 'dark' : 'light')
  }, [darkMode])

  useEffect(() => {
    localStorage.setItem(REMINDER_KEY, String(reminderEnabled))
  }, [reminderEnabled])

  useEffect(() => {
    localStorage.setItem(REMINDER_TIME_KEY, reminderTime)
  }, [reminderTime])

  useEffect(() => {
    localStorage.setItem(REMINDER_LAST_TRIGGER_KEY, lastReminderTrigger ?? '')
  }, [lastReminderTrigger])

  useEffect(() => {
    try {
      localStorage.setItem(BACKUPS_KEY, JSON.stringify(backups))
    } catch {
      // Keep the current in-memory backups if browser storage is unavailable.
    }
  }, [backups])

  useEffect(() => {
    const createDailyBackup = (): void => {
      if (!navigator.onLine) return

      const date = getLocalDateKey(new Date())
      if (backups.some((backup) => backup.date === date)) return

      const backup: DailyBackup = {
        id: `${date}-${Date.now()}`,
        date,
        createdAt: new Date().toISOString(),
        activeHabitId,
        firstUsedDate,
        habits,
        habitStates,
      }

      setBackups((current) => {
        if (current.some((item) => item.date === date)) return current
        return [backup, ...current].slice(0, MAX_BACKUPS)
      })
    }

    const checkOnVisibility = (): void => {
      if (document.visibilityState === 'visible') createDailyBackup()
    }

    createDailyBackup()
    const intervalId = window.setInterval(createDailyBackup, 60_000)
    window.addEventListener('online', createDailyBackup)
    document.addEventListener('visibilitychange', checkOnVisibility)

    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener('online', createDailyBackup)
      document.removeEventListener('visibilitychange', checkOnVisibility)
    }
  }, [activeHabitId, backups, firstUsedDate, habitStates, habits])

  useEffect(() => {
    if (!reminderEnabled || !('Notification' in window)) {
      return
    }

    const currentHour = Number.parseInt(reminderTime.split(':')[0], 10)
    if (Number.isNaN(currentHour)) {
      return
    }

    const checkReminder = (): void => {
      if (Notification.permission !== 'granted' || !reminderEnabled) {
        return
      }

      const now = new Date()
      const todayKey = formatKey(now)
      const isSameHour = now.getHours() === currentHour
      const isSameDay = lastReminderTrigger === todayKey

      if (!isSameHour || isSameDay || now.getMinutes() > 1) {
        return
      }

      const reminderLabel = activeHabit?.name?.trim() || 'your habit'
      new Notification('Reminder', {
        body: `Time to check in on ${reminderLabel}.`,
      })

      setLastReminderTrigger(todayKey)
    }

    checkReminder()
    const intervalId = window.setInterval(checkReminder, 30_000)

    return () => window.clearInterval(intervalId)
  }, [activeHabit, lastReminderTrigger, reminderEnabled, reminderTime])

  useEffect(() => {
    const state = { ...habitStates, [activeHabitId]: { ...activeState, slipDates } }
    localStorage.setItem(SLIPS_KEY, JSON.stringify(state))
  }, [activeHabitId, habitStates, slipDates, activeState])

  useEffect(() => {
    if (panicLevel <= 0) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      clickWindowRef.current = []
      setHabitStates((current) => ({
        ...current,
        [activeHabitId]: {
          ...(current[activeHabitId] ?? { panicLevel: 0, slipDates: [] }),
          panicLevel: 0,
        },
      }))
    }, 3500)

    return () => window.clearTimeout(timeoutId)
  }, [activeHabitId, panicLevel])

  const cycleDayStatus = (date: Date): void => {
    const key = formatKey(date)

    setHabitStates((current) => {
      const existing = current[activeHabitId] ?? { panicLevel: 0, slipDates: [], cleanDates: [] }
      const currentClean = existing.cleanDates
        ?? (existing.trackedDates ?? []).filter((item) => !existing.slipDates.includes(item))
      const currentTracked = existing.trackedDates
        ?? [...existing.slipDates, ...currentClean]
      const nextClean = currentClean.includes(key)
        ? currentClean.filter((item) => item !== key)
        : [...currentClean, key]

      return {
        ...current,
        [activeHabitId]: {
          ...existing,
          trackedDates: [...new Set([...currentTracked, key])],
          cleanDates: nextClean,
        },
      }
    })
  }

  const mergeSyncData = (incoming: SyncPayload): void => {
    if (incoming.firstUsedDate && incoming.firstUsedDate < firstUsedDate) {
      setFirstUsedDate(incoming.firstUsedDate)
    }

    setHabits((current) => {
      const merged = new Map(current.map((habit) => [habit.id, habit]))
      incoming.habits.forEach((habit) => merged.set(habit.id, habit))
      return [...merged.values()]
    })

    setHabitStates((current) => {
      const merged = { ...current }
      Object.entries(incoming.habitStates).forEach(([id, remote]) => {
        const local = merged[id] ?? { panicLevel: 0, slipDates: [], cleanDates: [], moodValues: {} }
        const localClean = local.cleanDates
          ?? (local.trackedDates ?? []).filter((date) => !local.slipDates.includes(date))
        const remoteClean = remote.cleanDates
          ?? (remote.trackedDates ?? []).filter((date) => !remote.slipDates.includes(date))
        const localTracked = local.trackedDates ?? [...local.slipDates, ...localClean]
        const remoteTracked = remote.trackedDates ?? [...remote.slipDates, ...remoteClean]
        const combinedSlips = [...new Set([...local.slipDates, ...remote.slipDates])].sort()
        merged[id] = {
          panicLevel: local.panicLevel,
          slipDates: combinedSlips,
          cleanDates: [...new Set([...localClean, ...remoteClean])].sort(),
          trackedDates: [...new Set([...localTracked, ...remoteTracked, ...combinedSlips])].sort(),
          moodValues: { ...(local.moodValues ?? {}), ...(remote.moodValues ?? {}) },
        }
      })
      return merged
    })
  }

  const restoreBackup = (backup: DailyBackup): void => {
    setHabits(backup.habits)
    setHabitStates(Object.fromEntries(Object.entries(backup.habitStates).map(([id, state]) => [id, {
      ...state,
      cleanDates: state.cleanDates ?? (state.trackedDates ?? []).filter((date) => !state.slipDates.includes(date)),
      trackedDates: state.trackedDates ?? [
        ...state.slipDates,
        ...(state.cleanDates ?? (state.trackedDates ?? []).filter((date) => !state.slipDates.includes(date))),
      ],
    }])))
    setActiveHabitId(backup.activeHabitId)
    if (backup.firstUsedDate) setFirstUsedDate(backup.firstUsedDate)
  }

  const isSlipDay = (date: Date): boolean => {
    return !cleanDates.includes(formatKey(date))
  }

  const setMoodValue = (moodValue: number): void => {
    const todayKey = formatKey(new Date())

    setHabitStates((current) => ({
      ...current,
      'habit-mood': {
        ...(current['habit-mood'] ?? { panicLevel: 0, slipDates: [], moodValues: {} }),
        moodValues: {
          ...(current['habit-mood']?.moodValues ?? {}),
          [todayKey]: moodValue,
        },
      },
    }))
  }

  const triggerPanic = (): void => {
    const now = Date.now()
    const oneMinuteAgo = now - 60_000

    clickWindowRef.current = clickWindowRef.current.filter((time) => time > oneMinuteAgo)
    clickWindowRef.current.push(now)

    const recentClicks = clickWindowRef.current.length
    const limitedLevel = Math.min(recentClicks, 60)

    setHabitStates((current) => ({
      ...current,
      [activeHabitId]: {
        ...(current[activeHabitId] ?? { panicLevel: 0, slipDates: [] }),
        panicLevel: limitedLevel,
      },
    }))

    const darkPool = ['💥', '😵', '🤢', '🩸', '🔥', '☠️', '💣', '🧨', '⚰️', '🕳️', '🧟', '🫨', '💀', '☠', '🩹', '🫠']
    const neutralPool = ['😬', '😶', '😵‍💫', '🫠', '😧', '😮', '😵', '🤕']
    const warmPool = ['✨', '💪', '😌', '🥳', '🔥', '✅', '🌿', '💚', '😄', '🎉', '👏', '🙂', '🌞', '💫']

    let chosenPool = darkPool
    if (limitedLevel >= 18 && limitedLevel < 38) {
      chosenPool = neutralPool
    } else if (limitedLevel >= 38) {
      chosenPool = warmPool
    }

    const burst = {
      id: Date.now() + Math.random(),
      x: 8 + Math.random() * 84,
      emoji: chosenPool[Math.floor(Math.random() * chosenPool.length)],
    }

    const darkWords = ['broken', 'shaken', 'numb', 'lost', 'drained', 'sick', 'falling', 'rough']
    const neutralWords = ['wobbly', 'unclear', 'tiring', 'strained', 'messy', 'shaky', 'uneasy', 'fragile']
    const positiveWords = ['steady', 'calm', 'strong', 'healing', 'clear', 'grounded', 'winning', 'clean']

    let text = darkWords[Math.floor(Math.random() * darkWords.length)]
    let tone: 'dark' | 'positive' = 'dark'

    if (limitedLevel < 14) {
      text = darkWords[Math.floor(Math.random() * darkWords.length)]
      tone = 'dark'
    } else if (limitedLevel < 28) {
      if (Math.random() < 0.35) {
        text = positiveWords[Math.floor(Math.random() * positiveWords.length)]
        tone = 'positive'
      } else {
        text = neutralWords[Math.floor(Math.random() * neutralWords.length)]
        tone = 'dark'
      }
    } else if (limitedLevel < 44) {
      if (Math.random() < 0.7) {
        text = positiveWords[Math.floor(Math.random() * positiveWords.length)]
        tone = 'positive'
      } else {
        text = neutralWords[Math.floor(Math.random() * neutralWords.length)]
        tone = 'dark'
      }
    } else {
      text = positiveWords[Math.floor(Math.random() * positiveWords.length)]
      tone = 'positive'
    }

    const floatingMessage = {
      id: Date.now() + Math.random() + 1,
      x: 18 + Math.random() * 64,
      text,
      tone,
    }

    setBursts((current) => [...current, burst])
    setFloatingText((current) => [...current, floatingMessage])

    window.setTimeout(() => {
      setBursts((current) => current.filter((item) => item.id !== burst.id))
      setFloatingText((current) => current.filter((item) => item.id !== floatingMessage.id))
    }, 900)
  }

  const panicStage =
    panicLevel < 12 ? 0 :
    panicLevel < 22 ? 1 :
    panicLevel < 32 ? 2 :
    panicLevel < 42 ? 3 :
    panicLevel < 52 ? 4 :
    5

  const moodState = habitStates['habit-mood'] ?? { panicLevel: 0, slipDates: [], moodValues: {} }
  const todayMood = moodState.moodValues?.[formatKey(new Date())] ?? null
  const moodHistoryDays = historyDays.map((date) => {
    const dateKey = getLocalDateKey(date)
    return { dateKey, date, value: moodState.moodValues?.[dateKey] ?? null }
  })

  const reorderHabits = (sourceId: string, targetId: string): void => {
    if (sourceId === targetId) {
      return
    }

    setHabits((current) => {
      const sourceIndex = current.findIndex((habit) => habit.id === sourceId)
      const targetIndex = current.findIndex((habit) => habit.id === targetId)

      if (sourceIndex === -1 || targetIndex === -1) {
        return current
      }

      const next = [...current]
      const [moved] = next.splice(sourceIndex, 1)
      next.splice(targetIndex, 0, moved)
      return next
    })
  }

  const handleTabPointerDown = (habitId: string, event: React.PointerEvent<HTMLButtonElement>): void => {
    if (event.pointerType === 'mouse' && event.button !== 0) {
      return
    }

    event.preventDefault()
    draggedHabitRef.current = habitId
    dragTargetRef.current = null
    didDragTabRef.current = false
    setDraggedHabitId(habitId)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handleTabPointerMove = (event: React.PointerEvent<HTMLButtonElement>): void => {
    const sourceId = draggedHabitRef.current
    if (!sourceId) {
      return
    }

    const target = document.elementFromPoint(event.clientX, event.clientY) as HTMLElement | null
    const nextHabit = target?.closest('[data-habit-id]') as HTMLElement | null
    const targetId = nextHabit?.dataset.habitId

    if (targetId && targetId !== sourceId && targetId !== dragTargetRef.current) {
      didDragTabRef.current = true
      reorderHabits(sourceId, targetId)
      dragTargetRef.current = targetId
    }
  }

  const handleTabPointerUp = (): void => {
    draggedHabitRef.current = null
    dragTargetRef.current = null
    setDraggedHabitId(null)
  }

  const resetDeleteConfirmation = (): void => {
    setDeleteConfirming(false)
  }

  const resetReminderConfirmation = (): void => {
    setReminderConfirming(false)
  }

  const handleDeleteHabit = (): void => {
    if (habits.length <= 1) {
      return
    }

    if (!deleteConfirming) {
      setDeleteConfirming(true)
      return
    }

    const currentIndex = habits.findIndex((habit) => habit.id === activeHabitId)
    const remainingHabits = habits.filter((habit) => habit.id !== activeHabitId)
    const nextActiveHabit = remainingHabits[Math.max(0, currentIndex - 1)] ?? remainingHabits[0]

    setHabits(remainingHabits)
    setActiveHabitId(nextActiveHabit.id)
    setHabitStates((current) => {
      const nextState = { ...current }
      delete nextState[activeHabitId]
      return nextState
    })
    setDeleteConfirming(false)
    setDeleteConfirmed(true)
    window.setTimeout(() => setDeleteConfirmed(false), 900)
  }

  const handleShareHabit = async (): Promise<void> => {
    const habitName = activeHabit?.name?.trim() || 'this habit'
    const slipCount = recentDays.filter((date) => !cleanDates.includes(formatKey(date))).length
    const statusLine = panicLevel >= 40
      ? `${habitName} is feeling strong — I’m on a good streak.`
      : panicLevel >= 20
        ? `${habitName} is shaky right now, but I’m still trying.`
        : `${habitName} is rough right now and I need a reset.`

    const shareText = `${habitName}: ${statusLine} Slip count in the last 7 days: ${slipCount}.`
    const userAgent = navigator.userAgent || ''
    const isDesktopWindows = /Windows/i.test(userAgent) && !/Mobile|Android|iPhone|iPad/i.test(userAgent)

    try {
      if (navigator.share && !isDesktopWindows) {
        await navigator.share({
          title: 'Slip tracker',
          text: shareText,
        })
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(shareText)
      }

      setShareCopied(true)
      window.setTimeout(() => setShareCopied(false), 1200)
    } catch {
      try {
        if (navigator.clipboard) {
          await navigator.clipboard.writeText(shareText)
          setShareCopied(true)
          window.setTimeout(() => setShareCopied(false), 1200)
        }
      } catch {
        // ignore clipboard failures in unsupported browsers
      }
    }
  }

  const handleReminderToggle = async (): Promise<void> => {
    if (!('Notification' in window)) {
      setReminderError('Notifications are not available in this browser.')
      setReminderEnabled(false)
      setReminderConfirming(false)
      return
    }

    if (!reminderEnabled) {
      if (Notification.permission === 'default') {
        if (!reminderConfirming) {
          setReminderConfirming(true)
          return
        }

        const permission = await Notification.requestPermission()
        if (permission !== 'granted') {
          setReminderError('Notification permission was denied. Reminder was not enabled.')
          setReminderEnabled(false)
          setReminderConfirming(false)
          return
        }

        setReminderError('')
        setReminderConfirming(false)
        setReminderEnabled(true)
        setReminderHourMenuOpen(false)
        return
      }

      if (Notification.permission === 'denied') {
        setReminderError('Notification permission was denied. Reminder was not enabled.')
        setReminderEnabled(false)
        setReminderConfirming(false)
        return
      }
    }

    setReminderError('')
    setReminderConfirming(false)
    setReminderEnabled((current) => !current)
    setReminderHourMenuOpen(false)
  }

  const handleHourSelect = async (hour: string): Promise<void> => {
    const hourOnlyValue = `${hour}:00`
    setReminderTime(hourOnlyValue)
    setReminderHourMenuOpen(false)

    if (!('Notification' in window)) {
      setReminderEnabled(false)
      return
    }

    const permission = await Notification.requestPermission()
    if (permission !== 'granted') {
      setReminderEnabled(false)
      return
    }

    setReminderEnabled(true)
  }

  return (
    <main className={`app-shell ${darkMode ? 'dark' : ''}`} aria-label="Habit tracker">
      <div className="emoji-overlay" aria-hidden="true">
        {bursts.map((burst) => (
          <span
            key={burst.id}
            className="emoji-burst"
            style={{ left: `${burst.x}%` }}
          >
            {burst.emoji}
          </span>
        ))}

        {floatingText.map((message) => (
          <span
            key={message.id}
            className={`floating-text ${message.tone}`}
            style={{ left: `${message.x}%` }}
          >
            {message.text}
          </span>
        ))}
      </div>

      <section className="tracker-card">
        <div className="mood-panel compact top-mood-panel">
          <div className="mood-scale" aria-label="Mood selection">
            {moodOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`mood-button ${todayMood === option.value ? 'selected' : ''}`}
                onClick={() => setMoodValue(option.value)}
                aria-label={`Mood ${option.label}`}
                title={option.label}
              >
                <span className="mood-emoji">{option.emoji}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="tab-bar" aria-label="Habit tabs">
          {habits.map((habit) => (
            <button
              key={habit.id}
              type="button"
              data-habit-id={habit.id}
              className={`tab-button ${habit.id === activeHabitId ? 'active' : ''} ${draggedHabitId === habit.id ? 'dragging' : ''}`}
              onPointerDown={(event) => handleTabPointerDown(habit.id, event)}
              onPointerMove={handleTabPointerMove}
              onPointerUp={handleTabPointerUp}
              onPointerCancel={handleTabPointerUp}
              onLostPointerCapture={handleTabPointerUp}
              onClick={() => {
                if (didDragTabRef.current) {
                  didDragTabRef.current = false
                  return
                }

                setActiveHabitId(habit.id)
              }}
            >
              {habit.name}
            </button>
          ))}

          <button
            type="button"
            className="tab-button add-button"
            onClick={() => {
              const newHabit = {
                id: `habit-${Date.now()}`,
                name: '',
              }
              setHabits((current) => [...current, newHabit])
              setActiveHabitId(newHabit.id)
              setHabitStates((current) => ({
                ...current,
                [newHabit.id]: {
                  panicLevel: 0,
                  slipDates: [],
                  cleanDates: [],
                  moodValues: {},
                },
              }))
            }}
          >
            + add
          </button>

          <button
            type="button"
            className="tab-button reminder-toggle"
            onClick={handleReminderToggle}
            onBlur={resetReminderConfirmation}
            aria-label={reminderEnabled ? 'Hide reminder time' : 'Show reminder time'}
            title={reminderEnabled ? 'Hide reminder time' : 'Show reminder time'}
          >
            {reminderConfirming ? 'track' : reminderEnabled ? '🔔' : '🔕'}
          </button>

          <BackupDialog backups={backups} onRestore={restoreBackup} />

          <SyncDialog habits={habits} habitStates={habitStates} firstUsedDate={firstUsedDate} onMerge={mergeSyncData} />

          {reminderEnabled && (
            <div
              className="reminder-hour-control"
              aria-label="Alarm time"
              ref={reminderHourSelectRef}
            >
              <button
                type="button"
                className="reminder-hour-trigger"
                onClick={() => setReminderHourMenuOpen((current) => !current)}
                aria-expanded={reminderHourMenuOpen}
                aria-label="Open alarm time"
                title="Open alarm time"
              >
                <span className="reminder-label" aria-hidden="true">⏰</span>
                <span>{reminderTime.slice(0, 2)}</span>
              </button>

              {reminderHourMenuOpen && (
                <div className="reminder-hour-menu" role="menu" aria-label="Alarm hour menu">
                  {reminderHourOptions.map((hour) => (
                    <button
                      key={hour}
                      type="button"
                      className="reminder-hour-option"
                      onClick={() => void handleHourSelect(hour)}
                      role="menuitem"
                    >
                      {hour}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {reminderError && <div className="reminder-error">{reminderError}</div>}

          <button
            type="button"
            className="tab-button theme-toggle"
            onClick={() => setDarkMode((current) => !current)}
            aria-label="Toggle dark mode"
            title="Toggle dark mode"
          >
            {darkMode ? '☀' : '☾'}
          </button>
        </div>

        {isMoodTab ? (
          <div className="mood-panel">
            <div className="mood-header">
              <h1></h1>
            </div>

            <div className="heatmap-wrap mood-heatmap" aria-label="Mood history heatmap">
              <div className="heatmap-labels">
                <span>First used {new Date(`${firstUsedDate}T12:00:00`).toLocaleDateString()}</span>
              </div>
              <div className="heatmap-grid">
                {moodHistoryDays.map(({ dateKey, date, value }) => {
                  const moodLabel = value ? moodOptions.find((option) => option.value === value)?.label : null
                  const dateLabel = date.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })
                  const title = `${dateLabel} — ${moodLabel ?? 'no mood recorded'}`

                  return (
                    <span
                      key={dateKey}
                      className={`heat-cell ${value ? `mood-${value}` : 'mood-empty'}`}
                      role="img"
                      aria-label={title}
                      title={title}
                    />
                  )
                })}
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="habit-header">
              <h1>
                No{' '}
                <input
                  className="habit-input"
                  aria-label="Habit field"
                  value={activeHabit?.name ?? ''}
                  onChange={(event) => {
                    const nextValue = event.target.value || 'habit'
                    setHabits((current) => current.map((habit) =>
                      habit.id === activeHabitId ? { ...habit, name: nextValue } : habit,
                    ))
                  }}
                />
              </h1>

              <div className="share-group">
                <button
                  type="button"
                  className="share-button"
                  onClick={handleShareHabit}
                  aria-label="Copy habit status to clipboard"
                  title="Copy habit status"
                >
                  ↗
                </button>
                {shareCopied && <span className="share-confirmation">copied to clipboard</span>}
              </div>

              <div className="delete-group">
                <button
                  type="button"
                  className={`delete-habit-button ${deleteConfirming ? 'confirming' : ''}`}
                  onClick={handleDeleteHabit}
                  onBlur={resetDeleteConfirmation}
                  disabled={habits.length <= 1}
                  aria-label="Delete current habit"
                >
                  {deleteConfirming ? <>🗑 sure?</> : '🗑'}
                </button>
                {deleteConfirmed && <span className="delete-confirmation">deleted</span>}
              </div>
            </div>

            <button type="button" className={`panic-button panic-${panicStage}`} onClick={triggerPanic}>
              Panic button
            </button>

            <div className="week-view" aria-label="Last 7 days calendar">
              <div className="week-grid">
                {recentDays.map((date) => {
                  const slipped = isSlipDay(date)
                  const dateLabel = date.toLocaleDateString(undefined, {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                  })

                  return (
                    <button
                      key={formatKey(date)}
                      type="button"
                      className={`week-day ${slipped ? 'slipped' : 'tracked-clean'}`}
                      onClick={() => cycleDayStatus(date)}
                      aria-label={`${dateLabel} ${slipped ? 'slipped, click to mark clean' : 'clean, click to mark slipped'}`}
                      title={`${dateLabel}: ${slipped ? 'slipped · click to mark clean' : 'clean · click to mark slipped'}`}
                    >
                      <span className="day-name">{date.toLocaleDateString(undefined, { weekday: 'short' })}</span>
                      <span className="day-number">{date.getDate()}</span>
                      <span className="day-status">{slipped ? 'slipped' : 'clean'}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="heatmap-wrap" aria-label="Recent activity heatmap">
              <div className="heatmap-labels">
                <span>First used {new Date(`${firstUsedDate}T12:00:00`).toLocaleDateString()}</span>
              </div>
              <div className="heatmap-grid">
                {trackedHabitDays.map(({ dateKey, date, tracked, slipped }) => {
                  const status = tracked ? (slipped ? 'slipped' : 'clean') : 'empty'
                  const label = tracked ? (slipped ? 'slipped' : 'clean') : 'not tracked'
                  const hoverText = `${date.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })} — ${label}`

                  return (
                    <span
                      key={dateKey}
                      className={`heat-cell habit-heat-cell ${status === 'empty' ? 'mood-empty' : status}`}
                      role="img"
                      aria-label={hoverText}
                      title={hoverText}
                    />
                  )
                })}
              </div>
            </div>
          </>
        )}
      </section>
    </main>
  )
}

export default App
