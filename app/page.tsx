import { GradientCanvas } from "@/components/auth/gradient-canvas"
import { LoginForm } from "@/components/auth/login-form"

export const metadata = {
  title: "Sign in — Lluna AI",
}

export default function LoginPage() {
  return (
    <main className="w-screen h-screen flex flex-col md:flex-row">
      <div className="flex-1 md:w-1/2 md:h-full">
        <LoginForm />
      </div>
      <div className="h-48 md:h-full md:w-1/2">
        <GradientCanvas />
      </div>
    </main>
  )
}
