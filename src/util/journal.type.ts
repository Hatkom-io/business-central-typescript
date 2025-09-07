export type Journal = {
  id: string
  balancingAccountId: string
  balancingAccountNumber: string
  code: string
  displayName: string
  lastModifiedDateTime: string
  templateDisplayName: string
}

export type DimensionLine = {
  id: string
  code: string
  parentId: string
  parentType: string
  displayName: string
  valueId: string
  valueCode: string
  valueDisplayName: string
}

export type JournalLine = {
  accountId: string
  accountNumber: string
  accountType: string
  amount: number
  balanceAccountType: string
  balancingAccountId: string
  balancingAccountNumber: string
  comment: string | null
  description: string
  documentNumber: string
  externalDocumentNumber: string | null
  id: string
  journalDisplayName: string
  journalId: string
  lastModifiedDateTime: string
  lineNumber: number
  postingDate: string
  taxCode: string
  dimensionLines?: DimensionLine[]
}
