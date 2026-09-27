import { Injectable, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';

export const ProductName = 'Moped Finance';

/** Browser tab titles as "Screen · Moped Finance", from each route's `title` (APP-1.9, APP-3.1). */
@Injectable({
    providedIn: 'root'
})
export class PageTitleStrategy extends TitleStrategy {
    private title = inject(Title);

    override updateTitle(snapshot: RouterStateSnapshot) {
        const screen = this.buildTitle(snapshot);
        this.title.setTitle(screen ? `${screen} · ${ProductName}` : ProductName);
    }
}
