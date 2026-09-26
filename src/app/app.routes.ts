import { Routes } from '@angular/router';
import { AppShellComponent } from './layout/app-shell.component';
import { DashboardComponent } from './features/dashboard/dashboard.component';
import { DecksComponent } from './features/decks/decks.component';
import { DeckDetailComponent } from './features/decks/deck-detail.component';
import { AddVocabularyComponent } from './features/search/add-vocabulary.component';
import { VocabularyComponent } from './features/vocabulary/vocabulary.component';
import { PracticeComponent } from './features/practice/practice.component';

export const routes: Routes = [
  {
    path: '',
    component: AppShellComponent,
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
