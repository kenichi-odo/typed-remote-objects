import { Where, Order, WhereCondition, OrderType } from './s-object-model'

export type TRORecord<SObject, Extensions = {}> = Readonly<SObject> &
  TRORecordInstance<SObject, Extensions> &
  Extensions

export type TRORecordInstance<SObject, Extensions> = {
  _update_fields: (keyof SObject)[]
  set<Field extends keyof SObject>(
    field_name_: Field,
    value_: SObject[Field],
  ): Readonly<SObject> & TRORecordInstance<SObject, Extensions>
  update(): Promise<TRORecord<SObject, Extensions>>
  delete(): Promise<void>
  toObject(): SObject
}

export type TROInstance<SObject, Extensions> = {
  _wheres: Where<SObject>
  _orders: Order<SObject>
  _limit: number | null
  _offset: number | null
  _size: number | null
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
  one(): Promise<TRORecord<SObject, Extensions> | null>
  all(): Promise<(TRORecord<SObject, Extensions>)[]>
  insert(props: SObject): Promise<TRORecord<SObject, Extensions>>
  update(id: string, props: SObject): Promise<TRORecord<SObject, Extensions>>
  delete(id: string): Promise<void>
}

export type TROError = { name: string; message: string; attributes?: unknown }
