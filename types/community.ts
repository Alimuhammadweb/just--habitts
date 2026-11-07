export interface CommunityPost {
  id: number
  userId: number // Post yaratgan user ID
  adminId: number // backward compatibility
  adminName: string
  adminAvatar?: string
  title: string
  content: string
  isPinned: boolean
  isAdminPost: boolean // Admin post ekanligini bildirish
  imageUrl?: string
  linkUrl?: string
  createdAt: string
  updatedAt: string
  comments: Comment[]
  reactions: Reaction[]
}

export interface Comment {
  id: number
  postId: number
  userId: number
  userName: string
  userAvatar?: string
  content: string
  createdAt: string
  isDeleted: boolean
}

export interface Reaction {
  id: number
  postId: number
  userId: number
  type: "like" | "heart" | "fire"
  createdAt: string
}

export interface CommunityStats {
  totalPosts: number
  totalComments: number
  activePosts: number
  mostActiveUsers: {
    userId: number
    userName: string
    commentCount: number
  }[]
}
