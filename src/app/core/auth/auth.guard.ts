import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { SupabaseService } from '../supabase/supabase.service';

export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const supabase = inject(SupabaseService);
  const router = inject(Router);
  if (!supabase.configured) return true;
  await auth.waitUntilReady();
  return auth.user() ? true : router.createUrlTree(['/login']);
};
