"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Pin, Trash2, Plus } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import type { User } from "@/types/user"
import type { CommunityPost } from "@/types/community"

interface CommunityManagementProps {
  currentUser: User
}

export function CommunityManagement({ currentUser }: CommunityManagementProps) {
  const [posts, setPosts] = useState<CommunityPost[]>([])
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingPost, setEditingPost] = useState<CommunityPost | null>(null)
  const [formData, setFormData] = useState({
    title: "",
    content: "",
    imageUrl: "",
    linkUrl: "",
  })
  const { toast } = useToast()

  useEffect(() => {
    loadPosts()
  }, [])

  const loadPosts = async () => {
    try {
      const response = await fetch("/api/community/posts")
      const data = await response.json()
      setPosts(data)
    } catch (error) {
      console.error("[v0] Error loading posts:", error)
    }
  }

  const handleCreatePost = async (isPinned = false) => {
    if (!formData.content.trim()) {
      toast({ title: "Xato", description: "Matn yozing!", variant: "destructive" })
      return
    }

    try {
      const response = await fetch("/api/community/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adminId: currentUser.id,
          adminName: currentUser.name,
          adminAvatar: currentUser.avatar,
          ...formData,
          isPinned,
        }),
      })

      if (response.ok) {
        toast({ title: "Muvaffaqiyatli!", description: "Post yaratildi" })
        setFormData({ title: "", content: "", imageUrl: "", linkUrl: "" })
        setShowAddModal(false)
        await loadPosts()
      }
    } catch (error) {
      console.error("[v0] Error creating post:", error)
    }
  }

  const handleTogglePin = async (postId: number, currentPinned: boolean) => {
    try {
      await fetch("/api/community/posts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postId,
          adminId: currentUser.id,
          updates: { isPinned: !currentPinned },
        }),
      })
      await loadPosts()
      toast({
        title: "Muvaffaqiyatli!",
        description: currentPinned ? "Post unpinned" : "Post pinned",
      })
    } catch (error) {
      console.error("[v0] Error toggling pin:", error)
    }
  }

  const handleDeletePost = async (postId: number) => {
    if (!confirm("Postni o'chirishni xohlaysizmi?")) return

    try {
      await fetch(`/api/community/posts?postId=${postId}&adminId=${currentUser.id}`, {
        method: "DELETE",
      })
      await loadPosts()
      toast({ title: "Post o'chirildi" })
    } catch (error) {
      console.error("[v0] Error deleting post:", error)
    }
  }

  const stats = {
    totalPosts: posts.length,
    totalComments: posts.reduce((sum, post) => sum + (post.comments?.length || 0), 0),
    totalReactions: posts.reduce((sum, post) => sum + (post.reactions?.length || 0), 0),
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 text-center">
          <div className="text-3xl font-bold text-purple-500">{stats.totalPosts}</div>
          <div className="text-sm text-muted-foreground">Jami postlar</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-3xl font-bold text-blue-500">{stats.totalComments}</div>
          <div className="text-sm text-muted-foreground">Jami izohlar</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-3xl font-bold text-red-500">{stats.totalReactions}</div>
          <div className="text-sm text-muted-foreground">Reaksiyalar</div>
        </Card>
      </div>

      {/* Add Post Button */}
      <Button onClick={() => setShowAddModal(true)} className="w-full">
        <Plus className="h-4 w-4 mr-2" />
        Yangi Post Qo'shish
      </Button>

      {/* Add/Edit Modal */}
      {showAddModal && (
        <Card className="p-6 space-y-4">
          <h3 className="text-lg font-bold">Yangi Post</h3>
          <Input
            placeholder="Sarlavha (ixtiyoriy)"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          />
          <Textarea
            placeholder="Matn *"
            value={formData.content}
            onChange={(e) => setFormData({ ...formData, content: e.target.value })}
            className="min-h-[120px]"
          />
          <Input
            placeholder="Rasm URL (ixtiyoriy)"
            value={formData.imageUrl}
            onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
          />
          <Input
            placeholder="Havola URL (ixtiyoriy)"
            value={formData.linkUrl}
            onChange={(e) => setFormData({ ...formData, linkUrl: e.target.value })}
          />
          <div className="flex gap-2">
            <Button onClick={() => handleCreatePost(false)} className="flex-1">
              Post Qo'shish
            </Button>
            <Button onClick={() => handleCreatePost(true)} variant="secondary" className="flex-1">
              <Pin className="h-4 w-4 mr-2" />
              PIN qilib Qo'shish
            </Button>
            <Button onClick={() => setShowAddModal(false)} variant="outline">
              Bekor
            </Button>
          </div>
        </Card>
      )}

      {/* Posts List */}
      <div className="space-y-4">
        {posts.map((post) => (
          <Card key={post.id} className={`p-4 ${post.isPinned ? "border-2 border-purple-500" : ""}`}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                {post.isPinned && (
                  <span className="px-2 py-1 bg-purple-500 text-white text-xs rounded-full inline-flex items-center gap-1 mb-2">
                    <Pin className="h-3 w-3" /> PIN
                  </span>
                )}
                {post.title && <h4 className="font-bold mb-1">{post.title}</h4>}
                <p className="text-sm mb-2 line-clamp-2">{post.content}</p>
                <div className="text-xs text-muted-foreground">
                  {post.comments?.length || 0} izoh • {post.reactions?.length || 0} reaksiya
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="icon" onClick={() => handleTogglePin(post.id, post.isPinned)}>
                  <Pin className={`h-4 w-4 ${post.isPinned ? "text-purple-500" : ""}`} />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => handleDeletePost(post.id)}>
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </div>
            </div>
          </Card>
        ))}

        {posts.length === 0 && <div className="text-center py-12 text-muted-foreground">Hali postlar yo'q</div>}
      </div>
    </div>
  )
}
