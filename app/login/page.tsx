import { redirect } from 'next/navigation'

// /login has moved to / — redirect old links permanently.
export default function LoginRedirect() {
  redirect('/')
}
