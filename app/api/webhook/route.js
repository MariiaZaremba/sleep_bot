import { getUser, createUser, saveLog, updateUserDay, updateUserStatus, getUserLogs } from '@/lib/sheets';
import {
  askSleepHours,
  askWakeTime,
  askWhyImprove,
  sendOnboardingComplete,
  askSkipReason,
  askBedTime,
  askWakeTimeActual,
  askSleepQuality,
  sendCheckinComplete,
  sendCheckinSkipComplete,
  sendFinalReport,
  sendMessage,
} from '@/lib/telegram';

const MINI_APP_URL = process.env.NEXT_PUBLIC_MINI_APP_URL || 'https://your-app.vercel.app/mini-app';
const miniAppUrl = (chatId) => `${MINI_APP_URL}?chatId=${chatId}`;

const userState = {};

function getToday() {
  return new Date().toISOString().split('T')[0];
}

function calcBedTime(wakeTime, sleepHours) {
  const [h, m] = wakeTime.split(':').map(Number);
  const totalMins = h * 60 + m - sleepHours * 60;
  const bedH = ((Math.floor(totalMins / 60) % 24) + 24) % 24;
  const bedM = ((totalMins % 60) + 60) % 60;
  return `${String(bedH).padStart(2, '0')}:${String(bedM).padStart(2, '0')}`;
}

function calcSleepHours(bedTime, wakeTime) {
  const [bh, bm] = bedTime.split(':').map(Number);
  const [wh, wm] = wakeTime.split(':').map(Number);
  let mins = (wh * 60 + wm) - (bh * 60 + bm);
  if (mins < 0) mins += 24 * 60;
  return Math.round(mins / 60 * 10) / 10;
}

function isTimeFormat(text) {
  return /^\d{1,2}:\d{2}$/.test(text.trim());
}

