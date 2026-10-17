import { useEffect, useRef, useState } from 'react'
import './App.css'

const HABIT_KEY = 'habit-tracker-habit'
const SLIPS_KEY = 'habit-tracker-slip-dates'

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
  const [habitWord, setHabitWord] = useState<string>(() => {
    return localStorage.getItem(HABIT_KEY) ?? 'news'
  })

  const [slipDates, setSlipDates] = useState<string[]>(() => {
    const saved = localStorage.getItem(SLIPS_KEY)

    if (saved) {
      return JSON.parse(saved)
    }

    return getLastSevenDays().map((date) => formatKey(date))
  })

  const [panicLevel, setPanicLevel] = useState<number>(() => {
    return 0
  })

  const [bursts, setBursts] = useState<Array<{ id: number; x: number; emoji: string }>>([])
  const clickWindowRef = useRef<number[]>([])

  const recentDays = getLastSevenDays()
  const heatmapDays = getRecentHeatmapDays()

  useEffect(() => {
    localStorage.setItem(HABIT_KEY, habitWord)
  }, [habitWord])

  useEffect(() => {
    localStorage.setItem(SLIPS_KEY, JSON.stringify(slipDates))
  }, [slipDates])

  const toggleSlip = (date: Date): void => {
    const key = formatKey(date)

    setSlipDates((current) => {
      if (current.includes(key)) {
        return current.filter((item) => item !== key)
      }

      return [...current, key]
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
    setPanicLevel(limitedLevel)

    const darkPool = ['💥', '😵', '🤢', '🩸', '🔥', '☠️', '💣', '🧨', '⚰️', '🕳️', '🧟', '🫨', '💀', '☠', '🩹', '🫠']
    const warmPool = ['✨', '💪', '😌', '🥳', '🔥', '✅', '🌿', '💚', '😄', '🎉', '👏', '🙂']
    const chosenPool = limitedLevel >= 45 ? warmPool : darkPool

    const burst = {
      id: Date.now() + Math.random(),
      x: 8 + Math.random() * 84,
      emoji: chosenPool[Math.floor(Math.random() * chosenPool.length)],
    }

    setBursts((current) => [...current, burst])

    window.setTimeout(() => {
      setBursts((current) => current.filter((item) => item.id !== burst.id))
    }, 900)
  }

  const panicStage =
    panicLevel < 10 ? 0 :
    panicLevel < 22 ? 1 :
    panicLevel < 35 ? 2 :
    panicLevel < 48 ? 3 :
    panicLevel < 58 ? 4 :
    5

  return (
    <main className="app-shell" aria-label="Habit tracker">
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
      </div>

      <section className="tracker-card">
        <h1>
          No{' '}
          <input
            className="habit-input"
            aria-label="Habit field"
            value={habitWord}
            onChange={(event) => setHabitWord(event.target.value)}
          />
        </h1>

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
              return (
                <button
                  key={formatKey(date)}
                  type="button"
                  className={`heat-cell ${slipped ? 'slipped' : 'clean'}`}
                  onClick={() => toggleSlip(date)}
                  aria-label={`${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} ${slipped ? 'slipped' : 'clean'}`}
                  title={`${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}: ${slipped ? 'slipped' : 'clean'}`}
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
