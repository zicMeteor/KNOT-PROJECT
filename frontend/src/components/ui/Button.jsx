// src/components/ui/Button.jsx
import styles from "./Button.module.css"

function Button({
  variant = "secondary",
  size = "md",
  block = false,
  type = "button",
  children,
  ...rest
}) {
  const cls = [
    styles.button,
    styles[variant],
    size === "sm" && styles.sm,
    block && styles.block,
  ]
    .filter(Boolean)
    .join(" ")
  return (
    <button type={type} className={cls} {...rest}>
      {children}
    </button>
  )
}

export default Button