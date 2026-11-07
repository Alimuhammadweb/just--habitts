-- Faqat QO'SHISH: mavjud jadvallar va ma'lumotlarga (User, PomodoroSession va h.k.) tegmaydi.

-- CreateTable
CREATE TABLE "PomodoroSettings" (
    "userId" BIGINT NOT NULL,
    "focusMin" INTEGER NOT NULL DEFAULT 25,
    "shortBreakMin" INTEGER NOT NULL DEFAULT 5,
    "longBreakMin" INTEGER NOT NULL DEFAULT 15,
    "longBreakEvery" INTEGER NOT NULL DEFAULT 4,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PomodoroSettings_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "PomodoroRun" (
    "id" TEXT NOT NULL,
    "userId" BIGINT NOT NULL,
    "mode" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "plannedSeconds" INTEGER NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "resumedAt" TIMESTAMP(3),
    "pausedAt" TIMESTAMP(3),
    "elapsedMs" INTEGER NOT NULL DEFAULT 0,
    "endedAt" TIMESTAMP(3),
    "credited" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PomodoroRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PomodoroRun_userId_status_idx" ON "PomodoroRun"("userId", "status");

-- CreateIndex
CREATE INDEX "PomodoroRun_userId_endedAt_idx" ON "PomodoroRun"("userId", "endedAt" DESC);

-- AddForeignKey
ALTER TABLE "PomodoroSettings" ADD CONSTRAINT "PomodoroSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PomodoroRun" ADD CONSTRAINT "PomodoroRun_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
