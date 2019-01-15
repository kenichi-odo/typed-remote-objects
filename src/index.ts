declare const SObjectModel: { [object_name: string]: new () => RemoteObject }

const Deepmerge: {
  <T1, T2>(x: Partial<T1>, y: Partial<T2>): T1 & T2
  all(objects: any[]): object
} = require('deepmerge')

import { WhereCondition, Where, Order, OrderType, Criteria, RemoteObject } from './s-object-model'

class RemoteObjectError extends Error {
  public attr

  constructor(error: Error, attr) {
    super(error.message)

    this.name = error.name
    this.attr = attr

    Object.setPrototypeOf(this, RemoteObjectError.prototype)
  }
}

const _s_object_models: { [object_name: string]: RemoteObject | null } = {}
class RemoteObjectWrapper<SObject, Extensions> {
  private remote_object: RemoteObject

  constructor(private object_name: string, private time_zone_offset: number, private extensions?: Extensions) {
    const rom = _s_object_models[object_name]
    if (rom == null) {
      if (SObjectModel[object_name] == null) {
        throw new Error(
          `Object name \`${object_name}\` is unknown. Please check the remote object component definition on Visualforce.`,
        )
      }

      const rom = new SObjectModel[object_name]()
      _s_object_models[object_name] = rom
    }

    this.remote_object = _s_object_models[object_name]!
  }

  protected retrieve({ criteria }: { criteria: Criteria<SObject> }) {
    return new Promise(
      (resolve: (_: TRORecord<SObject, Extensions>[]) => void, reject: (_: RemoteObjectError) => void) => {
        if (criteria.where != null) {
          Object.keys(criteria.where).forEach(_ => {
            const w = criteria.where![_]
            if (_ === 'and' || _ === 'or') {
              Object.keys(w).forEach(ao_key_ => {
                const aow = w[ao_key_]
                const aov = aow[Object.keys(aow)[0]]
                if (aov instanceof Date) {
                  const adjust_date = new Date(aov.getTime())
                  adjust_date.setHours(adjust_date.getHours() - this.time_zone_offset)
                  aow[Object.keys(aow)[0]] = adjust_date
                }
              })
              return
            }

            const v = w[Object.keys(w)[0]]
            if (v instanceof Date) {
              const adjust_date = new Date(v.getTime())
              adjust_date.setHours(adjust_date.getHours() - this.time_zone_offset)
              w[Object.keys(w)[0]] = adjust_date
            }
          })
        }

        this.remote_object.retrieve<SObject>(criteria, (error, records) => {
          if (error != null) {
            reject(new RemoteObjectError(error, { criteria }))
            return
          }

          resolve(
            records.map(_ => {
              const props: SObject = {} as SObject
              Object.keys(_._fields).forEach(key => {
                const field = _._fields[key]

                let field_name = key
                if (field.shorthand != null && field.shorthand !== '') {
                  field_name = field.shorthand
                }

                props[field_name] = _.get(key as keyof SObject)
              })
              return TypedRemoteObjectRecord<SObject, Extensions>({
                object_name: this.object_name,
                time_zone_offset: this.time_zone_offset,
                props,
                extensions: this.extensions,
              })
            }),
          )
        })
      },
    )
  }

  protected retrieves({ criteria, size }: { criteria: Criteria<SObject>; size?: number }) {
    return new Promise(
      async (resolve: (_: TRORecord<SObject, Extensions>[]) => void, reject: (_: RemoteObjectError) => void) => {
        if (criteria.limit != null || criteria.offset != null) {
          const _ = await this.retrieve({ criteria }).catch((_: RemoteObjectError) => _)
          if (_ instanceof RemoteObjectError) {
            reject(_)
            return
          }

          resolve(_)
          return
        }

        if (size == null) {
          size = 2000
        }

        let results: TRORecord<SObject, Extensions>[] = []
        let offset = 0
        while (size > 0) {
          if (size > 100) {
            criteria.limit = 100
            size -= 100
          } else {
            criteria.limit = size
            size = 0
          }

          if (offset !== 0) criteria.offset = offset
          const records = await this.retrieve({ criteria }).catch((_: RemoteObjectError) => _)
          if (records instanceof RemoteObjectError) {
            reject(records)
            return
          }
          if (records.length === 0) break

          results = results.concat(records)
          offset += 100
        }

        resolve(results)
      },
    )
  }