export async function POST(req) {
  try {
    const body = await req.json();
    const message = body.message;
    const callbackQuery = body.callback_query;

    let chatId, text, callbackData, userName;

    if (message) {
      chatId = message.chat.id;
      text = message.text;
      userName = message.from.first_name || 'друже';
    } else if (callbackQuery) {
      chatId = callbackQuery.message.chat.id;
      callbackData = callbackQuery.data;
      userName = callbackQuery.from.first_name || 'друже';
    } else {
      return Response.json({ ok: true });
    }

    const user = await getUser(chatId);
    const state = userState[chatId] || {};

    // /progress
    if (text === '/progress') {
      if (user) {
        await sendMessage(chatId, 'Твій прогрес 👇',
          [[{ text: 'Відкрити прогрес →', web_app: { url: miniAppUrl(chatId) } }]]
        );
      } else {
        await sendMessage(chatId, 'Спочатку почни челендж — /start');
      }
      return Response.json({ ok: true });
    }

    // /pause
    if (text === '/pause') {
      if (user && user.status === 'active') {
        await updateUserStatus(chatId, 'paused');
        await sendMessage(chatId, '⏸ Челендж призупинено. Напиши /resume щоб продовжити.');
      } else {
        await sendMessage(chatId, 'Немає активного челенджу для паузи.');
      }
      return Response.json({ ok: true });
    }

    // /resume
    if (text === '/resume') {
      if (user && user.status === 'paused') {
        await updateUserStatus(chatId, 'active');
        await sendMessage(chatId, `▶️ Челендж відновлено! Продовжуємо з дня ${user.day_current} 💚`);
      } else {
        await sendMessage(chatId, 'Немає призупиненого челенджу.');
      }
      return Response.json({ ok: true });
    }

    // /start
    if (text === '/start') {
      if (user && user.status === 'active') {
        await sendMessage(chatId,
          `Привіт, ${user.name}! Ти вже в челенджі 💚\nДень ${user.day_current} з 14.`,
          [[{ text: 'Відкрити прогрес →', web_app: { url: miniAppUrl(chatId) } }]]
        );
        return Response.json({ ok: true });
      }
      userState[chatId] = { step: 'onboarding_hours', name: userName, reasons: [] };
      await sendMessage(chatId,
        `Привіт, ${userName}! 🌙\n\nЯ допоможу тобі покращити сон за 14 днів.\n\nЩодня ввечері — завдання на ніч, вранці — короткий звіт.\n\nДавай почнемо 👇`
      );
      await askSleepHours(chatId);
      return Response.json({ ok: true });
    }

    if (callbackData) {

      // Онбординг: години сну
      if (callbackData.startsWith('hours_')) {
        const hours = parseInt(callbackData.replace('hours_', ''));
        userState[chatId] = { ...state, step: 'onboarding_wake', sleep_hours: hours };
        await askWakeTime(chatId);
        return Response.json({ ok: true });
      }

      // Онбординг: час підйому
      if (callbackData.startsWith('wake_') && state.step === 'onboarding_wake') {
        const wakeTime = callbackData.replace('wake_', '');
        const bedTime = calcBedTime(wakeTime, state.sleep_hours);
        userState[chatId] = { ...state, step: 'onboarding_why', wake_time: wakeTime, bed_time: bedTime };
        await sendMessage(chatId, `Час підйому: <b>${wakeTime}</b> → час відбою: <b>${bedTime}</b>`);
        await askWhyImprove(chatId);
        return Response.json({ ok: true });
      }

      // Онбординг: причини (мульти-вибір)
      if (callbackData.startsWith('why_') && state.step === 'onboarding_why') {
        if (callbackData === 'why_done') {
          await createUser({
            chat_id: chatId,
            name: state.name,
            timezone: 'Europe/Kyiv',
            wake_time: state.wake_time,
            bed_time: state.bed_time,
            sleep_hours: state.sleep_hours,
            start_date: getToday(),
            reasons_why: (state.reasons || []).join(', '),
          });
          userState[chatId] = {};
          await sendOnboardingComplete(chatId, state.bed_time, miniAppUrl(chatId));
        } else {
          const reasonMap = {
            why_energy: 'Більше енергії',
            why_focus: 'Краща концентрація',
            why_mood: 'Менше роздратованості',
            why_recovery: 'Краще відновлення',
          };
          const reasons = state.reasons || [];
          const reason = reasonMap[callbackData];
          if (reason && !reasons.includes(reason)) {
            reasons.push(reason);
            userState[chatId] = { ...state, reasons };
            await sendMessage(chatId, `✅ ${reason}`);
          }
        }
        return Response.json({ ok: true });
      }

      // Check-in: виконала
      if (callbackData.startsWith('done_')) {
        const dayNum = callbackData.replace('done_', '');
        userState[chatId] = { ...state, step: 'checkin_bed', day_num: dayNum, task_done: true, skip_reasons: '' };
        await askBedTime(chatId);
        return Response.json({ ok: true });
      }

      // Check-in: не виконала
      if (callbackData.startsWith('skip_')) {
        const dayNum = callbackData.replace('skip_', '');
        userState[chatId] = { ...state, step: 'checkin_reasons', day_num: dayNum, task_done: false, skip_reasons: [] };
        await askSkipReason(chatId, dayNum);
        return Response.json({ ok: true });
      }

      // Check-in: причини пропуску
      if (callbackData.startsWith('reason_') && state.step === 'checkin_reasons') {
        if (callbackData.startsWith('reason_done_')) {
          const reasons = (state.skip_reasons || []).join(', ');
          userState[chatId] = { ...state, step: 'checkin_bed', skip_reasons: reasons };
          await askBedTime(chatId);
        } else {
          const reasonMap = {
            reason_phone: 'Телефон перед сном',
            reason_late: 'Лягла занадто пізно',
            reason_stress: 'Стрес / тривога',
            reason_social: 'Соціальні обставини',
            reason_work: 'Робота / дедлайн',
            reason_other: 'Інше',
          };
          const key = callbackData.replace(/_\d+$/, '');
          const reason = reasonMap[key];
          if (reason) {
            const reasons = state.skip_reasons || [];
            if (!reasons.includes(reason)) reasons.push(reason);
            userState[chatId] = { ...state, skip_reasons: reasons };
            await sendMessage(chatId, `✅ ${reason}`);
          }
        }
        return Response.json({ ok: true });
      }

      // Check-in: якість сну
      if (callbackData.startsWith('quality_')) {
        const quality = parseInt(callbackData.replace('quality_', ''));
        const s = state;
        const sleepHoursActual = s.bed_time_actual && s.wake_time_actual
          ? calcSleepHours(s.bed_time_actual, s.wake_time_actual)
          : null;

        await saveLog({
          chat_id: chatId,
          date: getToday(),
          day_num: s.day_num,
          task_done: s.task_done,
          skip_reasons: s.skip_reasons || '',
          bed_time_actual: s.bed_time_actual || '',
          wake_time_actual: s.wake_time_actual || '',
          sleep_quality: quality,
          sleep_hours_actual: sleepHoursActual,
        });

        const nextDay = parseInt(s.day_num) + 1;
        userState[chatId] = {};

        if (nextDay > 14) {
          await updateUserStatus(chatId, 'completed');
          const allLogs = await getUserLogs(chatId);
          const doneDays = allLogs.filter(l => l.task_done === 'TRUE').length;
          const sleepLogs = allLogs.filter(l => l.sleep_hours_actual);
          const avgSleep = sleepLogs.length
            ? (sleepLogs.reduce((a, l) => a + parseFloat(l.sleep_hours_actual), 0) / sleepLogs.length).toFixed(1)
            : '—';
          const qualLogs = allLogs.filter(l => l.sleep_quality);
          const avgQuality = qualLogs.length
            ? (qualLogs.reduce((a, l) => a + parseFloat(l.sleep_quality), 0) / qualLogs.length).toFixed(1)
            : '—';
          let maxStreak = 0, cur = 0;
          allLogs.forEach(l => {
            if (l.task_done === 'TRUE') { cur++; if (cur > maxStreak) maxStreak = cur; }
            else { cur = 0; }
          });
          const reasonCounts = {};
          allLogs.filter(l => l.skip_reasons).forEach(l => {
            l.skip_reasons.split(',').forEach(r => {
              const reason = r.trim();
              if (reason) reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
            });
          });
          const topReason = Object.entries(reasonCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
          await sendFinalReport(chatId, { doneDays, avgSleep, avgQuality, streak: maxStreak, topReason }, miniAppUrl(chatId));
        } else {
          await updateUserDay(chatId, nextDay);
          if (s.task_done) {
            await sendCheckinComplete(chatId, miniAppUrl(chatId));
          } else {
            await sendCheckinSkipComplete(chatId, miniAppUrl(chatId));
          }
        }
        return Response.json({ ok: true });
      }
    }

    // Текстові відповіді: час відбою
    if (state.step === 'checkin_bed' && text && isTimeFormat(text)) {
      userState[chatId] = { ...state, step: 'checkin_wake', bed_time_actual: text.trim() };
      await askWakeTimeActual(chatId);
      return Response.json({ ok: true });
    }

    // Текстові відповіді: час підйому
    if (state.step === 'checkin_wake' && text && isTimeFormat(text)) {
      userState[chatId] = { ...state, step: 'checkin_quality', wake_time_actual: text.trim() };
      await askSleepQuality(chatId);
      return Response.json({ ok: true });
    }

    if (text && !state.step) {
      await sendMessage(chatId, 'Напиши /start щоб почати челендж 🌙');
    }

    return Response.json({ ok: true });

  } catch (error) {
    console.error('Webhook error:', error);
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
}
