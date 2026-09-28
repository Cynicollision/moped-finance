import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { Route, Router, TitleStrategy, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from './app.routes';
import { AuthService } from './core/auth.service';
import { PageTitleStrategy } from './core/layout/page-title.strategy';

@Component({
    selector: 'app-stub-screen',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: ''
})
class StubScreenComponent { }

// The app's routes with every screen swapped for an empty one, so navigation runs the real paths, guards,
// redirects and titles without the screens loading data.
function withStubScreens(routeList: Route[]): Route[] {
    return routeList.map(route => ({
        ...route,
        component: route.component ? StubScreenComponent : undefined,
        children: route.children ? withStubScreens(route.children) : undefined
    }));
}

describe('app routes', () => {
    let harness: RouterTestingHarness;

    beforeEach(async () => {
        TestBed.configureTestingModule({
            providers: [
                provideRouter(withStubScreens(routes)),
                { provide: TitleStrategy, useClass: PageTitleStrategy },
                { provide: AuthService, useValue: { currentUser: signal({ id: '1', displayName: 'Ada', username: 'ada' }) } }
            ]
        });
        harness = await RouterTestingHarness.create();
    });

    async function urlAfterVisiting(url: string): Promise<string> {
        await harness.navigateByUrl(url);
        return TestBed.inject(Router).url;
    }

    it('APP-1.6 should land on the Dashboard, for the root and for unknown URLs', async () => {
        expect(await urlAfterVisiting('/')).toBe('/dashboard');
        expect(await urlAfterVisiting('/no-such-screen')).toBe('/dashboard');
    });

    it('APP-1.9 should title the tab with the screen, then the product name', async () => {
        const title = TestBed.inject(Title);

        await harness.navigateByUrl('/dashboard');
        expect(title.getTitle()).toBe('Dashboard · Moped Finance');

        await harness.navigateByUrl('/accounts/acc-1/edit');
        expect(title.getTitle()).toBe('Edit Account · Moped Finance');
    });
});
