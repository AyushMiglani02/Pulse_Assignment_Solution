const { analyzeSensitivity } = require('../src/services/videoProcessing');

describe('Video Processing Service', () => {
  describe('analyzeSensitivity', () => {
    test('should mark video as safe with no flags', () => {
      const metadata = {
        duration: 60,
        size: 10000000,
        video: { width: 1920, height: 1080 },
        audio: { codec: 'aac' },
      };

      const result = analyzeSensitivity(metadata, 'Normal video', 'Regular description');

      expect(result.sensitivity).toBe('safe');
      expect(result.flags).toHaveLength(0);
    });

    test('should flag video with sensitive keywords in title', () => {
      const metadata = {
        duration: 60,
        size: 10000000,
        video: { width: 1920, height: 1080 },
        audio: { codec: 'aac' },
      };

      const result = analyzeSensitivity(metadata, 'Explicit content warning', 'Description');

      expect(result.sensitivity).toBe('flagged');
      expect(result.flags.length).toBeGreaterThan(0);
      expect(result.flags.some(f => f.includes('explicit'))).toBe(true);
    });

    test('should flag video with sensitive keywords in description', () => {
      const metadata = {
        duration: 60,
        size: 10000000,
        video: { width: 1920, height: 1080 },
        audio: { codec: 'aac' },
      };

      const result = analyzeSensitivity(metadata, 'Regular title', 'This contains 18+ content');

      expect(result.sensitivity).toBe('flagged');
      expect(result.flags.some(f => f.includes('18+'))).toBe(true);
    });

    test('should add flag for very short duration', () => {
      const metadata = {
        duration: 3,
        size: 100000,
        video: { width: 1920, height: 1080 },
        audio: { codec: 'aac' },
      };

      const result = analyzeSensitivity(metadata, 'Short video', '');

      expect(result.flags.some(f => f.includes('Very short duration'))).toBe(true);
    });

    test('should add flag for very long duration', () => {
      const metadata = {
        duration: 4000,
        size: 500000000,
        video: { width: 1920, height: 1080 },
        audio: { codec: 'aac' },
      };

      const result = analyzeSensitivity(metadata, 'Long video', '');

      expect(result.flags.some(f => f.includes('Very long duration'))).toBe(true);
    });

    test('should add flag for unusual aspect ratio', () => {
      const metadata = {
        duration: 60,
        size: 10000000,
        video: { width: 1920, height: 480 }, // 4:1 aspect ratio
        audio: { codec: 'aac' },
      };

      const result = analyzeSensitivity(metadata, 'Wide video', '');

      expect(result.flags.some(f => f.includes('Unusual aspect ratio'))).toBe(true);
    });

    test('should add flag for low bitrate', () => {
      const metadata = {
        duration: 60,
        size: 500000, // ~8.3KB/sec
        video: { width: 1920, height: 1080 },
        audio: { codec: 'aac' },
      };

      const result = analyzeSensitivity(metadata, 'Low quality video', '');

      expect(result.flags.some(f => f.includes('Unusually low bitrate'))).toBe(true);
    });

    test('should add flag for missing audio in long video', () => {
      const metadata = {
        duration: 120,
        size: 10000000,
        video: { width: 1920, height: 1080 },
        audio: null,
      };

      const result = analyzeSensitivity(metadata, 'Silent video', '');

      expect(result.flags.some(f => f.includes('No audio stream'))).toBe(true);
    });

    test('should not flag missing audio in short video', () => {
      const metadata = {
        duration: 15,
        size: 2000000,
        video: { width: 1920, height: 1080 },
        audio: null,
      };

      const result = analyzeSensitivity(metadata, 'Short silent video', '');

      const hasAudioFlag = result.flags.some(f => f.includes('No audio stream'));
      expect(hasAudioFlag).toBe(false);
    });

    test('should mark as flagged with multiple flags', () => {
      const metadata = {
        duration: 3, // Very short
        size: 50000, // Low bitrate
        video: { width: 3840, height: 1080 }, // Unusual aspect ratio
        audio: null, // But video is short, so this won't flag
      };

      const result = analyzeSensitivity(metadata, 'Problem video', '');

      // Should have multiple flags and be marked as flagged
      expect(result.flags.length).toBeGreaterThanOrEqual(3);
      expect(result.sensitivity).toBe('flagged');
    });

    test('should mark as unknown with some flags but not many', () => {
      const metadata = {
        duration: 60,
        size: 500000, // Low bitrate (1 flag)
        video: { width: 1920, height: 1080 },
        audio: { codec: 'aac' },
      };

      const result = analyzeSensitivity(metadata, 'Video', '');

      expect(result.flags.length).toBeGreaterThan(0);
      expect(result.flags.length).toBeLessThan(3);
      expect(result.sensitivity).toBe('unknown');
    });

    test('should include analyzedAt timestamp', () => {
      const metadata = {
        duration: 60,
        size: 10000000,
        video: { width: 1920, height: 1080 },
        audio: { codec: 'aac' },
      };

      const result = analyzeSensitivity(metadata, 'Video', '');

      expect(result.analyzedAt).toBeInstanceOf(Date);
    });
  });
});
