type WhereAndOr<T> = {
  /**
   * AND
   */
  and?: Where<T>

  /**
   * OR
   */
  or?: Where<T>
}

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

export type Where<T> = WhereAndOr<T> & { [K in keyof T]: WhereCondition<T[K]> }

export type OrderType = 'ASC NULLS FIRST' | 'ASC NULLS LAST' | 'ASC' | 'DESC NULLS FIRST' | 'DESC NULLS LAST' | 'DESC'

export type Order<T> = { [K in keyof T]: OrderType }

export type Criteria<T> = {
  where?: Where<T>
  orderby?: Order<T>[]
  limit?: number
  offset?: number
}

export type RemoteObjectRecord<T> = {
  get: (field_name: keyof T) => any
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
  result: { [key: string]: any }
  status: boolean
  statusCode: number
  tid: number
  type: string
}

export type RemoteObject = {
  retrieve<T>(criteria: Criteria<T>, result: (error: Error | undefined, records: RemoteObjectRecord<T>[]) => void): void
  create(
    props: { [field_name: string]: any },
    result: (error: Error | undefined, affected_ids: string[], event: RemotingEvent) => void,
  ): void
  update(
    ids: string[],
    props: { [field_name: string]: any },
    result: (error: Error | undefined, affected_ids: string[], event: RemotingEvent) => void,
  ): void
  del(id: string, result: (error: Error | undefined, affected_ids: string[], event: RemotingEvent) => void): void
}
