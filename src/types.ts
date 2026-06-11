import { ModuleMetadata } from '@nestjs/common'

export type ClientCredentialOptions = {
  msDynamicsTenantId: string
  azureClientId: string
  azureClientSecret: string
  accessToken?: never
}

type PersonalTokenOptions = {
  msDynamicsTenantId: string
  accessToken: string
}

export type DefaultOptions = ClientCredentialOptions | PersonalTokenOptions

export type ModuleOptions = Pick<ModuleMetadata, 'imports'> & {
  inject: any[]
  useFactory: (...args: any[]) => Promise<DefaultOptions> | DefaultOptions
  imports?: any[]
}
