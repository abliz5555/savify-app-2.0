import { useUser } from "@/lib/auth";

export const ADMIN_EMAILS: string[] = ["abliz5555@yahoo.com"];

export function useIsAdmin(): boolean {
  const { user } = useUser();
  const email =
    user?.primaryEmailAddress?.emailAddress ??
    user?.emailAddresses?.[0]?.emailAddress ??
    "";
  return ADMIN_EMAILS.includes(email.toLowerCase());
}
