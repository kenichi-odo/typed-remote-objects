import { Where, Order, WhereOperator, OrderType } from './s-object-model'

type NonNullableWithoutUndefined<T> = T extends null ? never : T

type NonNullableProperty<T> = {
  [P in keyof T]: NonNullableWithoutUndefined<T[P]>
}

export type TRORecord<T, U = {}> = Readonly<NonNullableProperty<T>> &
  U & {
    _update_fields: (keyof T)[]
    set<K extends keyof T>(field_name: K, value: T[K]): TRORecord<T, U>
    update(): Promise<TRORecord<T, U>>
    update<K extends keyof FetchResultTypes<T, U>>(options?: UpsertOptions<K>): Promise<FetchResultTypes<T, U>[K]>
    delete(): Promise<void>
    toObject(): T
  }

export type FetchResultTypes<T, U> = {
  true: TRORecord<T, U>
  false: void
}

export type UpsertOptions<T> = {
  fetch: T
}

export type FetchAllOptions = {
  parallel: boolean
}

export type TROInstance<T, U> = {
  _wheres: Where<T>
  _orders: Order<T>[]
  _limit: number | undefined
  _offset: number | undefined
  _size: number | undefined
  where<K extends keyof T>(field: K, condition: WhereOperator<T[K]>): TROInstance<T, U>
  wheres(wheres: Where<T>): TROInstance<T, U>
  order(field: keyof T, order_type: OrderType): TROInstance<T, U>
  limit(size: number): TROInstance<T, U>
  offset(size: number): TROInstance<T, U>
  size(size: number): TROInstance<T, U>
  one(): Promise<TRORecord<T, U> | undefined>
  all(options?: FetchAllOptions): Promise<TRORecord<T, U>[]>
  insert(props: T): Promise<TRORecord<T, U>>
  insert<K extends keyof FetchResultTypes<T, U>>(
    props: T,
    options: UpsertOptions<K>,
  ): Promise<FetchResultTypes<T, U>[K]>
  update(id: string, props: T): Promise<TRORecord<T, U>>
  update<K extends keyof FetchResultTypes<T, U>>(
    id: string,
    props: T,
    options: UpsertOptions<K>,
  ): Promise<FetchResultTypes<T, U>[K]>
  delete(id: string): Promise<void>
}
