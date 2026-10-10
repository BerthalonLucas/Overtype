import { describe, expect, it } from 'vitest';
import { translate, type Translate } from '../i18n';
import { visiblePages } from './nav';
import { fold, searchLimit, searchSettings } from './search';

const fr: Translate = (key, params) => translate('fr', key, params);
const en: Translate = (key, params) => translate('en', key, params);
const pages = visiblePages({ uiVersion: 'ilot' }, false);

describe('the search of the Settings sidebar', () => {
  it('finds a setting by its title, its page or its extra words, without accents or case', () => {
    expect(fold('Réglages PAR défaut')).toBe('reglages par defaut');
    expect(searchSettings('MODELE', fr, pages)).toEqual([
      { field: 'server', title: 'Modèle', page: 'server', pageLabel: 'Serveur' },
    ]);
    expect(searchSettings('undo', en, pages).map((result) => result.field)).toEqual(['undo']);
    expect(searchSettings('ctrl+z', fr, pages).map((result) => result.field)).toEqual(['undo']);
    // The page's own name finds its rows.
    expect(searchSettings('apparence', fr, pages).map((result) => result.page)).toEqual(
      expect.arrayContaining(['appearance']),
    );
    expect(searchSettings('raccourci', fr, pages).every((result) => result.page === 'shortcuts')).toBe(true);
  });

  it('answers nothing for an empty or unknown query, and never more than eight rows', () => {
    expect(searchSettings('', fr, pages)).toEqual([]);
    expect(searchSettings('   ', fr, pages)).toEqual([]);
    expect(searchSettings('zzzz', fr, pages)).toEqual([]);
    expect(searchSettings('e', fr, pages).length).toBeLessThanOrEqual(searchLimit);
  });

  it('leaves out the rows of a page that is not shown', () => {
    expect(searchSettings('coche', fr, pages).map((result) => result.page)).toEqual(['after']);
    expect(searchSettings('coche', fr, visiblePages({ uiVersion: 'v4' }, false))).toEqual([]);
  });
});
