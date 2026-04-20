export type Params<Entity> = {
  filter?: {
    operation: 'startswith' | 'endswith' | 'contains' | 'eq'
    field: Extract<keyof Entity, string> | string
    value: string
  }
  orderby?: {
    field: Extract<keyof Entity, string> | string
    direction: 'asc' | 'desc'
  }
  top?: number
  select?: Array<Extract<keyof Entity, string> | string>
}

export const formatParams = <Entity>(rawParams?: Params<Entity>) => {
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
    const { operation, field, value } = rawParams.filter
    query.$filter =
      operation === 'eq'
        ? `${field} eq '${value}'`
        : `${operation}(${field},'${value}')`
  }

  if (rawParams.select?.length) {
    query.$select = rawParams.select.join(',')
  }

  return query
}
