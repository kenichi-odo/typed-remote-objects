export type WhereCondition<T> = {
  /**
   * =
   */
  eq?: T

  /**
   * !=
   */
  ne?: T

  /**
   * \<
   */
  lt?: T

  /**
   * \<=
   */
  lte?: T

  /**
   * \>
   */
  gt?: T

  /**
   * \>=
   */
  gte?: T

  /**
   * LIKE
   */
  like?: string

  /**
   * IN
   */
  in?: T[]

  /**
   * NOT IN
   */
  nin?: T[]
}

export type WhereMore<ObjectType> = {
  /**
   * AND
   */
  and?: Where<ObjectType>

  /**
   * OR
   */
  or?: Where<ObjectType>
}

export type WhereObjectType<ObjectType> = {
  [Field in keyof ObjectType]?: WhereCondition<ObjectType[Field]>
}

type WhereCore<ObjectType> = WhereMore<ObjectType> & WhereObjectType<ObjectType>

export type Where<ObjectType> = { [K in keyof WhereCore<ObjectType>]: WhereCore<ObjectType>[K] }

export type OrderType = 'ASC NULLS FIRST' | 'ASC NULLS LAST' | 'ASC' | 'DESC NULLS FIRST' | 'DESC NULLS LAST' | 'DESC'

export type Order<ObjectType> = { [Field in keyof ObjectType]?: OrderType }[]

export type Criteria<ObjectType> = {
  where?: Where<ObjectType>
  orderby?: Order<ObjectType>
  limit?: number
  offset?: number
}

export type RemoteObjectRecord<ObjectType> = {
  get<Field extends keyof ObjectType>(field_name: keyof ObjectType): ObjectType[Field]
  _fields: {
    [field_name: string]: {
      type: string
      shorthand?: string
    }
  }
}

type RemotingEvent = {
  action: string
  method: string
  ref: boolean
  result: { [key: string]: unknown }
  status: boolean
  statusCode: number
  tid: number
  type: string
}

export type RemoteObject<ObjectType> = {
  retrieve(
    criteria: Criteria<ObjectType>,
    result: (error: Error | undefined, records: RemoteObjectRecord<ObjectType>[]) => void,
  ): void
  create<Field extends keyof ObjectType>(
    props: { [field_name: string]: ObjectType[Field] },
    result: (error: Error | undefined, affected_ids: string[], event: RemotingEvent) => void,
  ): void
  update<Field extends keyof ObjectType>(
    ids: string[],
    props: { [field_name: string]: ObjectType[Field] },
    result: (error: Error | undefined, affected_ids: string[], event: RemotingEvent) => void,
  ): void
  del(id: string, result: (error: Error | undefined, affected_ids: string[], event: RemotingEvent) => void): void
  _fields: { [field_name: string]: { type: string; shorthand: string } }
}
