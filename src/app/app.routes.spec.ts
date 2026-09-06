import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { routes } from './app.routes';

@Component({ standalone: true, template: 'Route loaded' })
class RouteStubComponent {}

describe('Application entry points', () => {
  it.each([
    ['/', '/player'],
    ['/battle-forge/', '/player'],
    ['/unknown', '/player'],
    ['/dm', '/dm'],
    ['/display', '/display'],
  ])('opens %s at %s', async (path, expected) => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter(
          routes.map((route) =>
            route.loadComponent
              ? { ...route, loadComponent: () => Promise.resolve(RouteStubComponent) }
              : route,
          ),
        ),
      ],
    });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(path, RouteStubComponent);
    expect(TestBed.inject(Router).url).toBe(expected);
  });

  it.each(['http://192.168.1.10:8080/', 'https://example.test/battle-forge/'])(
    'keeps the PWA launch and all screens inside its scope at %s',
    (base) => {
      const manifest = JSON.parse(readFileSync('public/manifest.webmanifest', 'utf8'));
      const manifestUrl = new URL('manifest.webmanifest', base);
      expect(new URL(manifest.start_url, manifestUrl).href).toBe(new URL('player', base).href);
      expect(new URL(manifest.id, manifestUrl).href).toBe(base);
      const scope = new URL(manifest.scope, manifestUrl).href;
      for (const route of ['player', 'dm', 'display']) {
        expect(new URL(route, base).href.startsWith(scope)).toBe(true);
      }
      expect(manifest.display).toBe('standalone');
    },
  );
});
