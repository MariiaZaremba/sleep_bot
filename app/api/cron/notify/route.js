import { getActiveUsers, getTask } from '@/lib/sheets';
import { sendEveningTask, sendMorningCheckin } from '@/lib/telegram';

const MINI_APP_URL = process.env.NEXT_PUBLIC_MINI_APP_URL || 'https://your-app.vercel.app/mini-app';

function getCurrentHour(timezone) {
  try {
    const formatter = new Intl.DateTimeFormat('uk', {
      timeZone: timezone,
      hour: 'numeric',
      hour12: false,
    });
    return parseInt(formatter.format(new Date()));
  } catch {
    return new Date().getHours();
  }
}

function getDaysSinceStart(startDate) {
  const start = new Date(startDate);
  const now = new Date();
  const diffMs = now - start;
  return Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
}

export async function GET(req) {
  const secret = req.headers.get('x-cron-secret');
  if (secret !== process.env.CRON_SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const users = await getActiveUsers();
    const results = { evening: 0, morning: 0, skipped: 0, errors: 0 };

    for (const user of users) {
      try {
        const localHour = getCurrentHour(user.timezone || 'Europe/Kyiv');
        const dayNum = getDaysSinceStart(user.start_date);

        if (dayNum > 14) {
          results.skipped++;
          continue;
        }

        const task = await getTask(dayNum);
        if (!task) {
          results.skipped++;
          continue;
        }

        // Вечірнє повідомлення о 21:00
        if (localHour === 21) {
          await sendEveningTask(user.chat_id, dayNum, task, MINI_APP_URL);
          results.evening++;
        }
        // Ранковий check-in о 7:00
        else if (localHour === 7) {
          await sendMorningCheckin(user.chat_id, dayNum, task);
          results.morning++;
        }
        else {
          results.skipped++;
        }

        // Пауза між запитами
        await new Promise(r => setTimeout(r, 50));

      } catch (err) {
        console.error(`Error for user ${user.chat_id}:`, err);
        results.errors++;
      }
    }

    console.log('Cron results:', results);
    return Response.json({ ok: true, results });

  } catch (error) {
    console.error('Cron error:', error);
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
}
