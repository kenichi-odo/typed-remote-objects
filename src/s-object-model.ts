export type Operator<T> = {
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

type LogicalOperator<SObjectType> = {
  /**
   * AND
   */
  and?: Where<SObjectType>

  /**
   * OR
   */
  or?: Where<SObjectType>
}

type Conditions<SObjectType> = {
  [Field in keyof SObjectType]?: Operator<SObjectType[Field]>
}

type ConditionsAndLogicalOperator<SObjectType> = Conditions<SObjectType> & LogicalOperator<SObjectType>

export type Where<SObjectType> = {
  [Key in keyof ConditionsAndLogicalOperator<SObjectType>]: ConditionsAndLogicalOperator<SObjectType>[Key]
}

type OrderType = 'ASC NULLS FIRST' | 'ASC NULLS LAST' | 'ASC' | 'DESC NULLS FIRST' | 'DESC NULLS LAST' | 'DESC'

type Order<SObjectType> = {
  [Field in keyof SObjectType]?: OrderType
}[]

export type Criteria<SObjectType> = {
  where?: Where<SObjectType>
  orderby?: Order<SObjectType>
  limit?: number
  offset?: number
}

export type Props<SObjectType> = {
  [Field in keyof SObjectType]?: SObjectType[Field] extends boolean ? SObjectType[Field] : SObjectType[Field] | null
}

type RemoteObjectEvent = {
  action: string
  method: string
  ref: boolean
  result: { [key: string]: unknown }
  status: boolean
  statusCode: number
  tid: number
  type: string
}

export type RemoteObjectInstance<SObjectType> = {
  retrieve(
    criteria: Criteria<SObjectType>,
    result: (
      error: Error | undefined,
      records: {
        get<Field extends keyof SObjectType>(field_name: keyof SObjectType): SObjectType[Field]
        _fields: {
          [Field in keyof SObjectType]: {
            type: string
            shorthand?: string
          }
        }
      }[],
    ) => void,
  ): void

  create(
    props: Props<SObjectType>,
    result: (error: Error | null, affected_ids: string[], event: RemoteObjectEvent) => void,
  ): void

  update(
    ids: string[],
    props: Props<SObjectType>,
    result: (error: Error | null, affected_ids: string[], event: RemoteObjectEvent) => void,
  ): void

  del(id: string, result: (error: Error | undefined, affected_ids: string[], event: RemoteObjectEvent) => void): void

  /**
   * Accessible fields.
   */
  _fields: {
    [Field in keyof SObjectType]: {
      type: string
      shorthand: string
    }
  }
}
