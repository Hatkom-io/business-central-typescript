export type Params<Fields> = {
  filter?: {
    operation: 'startswith' | 'endswith' | 'contains'
    field: Fields
    value: string
  }
  orderby?: {
    field: Fields
    direction: 'asc' | 'desc'
  }
  top?: number
}

export const formatParams = (rawParams?: Params<unknown>) => {
  if (!rawParams) {
    return undefined
  }

  const query: Record<string, string> = {}

  if (rawParams.top) {
    query.$top = `${rawParams.top}`
  }

  if (rawParams.orderby) {
    query.$orderby = `${rawParams.orderby.field} ${rawParams.orderby.direction}`
  }

  if (rawParams.filter) {
    query.$filter = `${rawParams.filter.operation}(${rawParams.filter.field},'${rawParams.filter.value}')`
  }

  return query
}
