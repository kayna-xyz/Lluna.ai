import { redirect } from 'next/navigation'

/** 诊所端实际页面在 `/clinicside/app`，此处缩短入口路径。 */
export default function ClinicsideEntryRedirect() {
  redirect('/clinicside/app')
}
