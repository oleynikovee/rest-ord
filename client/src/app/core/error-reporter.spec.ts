import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ErrorReporter } from './error-reporter';

describe('ErrorReporter', () => {
  it('stays off and drops errors when no DSN is configured', async () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const reporter = TestBed.inject(ErrorReporter);
    reporter.report(new Error('before config'));
    const init = reporter.init();
    TestBed.inject(HttpTestingController)
      .expectOne('/api/config')
      .flush({ sentryDsn: null, environment: 'test', release: null });
    await init;
    expect(() => reporter.report(new Error('after'))).not.toThrow();
  });

  it('never breaks the app when the config cannot be loaded', async () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const reporter = TestBed.inject(ErrorReporter);
    const init = reporter.init();
    TestBed.inject(HttpTestingController).expectOne('/api/config').flush('', { status: 500, statusText: 'x' });
    await expect(init).resolves.toBeUndefined();
  });
});