  protected create({ props }: { props: SObject }) {
    return new Promise(
      (resolve: (_: TRORecord<SObject, Extensions>) => void, reject: (_: RemoteObjectError) => void) => {
        Object.keys(props).forEach(_ => {
          const p = props[_]
          if (p instanceof Date) {
            const adjust_date = new Date(p.getTime())
            adjust_date.setHours(adjust_date.getHours() - this.time_zone_offset)
            props[_] = adjust_date
          }
        })

        this.remote_object.create(props, async (error, ids) => {
          if (ids.length === 0) {
            reject(new RemoteObjectError(error!, { props }))
            return
          }

          const _ = await this.retrieve({
            criteria: {
              where: { Id: { eq: ids[0] } } as Where<SObject>,
            },
          }).catch((_: RemoteObjectError) => _)
          if (_ instanceof RemoteObjectError) {
            reject(_)
            return
          }

          resolve(_[0])
        })
      },
    )
  }

  protected update({ props }: { props: SObject }) {
    return new Promise(
      (resolve: (_: TRORecord<SObject, Extensions>) => void, reject: (_: RemoteObjectError) => void) => {
        const id = props['Id']
        Object.keys(props).forEach(_ => {
          const p = props[_]
          if (p instanceof Date) {
            const adjust_date = new Date(p.getTime())
            adjust_date.setHours(adjust_date.getHours() - this.time_zone_offset)
            props[_] = adjust_date
          }
        })
        this.remote_object.update([id], props, async error => {
          if (error != null) {
            reject(new RemoteObjectError(error, { props }))
            return
          }

          const _ = await this.retrieve({
            criteria: {
              where: { Id: { eq: id } } as Where<SObject>,
            },
          }).catch((_: RemoteObjectError) => _)
          if (_ instanceof RemoteObjectError) {
            reject(_)
            return
          }

          resolve(_[0])
        })
      },
    )
  }

  protected delete({ id }: { id: string }) {
    return new Promise<void>((resolve: () => void, reject: (_: RemoteObjectError) => void) => {
      this.remote_object.del(id, error => {
        if (error != null) {
          reject(new RemoteObjectError(error, { id }))
          return
        }

        resolve()
      })
    })
  }
}

class TRORecordInstance<SObject, Extensions> extends RemoteObjectWrapper<SObject, Extensions> {
  private update_fields: (keyof SObject)[] = []

  private constructor(object_name: string, time_zone_offset: number) {
    super(object_name, time_zone_offset)
  }

  static getInstance<SObject, Extensions>(
    object_name: string,
    time_zone_offset: number,
    props: SObject,
    extensions: Extensions = {} as Extensions,
  ) {
    const _ = Deepmerge.all([
      new TRORecordInstance<SObject, Extensions>(object_name, time_zone_offset),
      props,
      extensions,
    ])
    Object.setPrototypeOf(_, TRORecordInstance.prototype)
    return _
  }

  private clone() {
    const _ = Deepmerge<{}, TRORecord<SObject, Extensions>>({}, this as any)
    Object.setPrototypeOf(_, TRORecordInstance.prototype)
    return _
  }

  set<Field extends keyof SObject>(field_name_: Field, value_: SObject[Field]) {
    const _ = this.clone()
    _[field_name_ as string] = value_
    _.update_fields.push(field_name_)
    return _
  }

  async update(this: TRORecord<SObject, Extensions>) {
    const props = { Id: this['Id'] }
    this.update_fields.forEach(_ => {
      props[_ as string] = this[_]
    })

    const _ = await super.update({ props: props as any }).catch((_: RemoteObjectError) => _)
    if (_ instanceof RemoteObjectError) {
      return Promise.reject(_)
    }

    return _
  }

  async delete() {
    const _ = await super.delete({ id: this['Id'] }).catch((_: RemoteObjectError) => _)
    if (_ instanceof RemoteObjectError) {
      throw _
    }
  }
}

type TRORecord<SObject, Extensions = {}> = TRORecordInstance<SObject, Extensions> & Readonly<SObject> & Extensions

const TypedRemoteObjectRecord = <SObject, Extensions>({
  object_name,
  time_zone_offset,
  props,
  extensions,
}: {
  object_name: string
  time_zone_offset: number
  props: SObject
  extensions?: Extensions
}) => {
  return TRORecordInstance.getInstance<SObject, Extensions>(
    object_name,
    time_zone_offset,
    props,
    extensions,
  ) as TRORecord<SObject, Extensions>
}

