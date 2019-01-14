type WhereAndOr<SObject> = {
  and?: Where<SObject>
  or?: Where<SObject>
}

export type WhereCondition<T> = {
  eq?: T
  ne?: T
  lt?: T
  lte?: T
  gt?: T
  gte?: T
  like?: string
  in?: T[]
  nin?: T[]
}

export type Where<SObject> = WhereAndOr<SObject> & { [Field in keyof SObject]: WhereCondition<SObject[Field]> }

export type OrderType = 'ASC NULLS FIRST' | 'ASC NULLS LAST' | 'ASC' | 'DESC NULLS FIRST' | 'DESC NULLS LAST' | 'DESC'

export type Order<SObject> = { [Field in keyof SObject]: OrderType }[]

export type Criteria<SObject> = {
  where?: Where<SObject>
  orderby?: Order<SObject>
  limit?: number
  offset?: number
}

type RemoteObjectModel<SObject> = {
  get: (field_name: keyof SObject) => any
  _fields: { [field_name: string]: any }
}

type RemotingEvent = {
  action: string
  method: string
  ref: boolean
  result: { [key: string]: any }
  status: boolean
  statusCode: number
  tid: number
  type: string
}

export type RemoteObject = {
  retrieve<SObject>(
    criteria: Criteria<SObject>,
    result: (error: Error | null, records: RemoteObjectModel<SObject>[]) => void,
  ): void
  create(
    props: { [field_name: string]: any },
    result: (error: Error | null, affected_ids: string[], event: RemotingEvent) => void,
  ): void
  update(
    ids: string[],
    props: { [field_name: string]: any },
    result: (error: Error | null, affected_ids: string[], event: RemotingEvent) => void,
  ): void
  del(id: string, result: (error: Error | null, affected_ids: string[], event: RemotingEvent) => void): void
}