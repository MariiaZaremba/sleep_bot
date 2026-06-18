const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const API = `https://api.telegram.org/bot${BOT_TOKEN}`;

export async function sendMessage(chatId, text, keyboard = null) {
  const body = {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
  };

  if (keyboard) {
    body.reply_markup = { inline_keyboard: keyboard };
  }

  const res = await fetch(`${API}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  return res.json();
}

function openMiniAppButton(text, url) {
  return [[{ text, web_app: { url } }]];
}

export async function askSleepHours(chatId) {
  await sendMessage(chatId,
    '😴 Скільки годин сну тобі потрібно щоб прокинутись відпочилою?\n\nПодумай про відпустку — скільки годин ти спиш коли немає будильника?',
    [
      [{ text: '6 годин', callback_data: 'hours_6' }, { text: '7 годин', callback_data: 'hours_7' }],
      [{ text: '8 годин', callback_data: 'hours_8' }, { text: '9 годин', callback_data: 'hours_9' }],
    ]
  );
}

export async function askWakeTime(chatId) {
  await sendMessage(chatId,
    '⏰ О котрій тобі потрібно прокидатись?\n\nВибери час який підходить під твій розклад 5-6 днів на тиждень.',
    [
      [{ text: '5:00', callback_data: 'wake_05:00' }, { text: '6:00', callback_data: 'wake_06:00' }],
      [{ text: '7:00', callback_data: 'wake_07:00' }, { text: '8:00', callback_data: 'wake_08:00' }],
      [{ text: '9:00', callback_data: 'wake_09:00' }, { text: '10:00', callback_data: 'wake_10:00' }],
    ]
  );
}

export async function askWhyImprove(chatId) {
  await sendMessage(chatId,
    '💭 Яка головна причина чому ти хочеш покращити сон?\n\nМожна вибрати кілька:',
    [
      [{ text: '💪 Більше енергії', callback_data: 'why_energy' }],
      [{ text: '🧠 Краща концентрація', callback_data: 'why_focus' }],
      [{ text: '😤 Менше роздратованості', callback_data: 'why_mood' }],
      [{ text: '🏋️ Краще відновлення', callback_data: 'why_recovery' }],
      [{ text: '✅ Готово', callback_data: 'why_done' }],
    ]
  );
}

export async function sendOnboardingComplete(chatId, bedTime, miniAppUrl) {
  await sendMessage(chatId,
    `✅ <b>Твій план сну готовий!</b>\n\nПочинаємо 14-денний челендж сьогодні.\n\n🌙 Час відбою: <b>${bedTime}</b>\n📱 Щовечора о 21:00 отримуватимеш завдання на ніч\n☀️ Щоранку о 7:00 — запит на ранковий звіт\n\nУдачі! Ти впораєшся 💚`,
    openMiniAppButton('Переглянути мій план →', miniAppUrl)
  );
}

export async function sendEveningTask(chatId, dayNum, task, miniAppUrl) {
  await sendMessage(chatId,
    `🌙 <b>День ${dayNum} — завдання на ніч</b>\n\n${task.task_text}\n\n<i>${task.why_text}</i>`,
    openMiniAppButton('Переглянути прогрес →', miniAppUrl)
  );
}

export async function sendMorningCheckin(chatId, dayNum, task) {
  await sendMessage(chatId,
    `☀️ <b>Доброго ранку! День ${dayNum}</b>\n\nЯк пройшла ніч?\nВчорашнє завдання: <i>${task.task_text}</i>`,
    [
      [
        { text: '✅ Виконала', callback_data: `done_${dayNum}` },
        { text: '❌ Не вдалося', callback_data: `skip_${dayNum}` },
      ],
    ]
  );
}

export async function askSkipReason(chatId, dayNum) {
  await sendMessage(chatId,
    'Що завадило? (можна вибрати кілька, потім натисни "Готово")',
    [
      [{ text: '📱 Телефон перед сном', callback_data: `reason_phone_${dayNum}` }],
      [{ text: '🕐 Лягла занадто пізно', callback_data: `reason_late_${dayNum}` }],
      [{ text: '😰 Стрес / тривога', callback_data: `reason_stress_${dayNum}` }],
      [{ text: '👥 Соціальні обставини', callback_data: `reason_social_${dayNum}` }],
      [{ text: '💼 Робота / дедлайн', callback_data: `reason_work_${dayNum}` }],
      [{ text: '✅ Готово', callback_data: `reason_done_${dayNum}` }],
    ]
  );
}

export async function askBedTime(chatId) {
  await sendMessage(chatId, 'О котрій лягла спати вчора ввечері? Напиши у форматі <b>23:30</b>');
}

export async function askWakeTimeActual(chatId) {
  await sendMessage(chatId, 'О котрій прокинулась сьогодні? Напиши у форматі <b>07:00</b>');
}

export async function askSleepQuality(chatId) {
  await sendMessage(chatId,
    'Як оцінюєш якість сну?',
    [
      [
        { text: '⭐', callback_data: 'quality_1' },
        { text: '⭐⭐', callback_data: 'quality_2' },
        { text: '⭐⭐⭐', callback_data: 'quality_3' },
        { text: '⭐⭐⭐⭐', callback_data: 'quality_4' },
        { text: '⭐⭐⭐⭐⭐', callback_data: 'quality_5' },
      ],
    ]
  );
}

export async function sendCheckinComplete(chatId, miniAppUrl) {
  await sendMessage(chatId,
    '💚 Записала! Гарного дня.\n\nПереглянь свою статистику в Mini App:',
    openMiniAppButton('Відкрити прогрес →', miniAppUrl)
  );
}
