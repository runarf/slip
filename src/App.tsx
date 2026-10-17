import { useEffect, useRef, useState } from 'react'
import './App.css'

const HABIT_KEY = 'habit-tracker-habit'
const SLIPS_KEY = 'habit-tracker-slip-dates'
const HABITS_KEY = 'habit-tracker-habits'
const THEME_KEY = 'habit-tracker-theme'

interface HabitItem {
  id: string
  name: string
}

interface HabitState {
  panicLevel: number
  slipDates: string[]
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

function getRecentHeatmapDays(): Date[] {
  const days: Date[] = []
  const today = new Date()

  for (let i = 89; i >= 0; i -= 1) {
    const date = new Date(today)
    date.setDate(today.getDate() - i)
    days.push(date)
  }

  return days
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

    return [{ id: 'habit-1', name: 'news' }]
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
    const fallbackState: HabitState = {
      panicLevel: 0,
      slipDates: getLastSevenDays().map((date) => formatKey(date)),
    }

    if (!saved) {
      return { 'habit-1': fallbackState }
    }

    try {
      const parsed = JSON.parse(saved) as Record<string, HabitState>
      if (parsed && parsed['habit-1']) {
        return parsed
      }
    } catch {
      // ignore invalid data and fall back below
    }

    return { 'habit-1': fallbackState }
  })

  const [bursts, setBursts] = useState<Array<{ id: number; x: number; emoji: string }>>([])
  const [floatingText, setFloatingText] = useState<Array<{ id: number; x: number; text: string; tone: 'dark' | 'positive' }>>([])
  const [draggedHabitId, setDraggedHabitId] = useState<string | null>(null)
  const [shareCopied, setShareCopied] = useState(false)
  const [deleteConfirming, setDeleteConfirming] = useState(false)
  const [deleteConfirmed, setDeleteConfirmed] = useState(false)
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem(THEME_KEY)
    return saved ? saved === 'dark' : false
  })
  const draggedHabitRef = useRef<string | null>(null)
  const dragTargetRef = useRef<string | null>(null)
  const didDragTabRef = useRef(false)
  const clickWindowRef = useRef<number[]>([])

  const recentDays = getLastSevenDays()
  const heatmapDays = getRecentHeatmapDays()
  const activeHabit = habits.find((habit) => habit.id === activeHabitId) ?? habits[0]
  const activeState = habitStates[activeHabitId] ?? { panicLevel: 0, slipDates: getLastSevenDays().map((date) => formatKey(date)) }
  const panicLevel = activeState.panicLevel
  const slipDates = activeState.slipDates

  useEffect(() => {
    localStorage.setItem(HABITS_KEY, JSON.stringify(habits))
  }, [habits])

  useEffect(() => {
    localStorage.setItem(HABIT_KEY, activeHabitId)
  }, [activeHabitId])

  useEffect(() => {
    localStorage.setItem(THEME_KEY, darkMode ? 'dark' : 'light')
  }, [darkMode])

  useEffect(() => {
    const state = { ...habitStates, [activeHabitId]: { ...activeState, slipDates } }
    localStorage.setItem(SLIPS_KEY, JSON.stringify(state))
  }, [activeHabitId, habitStates, slipDates, activeState])

  const toggleSlip = (date: Date): void => {
    const key = formatKey(date)

    setHabitStates((current) => {
      const existing = current[activeHabitId] ?? { panicLevel: 0, slipDates: [] }
      const nextDates = existing.slipDates.includes(key)
        ? existing.slipDates.filter((item) => item !== key)
        : [...existing.slipDates, key]

      return {
        ...current,
        [activeHabitId]: {
          ...existing,
          slipDates: nextDates,
        },
      }
    })
  }

  const isSlipDay = (date: Date): boolean => {
    return slipDates.includes(formatKey(date))
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
    const slipCount = slipDates.filter((date) => date).length
    const statusLine = panicLevel >= 40
      ? `${habitName} is feeling strong — I’m on a good streak.`
      : panicLevel >= 20
        ? `${habitName} is shaky right now, but I’m still trying.`
        : `${habitName} is rough right now and I need a reset.`

    const shareText = `${habitName}: ${statusLine} Slip count in the last 7 days: ${slipCount}.`

    try {
      if (navigator.share) {
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
                  slipDates: getLastSevenDays().map((date) => formatKey(date)),
                },
              }))
            }}
          >
            + add
          </button>

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
                  className={`week-day ${slipped ? 'slipped' : ''}`}
                  onClick={() => toggleSlip(date)}
                  aria-label={`${dateLabel} ${slipped ? 'slipped' : 'no slip'}`}
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
            <span>Past 90 days</span>
          </div>
          <div className="heatmap-grid">
            {heatmapDays.map((date) => {
              const slipped = isSlipDay(date)
              const hoverText = `${date.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })} — ${slipped ? 'slipped' : 'clean'}`

              return (
                <button
                  key={formatKey(date)}
                  type="button"
                  className={`heat-cell ${slipped ? 'slipped' : 'clean'}`}
                  onClick={() => toggleSlip(date)}
                  aria-label={hoverText}
                  title={hoverText}
                />
              )
            })}
          </div>
        </div>
      </section>
    </main>
  )
}

export default App
