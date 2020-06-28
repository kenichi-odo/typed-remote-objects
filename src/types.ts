import { Where, Order, WhereCondition, OrderType } from './s-object-model'

export type TRORecordInstance<ObjectLiteral, SObject, Extensions> = {
  type: ObjectLiteral
  _update_fields: (keyof SObject)[]
  set<Field extends keyof SObject>(
    field_name: Field,
    value: SObject[Field],
  ): Readonly<SObject> & TRORecordInstance<ObjectLiteral, SObject, Extensions>
  update(options?: UpsertOptions): Promise<TRORecord<ObjectLiteral, SObject, Extensions>>
  delete(): Promise<void>
  toObject(): SObject
}

type NonNullableWithoutUndefined<T> = T extends null ? never : T

type NonNullableProperty<T> = {
  [P in keyof T]: NonNullableWithoutUndefined<T[P]>
}

export type TRORecord<ObjectLiteral, SObject, Extensions = {}> = Readonly<NonNullableProperty<SObject>> &
  TRORecordInstance<ObjectLiteral, SObject, Extensions> &
  Extensions

export type UpsertOptions = {
  fetch: boolean
}

export type FetchAllOptions = {
  parallel: boolean
}

export type TROInstance<ObjectLiteral, SObject, Extensions> = {
  _wheres: Where<SObject>
  _orders: Order<SObject>
  _limit: number | undefined
  _offset: number | undefined
  _size: number | undefined
  where<Field extends keyof SObject>(
    field: Field,
    condition: WhereCondition<SObject[Field]>,
  ): TROInstance<ObjectLiteral, SObject, Extensions>
  wheres(wheres: Where<SObject>): TROInstance<ObjectLiteral, SObject, Extensions>
  and(
    ...wheres: ((_: {
      where<Field extends keyof SObject>(field: Field, condition: WhereCondition<SObject[Field]>): void
    }) => void)[]
  ): TROInstance<ObjectLiteral, SObject, Extensions>
  or(
    ...wheres: ((_: {
      where<Field extends keyof SObject>(field: Field, condition: WhereCondition<SObject[Field]>): void
    }) => void)[]
  ): TROInstance<ObjectLiteral, SObject, Extensions>
  order(field: keyof SObject, order_type: OrderType): TROInstance<ObjectLiteral, SObject, Extensions>
  limit(size: number): TROInstance<ObjectLiteral, SObject, Extensions>
  offset(size: number): TROInstance<ObjectLiteral, SObject, Extensions>
  size(size: number): TROInstance<ObjectLiteral, SObject, Extensions>
  one(): Promise<TRORecord<ObjectLiteral, SObject, Extensions> | undefined>
  all(options?: FetchAllOptions): Promise<TRORecord<ObjectLiteral, SObject, Extensions>[]>
  insert(props: SObject, options?: UpsertOptions): Promise<TRORecord<ObjectLiteral, SObject, Extensions> | undefined>
  update(
    id: string,
    props: SObject,
    options?: UpsertOptions,
  ): Promise<TRORecord<ObjectLiteral, SObject, Extensions> | undefined>
  delete(id: string): Promise<void>
}
