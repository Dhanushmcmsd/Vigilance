export const fadeUp = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3 } }
}

export const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } }
}

export const slideInRight = {
  hidden: { x: 360, opacity: 0 },
  visible: { x: 0, opacity: 1, transition: { duration: 0.3 } }
}

export const scaleIn = {
  hidden: { scale: 0.97, opacity: 0 },
  visible: { scale: 1, opacity: 1, transition: { duration: 0.2 } }
}

export const slideInLeft = {
  hidden: { x: -360, opacity: 0 },
  visible: { x: 0, opacity: 1, transition: { duration: 0.3 } }
}
