import { describe, expect, it } from 'vitest';
import type { Server, Settings } from '../types';
import { addServer, canAddServer, emptyServer, newServerId, removeServer, setDefaultServer, updateServer, usable } from './servers';

const server = (id: string, over: Partial<Server> = {}): Server => ({ ...emptyServer(id), endpoint: `https://${id}.exemple.com`, model: 'm', ...over });
const settings = (servers: Server[], defaultServerId = servers[0].id) => ({ servers, defaultServerId }) as Settings;

describe('the servers of the Settings', () => {
  it('adds a second server, empty, with a free id; never a third', () => {
    const one = settings([server('s1')]);
    expect(canAddServer(one)).toBe(true);
    const added = addServer(one);
    expect(added.id).toBe('s2');
    expect(added.settings.servers[1]).toEqual({ id: 's2', name: '', endpoint: '', apiKey: '', noKey: false, model: '' });
    expect(added.settings.defaultServerId).toBe('s1');
    expect(canAddServer(added.settings)).toBe(false);
    const again = addServer(added.settings);
    expect(again.id).toBeNull();
    expect(again.settings).toBe(added.settings);
    // An id left free by a removal is taken again; ids stay within [a-z0-9-].
    expect(newServerId([{ id: 's2' }])).toBe('s1');
    expect(newServerId([{ id: 's1' }, { id: 's2' }])).toBe('s3');
  });

  it('never removes the last server, and hands the default to the one left', () => {
    const two = settings([server('s1'), server('s2')], 's2');
    const left = removeServer(two, 's2');
    expect(left.servers.map(item => item.id)).toEqual(['s1']);
    expect(left.defaultServerId).toBe('s1');
    expect(removeServer(left, 's1')).toBe(left);
    expect(removeServer(two, 'unknown')).toBe(two);
    expect(removeServer(two, 's1').defaultServerId).toBe('s2');
  });

  it('sets the default only to a server that exists', () => {
    const two = settings([server('s1'), server('s2')]);
    expect(setDefaultServer(two, 's2').defaultServerId).toBe('s2');
    expect(setDefaultServer(two, 's9')).toBe(two);
  });

  it('never makes a server without an address or a model the default one', () => {
    const two = settings([server('s1'), emptyServer('s2')]);
    expect(usable(two.servers[0])).toBe(true);
    expect(usable(two.servers[1])).toBe(false);
    expect(usable(server('s3', { model: '  ' }))).toBe(false);
    expect(setDefaultServer(two, 's2')).toBe(two);
  });

  it('drops the key of a server declared without one, and leaves the others alone', () => {
    const two = settings([server('s1', { apiKey: 'sk-secret-000000000000' }), server('s2', { apiKey: 'sk-other-0000000000000' })]);
    const next = updateServer(two, 's1', { noKey: true });
    expect(next.servers[0]).toMatchObject({ id: 's1', noKey: true, apiKey: '' });
    expect(next.servers[1]).toBe(two.servers[1]);
    expect(updateServer(two, 's1', { model: 'other' }).servers[0]).toMatchObject({ model: 'other', apiKey: 'sk-secret-000000000000' });
  });
});
