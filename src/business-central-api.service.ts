import { HttpService } from '@nestjs/axios'
import { Inject, Injectable } from '@nestjs/common'
import axios, { AxiosRequestConfig } from 'axios'
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

// Rows per page, not a total — paging follows @odata.nextLink until BC stops
// sending one, so the row count a caller gets back is never capped by this.
const readPageSize = 5000
// Runaway guard for a nextLink that never advances. Throws rather than
// truncating, so it can never quietly return a short result the way $top does.
const maxPageCount = 1000

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
> &
  Partial<Pick<JournalLine, 'accountType'>>

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
  url: string
  params?: Params<Entity>
}

type InternalGetArgs<Entity> = {
  url: string
  params?: Params<Entity>
  environment?: string
}

type FetchAllPagesArgs = {
  url: string
  params?: Record<string, string>
}

type FetchPageArgs = FetchAllPagesArgs & {
  page: number
}

type PostArgs<Entity, Data = object> = {
  url: string
  body: Data
  params?: Params<Entity>
  headers?: AxiosRequestConfig['headers']
}

@Injectable()
export class BusinessCentralApiService {
  readonly businessCentralHttpService: HttpService

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

  // Follows @odata.nextLink to exhaustion. BC suppresses the link whenever $top
  // is set, so callers passing `top` keep their previous single-page behaviour.
  private fetchAllPages = <Entity>({
    url,
    params,
  }: FetchAllPagesArgs): Promise<Entity[]> => {
    type Page = { value: Entity[]; '@odata.nextLink'?: string }

    const fetchPage = async ({
      url: pageUrl,
      params: pageParams,
      page,
    }: FetchPageArgs): Promise<Entity[]> => {
      if (page >= maxPageCount) {
        throw new Error(
          `Business Central pagination exceeded ${maxPageCount} pages for ${url} — aborting to avoid a runaway loop`,
        )
      }

      const { data } = await firstValueFrom(
        this.businessCentralHttpService.get<Page>(pageUrl, {
          params: pageParams,
          headers: { Prefer: `odata.maxpagesize=${readPageSize}` },
        }),
      )

      const nextUrl = data['@odata.nextLink']

      if (!nextUrl) {
        return data.value
      }

      // The nextLink already carries the query, so params go on page 0 only.
      return [
        ...data.value,
        ...(await fetchPage({ url: nextUrl, page: page + 1 })),
      ]
    }

    return fetchPage({ url, params, page: 0 })
  }

  get = <Entity>({
    url,
    params: rawParams,
  }: GetArgs<Entity>): Promise<Entity[]> =>
    this.fetchAllPages<Entity>({ url, params: formatParams(rawParams) })

  post = async <Entity, Data>({
    url,
    body,
    headers,
    params: rawParams,
  }: PostArgs<Entity, Data>) => {
    const params = formatParams(rawParams)

    const { data } = await firstValueFrom(
      this.businessCentralHttpService.post<Entity>(url, body, {
        params,
        headers,
      }),
    )

    return data
  }

  patch = async <Entity, Data>({
    url,
    body,
    headers,
    params: rawParams,
  }: PostArgs<Entity, Data>) => {
    const params = formatParams(rawParams)

    const { data } = await firstValueFrom(
      this.businessCentralHttpService.patch<Entity>(url, body, {
        params,
        headers,
      }),
    )

    return data
  }

  private internalGet = <Entity>({
    environment = 'Production',
    url,
    params: rawParams,
  }: InternalGetArgs<Entity>): Promise<Entity[]> =>
    this.fetchAllPages<Entity>({
      url: `${environment}/api/v2.0/companies${url}`,
      params: formatParams(rawParams),
    })

  getVendors = ({ companyId, ...args }: GetVendorsArgs): Promise<Vendor[]> =>
    this.internalGet({ ...args, url: `(${companyId})/vendors` })

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
    this.internalGet({ ...args, url: `(${companyId})/journals` })

  getJournalLines = ({
    companyId,
    journalId,
    ...args
  }: GetJournalLinesArgs): Promise<JournalLine[]> =>
    this.internalGet({
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
    this.internalGet({ ...args, url: '' })

  getDimensions = ({
    companyId,
    ...args
  }: GetDimensionsArgs): Promise<DimensionLine[]> =>
    this.internalGet({ ...args, url: `(${companyId})/dimensions` })

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
