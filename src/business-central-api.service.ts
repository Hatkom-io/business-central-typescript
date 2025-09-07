import { HttpService } from '@nestjs/axios'
import { Inject, Injectable } from '@nestjs/common'
import axios from 'axios'
import { firstValueFrom } from 'rxjs'
import { MODULE_OPTIONS } from './constants'
import { DefaultOptions } from './types'
import { Company } from './util/company.type'
import { DimensionLine, Journal, JournalLine } from './util/journal.type'
import { isTokenValid } from './util/jwt.util'
import { formatParams, Params } from './util/param.util'
import { Vendor } from './util/vendor.type'

type GetTokenResponse = {
  token_type: string
  expires_in: number
  ext_expires_in: number
  access_token: string
}

type SpecificEnvironmentArgs = {
  environment?: string
}

type SpecificCompanyArgs = SpecificEnvironmentArgs & {
  companyId: string
}

export type GetVendorsArgs = SpecificCompanyArgs & {
  params?: Params<Vendor>
}

type VendorData = Pick<Vendor, 'displayName' | 'number'>

export type PatchVendorArgs = SpecificCompanyArgs & {
  vendorId: string
  data: Partial<VendorData>
}

export type PostJournalLineData = Pick<
  JournalLine,
  | 'amount'
  | 'description'
  | 'postingDate'
  | 'accountNumber'
  | 'balancingAccountNumber'
  | 'balanceAccountType'
  | 'documentNumber'
>

export type PostVendorArgs = SpecificCompanyArgs & {
  data: Partial<VendorData>
}

export type PostJournalLineArgs = SpecificCompanyArgs & {
  journalId: string
  data: PostJournalLineData
}

export type PostDimensionArgs = SpecificCompanyArgs & {
  journalLineId: string
  id: string
  valueCode: string
}

export type GetJournalsArgs = SpecificCompanyArgs & {
  params?: Params<Journal>
}
export type GetDimensionsArgs = SpecificCompanyArgs & {
  params?: Params<DimensionLine>
}
export type GetJournalLinesArgs = SpecificCompanyArgs & {
  journalId: string
  params?: Params<JournalLine>
}
export type GetCompaniesArgs = SpecificEnvironmentArgs & {
  params?: Params<Company>
}
export type PostAttachmentArgs = SpecificCompanyArgs & {
  parentId: string
  buffer: Buffer
  name: string
}

type GetArgs<Entity> = {
  environment?: string
  url: string
  params?: Params<Entity>
}

@Injectable()
export class BusinessCentralApiService {
  private readonly businessCentralHttpService: HttpService

  private token: string | null = null
  private baseURL: string

  constructor(
    @Inject(MODULE_OPTIONS) private readonly options: DefaultOptions,
  ) {
    this.baseURL = `https://api.businesscentral.dynamics.com/v2.0/${this.options.msDynamicsTenantId}/`

    const businessCentralAxios = axios.create({ baseURL: this.baseURL })

    businessCentralAxios.interceptors.request.use(async (config) => {
      const token = await this.getValidToken()

      config.headers.Authorization = `Bearer ${token}`

      return config
    })

    this.businessCentralHttpService = new HttpService(businessCentralAxios)
  }

  private getValidToken = async (): Promise<string> => {
    if (this.token && isTokenValid(this.token)) {
      return this.token
    }

    const microsoftOnlineService = new HttpService(
      axios.create({
        baseURL: `https://login.microsoftonline.com/${this.options.msDynamicsTenantId}/oauth2/v2.0/`,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }),
    )

    const { data } = await firstValueFrom(
      microsoftOnlineService.post<GetTokenResponse>('token', {
        grant_type: 'client_credentials',
        scope: 'https://api.businesscentral.dynamics.com/.default',
        client_id: this.options.azureClientId,
        client_secret: this.options.azureClientSecret,
      }),
    )

    this.token = data.access_token

    return this.token
  }

