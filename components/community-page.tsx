"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  ArrowLeft, Pin, Heart, MessageCircle, Trash2, Send, Plus, X,
  Sparkles, Image as ImageIcon, Link as LinkIcon, AlertCircle, RefreshCw
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import type { User } from "@/types/user"
import type { CommunityPost, Comment } from "@/types/community"
import type { Language } from "@/lib/translations"
import { translations } from "@/lib/translations"

interface CommunityPageProps {
  language: Language
  currentUser: User
  onBack: () => void
}

// ─── Avatar helper ─────────────────────────────────────────────────────────
function UserAvatar({
  name,
  avatarUrl,
  size = "md",
  gradient = "from-blue-500 to-cyan-500",
}: {
  name: string
  avatarUrl?: string
  size?: "sm" | "md" | "lg"
  gradient?: string
}) {
  const dim =
    size === "sm" ? "w-8 h-8 text-xs" : size === "lg" ? "w-12 h-12 text-base" : "w-10 h-10 text-sm"
  const initials = (name || "?")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .substring(0, 2)

  if (avatarUrl && (avatarUrl.startsWith("http") || avatarUrl.startsWith("/"))) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={avatarUrl} alt={name} className={`${dim} rounded-full object-cover shrink-0`} />
    )
  }
  return (
    <div
      className={`${dim} rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center font-bold text-white shrink-0`}
    >
      {initials}
    </div>
  )
}

// ─── Relative time ─────────────────────────────────────────────────────────
function relativeTime(dateString: string, language: Language) {
  const date = new Date(dateString)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (minutes < 1) return language === "uz" ? "Hozir" : language === "ru" ? "Только что" : "Just now"
  if (minutes < 60)
    return `${minutes} ${language === "uz" ? "daq. oldin" : language === "ru" ? "мин. назад" : "min ago"}`
  if (hours < 24)
    return `${hours} ${language === "uz" ? "soat oldin" : language === "ru" ? "ч. назад" : "h ago"}`
  if (days < 7)
    return `${days} ${language === "uz" ? "kun oldin" : language === "ru" ? "д. назад" : "d ago"}`
  return date.toLocaleDateString(
    language === "uz" ? "uz-UZ" : language === "ru" ? "ru-RU" : "en-US"
  )
}

