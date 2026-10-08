import { describe, expect, it, vi } from 'vitest';
import catalogue from '../content/starter-pack.json';
import { importPack, learnerFormErrors, PackFileError, parsePackFile, passwordError, type AdminCall } from './admin-actions';

const classroom = { id: 'classroom', schoolId: 'school', name: 'Grade 5', grade: 5, teacherId: 'teacher' };
const form = { alias: 'Mango', loginId: 'learner-31', password: 'temporary-password', classroomId: classroom.id };

describe('Learner account validation', () => {
  it('accepts the demo credentials and requires a real Classroom', () => {
    expect(learnerFormErrors(form, [classroom])).toEqual([]);
    expect(learnerFormErrors(form, [])).toEqual(['Choose a Classroom.']);
  });
  it('matches server alias, login and password constraints without trimming passwords', () => {
    expect(learnerFormErrors({ ...form, alias: ' ', loginId: 'x@school', password: 'short' }, [classroom])).toHaveLength(3);
    expect(passwordError(' '.repeat(12))).toBeNull();
    expect(passwordError('x'.repeat(129))).toBeTruthy();
    expect(learnerFormErrors({ ...form, alias: 'x'.repeat(81), loginId: 'x'.repeat(81) }, [classroom])).toHaveLength(2);
  });
});

describe('Pack-file parser', () => {
  it('reads the actual Starter Pack catalogue and single exported Packs', () => {
    const packs = parsePackFile(JSON.stringify(catalogue));
    expect(packs).toHaveLength(catalogue.packs.length);
    expect(parsePackFile(JSON.stringify(catalogue.packs[0]))).toEqual([packs[0]]);
    expect(packs[0].lessons[0].exercises[0].coinAward).toBe(5);
    expect(packs[0]).not.toHaveProperty('id');
  });
  it('reports readable errors per Lesson, including answer keys and Hints', () => {
    const broken = structuredClone(catalogue.packs[0]);
    broken.lessons[0].hints.en = '';
    broken.lessons[1].exercises[0].correctOption = 99;
    try { parsePackFile(JSON.stringify(broken)); throw new Error('accepted'); }
    catch (error) {
      expect(error).toBeInstanceOf(PackFileError);
      expect((error as PackFileError).errors).toEqual(expect.arrayContaining([
        expect.stringContaining('Lesson 1'), expect.stringContaining('Lesson 2'),
      ]));
    }
  });
  it('rejects invalid JSON, empty content, invalid types and backend limits', () => {
    for (const text of ['{', 'null', '[]', '{"packs":[]}', '{"packs":{}}']) expect(() => parsePackFile(text)).toThrow(PackFileError);
    const broken = { ...catalogue.packs[0], subject: 'UNKNOWN', grade: 13, lessons: Array(101).fill(null) };
    expect(() => parsePackFile(JSON.stringify(broken))).toThrow('must contain 1–100');
    const pack = structuredClone(catalogue.packs[0]);
    pack.lessons[0].exercises[0].options = ['', 'x'.repeat(501)];
    expect(() => parsePackFile(JSON.stringify(pack))).toThrow('option 1');
  });
  it('creates drafts with server-assigned ids through the existing endpoints, never publishes', async () => {
    const pack = parsePackFile(JSON.stringify(catalogue.packs[0]))[0];
    const request = vi.fn().mockResolvedValue({ id: 'server-id' });
    await importPack(request as AdminCall, pack, 'Pack Author');
    expect(request).toHaveBeenNthCalledWith(1, 'POST', 'content/packs', {
      title: pack.title, subject: pack.subject, grade: pack.grade, version: pack.version, attribution: 'Pack Author',
    });
    expect(request.mock.calls[1][1]).toBe('content/packs/server-id/lessons');
    expect(request.mock.calls[2][1]).toBe('content/lessons/server-id/exercises');
    expect(request.mock.calls.some((c) => c[1].endsWith('/publish'))).toBe(false);
  });
  it('creates nothing on malformed files and reports interrupted imports as incomplete drafts', async () => {
    const request = vi.fn().mockResolvedValueOnce({ id: 'draft-id' }).mockRejectedValue(new Error('Offline'));
    const pack = parsePackFile(JSON.stringify(catalogue.packs[0]))[0];
    await expect(importPack(request as AdminCall, pack, '')).rejects.toThrow('Attribution');
    expect(request).not.toHaveBeenCalled();
    expect(() => parsePackFile('{')).toThrow();
    expect(request).not.toHaveBeenCalled();
    await expect(importPack(request as AdminCall, pack, 'Author')).rejects.toThrow('incomplete');
    expect(request).toHaveBeenCalledTimes(2);
  });
  it('retries from the last acknowledged Exercise without creating duplicate Packs or Lessons', async () => {
    const pack = parsePackFile(JSON.stringify(catalogue.packs[0]))[0];
    const progress = { lessonIds: [] as string[], exerciseCounts: [] as number[] };
    const request = vi.fn().mockResolvedValue({ id: 'saved-id' });
    request.mockRejectedValueOnce(new Error('Offline'));
    await expect(importPack(request as AdminCall, pack, 'Author', progress)).rejects.toThrow();
    request.mockResolvedValueOnce({ id: 'pack-id' }).mockResolvedValueOnce({ id: 'lesson-id' }).mockResolvedValueOnce({}).mockRejectedValueOnce(new Error('Offline'));
    await expect(importPack(request as AdminCall, pack, 'Author', progress)).rejects.toThrow('incomplete');
    request.mockClear();
    await importPack(request as AdminCall, pack, 'Author', progress);
    expect(request.mock.calls[0]).toEqual(['POST', 'content/lessons/lesson-id/exercises', pack.lessons[0].exercises[1]]);
    expect(request.mock.calls.some((c) => c[1] === 'content/packs' || c[1] === 'content/packs/pack-id/lessons' && c[2].title === pack.lessons[0].title)).toBe(false);
  });
});
