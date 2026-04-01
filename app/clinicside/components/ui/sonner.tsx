'use client'

import { useTheme } from 'next-themes'
import { Toaster as Sonner, ToasterProps } from 'sonner'

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = 'system' } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps['theme']}
      className="toaster group"
      style={
        {
          '--normal-bg': 'var(--popover)',
          '--normal-text': 'var(--popover-foreground)',
          '--normal-border': 'var(--border)',
          /* Brand confirmations (toast.success) — brown primary, not default green */
          '--success-bg': 'var(--primary)',
          '--success-border': 'color-mix(in oklch, var(--primary) 88%, var(--foreground) 12%)',
          '--success-text': 'var(--primary-foreground)',
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
