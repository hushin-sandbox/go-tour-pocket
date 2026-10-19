import {
  countReadPages,
  emptyProgress,
  isPageRead,
  markPageOpened,
  pageKey,
  parseProgress,
  PROGRESS_STORAGE_KEY,
  readProgress,
  writeProgress,
  type ProgressStorage,
} from './progress';

function memoryStorage(initial: string | null = null): ProgressStorage & {
  value: string | null;
} {
  return {
    value: initial,
    getItem(key) {
      return key === PROGRESS_STORAGE_KEY ? this.value : null;
    },
    setItem(key, value) {
      if (key === PROGRESS_STORAGE_KEY) this.value = value;
    },
  };
}

describe('progress', () => {
  it('marks a page as read and remembers it as the last opened page', () => {
    const before = emptyProgress();
    const after = markPageOpened(before, 'basics', 2);

    expect(before.readPages).toEqual({});
    expect(after.readPages).toEqual({ [pageKey('basics', 2)]: true });
    expect(after.lastPage).toEqual({ lessonId: 'basics', pageIndex: 2 });
    expect(isPageRead(after, 'basics', 2)).toBe(true);
    expect(isPageRead(after, 'basics', 1)).toBe(false);
  });

  it('counts only pages of the requested lesson', () => {
    const progress = markPageOpened(
      markPageOpened(markPageOpened(emptyProgress(), 'basics', 0), 'basics', 2),
      'welcome',
      0,
    );

    expect(countReadPages(progress, 'basics', 5)).toBe(2);
    expect(countReadPages(progress, 'welcome', 3)).toBe(1);
    expect(countReadPages(progress, 'methods', 3)).toBe(0);
  });

  it('parses saved progress', () => {
    const saved = JSON.stringify({
      readPages: { 'basics/0': true },
      lastPage: { lessonId: 'basics', pageIndex: 0 },
    });
    expect(parseProgress(saved)).toEqual({
      readPages: { 'basics/0': true },
      lastPage: { lessonId: 'basics', pageIndex: 0 },
    });
  });

  it('falls back to empty progress for broken or unknown data', () => {
    expect(parseProgress(null)).toEqual(emptyProgress());
    expect(parseProgress('{')).toEqual(emptyProgress());
    expect(parseProgress('{"readPages":"oops"}')).toEqual(emptyProgress());
    expect(
      parseProgress('{"readPages":{},"lastPage":{"lessonId":"unknown","pageIndex":0}}'),
    ).toEqual(emptyProgress());
  });

  it('reads and writes through the storage adapter', () => {
    const storage = memoryStorage();
    writeProgress(markPageOpened(emptyProgress(), 'methods', 4), storage);

    expect(storage.value).not.toBeNull();
    expect(readProgress(storage).lastPage).toEqual({ lessonId: 'methods', pageIndex: 4 });
    expect(readProgress(storage).readPages).toEqual({ 'methods/4': true });
  });

  it('survives a storage that throws', () => {
    const storage: ProgressStorage = {
      getItem() {
        throw new Error('blocked');
      },
      setItem() {
        throw new Error('blocked');
      },
    };

    expect(readProgress(storage)).toEqual(emptyProgress());
    expect(() => writeProgress(emptyProgress(), storage)).not.toThrow();
  });
});
