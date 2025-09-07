export type Params<Entity> = {
  filter?: {
    operation: 'startswith' | 'endswith' | 'contains'
    field: Extract<keyof Entity, string>
    value: string
  }
  orderby?: {
    field: Extract<keyof Entity, string>
    direction: 'asc' | 'desc'
  }
  top?: number
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
    query.$filter = `${rawParams.filter.operation}(${rawParams.filter.field},'${rawParams.filter.value}')`
  }

  return query
}
