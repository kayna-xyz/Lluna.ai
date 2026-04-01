import { Toaster } from '@/components/ui/sonner'

export default function ClinicsideAuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      {children}
      <Toaster richColors position="top-center" />
    </>
  )
}
