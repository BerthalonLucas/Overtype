import { describe, expect, it } from 'vitest';
import { breakable } from './text';

describe('breakable', () => {
  it('leaves prose, short words and empty text whole', () => {
    expect(breakable('Pourriez-vous envoyer la proposition mise à jour avant jeudi ?')).toEqual([
      'Pourriez-vous envoyer la proposition mise à jour avant jeudi ?',
    ]);
    expect(breakable('C:\\Users\\Lucas')).toEqual(['C:\\Users\\Lucas']);
    expect(breakable('')).toEqual(['']);
  });
  it('cuts a long run after its separators and keeps the text identical', () => {
    const path = 'voir C:\\Users\\Lucas\\projects\\flowtranslate maintenant';
    expect(breakable(path)).toEqual(['voir C:\\', 'Users\\', 'Lucas\\', 'projects\\', 'flowtranslate maintenant']);
    expect(breakable(path).join('')).toBe(path);
    expect(breakable('https://example.org/dossier/rapport?page=2&tri=date')).toEqual([
      'https://',
      'example.',
      'org/',
      'dossier/',
      'rapport?',
      'page=2&',
      'tri=date',
    ]);
  });
  it('keeps consecutive separators together and never ends a run on a break', () => {
    expect(breakable('un_identifiant_tres_long_')).toEqual(['un_', 'identifiant_', 'tres_', 'long_']);
    expect(breakable('aaaaaaaaaaaaaaaaaaaaaaaaaaaa')).toEqual(['aaaaaaaaaaaaaaaaaaaaaaaaaaaa']);
    expect(breakable('deux mots-composés-assez-longs ici et fichier.tar.gz.sha256sum')).toEqual([
      'deux mots-',
      'composés-',
      'assez-',
      'longs ici et fichier.',
      'tar.',
      'gz.',
      'sha256sum',
    ]);
  });
});
