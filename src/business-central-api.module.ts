import { DynamicModule, Module } from '@nestjs/common'
import { BusinessCentralApiService } from './business-central-api.service'
import { MODULE_OPTIONS } from './constants'
import { ModuleOptions } from './types'

@Module({
  providers: [BusinessCentralApiService],
  exports: [BusinessCentralApiService],
})
export class BusinessCentralApiModule {
  static forRootAsync(options: ModuleOptions): DynamicModule {
    return {
      module: BusinessCentralApiModule,
      providers: [
        {
          provide: MODULE_OPTIONS,
          useFactory: options.useFactory,
          inject: options.inject,
        },
        BusinessCentralApiService,
      ],
      imports: options.imports || [],
      exports: [BusinessCentralApiService],
    }
  }
}
