export type Language = "uz" | "ru" | "en"

export const translations = {
  uz: {
    // Header
    rank: {
      beginner: "Boshlang'ich",
      lazy: "Dangasa",
      weak: "Sust",
      active: "Harakatchan",
      determined: "Irodali",
      disciplined: "Intizomli",
    },
    admin: "Admin",
    logout: "Chiqish",

    // Navigation
    aboutApp: "Ilova haqida",
    rankRules: "Qoidalar",
    plannedHabits: "Rejalashtirilgan",

    // Templates
    templates: "Shablonlar",
    templatesTitle: "Tayyor odatlar",
    templatesSubtitle: "Bir bosish bilan qo'shing",

    // Share card
    shareCardTitle: "Natijangizni ulashing",
    shareCardCopied: "Matn nusxalandi! Istalgan joyga joylashtiring.",
    downloadCard: "Yuklab olish",
    shareCard: "Ulashish",
    streakDays: "kunlik seriya",
    successRate: "muvaffaqiyat",

    // Notifications
    notifications: "Bildirishnomalar",
    notificationTime: "Eslatma vaqti",
    notificationEnable: "Eslatmalarni yoqish",
    notificationDisable: "O'chirish",
    notificationEnabling: "Yoqilmoqda...",
    notificationEnabled: "Har kuni soat {time} da eslatma yuboriladi",
    notificationDenied: "Bildirishnomalar bloklangan. Brauzer sozlamalaridan ruxsat bering.",
    notificationReminderMessage: "{name}, bugun odatlaringizni bajardingizmi? 💪",
    notificationTestMessage: "Eslatmalar yoqildi! Belgilangan vaqtda xabar olasiz.",

    // Streak Freeze
    streakFreeze: "Streak Muzlatish",
    streakFreezeCount: "Muzlatishlar",
    streakFreezeDesc: "Bir kun o'tkazib yuborsangiz streak uzilmaydi",
    streakFreezeEmpty: "Muzlatish yo'q",
    streakFreezeEarned: "Yangi muzlatish olindi! 🧊",
    streakFreezeUsed: "Streak muzlatildi! Seriya saqlanib qoldi 🧊",
    streakFreezeMax: "Maksimum 3 ta muzlatish saqlash mumkin",
    streakFreezeNoFreezes: "Muzlatish mavjud emas",
    frozenDay: "Muzlatilgan kun",
    earnFreeze: "Muzlatish olish",
    useFreeze: "Muzlatishdan foydalanish",
    freezeAvailable: "ta muzlatish mavjud",

    // Stats
    totalHabits: "Jami odatlar",
    completedDays: "Bajarilgan kunlar",
    partialDays: "Qisman bajarilgan",
    skippedDays: "O'tkazib yuborilgan",

    // Buttons
    addNewHabit: "Yangi odat qo'shish",
    addPlannedHabit: "Rejalashtirilgan odat qo'shish",
    noHabitsYet: "Hali odatlar yo'q",
    noHabitsMessage: "Yuqoridagi + tugmasini bosing va birinchi odatingizni qo'shing",
    noPlannedHabits: "Rejalashtirilgan odatlar yo'q",
    noPlannedMessage: "Kelajakda boshlanadigan odatlar bu yerda ko'rinadi",

    // Modal
    addHabit: "Yangi odat qo'shish",
    habitName: "Odat nomi",
    habitNamePlaceholder: "Masalan: Tongda yugurish",
    duration: "Davomiyligi (kunlarda)",
    reminderTime: "Eslatma vaqti (ixtiyoriy)",
    startDate: "Boshlash sanasi va vaqti",
    enableNotifications: "Bildirishnomalarni yoqish",
    addButton: "Qo'shish",
    scheduleButton: "Rejalashtirish",
    habitAdded: "Odat qo'shildi",
    habitAddedSuccess: "odati muvaffaqiyatli qo'shildi!",
    habitDeleted: "Odat o'chirildi",
    habitDeletedSuccess: "Odat muvaffaqiyatli o'chirildi",
    habitScheduled: "Odat rejalashtirildi",
    habitScheduledSuccess: "belgilangan vaqtda boshlanadi",

    // About Modal
    aboutTitle: "JUST Habits haqida",
    aboutPurpose: "Sayt nima uchun?",
    aboutPurposeText:
      "JUST Habits - bu sizning kundalik odatlaringizni kuzatish va rivojlantirishga yordam beradigan ilova. Maqsad - har kuni ozgina yaxshilanish orqali yil davomida katta o'zgarishlarga erishish.",
    whyUseful: "Nega foydali?",
    motivation: "Motivatsiya:",
    motivationText: "Progressni ko'rish sizni davom etishga undaydi",
    accountability: "Hisob-kitob:",
    accountabilityText: "Necha kun davom etganingizni aniq ko'rishingiz mumkin",
    timeManagement: "Vaqtni boshqarish:",
    timeManagementText: "Har kuni vaqtni to'g'ri taqsimlash",
    selfImprovement: "O'z-o'zini takomillashtirish:",
    selfImprovementText: "Har kuni ozgina yaxshilanish",
    howItWorks: "Qanday ishlaydi?",
    step1: "Odat qo'shasiz: Masalan: \"Har kuni 30 daqiqa kitob o'qish\"",
    step2: "Kunlar sonini tanlaysiz: 7, 14, 21, 30 kun",
    step3: "Har kuni katakni bosasiz:",
    completed: "Bajarildi",
    partial: "Yarim",
    skipped: "O'tkazib yuborildi",
    step4: "Progressni ko'rasiz: Necha foiz bajarilganini",
    privacy: "Maxfiylik",
    privacyText:
      "Barcha ma'lumotlar faqat SIZNING brauzeringizda saqlanadi. Serverga yuborilmaydi. Hech kim sizning odatlaringizni ko'rmaydi.",

    // Rules Modal
    rulesTitle: "Daraja Qoidalari",
    rulesIntro:
      "Har bir odat uchun ketma-ket natijalaringizga qarab darajangiz o'zgaradi. Bu sizga motivatsiya beradi va o'z-o'zingizni takomillashtirishga yordam beradi.",
    lazyRule: "Agar ketma-ket 2 kun qizil (o'tkazib yuborildi) bo'lsangiz",
    weakRule: "Agar ketma-ket 2 kun sariq (yarim) bo'lsangiz",
    activeRule: "Agar ketma-ket 5 kun yashil (bajarildi) bo'lsangiz",
    determinedRule: "Agar ketma-ket 10 kun yashil (bajarildi) bo'lsangiz",
    disciplinedRule: "Agar ketma-ket 30 kun yashil (bajarildi) bo'lsangiz",
    tip: "Maslahat",
    tipText:
      "Kichik odatlar bilan boshlang va ketma-ket yashil qatorni uzmaslikka harakat qiling. Har bir kun - yangi imkoniyat!",
    rulesContent: {
      title: "📊 Daraja Qoidalari",
      intro:
        "Har bir odatni bajarganingiz sayin XP yig'iladi.\nXP sizning darajangiz va umumiy reytingingizni belgilaydi.",
      xpRewards: {
        completed: "✅ Bajarildi → +10 XP",
        partial: "🟡 Qisman bajarildi → +5 XP",
        missed: "❌ O'tkazib yuborildi → +0 XP",
      },
      levelUp: {
        title: "🟢 Daraja oshishi",
        consistent: "💪 XP muntazam yig'ilsa → daraja oshadi",
        moreXP: "🔥 Ko'proq XP → yuqoriroq daraja",
        highLevel: "👑 Yuqori daraja → kuchli intizom belgisi",
      },
      ranking: {
        title: "🏆 Rank (boshqalar orasida o'rin)",
        moreXPBetter: "XP ko'p bo'lsa → ranking yuqoriroq",
        canDrop: "Faollik pasaysa → boshqalar o'tib ketishi mumkin",
      },
      importantRule: {
        title: "⚠️ Muhim qoida",
        oncePerDay: "Har bir odat kuniga faqat 1 marta belgilanadi",
        oneXP: "Bir kunda bir odatdan faqat bitta XP olinadi",
      },
      tip: {
        title: "💡 Maslahat",
        message: "Katta natija shart emas —\nbugun +5 XP bo'lsa ham, bu kechagidan yaxshiroq.",
      },
    },

    // Habit Card
    startedOn: "Boshlangan",
    progress: "Progress",
    day: "kun",
    delete: "O'chirish",
    startsIn: "Boshlanishiga",
    daysLeft: "kun qoldi",

    // Pomodoro
    pomodoro: "Pomodoro",
    pomodoroTimer: "Pomodoro Timer",
    minutes: "daqiqa",
    start: "Boshlash",
    pause: "To'xtatish",
    resume: "Davom ettirish",
    reset: "Qayta boshlash",
    pomodorosCompleted: "Bajarilgan pomidorlar",
    history: "Tarix",
    today: "Bugun",
    didNotWork: "Ishlamadingiz",
    tomatoCompleted: "ta pomidor bajarildi",
    setTimer: "Timerni sozlash",
    customTime: "Maxsus vaqt",

    // XP & Level System
    xp: "XP",
    level: "Daraja",
    rank: "Reyting",
    totalXP: "Jami XP",
    weeklyXP: "Haftalik XP",
    monthlyXP: "Oylik XP",
    leaderboard: "Liderlar ro'yxati",
    globalRank: "Global reyting",
    yourRank: "Sizning reytingingiz",

    // Level names
    levelBeginner: "Boshlang'ich",
    levelDiscipline: "Intizomli",
    levelAtomicMan: "Atom Odam",
    levelIronMind: "Temir Aql",
    levelElite: "Elita",

    // Rank titles
    rankLegend: "Afsonaviy",
    rankElite: "Elita",
    rankMaster: "Usta",
    rankWarrior: "Jangchi",
    rankChallenger: "Da'vogar",

    // Habit Why field
    whyField: "Nima uchun aynan shu odatni boshlaymoqchisiz?",
    whyPlaceholder: "Sababingizni yozing...",
    whyHint: "Bu sizga maqsadga yetishda yordam beradi",
    habitWhy: "Nega bu odat muhim?",
    habitWhyPlaceholder: "Masalan: Men sog'lom bo'lishim kerak...",
    whyImportant: "Nega muhim",

    // Miss reasons
    missReason: "O'tkazib yuborish sababi",
    reasonForgot: "Unutdim",
    reasonNoTime: "Vaqt yo'q edi",
    reasonLowMotivation: "Motivatsiya past",
    reasonHealth: "Salomatlik",
    reasonMentalOverload: "Aqliy charchoq",
    reasonCustom: "Boshqa sabab",
    customReasonPlaceholder: "Sababni yozing...",

    missReasons: {
      forgot: "Unutib qoldim",
      busy: "Band edim",
      tired: "Charchadim",
      sick: "Kasal edim",
      noMood: "Kayfiyatim yo'q edi",
      other: "Boshqa sabab",
    },

    // Miss reasons (legacy support)
    whySkip: "Nima uchun o'tkazib yubordingiz?",
    skipReason: "O'tkazib yuborish sababi",
    writeReason: "Sababni yozing...",
    cancel: "Bekor qilish",
    confirm: "Tasdiqlash",
    close: "Yopish",
    whyDoingThis: "Nima uchun bu odatni boshlaymoqchisiz?",

    // Community
    community: "Jamoat",
    communityPage: "Community sahifasi",
    newPost: "Yangi post",
    pinnedPost: "Pinlangan post",
    writeComment: "Fikringizni bildiring...",
    addComment: "Fikr qo'shish",
    commentAdded: "Fikr qo'shildi",
    commentDeleted: "Fikr o'chirildi",
    postTitle: "Sarlavha",
    postContent: "Matn",
    postImage: "Rasm URL",
    postLink: "Havola URL",
    createPost: "Post yaratish",
    pinPost: "PIN qilish",
    unpinPost: "PIN dan olish",
    deletePost: "Post o'chirish",
    noPosts: "Hali postlar yo'q",
    spam: "Spam!",
    tooManyComments: "Juda ko'p fikr. Iltimos biroz kuting.",
    justNow: "Hozir",
    minutesAgo: "daqiqa oldin",
    hoursAgo: "soat oldin",
    daysAgo: "kun oldin",
    statistics: "Statistika",
  },
  ru: {
    // Header
    rank: {
      beginner: "Новичок",
      lazy: "Ленивый",
      weak: "Слабый",
      active: "Активный",
      determined: "Решительный",
      disciplined: "Дисциплинированный",
    },
    admin: "Админ",
    logout: "Выйти",

    // Navigation
    aboutApp: "О приложении",
    rankRules: "Правила",
    plannedHabits: "Запланированные",

    // Templates
    templates: "Шаблоны",
    templatesTitle: "Готовые привычки",
    templatesSubtitle: "Добавьте одним нажатием",

    // Share card
    shareCardTitle: "Поделитесь результатами",
    shareCardCopied: "Текст скопирован! Вставьте куда угодно.",
    downloadCard: "Скачать",
    shareCard: "Поделиться",
    streakDays: "дней серия",
    successRate: "успех",

    // Notifications
    notifications: "Уведомления",
    notificationTime: "Время напоминания",
    notificationEnable: "Включить напоминания",
    notificationDisable: "Отключить",
    notificationEnabling: "Включение...",
    notificationEnabled: "Каждый день в {time} будет напоминание",
    notificationDenied: "Уведомления заблокированы. Разрешите в настройках браузера.",
    notificationReminderMessage: "{name}, вы выполнили привычки сегодня? 💪",
    notificationTestMessage: "Напоминания включены! Вы получите уведомление в указанное время.",

    // Streak Freeze
    streakFreeze: "Заморозка серии",
    streakFreezeCount: "Заморозки",
    streakFreezeDesc: "Если пропустите день, серия не прервётся",
    streakFreezeEmpty: "Нет заморозок",
    streakFreezeEarned: "Получена новая заморозка! 🧊",
    streakFreezeUsed: "Серия заморожена! Серия сохранена 🧊",
    streakFreezeMax: "Можно хранить максимум 3 заморозки",
    streakFreezeNoFreezes: "Нет доступных заморозок",
    frozenDay: "Замороженный день",
    earnFreeze: "Получить заморозку",
    useFreeze: "Использовать заморозку",
    freezeAvailable: "заморозок доступно",

    // Stats
    totalHabits: "Всего привычек",
    completedDays: "Выполнено дней",
    partialDays: "Частично",
    skippedDays: "Пропущено дней",

    // Buttons
    addNewHabit: "Добавить новую привычку",
    addPlannedHabit: "Добавить запланированную привычку",
    noHabitsYet: "Пока нет привычек",
    noHabitsMessage: "Нажмите кнопку + выше и добавьте свою первую привычку",
    noPlannedHabits: "Нет запланированных привычек",
    noPlannedMessage: "Привычки, которые начнутся в будущем, будут отображаться здесь",

    // Modal
    addHabit: "Добавить новую привычку",
    habitName: "Название привычки",
    habitNamePlaceholder: "Например: Утренняя пробежка",
    duration: "Продолжительность (в днях)",
    reminderTime: "Время напоминания (опционально)",
    startDate: "Дата и время начала",
    enableNotifications: "Включить уведомления",
    addButton: "Добавить",
    scheduleButton: "Запланировать",
    habitAdded: "Привычка добавлена",
    habitAddedSuccess: "успешно добавлена!",
    habitDeleted: "Привычка удалена",
    habitDeletedSuccess: "Привычка успешно удалена",
    habitScheduled: "Привычка запланирована",
    habitScheduledSuccess: "начнется в указанное время",

    // About Modal
    aboutTitle: "О JUST Habits",
    aboutPurpose: "Для чего сайт?",
    aboutPurposeText:
      "JUST Habits - это приложение, которое помогает отслеживать и развивать ваши ежедневные привычки. Цель - достичь больших изменений в течение года через небольшие ежедневные улучшения.",
    whyUseful: "Почему полезно?",
    motivation: "Мотивация:",
    motivationText: "Видеть прогресс мотивирует продолжать",
    accountability: "Подотчетность:",
    accountabilityText: "Вы точно видите, сколько дней продолжаете",
    timeManagement: "Управление временем:",
    timeManagementText: "Правильное распределение времени каждый день",
    selfImprovement: "Самосовершенствование:",
    selfImprovementText: "Небольшое улучшение каждый день",
    howItWorks: "Как это работает?",
    step1: 'Добавляете привычку: Например: "Читать 30 минут каждый день"',
    step2: "Выбираете количество дней: 7, 14, 21, 30 дней",
    step3: "Каждый день нажимаете на ячейку:",
    completed: "Выполнено",
    partial: "Половина",
    skipped: "Пропущено",
    step4: "Смотрите прогресс: Сколько процентов выполнено",
    privacy: "Конфиденциальность",
    privacyText:
      "Все данные хранятся только в ВАШЕМ браузере. Они не отправляются на сервер. Никто не видит ваши привычки.",

    // Rules Modal
    rulesTitle: "Правила ранга",
    rulesIntro: "Ваш ранг меняется в зависимости от результатов для каждой привычки.",
    lazyRule: "2 дня подряд красный (пропущено)",
    weakRule: "2 дня подряд желтый (половина)",
    activeRule: "5 дней подряд зеленый (выполнено)",
    determinedRule: "10 дней подряд зеленый (выполнено)",
    disciplinedRule: "30 дней подряд зеленый (выполнено)",
    tip: "Совет",
    tipText: "Начните с небольших привычек и старайтесь не прерывать зеленую серию!",
    rulesContent: {
      title: "📊 Правила уровней",
      intro: "Каждое выполнение привычки приносит XP.\nXP определяет ваш уровень и общий рейтинг.",
      xpRewards: {
        completed: "✅ Выполнено → +10 XP",
        partial: "🟡 Частично выполнено → +5 XP",
        missed: "❌ Пропущено → +0 XP",
      },
      levelUp: {
        title: "🟢 Повышение уровня",
        consistent: "💪 Регулярный XP → повышение уровня",
        moreXP: "🔥 Больше XP → выше уровень",
        highLevel: "👑 Высокий уровень → знак сильной дисциплины",
      },
      ranking: {
        title: "🏆 Ранг (позиция среди других)",
        moreXPBetter: "Больше XP → выше в рейтинге",
        canDrop: "Снижение активности → другие могут обогнать",
      },
      importantRule: {
        title: "⚠️ Важное правило",
        oncePerDay: "Каждая привычка отмечается только 1 раз в день",
        oneXP: "За один день от одной привычки получается только один XP",
      },
      tip: {
        title: "💡 Совет",
        message: "Большой результат не обязателен —\nдаже +5 XP сегодня лучше, чем вчера.",
      },
    },

    // Habit Card
    startedOn: "Начато",
    progress: "Прогресс",
    day: "день",
    delete: "Удалить",
    startsIn: "Через",
    daysLeft: "дн.",

    // Pomodoro
    pomodoro: "Помидоро",
    pomodoroTimer: "Таймер Помодоро",
    minutes: "минут",
    start: "Начать",
    pause: "Пауза",
    resume: "Продолжить",
    reset: "Сброс",
    pomodorosCompleted: "Помодоро завершено",
    history: "История",
    today: "Сегодня",
    didNotWork: "Не работали",
    tomatoCompleted: "помодоро",
    setTimer: "Установить таймер",
    customTime: "Свое время",

    // XP & Level System
    xp: "Опыт",
    level: "Уровень",
    rank: "Рейтинг",
    totalXP: "Всего опыта",
    weeklyXP: "Недельный опыт",
    monthlyXP: "Месячный опыт",
    leaderboard: "Таблица лидеров",
    globalRank: "Глобальный рейтинг",
    yourRank: "Ваш рейтинг",

    // Level names
    levelBeginner: "Новичок",
    levelDiscipline: "Дисциплина",
    levelAtomicMan: "Атомный человек",
    levelIronMind: "Железный разум",
    levelElite: "Элита",

    // Rank titles
    rankLegend: "Легенда",
    rankElite: "Элита",
    rankMaster: "Мастер",
    rankWarrior: "Воин",
    rankChallenger: "Претендент",

    // Habit Why field
    whyField: "Почему вы хотите начать именно эту привычку?",
    whyPlaceholder: "Напишите причину...",
    whyHint: "Это поможет вам достичь цели",
    habitWhy: "Почему эта привычка важна?",
    habitWhyPlaceholder: "Например: Мне нужно быть здоровым...",
    whyImportant: "Почему важно",

    missReasons: {
      forgot: "Забыл",
      busy: "Был занят",
      tired: "Устал",
      sick: "Болел",
      noMood: "Не было настроения",
      other: "Другая причина",
    },

    // Miss reasons (legacy support)
    missReason: "Причина пропуска",
    whySkip: "Почему пропустили?",
    skipReason: "Причина пропуска",
    writeReason: "Напишите причину...",
    cancel: "Отмена",
    confirm: "Подтвердить",
    close: "Закрыть",
    whyDoingThis: "Почему вы начинаете эту привычку?",

    // Community
    community: "Сообщество",
    communityPage: "Страница Community",
    newPost: "Новый пост",
    pinnedPost: "Закрепленный пост",
    writeComment: "Ваше мнение...",
    addComment: "Добавить комментарий",
    commentAdded: "Комментарий добавлен",
    commentDeleted: "Комментарий удален",
    postTitle: "Заголовок",
    postContent: "Текст",
    postImage: "URL изображения",
    postLink: "URL ссылки",
    createPost: "Создать пост",
    pinPost: "Закрепить",
    unpinPost: "Открепить",
    deletePost: "Удалить пост",
    noPosts: "Пока нет постов",
    spam: "Спам!",
    tooManyComments: "Слишком много комментариев. Подождите.",
    justNow: "Только что",
    minutesAgo: "мин. назад",
    hoursAgo: "ч. назад",
    daysAgo: "д. назад",
    statistics: "Статистика",
  },
  en: {
    // Header
    rank: {
      beginner: "Beginner",
      lazy: "Lazy",
      weak: "Weak",
      active: "Active",
      determined: "Determined",
      disciplined: "Disciplined",
    },
    admin: "Admin",
    logout: "Logout",

    // Navigation
    aboutApp: "About App",
    rankRules: "Rules",
    plannedHabits: "Planned",

    // Stats
    totalHabits: "Total Habits",
    completedDays: "Completed Days",
    partialDays: "Partially Done",
    skippedDays: "Skipped Days",

    // Buttons
    addNewHabit: "Add New Habit",
    addPlannedHabit: "Add Planned Habit",
    noHabitsYet: "No habits yet",
    noHabitsMessage: "Click the + button above and add your first habit",
    noPlannedHabits: "No planned habits",
    noPlannedMessage: "Habits that will start in the future will appear here",

    // Modal
    addHabit: "Add New Habit",
    habitName: "Habit Name",
    habitNamePlaceholder: "For example: Morning run",
    duration: "Duration (in days)",
    reminderTime: "Reminder Time (optional)",
    startDate: "Start Date and Time",
    enableNotifications: "Enable Notifications",
    addButton: "Add",
    scheduleButton: "Schedule",
    habitAdded: "Habit Added",
    habitAddedSuccess: "added successfully!",
    habitDeleted: "Habit Deleted",
    habitDeletedSuccess: "Habit deleted successfully",
    habitScheduled: "Habit Scheduled",
    habitScheduledSuccess: "will start at the specified time",

    // About Modal
    aboutTitle: "About JUST Habits",
    aboutPurpose: "What is the site for?",
    aboutPurposeText:
      "JUST Habits is an app that helps you track and develop your daily habits. The goal is to achieve big changes over the year through small daily improvements.",
    whyUseful: "Why is it useful?",
    motivation: "Motivation:",
    motivationText: "Seeing progress motivates you to continue",
    accountability: "Accountability:",
    accountabilityText: "You can see exactly how many days you've continued",
    timeManagement: "Time Management:",
    timeManagementText: "Properly distribute time each day",
    selfImprovement: "Self-Improvement:",
    selfImprovementText: "Small improvement every day",
    howItWorks: "How does it work?",
    step1: 'Add a habit: For example: "Read 30 minutes every day"',
    step2: "Choose number of days: 7, 14, 21, 30 days",
    step3: "Click on the cell each day:",
    completed: "Completed",
    partial: "Partial",
    skipped: "Skipped",
    step4: "See progress: What percentage is completed",
    privacy: "Privacy",
    privacyText: "All data is stored only in YOUR browser. Not sent to the server. No one sees your habits.",

    // Rules Modal
    rulesTitle: "Rank Rules",
    rulesIntro:
      "Your rank changes based on consecutive results for each habit. This motivates you and helps you improve yourself.",
    lazyRule: "If 2 consecutive days red (skipped)",
    weakRule: "If 2 consecutive days yellow (partial)",
    activeRule: "If 5 consecutive days green (completed)",
    determinedRule: "If 10 consecutive days green (completed)",
    disciplinedRule: "If 30 consecutive days green (completed)",
    tip: "Tip",
    tipText: "Start with small habits and try not to break the green streak. Every day is a new opportunity!",
    rulesContent: {
      title: "📊 Level Rules",
      intro: "Every habit completion earns XP.\nXP determines your level and overall rating.",
      xpRewards: {
        completed: "✅ Completed → +10 XP",
        partial: "🟡 Partial → +5 XP",
        missed: "❌ Missed → +0 XP",
      },
      levelUp: {
        title: "🟢 Level Up",
        consistent: "💪 Regular XP → level increases",
        moreXP: "🔥 More XP → higher level",
        highLevel: "👑 High level → sign of strong discipline",
      },
      ranking: {
        title: "🏆 Rank (position among others)",
        moreXPBetter: "More XP → higher ranking",
        canDrop: "Decreased activity → others may overtake",
      },
      importantRule: {
        title: "⚠️ Important rule",
        oncePerDay: "Each habit is marked only 1 time per day",
        oneXP: "One habit in one day gives only one XP",
      },
      tip: {
        title: "💡 Tip",
        message: "Big result not required —\neven +5 XP today is better than yesterday.",
      },
    },

    // Habit Card
    startedOn: "Started on",
    progress: "Progress",
    day: "day",
    delete: "Delete",
    startsIn: "Starts in",
    daysLeft: "days left",

    // Pomodoro
    pomodoro: "Pomodoro",
    pomodoroTimer: "Pomodoro Timer",
    minutes: "minutes",
    start: "Start",
    pause: "Pause",
    resume: "Resume",
    reset: "Reset",
    pomodorosCompleted: "Pomodoros Completed",
    history: "History",
    today: "Today",
    didNotWork: "Did not work",
    tomatoCompleted: "pomodoros completed",
    setTimer: "Set Timer",
    customTime: "Custom Time",

    // XP & Level System
    xp: "XP",
    level: "Level",
    rank: "Rank",
    totalXP: "Total XP",
    weeklyXP: "Weekly XP",
    monthlyXP: "Monthly XP",
    leaderboard: "Leaderboard",
    globalRank: "Global Rank",
    yourRank: "Your Rank",

    // Level names
    levelBeginner: "Beginner",
    levelDiscipline: "Discipline",
    levelAtomicMan: "Atomic Man",
    levelIronMind: "Iron Mind",
    levelElite: "Elite",

    // Rank titles
    rankLegend: "Legend",
    rankElite: "Elite",
    rankMaster: "Master",
    rankWarrior: "Warrior",
    rankChallenger: "Challenger",

    // Habit Why field
    whyField: "Why do you want to start this habit?",
    whyPlaceholder: "Write your reason...",
    whyHint: "This will help you achieve your goal",
    habitWhy: "Why is this habit important?",
    habitWhyPlaceholder: "For example: I need to be healthy...",
    whyImportant: "Why important",

    missReasons: {
      forgot: "Forgot",
      busy: "Was busy",
      tired: "Tired",
      sick: "Was sick",
      noMood: "No mood",
      other: "Other reason",
    },

    // Miss reasons (legacy support)
    missReason: "Miss reason",
    whySkip: "Why skip?",
    skipReason: "Skip reason",
    writeReason: "Write reason...",
    cancel: "Cancel",
    confirm: "Confirm",
    close: "Close",
    whyDoingThis: "Why are you starting this habit?",

    // Community
    community: "Community",
    communityPage: "Community Page",
    newPost: "New Post",
    pinnedPost: "Pinned Post",
    writeComment: "Your comment...",
    addComment: "Add Comment",
    commentAdded: "Comment added",
    commentDeleted: "Comment deleted",
    postTitle: "Title",
    postContent: "Content",
    postImage: "Image URL",
    postLink: "Link URL",
    createPost: "Create Post",
    pinPost: "Pin",
    unpinPost: "Unpin",
    deletePost: "Delete Post",
    noPosts: "No posts yet",
    spam: "Spam!",
    tooManyComments: "Too many comments. Please wait.",
    justNow: "Just now",
    minutesAgo: "min ago",
    hoursAgo: "h ago",
    daysAgo: "d ago",
    statistics: "Statistics",
  },
}
