import { Where, Order, WhereCondition, OrderType } from './s-object-model'

type NonNullableWithoutUndefined<T> = T extends null ? never : T

type NonNullableProperty<T> = {
  [P in keyof T]: NonNullableWithoutUndefined<T[P]>
}

export type TRORecord<ObjectLiteral, SObject, Extensions = {}> = Readonly<NonNullableProperty<SObject>> &
  Extensions & {
    type: ObjectLiteral
    _update_fields: (keyof SObject)[]
    set<K extends keyof SObject>(field_name: K, value: SObject[K]): TRORecord<ObjectLiteral, SObject, Extensions>
    update(): Promise<TRORecord<ObjectLiteral, SObject, Extensions>>
    update<K extends keyof FetchResultTypes<ObjectLiteral, SObject, Extensions>>(
      options?: UpsertOptions<K>,
    ): Promise<FetchResultTypes<ObjectLiteral, SObject, Extensions>[K]>
    delete(): Promise<void>
    toObject(): SObject
  }

export type FetchResultTypes<ObjectLiteral, SObject, Extensions> = {
  true: TRORecord<ObjectLiteral, SObject, Extensions>
  false: void
}

export type UpsertOptions<T> = {
  fetch: T
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
  insert(props: SObject): Promise<TRORecord<ObjectLiteral, SObject, Extensions>>
  insert<K extends keyof FetchResultTypes<ObjectLiteral, SObject, Extensions>>(
    props: SObject,
    options: UpsertOptions<K>,
  ): Promise<FetchResultTypes<ObjectLiteral, SObject, Extensions>[K]>
  update(id: string, props: SObject): Promise<TRORecord<ObjectLiteral, SObject, Extensions>>
  update<K extends keyof FetchResultTypes<ObjectLiteral, SObject, Extensions>>(
    id: string,
    props: SObject,
    options: UpsertOptions<K>,
  ): Promise<FetchResultTypes<ObjectLiteral, SObject, Extensions>[K]>
  delete(id: string): Promise<void>
}
