import { SetMetadata } from '@nestjs/common';

export const ApiScopes = (...scopes: string[]) => SetMetadata('api_scopes', scopes);
