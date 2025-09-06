import { DynamicModule, Module } from '@nestjs/common'
import { GraphQLModule } from '@nestjs/graphql'
import { BusinessCentralGraphQLService } from './business-central-graphql.service'
import { ModuleOptions } from './types'

@Module({
  imports: [
    GraphQLModule.forRoot({
      autoSchemaFile: true,
    }),
  ],
  providers: [BusinessCentralGraphQLService],
  exports: [BusinessCentralGraphQLService],
})
export class BusinessCentralGraphQLModule {
  static forRootAsync(options: ModuleOptions): DynamicModule {
    // You can extend this for async config if needed
    return {
      module: BusinessCentralGraphQLModule,
      providers: [
        {
          provide: 'BUSINESS_CENTRAL_OPTIONS',
          useFactory: options.useFactory,
          inject: options.inject,
        },
        BusinessCentralGraphQLService,
      ],
      imports: options.imports || [],
      exports: [BusinessCentralGraphQLService],
    }
  }
}
