import { Router } from "express";
import crypto from "node:crypto";
import { rawDb } from "../lib/enhanced.js";
import { auth } from "../lib/auth.js";
import { okResponse, errResponse } from "../schemas/common.js";

const router = Router();

function cuid() {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 25);
}

/** POST /api/demo/setup — create demo account with rich data, return session */
router.post("/setup", async (req, res) => {
  try {
    const ts = Date.now();
    const demoEmail = `demo-${ts}@demo.takt.pro`;
    const demoPassword = `demo-${ts}-pass`;
    const demoName = "Демо Пользователь";

    // 1. Signup via better-auth
    const signupRes = await auth.api.signUpEmail({
      body: { name: demoName, email: demoEmail, password: demoPassword },
    });
    const userId = signupRes.user.id;

    // 2. Create org
    const orgId = cuid();
    const now = new Date();
    await rawDb.organization.create({
      data: {
        id: orgId,
        name: "Демо Кофейня",
        slug: `demo-${ts}`,
        timezone: "Europe/Moscow",
        plan: "TRIAL",
        trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        metadata: JSON.stringify({ demo: true }),
        updatedAt: now,
      },
    });

    // 3. Create member (owner)
    await rawDb.member.create({
      data: {
        id: cuid(),
        organizationId: orgId,
        userId,
        role: "owner",
        taktRole: "OWNER",
      },
    });

    // 4. Create 2 locations
    const loc1Id = cuid();
    const loc2Id = cuid();
    await rawDb.location.createMany({
      data: [
        { id: loc1Id, orgId, name: "Центральная", address: "ул. Арбат, 15", timezone: "Europe/Moscow", resetHour: 10, updatedAt: now },
        { id: loc2Id, orgId, name: "На Покровке", address: "ул. Покровка, 42", timezone: "Europe/Moscow", resetHour: 10, updatedAt: now },
      ],
    });

    // 5. Create demo staff (barista + trainee)
    const barista = await auth.api.signUpEmail({
      body: { name: "Анна Бариста", email: `barista-${ts}@demo.takt.pro`, password: demoPassword },
    });
    await rawDb.member.create({
      data: {
        id: cuid(),
        organizationId: orgId,
        userId: barista.user.id,
        role: "member",
        taktRole: "BARISTA",
        locationIds: [loc1Id],
      },
    });

    const trainee = await auth.api.signUpEmail({
      body: { name: "Мария Стажёр", email: `trainee-${ts}@demo.takt.pro`, password: demoPassword },
    });
    await rawDb.member.create({
      data: {
        id: cuid(),
        organizationId: orgId,
        userId: trainee.user.id,
        role: "member",
        taktRole: "TRAINEE",
        locationIds: [loc1Id],
      },
    });

    // 6. Checklist templates
    const closingTplId = cuid();
    const openingTplId = cuid();
    await rawDb.checklistTemplate.createMany({
      data: [
        {
          id: closingTplId, orgId, name: "Закрытие смены", type: "closing", isDefault: true, updatedAt: now,
          sections: [
            { name: "Списание заготовок", tasks: [
              { key: "close_fresh", text: "Списать фреш, нарезки фруктов и цитрусов", type: "checkbox" },
            ]},
            { name: "Оборудование", tasks: [
              { key: "eq_machine", text: "Промыть кофемашину (обратная промывка с ковизой)", type: "checkbox" },
              { key: "eq_group_soak", text: "Замочить холдеры, сетки групп, термосы с ковизой на 20 мин", type: "checkbox" },
              { key: "eq_filter_off", text: "Выключить фильтр-машину", type: "checkbox" },
              { key: "eq_grill_off", text: "Выключить гриль", type: "checkbox" },
              { key: "eq_lights_off", text: "Выключить свет витрин", type: "checkbox" },
            ]},
            { name: "Касса", tasks: [
              { key: "cash_count", text: "Пересчитать кассу", type: "checkbox" },
              { key: "cash_close", text: "Закрыть смену в Quick Resto", type: "checkbox" },
              { key: "cash_report", text: "Выгрузить Z-отчёт", type: "checkbox" },
            ]},
            { name: "Уборка", tasks: [
              { key: "clean_bar", text: "Протереть барную стойку и рабочие поверхности", type: "checkbox" },
              { key: "clean_trash", text: "Вынести мусор", type: "checkbox" },
            ]},
            { name: "Отчёт о закрытии", tasks: [
              { key: "report_cash", text: "Сумма наличных в кассе", type: "checkbox" },
              { key: "report_stops", text: "Стоп-лист на утро", type: "checkbox" },
              { key: "report_photos", text: "Фотоотчёт (3–10 фото зала и бара)", type: "photo_report", minPhotos: 3, maxPhotos: 10 },
            ]},
          ],
        },
        {
          id: openingTplId, orgId, name: "Открытие смены", type: "opening", isDefault: false, updatedAt: now,
          sections: [
            { name: "Включение оборудования (9:00–9:05)", tasks: [
              { key: "open_filter_machine", text: "Включить фильтр-машину", type: "checkbox" },
              { key: "open_coffee_machine", text: "Включить кофемашину", type: "checkbox" },
              { key: "open_grill", text: "Включить гриль", type: "checkbox" },
              { key: "open_lights", text: "Включить свет витрин и холодильника", type: "checkbox" },
            ]},
            { name: "Проверка заготовок (9:00–9:05)", tasks: [
              { key: "open_expiry", text: "Проверить сроки годности", type: "checkbox" },
              { key: "open_visual", text: "Проверить внешний вид продукции", type: "checkbox" },
            ]},
            { name: "Подготовка инвентаря (9:05–9:10)", tasks: [
              { key: "open_mats", text: "Разложить резиновые коврики и питчеры", type: "checkbox" },
              { key: "open_tools", text: "Промыть и разложить инструменты после ковизы", type: "checkbox" },
              { key: "open_filter1", text: "Приготовить первый термос фильтр-кофе", type: "checkbox" },
            ]},
            { name: "Оформление витрин (9:10–9:20)", tasks: [
              { key: "open_display", text: "Выложить десерты, выпечку и еду to go", type: "checkbox" },
              { key: "open_prices", text: "Расставить ценники", type: "checkbox" },
              { key: "open_display_photo", text: "Фотоотчёт всех витрин", type: "photo" },
            ]},
            { name: "Фреш и заготовки (9:20–9:40)", tasks: [
              { key: "open_orange", text: "Выжать апельсиновый фреш (2л)", type: "checkbox" },
              { key: "open_lemon", text: "Выжать лимонный фреш (100-150мл)", type: "checkbox" },
              { key: "open_cut_fruit", text: "Нарезать лимон и лайм", type: "checkbox" },
              { key: "open_cold_filter", text: "Остудить фильтр, перелить в сосудник", type: "checkbox" },
              { key: "open_filter2", text: "Приготовить второй термос фильтр-кофе", type: "checkbox" },
            ]},
            { name: "Настройка и запуск (9:40–10:00)", tasks: [
              { key: "open_espresso", text: "Настроить эспрессо", type: "checkbox" },
              { key: "open_pos", text: "Открыть смену в Quick Resto", type: "checkbox" },
              { key: "open_cash", text: "Пересчитать наличные в кассе", type: "checkbox" },
              { key: "open_internet", text: "Проверить кассовую систему и интернет", type: "checkbox" },
            ]},
            { name: "Ежедневный отчёт", tasks: [
              { key: "report_cash", text: "Точная сумма наличных в кассе", type: "checkbox" },
              { key: "report_stops", text: "Стоп-лист по бару и кухне", type: "checkbox" },
              { key: "report_temp", text: "Температура витрин и холодильников", type: "checkbox" },
              { key: "report_water", text: "Показатели минерализации воды", type: "checkbox" },
              { key: "report_espresso", text: "Описание эспрессо (зерно, рецепт, дескрипторы)", type: "checkbox" },
              { key: "report_filter", text: "Описание фильтр-кофе (зерно, рецепт, дескрипторы)", type: "checkbox" },
              { key: "report_photos", text: "Фотографии витрин и зала", type: "photo" },
            ]},
            { name: "Финал", tasks: [
              { key: "open_music", text: "Включить плейлист с телефона", type: "checkbox" },
            ]},
          ],
        },
      ],
    });

    // 7. Products
    await rawDb.product.createMany({
      data: [
        { orgId, name: "Эспрессо", group: "Кофе", unit: "шт", costPrice: 45, updatedAt: now },
        { orgId, name: "Капучино", group: "Кофе", unit: "шт", costPrice: 65, updatedAt: now },
        { orgId, name: "Латте", group: "Кофе", unit: "шт", costPrice: 70, updatedAt: now },
        { orgId, name: "Американо", group: "Кофе", unit: "шт", costPrice: 50, updatedAt: now },
        { orgId, name: "Раф", group: "Кофе", unit: "шт", costPrice: 80, updatedAt: now },
        { orgId, name: "Чай чёрный", group: "Чай", unit: "шт", costPrice: 25, updatedAt: now },
        { orgId, name: "Чай зелёный", group: "Чай", unit: "шт", costPrice: 25, updatedAt: now },
        { orgId, name: "Круассан", group: "Выпечка", unit: "шт", costPrice: 40, updatedAt: now },
        { orgId, name: "Чизкейк", group: "Десерты", unit: "шт", costPrice: 90, updatedAt: now },
        { orgId, name: "Молоко 3.2%", group: "Расходники", unit: "л", costPrice: 85, updatedAt: now },
        { orgId, name: "Зерно (бленд)", group: "Расходники", unit: "кг", costPrice: 1200, updatedAt: now },
      ],
    });

    // 7b. Manager account
    const manager = await auth.api.signUpEmail({
      body: { name: "Игорь Менеджер", email: `manager-${ts}@demo.takt.pro`, password: demoPassword },
    });
    await rawDb.member.create({
      data: {
        id: cuid(),
        organizationId: orgId,
        userId: manager.user.id,
        role: "member",
        taktRole: "MANAGER",
        locationIds: [loc1Id],
      },
    });

    // 8. Shifts (today + 2 past days)
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const dayBefore = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10);

    const shiftTodayId = cuid();
    const shiftToday2Id = cuid();
    const shiftYestId = cuid();
    const shiftDayBeforeId = cuid();

    await rawDb.shift.createMany({
      data: [
        {
          id: shiftTodayId, orgId, locationId: loc1Id, date: today, status: "OPEN",
          openedBy: userId, openedAt: new Date(), responsibleId: barista.user.id,
          responsibleName: "Анна Бариста", updatedAt: now,
        },
        {
          id: shiftToday2Id, orgId, locationId: loc2Id, date: today, status: "OPEN",
          openedBy: userId, openedAt: new Date(), responsibleId: manager.user.id,
          responsibleName: "Игорь Менеджер", updatedAt: now,
        },
        {
          id: shiftYestId, orgId, locationId: loc1Id, date: yesterday, status: "CLOSED",
          openedBy: userId, openedAt: new Date(Date.now() - 86400000),
          closedBy: barista.user.id, closedAt: new Date(Date.now() - 50000000),
          responsibleId: barista.user.id, responsibleName: "Анна Бариста", updatedAt: now,
        },
        {
          id: shiftDayBeforeId, orgId, locationId: loc1Id, date: dayBefore, status: "CLOSED",
          openedBy: userId, openedAt: new Date(Date.now() - 2 * 86400000),
          closedBy: userId, closedAt: new Date(Date.now() - 130000000),
          responsibleId: userId, responsibleName: demoName, updatedAt: now,
        },
      ],
    });

    // 9. Task completions for yesterday's shift (mostly done)
    const closingTasks = ["clean_bar", "clean_floor", "clean_toilet", "eq_grinder", "eq_machine", "eq_fridge", "cash_count", "cash_report"];
    await rawDb.taskCompletion.createMany({
      data: closingTasks.map((key, i) => ({
        shiftId: shiftYestId,
        taskKey: key,
        done: i < 7, // last one not done
        byUserId: barista.user.id,
        byName: "Анна Бариста",
        doneAt: i < 7 ? new Date(Date.now() - 50000000 + i * 60000) : null,
        updatedAt: now,
      })),
    });

    // 10. Today's shift: partially completed (with photos)
    await rawDb.taskCompletion.createMany({
      data: [
        { shiftId: shiftTodayId, taskKey: "clean_bar", done: true, byUserId: barista.user.id, byName: "Анна Бариста", doneAt: new Date(), photo: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=300&h=200&fit=crop", updatedAt: now },
        { shiftId: shiftTodayId, taskKey: "clean_floor", done: true, byUserId: barista.user.id, byName: "Анна Бариста", doneAt: new Date(), photo: "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=300&h=200&fit=crop", updatedAt: now },
        { shiftId: shiftTodayId, taskKey: "eq_grinder", done: false, updatedAt: now },
        // Completions for loc2 shift
        { shiftId: shiftToday2Id, taskKey: "clean_bar", done: true, byUserId: manager.user.id, byName: "Игорь Менеджер", doneAt: new Date(), updatedAt: now },
        { shiftId: shiftToday2Id, taskKey: "open_check_water", done: true, byUserId: manager.user.id, byName: "Игорь Менеджер", doneAt: new Date(), photo: "https://images.unsplash.com/photo-1559305616-3f99cd43e353?w=300&h=200&fit=crop", updatedAt: now },
      ],
    });

    // 11. Shift events
    await rawDb.shiftEvent.createMany({
      data: [
        { shiftId: shiftTodayId, userId, userName: demoName, action: "shift_opened", at: now },
        { shiftId: shiftTodayId, taskKey: "clean_bar", userId: barista.user.id, userName: "Анна Бариста", action: "task_done", at: now },
        { shiftId: shiftTodayId, taskKey: "clean_floor", userId: barista.user.id, userName: "Анна Бариста", action: "task_done", at: now },
        { shiftId: shiftYestId, userId, userName: demoName, action: "shift_opened", at: new Date(Date.now() - 86400000) },
        { shiftId: shiftYestId, userId: barista.user.id, userName: "Анна Бариста", action: "shift_closed", at: new Date(Date.now() - 50000000) },
      ],
    });

    // 12. Ratings
    await rawDb.shiftRating.createMany({
      data: [
        { shiftId: shiftYestId, userId, userName: demoName, rating: 4, comment: "Хорошая смена, но забыли выгрузить Z-отчёт", createdAt: new Date(Date.now() - 40000000) },
        { shiftId: shiftDayBeforeId, userId, userName: demoName, rating: 5, comment: "Отличная работа!", createdAt: new Date(Date.now() - 120000000) },
      ],
    });

    // 13. Orders
    await rawDb.order.createMany({
      data: [
        { orgId, locationId: loc1Id, shiftId: shiftTodayId, shiftDate: today, userId: barista.user.id, userName: "Анна Бариста", text: "Молоко 3.2% — 5л, овсяное молоко — 3л", createdAt: now },
        { orgId, locationId: loc1Id, shiftId: shiftYestId, shiftDate: yesterday, userId: barista.user.id, userName: "Анна Бариста", text: "Стаканы 300мл — 200шт, крышки — 200шт", createdAt: new Date(Date.now() - 80000000) },
        { orgId, locationId: loc1Id, shiftId: shiftYestId, shiftDate: yesterday, userId, userName: demoName, text: "Зерно (бленд) — 2кг, декаф — 500г", createdAt: new Date(Date.now() - 75000000) },
      ],
    });

    // 14. Calendar tasks
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
    await rawDb.calendarTask.createMany({
      data: [
        { orgId, locationId: loc1Id, date: today, text: "Приёмка молока (поставщик ~14:00)", color: "blue", createdBy: userId, updatedAt: now },
        { orgId, locationId: loc1Id, date: today, text: "Обучение Марии: латте-арт", color: "green", assignedTo: trainee.user.id, assignedName: "Мария Стажёр", createdBy: userId, updatedAt: now },
        { orgId, locationId: loc1Id, date: tomorrow, text: "ТО кофемашины", color: "red", createdBy: userId, updatedAt: now },
        { orgId, locationId: loc1Id, date: nextWeek, text: "Инвентаризация", color: "orange", createdBy: userId, updatedAt: now },
        { orgId, locationId: loc2Id, date: today, text: "Открытие новой точки — финальная проверка", color: "purple", createdBy: userId, updatedAt: now },
      ],
    });

    // 15. Settings
    await rawDb.setting.createMany({
      data: [
        { orgId, key: "checklist_closing_template", value: closingTplId },
        { orgId, key: "checklist_opening_template", value: openingTplId },
        { orgId, key: "notifications", value: { shift_open: true, shift_close: true, low_completion: true } },
      ],
    });

    // 16. Alerts
    await rawDb.alert.createMany({
      data: [
        { orgId, locationId: loc1Id, type: "low_completion", severity: "warning", message: `Смена ${yesterday}: выполнено 87% задач`, data: { shiftId: shiftYestId, completionRate: 0.87 }, createdAt: new Date(Date.now() - 40000000) },
      ],
    });

    // 17. TestAttempt for trainee
    await rawDb.testAttempt.createMany({
      data: [
        { userId: trainee.user.id, testKey: "coffee_basics", score: 85, passed: true, startedAt: new Date(Date.now() - 3 * 86400000), finishedAt: new Date(Date.now() - 3 * 86400000 + 1200000) },
        { userId: trainee.user.id, testKey: "hygiene_101", score: 60, passed: false, startedAt: new Date(Date.now() - 2 * 86400000), finishedAt: new Date(Date.now() - 2 * 86400000 + 900000) },
        { userId: trainee.user.id, testKey: "latte_art", score: 92, passed: true, startedAt: new Date(Date.now() - 86400000), finishedAt: new Date(Date.now() - 86400000 + 1500000) },
      ],
    });

    // 18. CalendarTask assigned to barista
    await rawDb.calendarTask.create({
      data: {
        orgId, locationId: loc1Id, date: today, text: "Проверить срок годности сиропов",
        color: "yellow", assignedTo: barista.user.id, assignedName: "Анна Бариста",
        createdBy: userId, updatedAt: now,
      },
    });

    // 19. Recipes (техкарты)
    await rawDb.recipe.createMany({
      data: [
        {
          orgId, name: "Эспрессо", group: "Кофе", description: "Классический эспрессо 30мл",
          output: 1, outputUnit: "порция", costPrice: 45,
          ingredients: [
            { name: "Зерно (бленд)", amount: 18, unit: "г" },
          ],
          steps: ["Смолоть 18г зерна", "Темперовать таблетку", "Экстракция 25-30 сек, выход 30мл"],
          updatedAt: now,
        },
        {
          orgId, name: "Капучино", group: "Кофе", description: "Капучино 180мл",
          output: 1, outputUnit: "порция", costPrice: 65,
          ingredients: [
            { name: "Зерно (бленд)", amount: 18, unit: "г" },
            { name: "Молоко 3.2%", amount: 150, unit: "мл" },
          ],
          steps: ["Смолоть 18г зерна", "Приготовить эспрессо 30мл", "Вспенить молоко до 65°C", "Влить молоко в эспрессо, создать латте-арт"],
          updatedAt: now,
        },
        {
          orgId, name: "Латте", group: "Кофе", description: "Латте 250мл",
          output: 1, outputUnit: "порция", costPrice: 70,
          ingredients: [
            { name: "Зерно (бленд)", amount: 18, unit: "г" },
            { name: "Молоко 3.2%", amount: 200, unit: "мл" },
          ],
          steps: ["Смолоть 18г зерна", "Приготовить эспрессо 30мл", "Вспенить молоко до 65°C (менее пены чем капучино)", "Влить молоко, создать латте-арт"],
          updatedAt: now,
        },
        {
          orgId, name: "Раф", group: "Кофе", description: "Раф-кофе 250мл",
          output: 1, outputUnit: "порция", costPrice: 80,
          ingredients: [
            { name: "Зерно (бленд)", amount: 18, unit: "г" },
            { name: "Молоко 3.2%", amount: 100, unit: "мл" },
            { name: "Сливки 10%", amount: 100, unit: "мл" },
            { name: "Ванильный сахар", amount: 5, unit: "г" },
          ],
          steps: ["Приготовить эспрессо", "Смешать молоко, сливки и ванильный сахар", "Взбить всё вместе паром до однородности"],
          updatedAt: now,
        },
        {
          orgId, name: "Чай чёрный", group: "Чай", description: "Чёрный чай 300мл",
          output: 1, outputUnit: "порция", costPrice: 25,
          ingredients: [
            { name: "Чай чёрный (листовой)", amount: 5, unit: "г" },
            { name: "Вода", amount: 300, unit: "мл" },
          ],
          steps: ["Нагреть воду до 95°C", "Заварить чай 4-5 минут"],
          updatedAt: now,
        },
      ],
    });

    // 20. Schedule slots (current week)
    const daysOfWeek: string[] = [];
    const nowMs = Date.now();
    const dayOfWeek = new Date().getDay() || 7;
    for (let i = 1; i <= 7; i++) {
      const d = new Date(nowMs + (i - dayOfWeek) * 86400000);
      daysOfWeek.push(d.toISOString().slice(0, 10));
    }

    const scheduleData: { orgId: string; userId: string; userName: string; locationId: string; date: string; startTime: string; endTime: string; breakMin: number; createdBy: string; updatedAt: Date }[] = [];
    // Barista works Mon-Fri
    for (let i = 0; i < 5; i++) {
      scheduleData.push({
        orgId, userId: barista.user.id, userName: "Анна Бариста",
        locationId: loc1Id, date: daysOfWeek[i],
        startTime: "08:00", endTime: "16:00", breakMin: 30,
        createdBy: userId, updatedAt: now,
      });
    }
    // Manager works Mon-Sat
    for (let i = 0; i < 6; i++) {
      scheduleData.push({
        orgId, userId: manager.user.id, userName: "Игорь Менеджер",
        locationId: loc1Id, date: daysOfWeek[i],
        startTime: "09:00", endTime: "18:00", breakMin: 60,
        createdBy: userId, updatedAt: now,
      });
    }
    // Trainee works Mon, Wed, Fri
    for (const i of [0, 2, 4]) {
      scheduleData.push({
        orgId, userId: trainee.user.id, userName: "Мария Стажёр",
        locationId: loc1Id, date: daysOfWeek[i],
        startTime: "10:00", endTime: "16:00", breakMin: 30,
        createdBy: userId, updatedAt: now,
      });
    }
    await rawDb.scheduleSlot.createMany({ data: scheduleData });

    // 21. Pay rates
    const monthStart = `${new Date().toISOString().slice(0, 7)}-01`;
    await rawDb.payRate.createMany({
      data: [
        { orgId, userId: barista.user.id, userName: "Анна Бариста", type: "hourly", rate: 350, currency: "RUB", validFrom: monthStart, updatedAt: now },
        { orgId, userId: manager.user.id, userName: "Игорь Менеджер", type: "hourly", rate: 500, currency: "RUB", validFrom: monthStart, updatedAt: now },
        { orgId, userId: trainee.user.id, userName: "Мария Стажёр", type: "hourly", rate: 250, currency: "RUB", validFrom: monthStart, updatedAt: now },
      ],
    });

    // 22. Return credentials for client-side sign-in
    res.json(okResponse({
      user: { id: userId, name: demoName, email: demoEmail },
      credentials: { email: demoEmail, password: demoPassword },
      orgId,
      orgName: "Демо Кофейня",
      message: "Демо-аккаунт создан. Добро пожаловать!",
    }));

    // ── Regulation: Открытие бара (Сокольники) ──
    await rawDb.regulation.create({
      data: {
        orgId,
        locationId: loc1Id,
        name: "Открытие бара",
        type: "opening",
        sections: [
          {
            time: null,
            title: "Доставка еды to go",
            note: "Доставка еды to go и заготовок с склада РЦ только в понедельник, среду, пятницу и воскресенье",
            dayFilter: [1, 3, 5, 0], // пн=1, ср=3, пт=5, вс=0
            tasks: [
              { name: "Позвонить охране ТЦ перед открытием ворот", note: "Рабочий номер охраны: +79685148466 (Родион, в случаях его отсутствия — Азамат)" },
              { name: "Принять поставку от водителя", note: "Водитель приезжает с 9:00 до 10:00, время на приёмку 5-10 минут. В случае неприезда — сообщить в чат" },
            ],
          },
          {
            time: "9:00 – 9:05",
            title: "Включение оборудования",
            tasks: [
              { name: "Фильтр-машина" },
              { name: "Кофемашина" },
              { name: "Гриль" },
              { name: "Включение света витрин и холодильника" },
            ],
          },
          {
            time: "9:00 – 9:05",
            title: "Проверка заготовок и продукции",
            tasks: [
              { name: "Сроки годности" },
              { name: "Внешний вид" },
            ],
          },
          {
            time: "9:05 – 9:10",
            title: "Подготовка инвентаря бара",
            tasks: [
              { name: "Разложить помытые резиновые коврики и питчеры" },
              { name: "Промыть и разложить все замытые с ковизой на ночь инструменты", note: "Холдеры, сетки групп, термосы для фильтра, стурпки микрофибра" },
            ],
          },
          {
            time: "9:05 – 9:10",
            title: "Приготовление первого термоса фильтр-кофе",
            tasks: [
              { name: "Приготовить первый термос фильтр-кофе" },
            ],
          },
          {
            time: "9:10 – 9:20",
            title: "Полное оформление витрин",
            tasks: [
              { name: "Выложить десерты, выпечку и еду to go" },
              { name: "Расставить ценники с соответствием с продукцией" },
              { name: "Сделать фотоотчёт всех витрин кофейни" },
            ],
          },
          {
            time: "9:20 – 9:40",
            title: "Приготовление фреша и нарезка фруктов",
            note: "Срок хранения любого вида фреша, нарезок фруктов и цитрусов, заготовки матчи, заготовки холодного фильтра — 12 часов. Выжимаем утром, списываем и выбрасываем вечером!",
            tasks: [
              { name: "Выжать апельсиновый фреш (2 полные бутылки — 2л)" },
              { name: "Выжать лимонный фреш (100-150мл)" },
              { name: "Нарезать лимон и лайм (по одному цитрусу небольшого размера)" },
            ],
          },
          {
            time: "9:20 – 9:40",
            title: "Заготовка холодного фильтра",
            tasks: [
              { name: "Остудить свежеприготовленный фильтр и перелить в сосудник" },
            ],
          },
          {
            time: "9:20 – 9:40",
            title: "Приготовление второго термоса фильтр-кофе",
            tasks: [
              { name: "Приготовить второй термос фильтр-кофе" },
            ],
          },
          {
            time: "9:40 – 9:50",
            title: "Настройка эспрессо",
            tasks: [
              { name: "Настроить эспрессо" },
            ],
          },
          {
            time: "9:50 – 10:00",
            title: "Открытие кассовой смены",
            tasks: [
              { name: "Открыть смену в Quick Resto" },
              { name: "Пересчитать наличные в кассе" },
              { name: "Проверить работоспособность кассовой системы и интернета" },
            ],
          },
          {
            time: "9:50 – 10:00",
            title: "Ежедневный отчёт об открытии кофейни",
            tasks: [
              { name: "Точная сумма наличных денег в кассе" },
              { name: "Стоп-лист по бару и по кухне" },
              { name: "Температура десертной витрины, холодильника с бутилированной продукцией и витрины to go" },
              { name: "Показатели минерализации воды" },
              { name: "Полное описание эспрессо (зерно, рецепт, вкусовые показатели, описание дискрипторов)" },
              { name: "Полное описание фильтр-кофе (зерно, рецепт, вкусовые показатели, описание дискрипторов)" },
              { name: "Фотографии всех витрин кофейни и зала" },
            ],
          },
          {
            time: "10:00",
            title: "Включение музыки",
            tasks: [
              { name: "Включить плейлист с телефона (на беке, на верхней полке)" },
            ],
          },
        ],
      },
    });

  } catch (err: any) {
    console.error("Demo setup error:", err);
    res.status(500).json(errResponse("DEMO_ERROR", err.message || "Ошибка создания демо"));
  }
});

export default router;
