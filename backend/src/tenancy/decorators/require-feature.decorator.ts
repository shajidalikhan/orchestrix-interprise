import { SetMetadata } from '@nestjs/common';

export const RequireFeature = (feature: string) => SetMetadata('required_feature', feature);
