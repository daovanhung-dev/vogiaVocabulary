import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';
import { AppShellComponent } from './layout/app-shell.component';
import { AuthPageComponent } from './features/auth/auth-page.component';
import { DashboardComponent } from './features/dashboard/dashboard.component';
import { DecksComponent } from './features/decks/decks.component';
import { DeckDetailComponent } from './features/decks/deck-detail.component';
import { AddVocabularyComponent } from './features/search/add-vocabulary.component';
import { VocabularyComponent } from './features/vocabulary/vocabulary.component';
import { PracticeComponent } from './features/practice/practice.component';

export const routes: Routes = [
  { path: 'login', component: AuthPageComponent, data: { mode: 'login' } },
  { path: 'register', component: AuthPageComponent, data: { mode: 'register' } },
  {
    path: '',
    component: AppShellComponent,
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      { path: 'dashboard', component: DashboardComponent },
      { path: 'decks', component: DecksComponent },
      { path: 'decks/:deckId', component: DeckDetailComponent },
      { path: 'decks/:deckId/add', component: AddVocabularyComponent },
      { path: 'decks/:deckId/vocabulary', component: VocabularyComponent },
      { path: 'decks/:deckId/practice', component: PracticeComponent },
    ],
  },
  { path: '**', redirectTo: 'dashboard' },
];
