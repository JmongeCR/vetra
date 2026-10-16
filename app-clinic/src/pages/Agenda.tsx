import { useState } from 'react'
import styles from './Agenda.module.css'

type AgendaView = 'day' | 'week' | 'month'

const TODAY = new Date()
const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

function getWeekDays(base: Date): Date[] {
  const start = new Date(base)
  start.setDate(base.getDate() - base.getDay())
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return d
  })
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

export default function Agenda() {
  const [view, setView] = useState<AgendaView>('week')
  const [current, setCurrent] = useState(new Date(TODAY))

  const weekDays = getWeekDays(current)

  function prevPeriod() {
    const d = new Date(current)
    if (view === 'day') d.setDate(d.getDate() - 1)
    else if (view === 'week') d.setDate(d.getDate() - 7)
    else d.setMonth(d.getMonth() - 1)
    setCurrent(d)
  }

  function nextPeriod() {
    const d = new Date(current)
    if (view === 'day') d.setDate(d.getDate() + 1)
    else if (view === 'week') d.setDate(d.getDate() + 7)
    else d.setMonth(d.getMonth() + 1)
    setCurrent(d)
  }

  function periodLabel() {
    if (view === 'day') {
      return current.toLocaleDateString('es-CR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    }
    if (view === 'week') {
      const start = weekDays[0]
      const end = weekDays[6]
      if (start.getMonth() === end.getMonth()) {
        return `${start.getDate()} – ${end.getDate()} de ${MONTHS[start.getMonth()]} ${start.getFullYear()}`
      }
      return `${start.getDate()} ${MONTHS[start.getMonth()]} – ${end.getDate()} ${MONTHS[end.getMonth()]} ${end.getFullYear()}`
    }
    return `${MONTHS[current.getMonth()]} ${current.getFullYear()}`
  }

  const HOURS = Array.from({ length: 11 }, (_, i) => i + 7) // 7am – 5pm

  return (
    <div className={styles.page}>
      {/* ── Toolbar ── */}
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <div className={styles.viewTabs}>
            {(['day','week','month'] as AgendaView[]).map(v => (
              <button
                key={v}
                className={`${styles.viewTab} ${view === v ? styles.viewTabActive : ''}`}
                onClick={() => setView(v)}
              >
                {v === 'day' ? 'Día' : v === 'week' ? 'Semana' : 'Mes'}
              </button>
            ))}
          </div>
          <div className={styles.periodNav}>
            <button className={styles.navBtn} onClick={prevPeriod}>‹</button>
            <span className={styles.periodLabel}>{periodLabel()}</span>
            <button className={styles.navBtn} onClick={nextPeriod}>›</button>
          </div>
          <button className={styles.btnToday} onClick={() => setCurrent(new Date(TODAY))}>Hoy</button>
        </div>
        <button className={styles.btnPrimary} disabled>+ Nueva cita</button>
      </div>

      {/* ── Week view ── */}
      {view === 'week' && (
        <div className={styles.weekGrid}>
          <div className={styles.timeCol}>
            <div className={styles.timeColHeader} />
            {HOURS.map(h => (
              <div key={h} className={styles.timeSlot}>
                {h}:00
              </div>
            ))}
          </div>
          {weekDays.map((day, di) => (
            <div key={di} className={`${styles.dayCol} ${sameDay(day, TODAY) ? styles.dayColToday : ''}`}>
              <div className={styles.dayHeader}>
                <span className={styles.dayName}>{DAYS[day.getDay()]}</span>
                <span className={`${styles.dayNum} ${sameDay(day, TODAY) ? styles.dayNumToday : ''}`}>
                  {day.getDate()}
                </span>
              </div>
              {HOURS.map(h => (
                <div key={h} className={styles.hourCell} />
              ))}
            </div>
          ))}
        </div>
      )}

      {/* ── Day view ── */}
      {view === 'day' && (
        <div className={styles.dayView}>
          <div className={styles.timeCol}>
            <div className={styles.timeColHeader} />
            {HOURS.map(h => (
              <div key={h} className={styles.timeSlot}>{h}:00</div>
            ))}
          </div>
          <div className={`${styles.dayCol} ${styles.dayColFull} ${sameDay(current, TODAY) ? styles.dayColToday : ''}`}>
            <div className={styles.dayHeader}>
              <span className={styles.dayName}>{DAYS[current.getDay()]}</span>
              <span className={`${styles.dayNum} ${sameDay(current, TODAY) ? styles.dayNumToday : ''}`}>
                {current.getDate()}
              </span>
            </div>
            {HOURS.map(h => (
              <div key={h} className={styles.hourCell} />
            ))}
          </div>
        </div>
      )}

      {/* ── Month view ── */}
      {view === 'month' && (
        <div className={styles.monthGrid}>
          {DAYS.map(d => <div key={d} className={styles.monthDayName}>{d}</div>)}
          {(() => {
            const first = new Date(current.getFullYear(), current.getMonth(), 1)
            const last  = new Date(current.getFullYear(), current.getMonth() + 1, 0)
            const cells: React.ReactNode[] = []
            for (let i = 0; i < first.getDay(); i++) cells.push(<div key={`pre-${i}`} className={styles.monthCell} />)
            for (let d = 1; d <= last.getDate(); d++) {
              const date = new Date(current.getFullYear(), current.getMonth(), d)
              cells.push(
                <div key={d} className={`${styles.monthCell} ${styles.monthCellActive} ${sameDay(date, TODAY) ? styles.monthCellToday : ''}`}>
                  <span className={styles.monthDate}>{d}</span>
                </div>
              )
            }
            return cells
          })()}
        </div>
      )}

      {/* ── Empty state notice ── */}
      <div className={styles.emptyNotice}>
        <span className={styles.emptyIcon}>📅</span>
        <p>No hay citas programadas para este período.</p>
        <span className={styles.emptyTag}>El módulo de citas requiere backend — próxima fase</span>
      </div>
    </div>
  )
}
