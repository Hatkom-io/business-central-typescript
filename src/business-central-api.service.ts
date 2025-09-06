import { HttpService } from '@nestjs/axios'
import { Inject, Injectable } from '@nestjs/common'
import axios from 'axios'
import { firstValueFrom } from 'rxjs'
import { MODULE_OPTIONS } from './constants'
import { DefaultOptions } from './types'
import { Company } from './util/company.type'
import { Journal, JournalLine } from './util/journal.type'
import { isTokenValid } from './util/jwt.util'
import { Vendor } from './util/vendor.type'

type GetTokenResponse = {
  token_type: string
  expires_in: number
  ext_expires_in: number
  access_token: string
}

type Dimension = {
  id: string
  displayName: string
}

type SpecificEnvironmentArgs = {
  environment?: string
}

type SpecificCompanyArgs = SpecificEnvironmentArgs & {
  parentId: string
  companyId: string
}

export type GetVendorsArgs = SpecificCompanyArgs

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

export type GetJournalsArgs = SpecificCompanyArgs
export type GetDimensionsArgs = SpecificCompanyArgs
export type GetJournalLinesArgs = SpecificCompanyArgs & {
  journalId: string
}
export type GetCompaniesArgs = SpecificEnvironmentArgs
export type PostAttachmentArgs = SpecificCompanyArgs & {
  buffer: Buffer
  name: string
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

  getVendors = async ({
    environment = 'Production',
    companyId,
  }: GetVendorsArgs): Promise<Vendor[]> => {
    const {
      data: { value: existingVendors },
    } = await firstValueFrom(
      this.businessCentralHttpService.get<{ value: Vendor[] }>(
        `${environment}/api/v2.0/companies(${companyId})/vendors`,
      ),
    )

    return existingVendors
  }

  patchVendor = ({
    environment = 'Production',
    companyId,
    vendorId,
    data,
  }: PatchVendorArgs): Promise<unknown> => {
    return firstValueFrom(
      this.businessCentralHttpService.patch(
        `${environment}/api/v2.0/companies(${companyId})/vendors(${vendorId})`,
        data,
        {
          headers: {
            'If-Match': '*',
          },
        },
      ),
    )
  }

  postVendor = ({
    environment = 'Production',
    companyId,
    data,
  }: PostVendorArgs): Promise<unknown> => {
    return firstValueFrom(
      this.businessCentralHttpService.post(
        `${environment}/api/v2.0/companies(${companyId})/vendors`,
        data,
      ),
    )
  }

  getJournals = async ({
    environment = 'Production',
    companyId,
  }: GetJournalsArgs): Promise<Journal[]> => {
    const {
      data: { value },
    } = await firstValueFrom(
      this.businessCentralHttpService.get<{ value: Journal[] }>(
        `${environment}/api/v2.0/companies(${companyId})/journals`,
      ),
    )

    return value
  }

  getJournalLines = async ({
    environment = 'Production',
    companyId,
    journalId,
  }: GetJournalLinesArgs): Promise<JournalLine[]> => {
    const { data } = await firstValueFrom(
      this.businessCentralHttpService.get<{ value: JournalLine[] }>(
        `${environment}/api/v2.0/companies(${companyId})/journals(${journalId})/journalLines`,
      ),
    )

    return data.value
  }

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

  getCompanies = async ({
    environment,
  }: GetCompaniesArgs): Promise<Company[]> => {
    const { data: companiesData } = await firstValueFrom(
      this.businessCentralHttpService.get<{ value: Company[] }>(
        `${environment}/api/v2.0/companies`,
      ),
    )

    return companiesData.value
  }

  getDimensions = async ({
    companyId,
    environment,
  }: GetDimensionsArgs): Promise<Dimension[]> => {
    const {
      data: { value: dimensions },
    } = await firstValueFrom(
      this.businessCentralHttpService.get<{ value: Dimension[] }>(
        `${environment}/api/v2.0/companies(${companyId})/dimensions`,
      ),
    )

    return dimensions
  }

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
    const fileBlob = new Blob([buffer])
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
