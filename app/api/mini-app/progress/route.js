import { getUser, getUserLogs, getTask } from '@/lib/sheets';

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const initData = searchParams.get('initData') || '';
    const timezone = searchParams.get('timezone');

    // Спочатку пробуємо отримати chatId з initData (Telegram)
    let chatId = null;
    if (initData) {
      try {
        const params = new URLSearchParams(initData);
        const userStr = params.get('user');
        if (userStr) {
          const user = JSON.parse(decodeURIComponent(userStr));
          chatId = user.id;
        }
      } catch {
        // ігноруємо помилку парсингу
      }
    }

    // Fallback для тестування в браузері
    if (!chatId) {
      chatId = searchParams.get('chatId');
    }

    if (!chatId) {
      return Response.json({ error: 'No user ID' }, { status: 400 });
    }

    const user = await getUser(chatId);
    if (!user) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    const logs = await getUserLogs(chatId);
    const dayNum = parseInt(user.day_current) || 1;
    const todayTask = await getTask(dayNum);

    return Response.json({
      user,
      logs,
      dayNum,
      todayTask,
    });

  } catch (error) {
    console.error('Mini App API error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
