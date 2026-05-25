"use client"

import { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"

interface AchievementAnimationProps {
  type: "snow" | "confetti" | "sparkles" | "fireworks" | "stars"
  duration?: number
}

export function AchievementAnimation({ type, duration = 5000 }: AchievementAnimationProps) {
  const [particles, setParticles] = useState<Array<{ id: number; x: number; y: number; rotation: number }>>([])

  useEffect(() => {
    // Generate particles
    const newParticles = Array.from({ length: 50 }, (_, i) => ({
      id: i,
      x: Math.random() * window.innerWidth,
      y: -20,
      rotation: Math.random() * 360,
    }))
    setParticles(newParticles)

    // Clean up after duration
    const timer = setTimeout(() => {
      setParticles([])
    }, duration)

    return () => clearTimeout(timer)
  }, [duration])

  const getParticleContent = () => {
    switch (type) {
      case "snow":
        return "❄️"
      case "confetti":
        return ["🎉", "🎊", "✨", "🎈"][Math.floor(Math.random() * 4)]
      case "sparkles":
        return "✨"
      case "fireworks":
        return "🎆"
      case "stars":
        return "⭐"
      default:
        return "✨"
    }
  }

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      <AnimatePresence>
        {particles.map((particle) => (
          <motion.div
            key={particle.id}
            initial={{ x: particle.x, y: particle.y, opacity: 1, rotate: particle.rotation }}
            animate={{
              y: window.innerHeight + 50,
              opacity: 0,
              rotate: particle.rotation + 360,
            }}
            exit={{ opacity: 0 }}
            transition={{
              duration: type === "snow" ? 8 : 3,
              delay: Math.random() * 2,
              ease: "linear",
            }}
            className="absolute text-2xl"
          >
            {getParticleContent()}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