// ─── Comment row ────────────────────────────────────────────────────────────
function CommentRow({
  comment,
  currentUser,
  language,
  onDelete,
}: {
  comment: Comment
  currentUser: User
  language: Language
  onDelete: () => void
}) {
  const time = relativeTime(comment.createdAt, language)
  const canDelete = comment.userId === currentUser.id || currentUser.isAdmin
  return (
    <div className="flex gap-2 items-start group">
      <UserAvatar
        name={comment.userName}
        avatarUrl={comment.userAvatar}
        size="sm"
        gradient="from-blue-500 to-cyan-400"
      />
      <div className="flex-1 bg-muted/60 rounded-2xl px-3 py-2 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <span className="text-xs font-semibold truncate">{comment.userName}</span>
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-[10px] text-muted-foreground">{time}</span>
            {canDelete && (
              <button
                onClick={onDelete}
                className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-red-500"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
        <p className="text-sm leading-relaxed">{comment.content}</p>
      </div>
    </div>
  )
}

// ─── Post card ──────────────────────────────────────────────────────────────
function PostCard({
  post,
  currentUser,
  language,
  commentInput,
  onCommentChange,
  onAddComment,
  onDeleteComment,
  onDeletePost,
  onToggleReaction,
}: {
  post: CommunityPost
  currentUser: User
  language: Language
  commentInput: string
  onCommentChange: (v: string) => void
  onAddComment: () => void
  onDeleteComment: (commentId: number) => void
  onDeletePost: () => void
  onToggleReaction: () => void
}) {
  const [showAll, setShowAll] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const time = relativeTime(post.createdAt, language)
  const hasLiked = post.reactions?.some((r) => r.userId === currentUser.id)
  const likesCount = post.reactions?.length || 0
  const commentsCount = post.comments?.length || 0
  const visibleComments = showAll ? post.comments : (post.comments || []).slice(-3)
  const ph =
    language === "uz"
      ? "Fikringizni bildiring..."
      : language === "ru"
        ? "Ваш комментарий..."
        : "Write a comment..."

  return (
    <Card
      className={`overflow-hidden transition-shadow hover:shadow-lg ${
        post.isPinned
          ? "border-2 border-purple-500/60 bg-gradient-to-b from-purple-500/5 to-transparent"
          : "border border-border"
      }`}
    >
      {/* Header */}
      <div className="flex items-start gap-3 p-4 pb-3">
        <UserAvatar
          name={post.adminName}
          avatarUrl={post.adminAvatar}
          gradient="from-purple-500 to-pink-500"
        />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
            <span className="font-semibold text-sm">{post.adminName}</span>
            {post.isAdminPost && (
              <span className="px-1.5 py-0.5 bg-blue-500 text-white text-[10px] rounded-full font-medium">
                Admin
              </span>
            )}
            {post.isPinned && (
              <span className="px-1.5 py-0.5 bg-purple-500 text-white text-[10px] rounded-full flex items-center gap-0.5">
                <Pin className="h-2.5 w-2.5" /> PIN
              </span>
            )}
          </div>
          <span className="text-xs text-muted-foreground">{time}</span>
        </div>
        {currentUser.isAdmin && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-red-500 shrink-0"
            onClick={onDeletePost}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {/* Body */}
      <div className="px-4 pb-3">
        {post.title && <h3 className="text-base font-bold mb-2">{post.title}</h3>}
        <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">{post.content}</p>
        {post.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={post.imageUrl}
            alt=""
            className="mt-3 rounded-xl max-h-80 w-full object-cover border border-border"
          />
        )}
        {post.linkUrl && (
          <a
            href={post.linkUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 flex items-center gap-1.5 text-xs text-blue-400 hover:underline truncate"
          >
            <LinkIcon className="h-3 w-3 shrink-0" />
            {post.linkUrl}
          </a>
        )}
      </div>

      {/* Reactions bar */}
      <div className="flex items-center gap-4 px-4 py-2 border-t border-border/50">
        <button
          onClick={onToggleReaction}
          className={`flex items-center gap-1.5 text-sm transition-all hover:scale-110 active:scale-95 ${
            hasLiked ? "text-red-500" : "text-muted-foreground hover:text-red-400"
          }`}
        >
          <Heart className={`h-4 w-4 ${hasLiked ? "fill-red-500" : ""}`} />
          <span className="font-medium">{likesCount}</span>
        </button>
        <button
          onClick={() => textareaRef.current?.focus()}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors"
        >
          <MessageCircle className="h-4 w-4" />
          <span className="font-medium">{commentsCount}</span>
        </button>
      </div>

      {/* Comments */}
      {commentsCount > 0 && (
        <div className="px-4 pb-2 space-y-2">
          {commentsCount > 3 && !showAll && (
            <button
              onClick={() => setShowAll(true)}
              className="text-xs text-primary hover:underline"
            >
              {language === "uz"
                ? `Barcha ${commentsCount} ta fikrni ko'rish`
                : language === "ru"
                  ? `Показать все ${commentsCount} комментарии`
                  : `View all ${commentsCount} comments`}
            </button>
          )}
          {visibleComments.map((comment: Comment) => (
            <CommentRow
              key={comment.id}
              comment={comment}
              currentUser={currentUser}
              language={language}
              onDelete={() => onDeleteComment(comment.id)}
            />
          ))}
        </div>
      )}

      {/* Comment input */}
      <div className="flex items-end gap-2 px-4 pb-4 pt-2 border-t border-border/40">
        <UserAvatar
          name={
            currentUser.firstName && currentUser.lastName
              ? `${currentUser.firstName} ${currentUser.lastName}`
              : currentUser.name
          }
          avatarUrl={currentUser.avatarUrl}
          size="sm"
          gradient="from-primary to-purple-500"
        />
        <div className="flex-1 flex items-end gap-2 bg-muted/50 rounded-2xl px-3 py-2">
          <textarea
            ref={textareaRef}
            placeholder={ph}
            value={commentInput}
            onChange={(e) => onCommentChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                onAddComment()
              }
            }}
            rows={1}
            className="flex-1 bg-transparent text-sm resize-none outline-none leading-relaxed max-h-28 overflow-y-auto"
            style={{ minHeight: "20px" }}
          />
          {commentInput.trim() && (
            <button
              onClick={onAddComment}
              className="text-primary hover:text-primary/80 transition-colors shrink-0 mb-0.5"
            >
              <Send className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </Card>
  )
}

// ─── Main component ─────────────────────────────────────────────────────────
export function CommunityPage({ language, currentUser, onBack }: CommunityPageProps) {
  const [posts, setPosts] = useState<CommunityPost[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [commentInputs, setCommentInputs] = useState<Record<number, string>>({})
  const [showCreatePost, setShowCreatePost] = useState(false)
  const [newPostContent, setNewPostContent] = useState("")
  const [newPostTitle, setNewPostTitle] = useState("")
  const [newPostImageUrl, setNewPostImageUrl] = useState("")
  const [newPostLinkUrl, setNewPostLinkUrl] = useState("")
  const [isPosting, setIsPosting] = useState(false)
  const { toast } = useToast()
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const t = translations[language]

  // BUG FIX: currentUser.avatarUrl ishlatiladi (currentUser.avatar EMAS)
  const displayName =
    currentUser.firstName && currentUser.lastName
      ? `${currentUser.firstName} ${currentUser.lastName}`
      : currentUser.name

  useEffect(() => {
    loadPosts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadPosts = async (silent = false) => {
    if (!silent) setIsLoading(true)
    else setIsRefreshing(true)
    try {
      const res = await fetch("/api/community/posts")
      if (!res.ok) { setPosts([]); return }
      const data = await res.json()
      const arr: CommunityPost[] = Array.isArray(data) ? data : []
      setPosts(arr)
      const pinned = arr.find((p) => p.isPinned)
      if (pinned) localStorage.setItem(`lastSeenPin_${currentUser.id}`, String(pinned.id))
    } catch {
      setPosts([])
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }

  const handleCreatePost = async () => {
    const content = newPostContent.trim()
    if (!content) return
    setIsPosting(true)
    try {
      const res = await fetch("/api/community/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: currentUser.id,
          userName: displayName,
          // ✅ BUG FIX: avatarUrl ishlatildi (User type da "avatar" field yo'q!)
          userAvatar: currentUser.avatarUrl || "",
          title: newPostTitle.trim(),
          content,
          imageUrl: newPostImageUrl.trim(),
          linkUrl: newPostLinkUrl.trim(),
          isAdmin: currentUser.isAdmin,
        }),
      })
      if (res.ok) {
        setNewPostContent("")
        setNewPostTitle("")
        setNewPostImageUrl("")
        setNewPostLinkUrl("")
        setShowCreatePost(false)
        await loadPosts()
        toast({
          title:
            language === "uz"
              ? "Post yaratildi! 🎉"
              : language === "ru"
                ? "Пост создан! 🎉"
                : "Post created! 🎉",
        })
      } else {
        const err = await res.json()
        toast({ title: "Xato", description: err.error, variant: "destructive" })
      }
    } catch {
      toast({ title: "Xato", description: "Server xatosi", variant: "destructive" })
    } finally {
      setIsPosting(false)
    }
  }

  const handleDeletePost = async (postId: number) => {
    if (!currentUser.isAdmin) return
    try {
      const res = await fetch(
        `/api/community/posts?postId=${postId}&userId=${currentUser.id}`,
        { method: "DELETE" }
      )
      if (res.ok) {
        await loadPosts(true)
        toast({
          title:
            language === "uz"
              ? "Post o'chirildi"
              : language === "ru"
                ? "Пост удален"
                : "Post deleted",
        })
      }
    } catch {}
  }

  const handleAddComment = async (postId: number) => {
    const content = commentInputs[postId]?.trim()
    if (!content) return
    try {
      const res = await fetch("/api/community/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postId,
          userId: currentUser.id,
          // ✅ BUG FIX: displayName va avatarUrl ishlatildi
          userName: displayName,
          userAvatar: currentUser.avatarUrl || "",
          content,
        }),
      })
      if (res.ok) {
        setCommentInputs((prev) => ({ ...prev, [postId]: "" }))
        await loadPosts(true)
      } else if (res.status === 429) {
        toast({
          title: "Spam!",
          description:
            language === "uz"
              ? "Juda ko'p fikr. Biroz kuting."
              : language === "ru"
                ? "Слишком много комментариев. Подождите."
                : "Too many comments. Please wait.",
          variant: "destructive",
        })
      }
    } catch {}
  }

  const handleDeleteComment = async (postId: number, commentId: number) => {
    try {
      await fetch(
        `/api/community/comments?postId=${postId}&commentId=${commentId}&userId=${currentUser.id}`,
        { method: "DELETE" }
      )
      await loadPosts(true)
      toast({
        title:
          language === "uz"
            ? "Fikr o'chirildi"
            : language === "ru"
              ? "Комментарий удален"
              : "Comment deleted",
      })
    } catch {}
  }

  const handleToggleReaction = async (postId: number) => {
    // Optimistic update
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id !== postId) return p
        const hasLiked = p.reactions?.some((r) => r.userId === currentUser.id)
        if (hasLiked) {
          return { ...p, reactions: p.reactions.filter((r) => r.userId !== currentUser.id) }
        }
        return {
          ...p,
          reactions: [
            ...(p.reactions || []),
            {
              id: Date.now(),
              postId,
              userId: currentUser.id,
              type: "heart" as const,
              createdAt: new Date().toISOString(),
            },
          ],
        }
      })
    )
    try {
      await fetch("/api/community/reactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId, userId: currentUser.id, type: "heart" }),
      })
    } catch {}
  }

  const pinnedPost = posts.find((p) => p.isPinned)
  const regularPosts = posts.filter((p) => !p.isPinned)

  const L = {
    newPost:
      language === "uz" ? "Yangi post" : language === "ru" ? "Новый пост" : "New Post",
    titlePh:
      language === "uz"
        ? "Sarlavha (ixtiyoriy)"
        : language === "ru"
          ? "Заголовок (необязательно)"
          : "Title (optional)",
    contentPh:
      language === "uz"
        ? "Nima haqida o'ylayapsiz?"
        : language === "ru"
          ? "О чём думаете?"
          : "What's on your mind?",
    publish:
      language === "uz" ? "Joylash" : language === "ru" ? "Опубликовать" : "Publish",
    cancel:
      language === "uz" ? "Bekor" : language === "ru" ? "Отмена" : "Cancel",
    noPosts:
      language === "uz" ? "Hali postlar yo'q" : language === "ru" ? "Пока нет постов" : "No posts yet",
    loading:
      language === "uz" ? "Yuklanmoqda..." : language === "ru" ? "Загрузка..." : "Loading...",
    onlyAdmin:
      language === "uz"
        ? "Faqat admin post yarata oladi. Siz fikr bildira olasiz va like bosa olasiz."
        : language === "ru"
          ? "Только админ может создавать посты. Вы можете комментировать и ставить лайки."
          : "Only admins can create posts. You can comment and react.",
    posts:
      language === "uz" ? "ta post" : language === "ru" ? "публикаций" : "posts",
    publishing:
      language === "uz" ? "Joylashtirilmoqda..." : language === "ru" ? "Публикуется..." : "Publishing...",
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border">
        <div className="flex items-center justify-between px-4 h-14 max-w-2xl mx-auto w-full">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="font-bold leading-none flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-purple-400" />
                Community
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                {posts.length} {L.posts}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => loadPosts(true)}
              disabled={isRefreshing}
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            </Button>
            {true && (
              <Button size="sm" onClick={() => setShowCreatePost(true)} className="h-8 text-xs gap-1">
                <Plus className="h-3.5 w-3.5" />
                {L.newPost}
              </Button>
            )}
          </div>
        </div>
      </header>

      <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-4 space-y-4">
        {/* Info banner */}
        {false && (
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-sm text-blue-300">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0 text-blue-400" />
            <p>{L.onlyAdmin}</p>
          </div>
        )}

        {/* Create post form */}
        {showCreatePost && (
          <Card className="p-4 border-2 border-primary/40 bg-primary/5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm">{L.newPost}</h3>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setShowCreatePost(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Author preview */}
            <div className="flex items-center gap-2 mb-3">
              <UserAvatar
                name={displayName}
                avatarUrl={currentUser.avatarUrl}
                size="sm"
                gradient="from-purple-500 to-pink-500"
              />
              <div>
                <p className="text-xs font-semibold">{displayName}</p>
                <span className="text-[10px] px-1.5 py-0.5 bg-blue-500/20 text-blue-400 rounded-full">
                  Admin
                </span>
              </div>
            </div>

            <div className="space-y-2.5">
              <Input
                placeholder={L.titlePh}
                value={newPostTitle}
                onChange={(e) => setNewPostTitle(e.target.value)}
                className="h-9 text-sm"
              />
              <textarea
                placeholder={L.contentPh}
                value={newPostContent}
                onChange={(e) => setNewPostContent(e.target.value)}
                className="w-full min-h-[100px] rounded-md border border-input bg-background px-3 py-2 text-sm outline-none resize-none focus:ring-1 focus:ring-ring"
              />
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <ImageIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="https://... (rasm URL)"
                    value={newPostImageUrl}
                    onChange={(e) => setNewPostImageUrl(e.target.value)}
                    className="pl-8 h-8 text-xs"
                  />
                </div>
                <div className="relative flex-1">
                  <LinkIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="https://... (havola)"
                    value={newPostLinkUrl}
                    onChange={(e) => setNewPostLinkUrl(e.target.value)}
                    className="pl-8 h-8 text-xs"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-3">
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={() => setShowCreatePost(false)}
              >
                {L.cancel}
              </Button>
              <Button
                size="sm"
                className="h-8 text-xs"
                onClick={handleCreatePost}
                disabled={!newPostContent.trim() || isPosting}
              >
                {isPosting ? (
                  <span className="flex items-center gap-1.5">
                    <RefreshCw className="h-3 w-3 animate-spin" />
                    {L.publishing}
                  </span>
                ) : (
                  L.publish
                )}
              </Button>
            </div>
          </Card>
        )}

        {/* Loading */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-8 h-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
            <p className="text-sm text-muted-foreground">{L.loading}</p>
          </div>
        ) : (
          <>
            {pinnedPost && (
              <PostCard
                post={pinnedPost}
                currentUser={currentUser}
                language={language}
                commentInput={commentInputs[pinnedPost.id] || ""}
                onCommentChange={(v) =>
                  setCommentInputs((prev) => ({ ...prev, [pinnedPost.id]: v }))
                }
                onAddComment={() => handleAddComment(pinnedPost.id)}
                onDeleteComment={(cid) => handleDeleteComment(pinnedPost.id, cid)}
                onDeletePost={() => handleDeletePost(pinnedPost.id)}
                onToggleReaction={() => handleToggleReaction(pinnedPost.id)}
              />
            )}

            {regularPosts.length === 0 && !pinnedPost ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <MessageCircle className="h-12 w-12 text-muted-foreground/30 mb-3" />
                <p className="text-muted-foreground text-sm">{L.noPosts}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {regularPosts.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    currentUser={currentUser}
                    language={language}
                    commentInput={commentInputs[post.id] || ""}
                    onCommentChange={(v) =>
                      setCommentInputs((prev) => ({ ...prev, [post.id]: v }))
                    }
                    onAddComment={() => handleAddComment(post.id)}
                    onDeleteComment={(cid) => handleDeleteComment(post.id, cid)}
                    onDeletePost={() => handleDeletePost(post.id)}
                    onToggleReaction={() => handleToggleReaction(post.id)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
