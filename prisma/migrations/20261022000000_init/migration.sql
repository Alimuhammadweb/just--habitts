-- CreateTable
CREATE TABLE "User" (
    "id" BIGINT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "salt" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "timezone" TEXT,
    "avatarUrl" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "publicProfile" BOOLEAN NOT NULL DEFAULT false,
    "selectedTheme" TEXT,
    "selectedBadge" TEXT,
    "selectedBorder" TEXT,
    "selectedFrame" TEXT,
    "selectedBackground" TEXT,
    "statsTotalHabits" INTEGER NOT NULL DEFAULT 0,
    "statsCompletedDays" INTEGER NOT NULL DEFAULT 0,
    "statsCurrentStreak" INTEGER NOT NULL DEFAULT 0,
    "statsLongestStreak" INTEGER NOT NULL DEFAULT 0,
    "totalXP" INTEGER NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL DEFAULT 1,
    "rank" INTEGER,
    "weeklyXP" INTEGER NOT NULL DEFAULT 0,
    "monthlyXP" INTEGER NOT NULL DEFAULT 0,
    "weekKey" TEXT,
    "currentXP" INTEGER NOT NULL DEFAULT 0,
    "xpLastUpdated" BIGINT NOT NULL DEFAULT 0,
    "streakFreezes" INTEGER NOT NULL DEFAULT 1,
    "totalFreezesUsed" INTEGER NOT NULL DEFAULT 0,
    "lastFreezeEarned" BIGINT,
    "pomodoroTotal" INTEGER NOT NULL DEFAULT 0,
    "unlockedAvatars" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "unlockedThemes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "unlockedBadges" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "unlockedBorders" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "unlockedFrames" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "unlockedBackgrounds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "completedTasks" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "completedChallenges" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "challengeRewards" JSONB NOT NULL DEFAULT '[]',
    "plannedHabits" JSONB NOT NULL DEFAULT '[]',
    "rev" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Habit" (
    "id" BIGINT NOT NULL,
    "userId" BIGINT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "name" TEXT NOT NULL,
    "duration" INTEGER NOT NULL,
    "timeHour" INTEGER,
    "timeMinute" INTEGER,
    "notifications" BOOLEAN NOT NULL DEFAULT false,
    "startDay" INTEGER NOT NULL,
    "startMonth" INTEGER NOT NULL,
    "startYear" INTEGER NOT NULL,
    "startTimestamp" BIGINT NOT NULL,
    "scheduledStartTime" BIGINT,
    "why" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "Habit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HabitDay" (
    "habitId" BIGINT NOT NULL,
    "dayIndex" INTEGER NOT NULL,
    "status" TEXT,
    "lockStatus" TEXT,
    "markedAt" BIGINT,
    "dateString" TEXT,
    "xpAwarded" INTEGER,
    "locked" BOOLEAN,
    "missReason" TEXT,

    CONSTRAINT "HabitDay_pkey" PRIMARY KEY ("habitId","dayIndex")
);

-- CreateTable
CREATE TABLE "XpHistory" (
    "id" SERIAL NOT NULL,
    "userId" BIGINT NOT NULL,
    "date" TEXT NOT NULL,
    "xpEarned" INTEGER NOT NULL,
    "habitId" BIGINT NOT NULL,
    "dayIndex" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "timestamp" BIGINT NOT NULL,

    CONSTRAINT "XpHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PomodoroSession" (
    "pk" SERIAL NOT NULL,
    "userId" BIGINT NOT NULL,
    "sessionId" BIGINT NOT NULL,
    "date" TEXT NOT NULL,
    "count" INTEGER NOT NULL,

    CONSTRAINT "PomodoroSession_pkey" PRIMARY KEY ("pk")
);

-- CreateTable
CREATE TABLE "ActiveChallenge" (
    "pk" SERIAL NOT NULL,
    "userId" BIGINT NOT NULL,
    "challengeId" INTEGER NOT NULL,
    "startedAt" BIGINT NOT NULL,
    "completedDays" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" BIGINT,
    "startDateKey" TEXT,
    "endDateKey" TEXT,
    "attempt" INTEGER,

    CONSTRAINT "ActiveChallenge_pkey" PRIMARY KEY ("pk")
);

-- CreateTable
CREATE TABLE "Friendship" (
    "userId" BIGINT NOT NULL,
    "friendId" BIGINT NOT NULL,

    CONSTRAINT "Friendship_pkey" PRIMARY KEY ("userId","friendId")
);

-- CreateTable
CREATE TABLE "FriendRequest" (
    "fromId" BIGINT NOT NULL,
    "toId" BIGINT NOT NULL,

    CONSTRAINT "FriendRequest_pkey" PRIMARY KEY ("fromId","toId")
);

-- CreateTable
CREATE TABLE "WeeklyTask" (
    "id" TEXT NOT NULL,
    "userId" BIGINT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "date" TEXT NOT NULL,
    "time" TEXT,
    "durationMin" INTEGER,
    "category" TEXT NOT NULL,
    "priority" TEXT NOT NULL,
    "reminderMin" INTEGER,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeeklyTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunityPost" (
    "id" BIGINT NOT NULL,
    "userId" BIGINT NOT NULL,
    "userName" TEXT NOT NULL,
    "userAvatar" TEXT NOT NULL DEFAULT '',
    "title" TEXT NOT NULL DEFAULT '',
    "content" TEXT NOT NULL,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "isAdminPost" BOOLEAN NOT NULL DEFAULT false,
    "imageUrl" TEXT NOT NULL DEFAULT '',
    "linkUrl" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunityPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comment" (
    "id" BIGINT NOT NULL,
    "postId" BIGINT NOT NULL,
    "userId" BIGINT NOT NULL,
    "userName" TEXT NOT NULL,
    "userAvatar" TEXT NOT NULL DEFAULT '',
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reaction" (
    "id" BIGINT NOT NULL,
    "postId" BIGINT NOT NULL,
    "userId" BIGINT NOT NULL,
    "type" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Reaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "jti" TEXT NOT NULL,
    "userId" BIGINT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revoked" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("jti")
);

-- CreateTable
CREATE TABLE "PasswordReset" (
    "id" SERIAL NOT NULL,
    "userId" BIGINT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PasswordReset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimit" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_totalXP_createdAt_id_idx" ON "User"("totalXP" DESC, "createdAt", "id");

-- CreateIndex
CREATE INDEX "User_weekKey_weeklyXP_idx" ON "User"("weekKey", "weeklyXP" DESC);

-- CreateIndex
CREATE INDEX "Habit_userId_position_idx" ON "Habit"("userId", "position");

-- CreateIndex
CREATE INDEX "XpHistory_userId_id_idx" ON "XpHistory"("userId", "id");

-- CreateIndex
CREATE INDEX "PomodoroSession_userId_date_idx" ON "PomodoroSession"("userId", "date");

-- CreateIndex
CREATE INDEX "ActiveChallenge_userId_idx" ON "ActiveChallenge"("userId");

-- CreateIndex
CREATE INDEX "Friendship_friendId_idx" ON "Friendship"("friendId");

-- CreateIndex
CREATE INDEX "FriendRequest_toId_idx" ON "FriendRequest"("toId");

-- CreateIndex
CREATE INDEX "WeeklyTask_userId_date_time_idx" ON "WeeklyTask"("userId", "date", "time");

-- CreateIndex
CREATE INDEX "WeeklyTask_userId_completed_date_idx" ON "WeeklyTask"("userId", "completed", "date");

-- CreateIndex
CREATE INDEX "CommunityPost_isPinned_createdAt_idx" ON "CommunityPost"("isPinned" DESC, "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Comment_postId_createdAt_idx" ON "Comment"("postId", "createdAt");

-- CreateIndex
CREATE INDEX "Comment_userId_createdAt_idx" ON "Comment"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Reaction_postId_userId_key" ON "Reaction"("postId", "userId");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- CreateIndex
CREATE INDEX "RefreshToken_expiresAt_idx" ON "RefreshToken"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordReset_tokenHash_key" ON "PasswordReset"("tokenHash");

-- CreateIndex
CREATE INDEX "PasswordReset_userId_idx" ON "PasswordReset"("userId");

-- CreateIndex
CREATE INDEX "RateLimit_expiresAt_idx" ON "RateLimit"("expiresAt");

-- AddForeignKey
ALTER TABLE "Habit" ADD CONSTRAINT "Habit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HabitDay" ADD CONSTRAINT "HabitDay_habitId_fkey" FOREIGN KEY ("habitId") REFERENCES "Habit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "XpHistory" ADD CONSTRAINT "XpHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PomodoroSession" ADD CONSTRAINT "PomodoroSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActiveChallenge" ADD CONSTRAINT "ActiveChallenge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Friendship" ADD CONSTRAINT "Friendship_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Friendship" ADD CONSTRAINT "Friendship_friendId_fkey" FOREIGN KEY ("friendId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FriendRequest" ADD CONSTRAINT "FriendRequest_fromId_fkey" FOREIGN KEY ("fromId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FriendRequest" ADD CONSTRAINT "FriendRequest_toId_fkey" FOREIGN KEY ("toId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyTask" ADD CONSTRAINT "WeeklyTask_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "CommunityPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reaction" ADD CONSTRAINT "Reaction_postId_fkey" FOREIGN KEY ("postId") REFERENCES "CommunityPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordReset" ADD CONSTRAINT "PasswordReset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