class TROInstance<SObject, Extensions> extends RemoteObjectWrapper<SObject, Extensions> {
  private _wheres: Where<SObject> = {} as Where<SObject>
  private _orders: Order<SObject> = []
  private _limit: number | null = null
  private _offset: number | null = null
  private _size: number | null = null

  constructor(object_name: string, time_zone_offset: number, extensions?: Extensions) {
    super(object_name, time_zone_offset, extensions)
  }

  private clone() {
    const _ = Deepmerge<{}, TROInstance<SObject, Extensions>>({}, this)
    Object.setPrototypeOf(_, TROInstance.prototype)
    return _
  }

  where<Field extends keyof SObject>(field: Field, condition: WhereCondition<SObject[Field]>) {
    const _ = this.clone()
    _._wheres[field as string] = condition
    return _
  }

  wheres(wheres: Where<SObject>) {
    const _ = this.clone()
    _._wheres = wheres
    return _
  }

  and(
    ...wheres: ((
      _: {
        where<Field extends keyof SObject>(field: Field, condition: WhereCondition<SObject[Field]>): void
      },
    ) => void)[]
  ) {
    const _ = this.clone()

    const ws = {} as Where<SObject>
    wheres.forEach(w_ => {
      w_({
        where(field, condition) {
          ws[field as string] = condition
        },
      })
    })

    _._wheres.and = ws
    return _
  }

  or(
    ...wheres: ((
      _: {
        where<Field extends keyof SObject>(field: Field, condition: WhereCondition<SObject[Field]>): void
      },
    ) => void)[]
  ) {
    const _ = this.clone()

    const ws = {} as Where<SObject>
    wheres.forEach(w_ => {
      w_({
        where(field, condition) {
          ws[field as string] = condition
        },
      })
    })

    _._wheres.or = ws
    return _
  }

  order(field: keyof SObject, order_type: OrderType) {
    const _ = this.clone()
    _._orders.push({ [field]: order_type } as { [Field in keyof SObject]: OrderType })
    return _
  }

  limit(size: number) {
    if (size > 100) {
      throw new Error('Please specify it within 100.')
    }

    const _ = this.clone()
    _._limit = size
    return _
  }

  offset(size: number) {
    if (size > 2000) {
      throw new Error('Please specify it within 2000.')
    }

    const _ = this.clone()
    _._offset = size
    return _
  }

  size(size: number) {
    if (size > 2000) {
      throw new Error('Please specify it within 2000.')
    }

    const _ = this.clone()
    _._size = size
    return _
  }

  async one() {
    const criteria: Criteria<SObject> = {
      limit: 1,
      offset: undefined,
    }

    if (Object.keys(this._wheres).length !== 0) {
      criteria.where = this._wheres
    }

    if (this._orders.length !== 0) {
      criteria.orderby = this._orders
    }

    const _ = await this.retrieve({ criteria }).catch((_: RemoteObjectError) => _)
    if (_ instanceof RemoteObjectError) {
      return Promise.reject(_)
    }

    return _.length === 0 ? null : _[0]
  }

  async all() {
    const criteria: Criteria<SObject> = {}
    if (Object.keys(this._wheres).length !== 0) {
      criteria.where = this._wheres
    }

    if (this._orders.length !== 0) {
      criteria.orderby = this._orders
    }

    if (this._limit != null) {
      criteria.limit = this._limit
    }

    if (this._offset != null) {
      criteria.offset = this._offset
    }

    let size: number | undefined
    if (this._size != null) {
      size = this._size
    }

    const _ = await this.retrieves({ criteria, size }).catch((_: RemoteObjectError) => _)
    if (_ instanceof RemoteObjectError) {
      return Promise.reject(_)
    }

    return _
  }

  async insert(props: SObject) {
    const _ = await this.create({ props }).catch((_: RemoteObjectError) => _)
    if (_ instanceof RemoteObjectError) {
      return Promise.reject(_)
    }

    return _
  }
}

const TypedRemoteObjects = <SObject, Extensions = {}>({
  object_name,
  time_zone_offset,
  extensions,
}: {
  object_name: string
  time_zone_offset: number
  extensions?: Extensions
}) => {
  return new TROInstance<SObject, Extensions>(object_name, time_zone_offset, extensions)
}

export { RemoteObjectError, TRORecord, TypedRemoteObjects }
