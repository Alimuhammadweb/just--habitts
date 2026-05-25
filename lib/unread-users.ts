// Unread users count management utility

let unreadCount = 0

export function setUnreadUsers(count: number) {
  unreadCount = count
  // Store in localStorage for persistence if needed
  if (typeof window !== "undefined") {
    localStorage.setItem("unread-users-count", count.toString())
  }
}

export function getUnreadUsers(): number {
  // Retrieve from localStorage if available
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem("unread-users-count")
    if (stored) {
      unreadCount = Number.parseInt(stored, 10) || 0
    }
  }
  return unreadCount
}
