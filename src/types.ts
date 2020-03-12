import { Where, Order, WhereCondition, OrderType } from './s-object-model'

export type TRORecordInstance<SObject, Extensions> = {
  _update_fields: (keyof SObject)[]
  set<Field extends keyof SObject>(
    field_name: Field,
    value: SObject[Field],
  ): Readonly<SObject> & TRORecordInstance<SObject, Extensions>
  update(options?: UpsertOptions): Promise<TRORecord<SObject, Extensions>>
  delete(): Promise<void>
  toObject(): SObject
}

export type TRORecord<SObject, Extensions = {}> = Readonly<SObject> &
  TRORecordInstance<SObject, Extensions> &
  Extensions

export type UpsertOptions = {
  fetch: boolean
}

export type FetchAllOptions = {
  parallel: boolean
}

export type TROInstance<SObject, Extensions> = {
  _wheres: Where<SObject>
  _orders: Order<SObject>
  _limit: number | undefined
  _offset: number | undefined
  _size: number | undefined
  where<Field extends keyof SObject>(
    field: Field,
    condition: WhereCondition<SObject[Field]>,
  ): TROInstance<SObject, Extensions>
  wheres(wheres: Where<SObject>): TROInstance<SObject, Extensions>
  and(
    ...wheres: ((_: {
      where<Field extends keyof SObject>(field: Field, condition: WhereCondition<SObject[Field]>): void
    }) => void)[]
  ): TROInstance<SObject, Extensions>
  or(
    ...wheres: ((_: {
      where<Field extends keyof SObject>(field: Field, condition: WhereCondition<SObject[Field]>): void
    }) => void)[]
  ): TROInstance<SObject, Extensions>
  order(field: keyof SObject, order_type: OrderType): TROInstance<SObject, Extensions>
  limit(size: number): TROInstance<SObject, Extensions>
  offset(size: number): TROInstance<SObject, Extensions>
  size(size: number): TROInstance<SObject, Extensions>
  one(): Promise<TRORecord<SObject, Extensions> | undefined>
  all(options?: FetchAllOptions): Promise<TRORecord<SObject, Extensions>[]>
  insert(props: SObject, options?: UpsertOptions): Promise<TRORecord<SObject, Extensions> | undefined>
  update(id: string, props: SObject, options?: UpsertOptions): Promise<TRORecord<SObject, Extensions> | undefined>
  delete(id: string): Promise<void>
}
