require("dotenv").config();
const { Bot } = require("grammy");
const chrono = require("chrono-node/ru"); // ← КЛЮЧЕВОЕ ИЗМЕНЕНИЕ
const cron = require("node-cron");
const db = require("./db");

const bot = new Bot(process.env.BOT_TOKEN);

// Команда /start
bot.command("start", (ctx) => {
  ctx.reply(
    'Привет! Напиши напоминание на естественном языке, например:\n"Напомни через 5 минут купить молоко"\nили "Напомни 15 февраля в 10 утра позвонить другу"',
  );
});

// Обработка сообщений (парсинг напоминания)
bot.on("message:text", async (ctx) => {
  const text = ctx.message.text;
  const userId = ctx.from.id;

  // Парсим дату из текста с chrono (поддерживает русский)
  const parsed = chrono.parse(text);
  if (parsed.length === 0) {
    return ctx.reply(
      'Не понял дату/время. Попробуй уточнить, например: "через 10 минут" или "завтра в 9"',
    );
  }

  const dueDate = parsed[0].start.date(); // Дата/время
  const reminderText = parsed[0].text
    ? text.replace(parsed[0].text, "").trim()
    : text; // Текст без даты

  if (!reminderText) {
    return ctx.reply("Что именно напомнить? Добавь текст после даты.");
  }

  const dueTime = Math.floor(dueDate.getTime() / 1000); // UNIX timestamp

  // Сохраняем в БД
  const stmt = db.prepare(
    "INSERT INTO reminders (user_id, text, due_time) VALUES (?, ?, ?)",
  );
  stmt.run(userId, reminderText, dueTime);

  await ctx.reply(
    `Ок, напомню "${reminderText}" в ${dueDate.toLocaleString("ru-RU")}`,
  );
});

// Периодическая проверка напоминаний (каждую минуту)
cron.schedule("* * * * *", async () => {
  const now = Math.floor(Date.now() / 1000);
  const reminders = db
    .prepare("SELECT * FROM reminders WHERE due_time <= ? AND sent = 0")
    .all(now);

  for (const rem of reminders) {
    try {
      await bot.api.sendMessage(rem.user_id, `Напоминание: ${rem.text}`);
      db.prepare("UPDATE reminders SET sent = 1 WHERE id = ?").run(rem.id);
    } catch (err) {
      console.error(`Ошибка отправки: ${err}`);
    }
  }
});

// Запуск бота (polling для локального теста)
bot.start();
console.log("Бот запущен локально");

// ... остальной код без изменений ...

bot.on("message:text", async (ctx) => {
  const text = ctx.message.text.trim();
  const userId = ctx.from.id;

  if (text.toLowerCase().startsWith("напомни")) {
    // Убираем слово "напомни" в начале, чтобы chrono лучше парсил
    const cleanedText = text.replace(/^напомни\s*/i, "").trim();

    const parsed = chrono.parse(cleanedText, new Date(), { forwardDate: true });

    if (
      parsed.length === 0 ||
      (!parsed[0].start.isCertain("hour") &&
        !parsed[0].start.isCertain("minute") &&
        !parsed[0].start.isCertain("day"))
    ) {
      return ctx.reply(
        "Не смог разобрать время. Попробуй так:\n" +
          "• через 15 минут\n" +
          "• завтра в 9:30\n" +
          "• в пятницу в 14:00\n" +
          "• 20 марта в 18:45",
      );
    }

    const refDate = parsed[0].start.date();
    const reminderText = parsed[0].text
      ? cleanedText.replace(parsed[0].text, "").trim() || cleanedText
      : cleanedText;

    if (!reminderText) {
      return ctx.reply(
        "Что именно напомнить? После времени должен быть текст.",
      );
    }

    const dueTime = Math.floor(refDate.getTime() / 1000);

    // Сохраняем
    const stmt = db.prepare(
      "INSERT INTO reminders (user_id, text, due_time) VALUES (?, ?, ?)",
    );
    stmt.run(userId, reminderText, dueTime);

    await ctx.reply(
      `✅ Ок, напомню:\n"${reminderText}"\nв ${refDate.toLocaleString("ru-RU", { dateStyle: "long", timeStyle: "short" })}`,
    );
  } else {
    await ctx.reply(
      'Просто напиши мне фразу с напоминанием, например:\n"Напомни через 10 минут проверить почту"',
    );
  }
});
