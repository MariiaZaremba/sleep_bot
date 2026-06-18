'use client';

import { useState, useEffect } from 'react';

export default function MiniApp() {
  const [tab, setTab] = useState('home');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tooltipDay, setTooltipDay] = useState(null);

  useEffect(() => {
    // Отримуємо initData від Telegram
    const tg = window.Telegram?.WebApp;
    if (tg) {
      tg.ready();
      tg.expand();
    }

    // Надсилаємо таймзону на сервер при першому відкритті
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    // Завантажуємо дані
    const initData = tg?.initData || '';
    const searchParams = new URLSearchParams(window.location.search);
    const chatIdParam = searchParams.get('chatId') || '';
    fetch(`/api/mini-app/progress?initData=${encodeURIComponent(initData)}&timezone=${encodeURIComponent(timezone)}&chatId=${chatIdParam}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return (
    <div style={s.center}>
      <div style={s.spinner}></div>
      <p style={s.loadingText}>Завантаження...</p>
    </div>
  );

  if (!data || data.error) return (
    <div style={s.center}>
      <p style={s.errorText}>Помилка завантаження. Спробуй ще раз.</p>
    </div>
  );

  return (
    <div style={s.wrap}>
      <div style={s.content}>
        {tab === 'home' && <HomeTab data={data} setTab={setTab} tooltipDay={tooltipDay} setTooltipDay={setTooltipDay} />}
        {tab === 'stats' && <StatsTab data={data} />}
        {tab === 'plan' && <PlanTab data={data} />}
      </div>
      <nav style={s.nav}>
        <button style={tab === 'home' ? {...s.nb, ...s.nbActive} : s.nb} onClick={() => setTab('home')}>
          <span style={s.nbIcon}>🏠</span>
          <span style={s.nbLabel}>Головна</span>
        </button>
        <button style={tab === 'stats' ? {...s.nb, ...s.nbActive} : s.nb} onClick={() => setTab('stats')}>
          <span style={s.nbIcon}>📊</span>
          <span style={s.nbLabel}>Статистика</span>
        </button>
        <button style={tab === 'plan' ? {...s.nb, ...s.nbActive} : s.nb} onClick={() => setTab('plan')}>
          <span style={s.nbIcon}>📅</span>
          <span style={s.nbLabel}>Мій план</span>
        </button>
      </nav>
    </div>
  );
}

function HomeTab({ data, setTab, tooltipDay, setTooltipDay }) {
  const { user, logs, todayTask, dayNum } = data;
  const doneDays = logs.filter(l => l.task_done === 'TRUE').length;
  const avgSleep = logs.length
    ? (logs.reduce((a, l) => a + parseFloat(l.sleep_hours_actual || 0), 0) / logs.filter(l => l.sleep_hours_actual).length || 0).toFixed(1)
    : '—';
  const avgQuality = logs.length
    ? (logs.reduce((a, l) => a + parseFloat(l.sleep_quality || 0), 0) / logs.filter(l => l.sleep_quality).length || 0).toFixed(1)
    : '—';

  return (
    <>
      <div style={s.hero}>
        <div style={s.heroDay}>День {dayNum} з 14</div>
        <div style={s.heroTitle}>Привіт, {user.name}!</div>
        <div style={s.heroSub}>Ти на правильному шляху 💚</div>
        <div style={s.heroStats}>
          <div style={s.heroStat}>
            <div style={s.heroStatVal}>{doneDays}</div>
            <div style={s.heroStatLbl}>виконано</div>
          </div>
          <div style={s.heroStat}>
            <div style={s.heroStatVal}>{avgSleep}</div>
            <div style={s.heroStatLbl}>год сну</div>
          </div>
          <div style={s.heroStat}>
            <div style={s.heroStatVal}>{avgQuality}</div>
            <div style={s.heroStatLbl}>якість</div>
          </div>
        </div>
      </div>

      <div style={s.section}>
        <div style={s.sLabel}>14 днів</div>
        <div style={s.grid}>
          {Array.from({ length: 14 }, (_, i) => {
            const day = i + 1;
            const log = logs.find(l => parseInt(l.day_num) === day);
            const isDone = log?.task_done === 'TRUE';
            const isSkip = log?.task_done === 'FALSE';
            const isToday = day === parseInt(dayNum);
            let dotStyle = { ...s.dot };
            if (isDone) dotStyle = { ...dotStyle, ...s.dotDone };
            else if (isSkip) dotStyle = { ...dotStyle, ...s.dotSkip };
            else if (isToday) dotStyle = { ...dotStyle, ...s.dotToday };
            else dotStyle = { ...dotStyle, ...s.dotFuture };
            return (
              <div key={day} style={dotStyle} onClick={() => {
                if (isSkip && log.skip_reasons) {
                  setTooltipDay(tooltipDay === day ? null : day);
                }
              }}>
                {day}
              </div>
            );
          })}
        </div>
        {tooltipDay && (() => {
          const log = logs.find(l => parseInt(l.day_num) === tooltipDay);
          return log?.skip_reasons ? (
            <div style={s.tooltip}>Причина: {log.skip_reasons}</div>
          ) : null;
        })()}
        <div style={s.legend}>
          <div style={s.legItem}><div style={{...s.legDot, background:'#1a7f64'}}></div>виконала</div>
          <div style={s.legItem}><div style={{...s.legDot, background:'#f09595'}}></div>пропустила</div>
        </div>
      </div>

      {todayTask && (
        <div style={s.eveCard}>
          <div style={s.eveTitle}>🌙 Завдання на сьогоднішню ніч</div>
          <div style={s.eveText}>{todayTask.task_text}</div>
          <div style={s.eveTimes}>
            <div style={s.eveRow}><span style={s.eveTime}>{todayTask.evening_time_plan}</span><span style={s.eveStep}>Почати wind-down</span></div>
            <div style={s.eveRow}><span style={s.eveTime}>{user.bed_time}</span><span style={s.eveStep}>Лягти спати</span></div>
          </div>
        </div>
      )}
    </>
  );
}

function StatsTab({ data }) {
  const { logs } = data;
  const doneDays = logs.filter(l => l.task_done === 'TRUE').length;
  const skipDays = logs.filter(l => l.task_done === 'FALSE').length;

  const avgSleepLogs = logs.filter(l => l.sleep_hours_actual);
  const avgSleep = avgSleepLogs.length
    ? (avgSleepLogs.reduce((a, l) => a + parseFloat(l.sleep_hours_actual), 0) / avgSleepLogs.length).toFixed(1)
    : '—';

  const avgQualLogs = logs.filter(l => l.sleep_quality);
  const avgQuality = avgQualLogs.length
    ? (avgQualLogs.reduce((a, l) => a + parseFloat(l.sleep_quality), 0) / avgQualLogs.length).toFixed(1)
    : '—';

  // Серія підряд
  let streak = 0;
  for (let i = logs.length - 1; i >= 0; i--) {
    if (logs[i].task_done === 'TRUE') streak++;
    else break;
  }

  // Причини пропусків
  const reasonCounts = {};
  logs.filter(l => l.skip_reasons).forEach(l => {
    l.skip_reasons.split(',').forEach(r => {
      const reason = r.trim();
      if (reason) reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
    });
  });
  const maxReasonCount = Math.max(...Object.values(reasonCounts), 1);

  return (
    <>
      <div style={s.pageTitle}>Статистика</div>
      <div style={s.stat2}>
        <div style={s.statCard}><div style={s.statLbl}>Середній сон</div><div style={s.statVal}>{avgSleep} <span style={s.statUnit}>год</span></div></div>
        <div style={s.statCard}><div style={s.statLbl}>Серія підряд</div><div style={s.statVal}>{streak} <span style={s.statUnit}>ночі</span></div></div>
      </div>
      <div style={s.stat2}>
        <div style={s.statCard}><div style={s.statLbl}>Середня якість</div><div style={s.statVal}>{avgQuality} <span style={s.statUnit}>/ 5</span></div></div>
        <div style={s.statCard}><div style={s.statLbl}>Виконано</div><div style={s.statVal}>{doneDays} <span style={s.statUnit}>з {doneDays + skipDays}</span></div></div>
      </div>

      <div style={s.card}>
        <div style={s.sLabel}>Якість сну по ночах</div>
        <div style={s.barChart}>
          {Array.from({ length: 14 }, (_, i) => {
            const log = logs.find(l => parseInt(l.day_num) === i + 1);
            const val = log ? parseFloat(log.sleep_quality) : 0;
            return (
              <div key={i} style={s.barCol}>
                <div style={{ ...s.bar, height: val ? `${Math.round(val / 5 * 52)}px` : '3px', background: val ? '#1a7f64' : '#e0e0e0' }}></div>
                <div style={s.barLbl}>{i + 1}</div>
              </div>
            );
          })}
        </div>
      </div>

      {Object.keys(reasonCounts).length > 0 && (
        <div style={s.card}>
          <div style={s.sLabel}>Чому пропускала</div>
          <div style={s.reasonBars}>
            {Object.entries(reasonCounts).map(([reason, count]) => (
              <div key={reason} style={s.rbRow}>
                <div style={s.rbLbl}>{reason}</div>
                <div style={s.rbTrack}>
                  <div style={{ ...s.rbFill, width: `${Math.round(count / maxReasonCount * 100)}%` }}></div>
                </div>
                <div style={s.rbN}>{count}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function PlanTab({ data }) {
  const { user, dayNum } = data;
  const phases = [
    { days: '1–3', label: 'Стабільний підйом' },
    { days: '4–6', label: 'Wind-down ритуал' },
    { days: '7–9', label: 'Середовище сну' },
    { days: '10–12', label: 'Стрес і відновлення' },
    { days: '13–14', label: 'Підсумок і рефлексія' },
  ];

  const currentPhase = dayNum <= 3 ? 0 : dayNum <= 6 ? 1 : dayNum <= 9 ? 2 : dayNum <= 12 ? 3 : 4;

  return (
    <>
      <div style={s.pageTitle}>Мій план</div>
      <div style={s.card}>
        <div style={s.sLabel}>Розклад</div>
        {[
          { icon: '☀️', label: 'Підйом', val: user.wake_time },
          { icon: '🌙', label: 'Відбій', val: user.bed_time },
          { icon: '⏰', label: 'Ціль сну', val: `${user.sleep_hours} год` },
          { icon: '🔔', label: 'Завдання ввечері', val: user.evening_notify },
          { icon: '📋', label: 'Ранковий check-in', val: user.morning_notify },
        ].map(({ icon, label, val }) => (
          <div key={label} style={s.planRow}>
            <span style={s.planLbl}>{icon} {label}</span>
            <span style={s.planVal}>{val}</span>
          </div>
        ))}
      </div>

      <div>
        <div style={s.sLabel}>Фази програми</div>
        <div style={s.phases}>
          {phases.map((p, i) => (
            <div key={i} style={i === currentPhase ? {...s.phase, ...s.phaseCur} : s.phase}>
              <div style={i === currentPhase ? {...s.pNum, ...s.pNumCur} : s.pNum}>{p.days}</div>
              <div style={i === currentPhase ? {...s.pTxt, ...s.pTxtCur} : s.pTxt}>{p.label}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

const G = '#1a7f64';
const s = {
  wrap: { fontFamily: 'system-ui, sans-serif', display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#f5f5f5' },
  content: { flex: 1, padding: '14px', display: 'flex', flexDirection: 'column', gap: '12px', paddingBottom: '70px' },
  center: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' },
  spinner: { width: '32px', height: '32px', border: '3px solid #e0e0e0', borderTop: `3px solid ${G}`, borderRadius: '50%', animation: 'spin 1s linear infinite' },
  loadingText: { color: '#888', fontSize: '14px', marginTop: '12px' },
  errorText: { color: '#e24b4a', fontSize: '14px' },
  nav: { position: 'fixed', bottom: 0, left: 0, right: 0, display: 'flex', background: 'white', borderTop: '0.5px solid #e0e0e0' },
  nb: { flex: 1, padding: '9px 4px 7px', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' },
  nbActive: { color: G },
  nbIcon: { fontSize: '19px' },
  nbLabel: { fontSize: '10px', color: '#888' },
  hero: { background: G, borderRadius: '12px', padding: '16px', color: 'white' },
  heroDay: { fontSize: '11px', opacity: .8, marginBottom: '4px' },
  heroTitle: { fontSize: '18px', fontWeight: 500 },
  heroSub: { fontSize: '12px', opacity: .8, marginTop: '2px' },
  heroStats: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginTop: '14px' },
  heroStat: { background: 'rgba(255,255,255,.15)', borderRadius: '8px', padding: '8px', textAlign: 'center' },
  heroStatVal: { fontSize: '18px', fontWeight: 500 },
  heroStatLbl: { fontSize: '10px', opacity: .75, marginTop: '2px' },
  section: { background: 'white', borderRadius: '12px', padding: '12px' },
  sLabel: { fontSize: '11px', color: '#888', letterSpacing: '.3px', fontWeight: 500, marginBottom: '8px' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '5px' },
  dot: { aspectRatio: '1', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 500, cursor: 'default' },
  dotDone: { background: G, color: 'white' },
  dotSkip: { background: '#fcebeb', color: '#a32d2d', cursor: 'pointer' },
  dotToday: { background: '#e1f5ee', color: '#085041', border: `1.5px solid ${G}` },
  dotFuture: { background: '#f0f0f0', color: '#aaa' },
  tooltip: { background: 'white', border: '0.5px solid #ddd', borderRadius: '8px', padding: '8px 10px', fontSize: '12px', color: '#333', marginTop: '6px' },
  legend: { display: 'flex', gap: '12px', marginTop: '8px' },
  legItem: { display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#888' },
  legDot: { width: '9px', height: '9px', borderRadius: '50%' },
  eveCard: { background: '#fef9f0', border: '0.5px solid #fac775', borderRadius: '12px', padding: '12px' },
  eveTitle: { fontSize: '13px', fontWeight: 500, color: '#633806', marginBottom: '6px' },
  eveText: { fontSize: '13px', color: '#854f0b', lineHeight: 1.5 },
  eveTimes: { display: 'flex', flexDirection: 'column', gap: '5px', marginTop: '10px' },
  eveRow: { display: 'flex', alignItems: 'center', gap: '8px' },
  eveTime: { fontSize: '11px', color: '#854f0b', width: '38px', flexShrink: 0 },
  eveStep: { fontSize: '13px', color: '#633806' },
  pageTitle: { fontSize: '17px', fontWeight: 500, color: '#222', marginBottom: '4px' },
  stat2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' },
  statCard: { background: 'white', borderRadius: '8px', padding: '10px' },
  statLbl: { fontSize: '11px', color: '#888' },
  statVal: { fontSize: '20px', fontWeight: 500, color: '#222', marginTop: '3px' },
  statUnit: { fontSize: '11px', color: '#888' },
  card: { background: 'white', borderRadius: '12px', padding: '12px' },
  barChart: { display: 'flex', alignItems: 'flex-end', gap: '3px', height: '60px', marginTop: '8px' },
  barCol: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' },
  bar: { width: '100%', borderRadius: '2px 2px 0 0', minHeight: '3px' },
  barLbl: { fontSize: '9px', color: '#aaa' },
  reasonBars: { display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' },
  rbRow: { display: 'flex', alignItems: 'center', gap: '8px' },
  rbLbl: { fontSize: '12px', color: '#333', width: '110px', flexShrink: 0, lineHeight: 1.3 },
  rbTrack: { flex: 1, background: '#e0e0e0', borderRadius: '3px', height: '7px', overflow: 'hidden' },
  rbFill: { height: '100%', borderRadius: '3px', background: '#e24b4a' },
  rbN: { fontSize: '11px', color: '#888', width: '16px', textAlign: 'right', flexShrink: 0 },
  planRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '0.5px solid #f0f0f0' },
  planLbl: { fontSize: '13px', color: '#888' },
  planVal: { fontSize: '13px', fontWeight: 500, color: '#222' },
  phases: { display: 'flex', flexDirection: 'column', gap: '5px' },
  phase: { display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 10px', background: '#f5f5f5', borderRadius: '8px' },
  phaseCur: { background: G },
  pNum: { width: '28px', height: '22px', borderRadius: '11px', background: '#ddd', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 500, color: '#888', flexShrink: 0 },
  pNumCur: { background: 'rgba(255,255,255,.3)', color: 'white' },
  pTxt: { fontSize: '13px', color: '#888' },
  pTxtCur: { color: 'white' },
};
