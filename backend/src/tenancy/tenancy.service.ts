import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';

@Injectable()
export class TenancyService {
  private readonly asyncLocalStorage = new AsyncLocalStorage<Map<string, string>>();

  runWithTenant(tenantId: string, callback: () => void | Promise<void>) {
    const store = new Map<string, string>();
    store.set('tenantId', tenantId);
    this.asyncLocalStorage.run(store, callback);
  }

  getTenantId(): string | undefined {
    const store = this.asyncLocalStorage.getStore();
    return store?.get('tenantId');
  }
}