  private get = async <Entity>({
    environment = 'Production',
    url,
    params: rawParams,
  }: GetArgs<Entity>) => {
    const params = formatParams(rawParams)

    const {
      data: { value },
    } = await firstValueFrom(
      this.businessCentralHttpService.get<{ value: Entity[] }>(
        `${environment}/api/v2.0/companies${url}`,
        {
          params,
        },
      ),
    )

    return value
  }

  getVendors = ({ companyId, ...args }: GetVendorsArgs): Promise<Vendor[]> =>
    this.get({ ...args, url: `(${companyId})/vendors` })

  patchVendor = async ({
    environment = 'Production',
    companyId,
    vendorId,
    data,
  }: PatchVendorArgs): Promise<Vendor> => {
    const {
      data: { value },
    } = await firstValueFrom(
      this.businessCentralHttpService.patch<{ value: Vendor }>(
        `${environment}/api/v2.0/companies(${companyId})/vendors(${vendorId})`,
        data,
        {
          headers: {
            'If-Match': '*',
          },
        },
      ),
    )

    return value
  }

  postVendor = async ({
    environment = 'Production',
    companyId,
    data,
  }: PostVendorArgs): Promise<Vendor> => {
    const {
      data: { value },
    } = await firstValueFrom(
      this.businessCentralHttpService.post<{ value: Vendor }>(
        `${environment}/api/v2.0/companies(${companyId})/vendors`,
        data,
      ),
    )

    return value
  }

  getJournals = ({ companyId, ...args }: GetJournalsArgs): Promise<Journal[]> =>
    this.get({ ...args, url: `(${companyId})/journals` })

  getJournalLines = ({
    companyId,
    journalId,
    ...args
  }: GetJournalLinesArgs): Promise<JournalLine[]> =>
    this.get({
      ...args,
      url: `(${companyId})/journals(${journalId})/journalLines`,
    })

  postJournalLine = async ({
    environment = 'Production',
    companyId,
    journalId,
    data: line,
  }: PostJournalLineArgs) => {
    const { data } = await firstValueFrom(
      this.businessCentralHttpService.post<JournalLine>(
        `${environment}/api/v2.0/companies(${companyId})/journals(${journalId})/journalLines`,
        { ...line, journalId },
      ),
    )

    return data
  }

  getCompanies = (args: GetCompaniesArgs): Promise<Company[]> =>
    this.get({ ...args, url: '' })

  getDimensions = ({
    companyId,
    ...args
  }: GetDimensionsArgs): Promise<DimensionLine[]> =>
    this.get({ ...args, url: `(${companyId})/dimensions` })

  postDimension = async ({
    id,
    valueCode,
    companyId,
    journalLineId,
    environment = 'Production',
  }: PostDimensionArgs): Promise<void> => {
    await firstValueFrom(
      this.businessCentralHttpService.post(
        `${environment}/api/v2.0/companies(${companyId})/journalLines(${journalLineId})/dimensionSetLines`,
        { id, valueCode },
      ),
    )
  }

  postAttachment = async ({
    companyId,
    parentId,
    environment = 'Production',
    buffer,
    name,
  }: PostAttachmentArgs): Promise<void> => {
    const fileData = new FormData()
    const fileBlob = new Blob([Uint8Array.from(buffer)])
    fileData.append('file', fileBlob)

    const token = await this.getValidToken()

    const headers = new Headers()
    headers.append('If-Match', '*')
    headers.append('Content-Type', 'multipart/form-data')
    headers.append('Authorization', `Bearer ${token}`)

    const requestOptions = {
      method: 'PATCH',
      headers,
      body: fileData,
    }

    const { data: attachment } = await firstValueFrom(
      this.businessCentralHttpService.post<{
        id: string
        parentId: string
      }>(`${environment}/api/v2.0/companies(${companyId})/attachments`, {
        parentId,
        fileName: `${name}.pdf`,
        parentType: 'Journal',
      }),
    )

    await fetch(
      // Standard HttpService uses `axios` and for some reason the request fails
      // Moving to `fetch` resolved the issue
      `${this.baseURL}${environment}/api/v2.0/companies(${companyId})/attachments(${attachment.id})/attachmentContent`,
      requestOptions,
    )
  }
}
