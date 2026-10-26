// User rank management utility

let currentUserRank = "beginner"

export function setUserRank(rank: string) {
  currentUserRank = rank
  // Store in localStorage for persistence if needed
  if (typeof window !== "undefined") {
    localStorage.setItem("user-rank", rank)
  }
}

export function getUserRank(): string {
  // Retrieve from localStorage if available
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem("user-rank")
    if (stored) {
      currentUserRank = stored
    }
  }
  return currentUserRank
}
