import { useEffect, useState } from 'react'
import './App.css'

const HABIT_KEY = 'habit-tracker-habit'
const SLIPS_KEY = 'habit-tracker-slip-dates'

function formatKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function getLastSevenDays(): Date[] {
  const days: Date[] = []
  const today = new Date()

  for (let i = 7; i >= 1; i -= 1) {
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
    return saved ? JSON.parse(saved) : []
  })

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

    setSlipDates((current) =>
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key],
    )
  }

  const isSlipDay = (date: Date): boolean => {
    return slipDates.includes(formatKey(date))
  }

  return (
    <main className="app-shell" aria-label="Habit tracker">
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
