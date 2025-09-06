import { ModuleMetadata } from '@nestjs/common'

export type DefaultOptions = {
  msDynamicsTenantId: string
  azureClientId: string
  azureClientSecret: string
}

export type ModuleOptions = Pick<ModuleMetadata, 'imports'> & {
  inject: any[]
  useFactory: (...args: any[]) => Promise<DefaultOptions> | DefaultOptions
  imports?: any[]
}
