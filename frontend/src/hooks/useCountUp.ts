import { useEffect, useRef, useState } from 'react'

export function useCountUp(target: number, duration = 1800, start = false) {
  const [value, setValue] = useState(0)
  const raf = useRef<number>(0)

  useEffect(() => {
    if (!start || target === 0) return
    const startTime = performance.now()
    const animate = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1)
      const ease = 1 - Math.pow(1 - progress, 3) // ease-out-cubic
      setValue(Math.floor(ease * target))
      if (progress < 1) raf.current = requestAnimationFrame(animate)
      else setValue(target)
    }
    raf.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(raf.current)
  }, [target, duration, start])

  return value
}
