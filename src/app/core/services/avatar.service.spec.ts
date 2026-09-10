import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AvatarService } from './avatar.service';

describe('AvatarService', () => {
  let http: HttpTestingController;
  let service: AvatarService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [AvatarService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AvatarService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('uploads the cropped blob with FormData and returns the stored reference', async () => {
    const blob = new Blob(['portrait'], { type: 'image/webp' });
    const pending = service.upload('player', 'Aria Storm', blob);
    const request = http.expectOne('/api/avatars/player/Aria%20Storm');

    expect(request.request.method).toBe('POST');
    expect(request.request.body).toBeInstanceOf(FormData);
    expect((request.request.body as FormData).get('file')).toBeInstanceOf(Blob);
    request.flush({
      avatar: { key: 'avatars/players/avatar.webp', version: 42 },
    });

    await expect(pending).resolves.toEqual({
      key: 'avatars/players/avatar.webp',
      version: 42,
    });
  });

  it('builds a same-origin versioned media URL only for managed avatar keys', () => {
    expect(
      service.url({
        key: 'avatars/creatures/00000000-0000-4000-8000-000000000001.webp',
        version: 42,
      }),
    ).toBe('/media/avatars/creatures/00000000-0000-4000-8000-000000000001.webp?v=42');
    expect(service.url({ key: '../secret.webp', version: 1 })).toBeNull();
  });
});
