import { Where, Order, WhereCondition, OrderType } from './s-object-model'

export type Record<SObject, Extensions = {}> = Readonly<SObject> & UpdateModel<SObject, Extensions> & Extensions

export type InsertModel<SObject, Extensions> = Readonly<SObject> & {
  set<Field extends keyof SObject>(
    this: InsertModel<SObject, Extensions>,
    field_name_: Field,
    value_: SObject[Field],
  ): InsertModel<SObject, Extensions>
  insert(): Promise<Record<SObject, Extensions>>
}

export type UpdateModel<SObject, Extensions> = {
  _update_fields: (keyof SObject)[]
  set<Field extends keyof SObject>(
    field_name_: Field,
    value_: SObject[Field],
  ): Readonly<SObject> & UpdateModel<SObject, Extensions>
  update(): Promise<Record<SObject, Extensions>>
  delete(): Promise<void>
  toObject(): SObject
}

export type Funcs<SObject, Extensions> = {
  _wheres: Where<SObject>
  _orders: Order<SObject>
  _limit: number | null
  _offset: number | null
  _size: number | null
  where<Field extends keyof SObject>(
    this: Funcs<SObject, Extensions>,
    field: Field,
    condition: WhereCondition<SObject[Field]>,
  ): Funcs<SObject, Extensions>
  and(
    this: Funcs<SObject, Extensions>,
    ...wheres: ((
      _: {
        where<Field extends keyof SObject>(field: Field, condition: WhereCondition<SObject[Field]>): void
      },
    ) => void)[]
  ): Funcs<SObject, Extensions>
  or(
    this: Funcs<SObject, Extensions>,
    ...wheres: ((
      _: {
        where<Field extends keyof SObject>(field: Field, condition: WhereCondition<SObject[Field]>): void
      },
    ) => void)[]
  ): Funcs<SObject, Extensions>
  order(this: Funcs<SObject, Extensions>, field: keyof SObject, order_type: OrderType): Funcs<SObject, Extensions>
  limit(this: Funcs<SObject, Extensions>, size: number): Funcs<SObject, Extensions>
  offset(this: Funcs<SObject, Extensions>, size: number): Funcs<SObject, Extensions>
  size(this: Funcs<SObject, Extensions>, size: number): Funcs<SObject, Extensions>
  one(this: Funcs<SObject, Extensions>): Promise<Record<SObject, Extensions> | null>
  all(this: Funcs<SObject, Extensions>): Promise<(Record<SObject, Extensions>)[]>
  _clear(this: Funcs<SObject, Extensions>): void
  record(_?: Readonly<SObject>): InsertModel<SObject, Extensions>
}
