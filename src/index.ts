declare const SObjectModel: { [object_name: string]: new () => RemoteObject }

import Deepmerge from 'deepmerge'
import { CustomError } from 'ts-custom-error'

import { RemoteObject, Criteria, Where, OrderType } from './s-object-model'
import { TRORecord, TRORecordInstance, TROInstance, UpsertOptions, FetchAllOptions } from './types'
export { TRORecord }

export class TROError extends CustomError {
  constructor(public object_name: string, message: string, public attributes?: object) {
    super(message)
  }

  toObject() {
    return { object_name: this.object_name, name: this.name, message: this.message, attributes: this.attributes }
  }
}

const troErrorFactory = (_: { object_name: string; message: string; attributes?: object }) => {
  return new TROError(_.object_name, _.message, _.attributes)
}

const _s_object_models: { [object_name: string]: RemoteObject | undefined } = {}
const _getSObjectModel = <SObject extends object>({
  object_name,
  un_accessible_fields,
}: {
  object_name: string
  un_accessible_fields: (keyof SObject)[]
}): RemoteObject => {
  const som = _s_object_models[object_name]
  if (som == null) {
    if (SObjectModel[object_name] == null) {
      throw troErrorFactory({
        object_name,
        message: `Object name \`${object_name}\` is unknown. Please check the remote object component definition on Visualforce.`,
      })
    }

    const som = new SObjectModel[object_name]()
    un_accessible_fields.forEach(_ => delete som._fields[_ as string])
    _s_object_models[object_name] = som
    return som
  }

  return _s_object_models[object_name]!
}

const _create = <ObjectLiteral, SObject extends object, Extensions>({
  object_name,
  time_zone_offset,
  un_accessible_fields,
  hookExecute,
  extensions,
  props,
  options,
}: {
  object_name: string
  time_zone_offset: number
  un_accessible_fields: (keyof SObject)[]
  hookExecute?: (type: 'insert' | 'update' | 'delete', execute: () => Promise<void>) => Promise<void>
  extensions: Extensions
  props: SObject
  options?: UpsertOptions
}) => {
  return new Promise<TRORecord<ObjectLiteral, SObject, Extensions> | undefined>((resolve, reject) => {
    Object.keys(props).forEach(_ => {
      const p = props[_]
      if (p instanceof Date) {
        const adjust_date = new Date(p.getTime())
        adjust_date.setHours(adjust_date.getHours() - time_zone_offset)
        props[_] = adjust_date
      }
    })

    _getSObjectModel({ object_name, un_accessible_fields }).create(props, async (error, ids) => {
      if (ids.length === 0) {
        reject(troErrorFactory({ object_name, message: error!.message, attributes: { props } }))
        return
      }

      if (options != null && !options.fetch) {
        resolve()
        return
      }

      const _ = await _retrieve<ObjectLiteral, SObject, Extensions>({
        object_name,
        time_zone_offset,
        un_accessible_fields,
        hookExecute,
        extensions,
        criteria: { where: { Id: { eq: ids[0] } } as Where<SObject> },
      }).catch((_: Error) => _)
      if (_ instanceof Error) {
        reject(_)
        return
      }

      resolve(_[0])
    })
  })
}

const _update = <ObjectLiteral, SObject extends object, Extensions>({
  object_name,
  time_zone_offset,
  un_accessible_fields,
  hookExecute,
  extensions,
  props,
  options,
}: {
  object_name: string
  time_zone_offset: number
  un_accessible_fields: (keyof SObject)[]
  hookExecute?: (type: 'insert' | 'update' | 'delete', execute: () => Promise<void>) => Promise<void>
  extensions: Extensions
  props: SObject
  options?: UpsertOptions
}) => {
  return new Promise<TRORecord<ObjectLiteral, SObject, Extensions> | undefined>((resolve, reject) => {
    const id = props['Id']
    Object.keys(props).forEach(_ => {
      const p = props[_]
      if (p instanceof Date) {
        const adjust_date = new Date(p.getTime())
        adjust_date.setHours(adjust_date.getHours() - time_zone_offset)
        props[_] = adjust_date
      }
    })

    _getSObjectModel({ object_name, un_accessible_fields }).update([id], props, async error => {
      if (error != null) {
        reject(troErrorFactory({ object_name, message: error.message, attributes: { props } }))
        return
      }

      if (options != null && !options.fetch) {
        resolve()
        return
      }

      const _ = await _retrieve<ObjectLiteral, SObject, Extensions>({
        object_name,
        time_zone_offset,
        un_accessible_fields,
        hookExecute,
        extensions,
        criteria: { where: { Id: { eq: id } } as Where<SObject> },
      }).catch((_: Error) => _)
      if (_ instanceof Error) {
        reject(_)
        return
      }

      resolve(_[0])
    })
  })
}

const _delete = <SObject extends object>({
  object_name,
  id,
  un_accessible_fields,
}: {
  object_name: string
  id: string
  un_accessible_fields: (keyof SObject)[]
}) => {
  return new Promise<void>((resolve, reject) => {
    _getSObjectModel({ object_name, un_accessible_fields }).del(id, error => {
      if (error != null) {
        reject(troErrorFactory({ object_name, message: error.message, attributes: { id } }))
        return
      }

      resolve()
    })
  })
}

const _retrieve = <ObjectLiteral, SObject extends object, Extensions>({
  object_name,
  time_zone_offset,
  un_accessible_fields,
  hookExecute,
  extensions,
  criteria,
}: {
  object_name: string
  time_zone_offset: number
  un_accessible_fields: (keyof SObject)[]
  hookExecute?: (type: 'insert' | 'update' | 'delete', execute: () => Promise<void>) => Promise<void>
  extensions: Extensions
  criteria: Criteria<SObject>
}) => {
  return new Promise<TRORecord<ObjectLiteral, SObject, Extensions>[]>((resolve, reject) => {
    if (criteria.where != null) {
      Object.keys(criteria.where).forEach(_ => {
        const w = criteria.where![_]
        if (_ === 'and' || _ === 'or') {
          Object.keys(w).forEach(ao_key_ => {
            const aow = w[ao_key_]
            const aov = aow[Object.keys(aow)[0]]
            if (aov instanceof Date) {
              const adjust_date = new Date(aov.getTime())
              adjust_date.setHours(adjust_date.getHours() - time_zone_offset)
              aow[Object.keys(aow)[0]] = adjust_date
            }
          })
          return
        }

        const v = w[Object.keys(w)[0]]
        if (v instanceof Date) {
          const adjust_date = new Date(v.getTime())
          adjust_date.setHours(adjust_date.getHours() - time_zone_offset)
          w[Object.keys(w)[0]] = adjust_date
        }
      })
    }

    _getSObjectModel({ object_name, un_accessible_fields }).retrieve<SObject>(criteria, (error, records) => {
      if (error != null) {
        reject(troErrorFactory({ object_name, message: error.message, attributes: { criteria } }))
        return
      }

      resolve(
        records.map(record => {
          const tro_record_instance: Readonly<SObject> & TRORecordInstance<ObjectLiteral, SObject, Extensions> = {
            type: (object_name as unknown) as ObjectLiteral,
            _update_fields: [] as (keyof SObject)[],
            set(fn, v) {
              const _ = Deepmerge({}, this)
              _[fn as string] = v
              _._update_fields.push(fn)
              return _
            },
            async update(options) {
              const ops = { Id: this['Id'] } as SObject
              this._update_fields.forEach(_ => {
                ops[_ as string] = this[_]
              })

              const ps = {
                object_name,
                time_zone_offset,
                un_accessible_fields,
                hookExecute,
                extensions,
                props: ops,
                options,
              }
              if (hookExecute == null) {
                return await _update(ps)
              }

              let _: TRORecord<ObjectLiteral, SObject, Extensions> | undefined
              hookExecute('update', async () => {
                _ = await _update(ps)
              })
              return _
            },
            async delete() {
              const ps = { object_name, id: this['Id'], un_accessible_fields }
              if (hookExecute == null) {
                await _delete(ps)
                return
              }

              hookExecute('delete', async () => {
                await _delete(ps)
              })
            },
            toObject() {
              const _ = Deepmerge({}, this)
              delete _.type
              delete _._update_fields
              delete _.set
              delete _.update
              delete _.delete
              delete _.toObject
              return _
            },
          } as Readonly<SObject> & TRORecordInstance<ObjectLiteral, SObject, Extensions>

          Object.keys(record._fields).forEach(key => {
            const field = record._fields[key]

            let field_name = key
            if (field.shorthand != null && field.shorthand !== '') {
              field_name = field.shorthand
            }

            tro_record_instance[field_name] = record.get(key as keyof SObject)
          })

          return Deepmerge.all([{}, tro_record_instance, extensions]) as TRORecord<ObjectLiteral, SObject, Extensions>
        }),
      )
    })
  })
}

const _retrieves = <ObjectLiteral, SObject extends object, Extensions>({
  object_name,
  time_zone_offset,
  un_accessible_fields,
  hookExecute,
  extensions,
  criteria,
  size,
  options,
}: {
  object_name: string
  time_zone_offset: number
  un_accessible_fields: (keyof SObject)[]
  hookExecute?: (type: 'insert' | 'update' | 'delete', execute: () => Promise<void>) => Promise<void>
  extensions: Extensions
  criteria: Criteria<SObject>
  size?: number
  options?: FetchAllOptions
}) => {
  return new Promise<TRORecord<ObjectLiteral, SObject, Extensions>[]>(async (resolve, reject) => {
    if (criteria.limit != null || criteria.offset != null) {
      const _ = await _retrieve<ObjectLiteral, SObject, Extensions>({
        object_name,
        time_zone_offset,
        un_accessible_fields,
        hookExecute,
        extensions,
        criteria,
      }).catch((_: Error) => _)
      if (_ instanceof Error) {
        reject(_)
        return
      }

      resolve(_)
      return
    }

    let offset = 0
    if (size == null) {
      size = 2000
    }

    if (options == null || !options.parallel) {
      let results: TRORecord<ObjectLiteral, SObject, Extensions>[] = []
      while (size > 0) {
        if (size > 100) {
          criteria.limit = 100
          size -= 100
        } else {
          criteria.limit = size
          size = 0
        }

        if (offset !== 0) {
          criteria.offset = offset
        }

        const records = await _retrieve<ObjectLiteral, SObject, Extensions>({
          object_name,
          time_zone_offset,
          un_accessible_fields,
          hookExecute,
          extensions,
          criteria,
        }).catch((_: Error) => _)
        if (records instanceof Error) {
          reject(records)
          return
        }

        if (records.length === 0) {
          break
        }

        results = results.concat(records)
        offset += 100
      }

      resolve(results)
      return
    }

    const promises: Promise<TRORecord<ObjectLiteral, SObject, Extensions>[]>[] = []
    while (size > 0) {
      if (size > 100) {
        criteria.limit = 100
        size -= 100
      } else {
        criteria.limit = size
        size = 0
      }

      if (offset !== 0) {
        criteria.offset = offset
      }

      promises.push(
        _retrieve<ObjectLiteral, SObject, Extensions>({
          object_name,
          time_zone_offset,
          un_accessible_fields,
          hookExecute,
          extensions,
          criteria: Deepmerge({}, criteria),
        }),
      )

      offset += 100
    }

    const awaits = await Promise.all(promises).catch((_: Error) => _)
    if (awaits instanceof Error) {
      reject(awaits)
      return
    }

    resolve(awaits.flat())
  })
}

const TypedRemoteObjects = <ObjectLiteral, SObject extends object, Extensions = {}>({
  object_name,
  time_zone_offset,
  un_accessible_fields = [],
  extensions = {} as Extensions,
  hookExecute,
}: {
  object_name: string
  time_zone_offset: number
  un_accessible_fields?: (keyof SObject)[]
  extensions?: Extensions
  hookExecute?: (type: 'insert' | 'update' | 'delete', execute: () => Promise<void>) => Promise<void>
}): TROInstance<ObjectLiteral, SObject, Extensions> => {
  return {
    _wheres: {} as Where<SObject>,
    _orders: [],
    _limit: undefined,
    _offset: undefined,
    _size: undefined,
    where(field, condition) {
      const _ = Deepmerge({}, this)
      _._wheres[field as string] = condition
      return _
    },
    wheres(wheres) {
      const _ = Deepmerge({}, this)
      _._wheres = wheres
      return _
    },
    and(...wheres) {
      const _ = Deepmerge({}, this)

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
    },
    or(...wheres) {
      const _ = Deepmerge({}, this)

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
    },
    order(field, order_type) {
      const _ = Deepmerge({}, this)
      _._orders.push({ [field]: order_type } as { [Field in keyof SObject]: OrderType })
      return _
    },
    limit(size) {
      if (size > 100) {
        throw 'Please specify it within 100.'
      }

      const _ = Deepmerge({}, this)
      _._limit = size
      return _
    },
    offset(size) {
      if (size > 2000) {
        throw 'Please specify it within 2000.'
      }

      const _ = Deepmerge({}, this)
      _._offset = size
      return _
    },
    size(size) {
      if (size > 2000) {
        throw 'Please specify it within 2000.'
      }

      const _ = Deepmerge({}, this)
      _._size = size
      return _
    },
    async one() {
      const criteria: Criteria<SObject> = {}
      if (Object.keys(this._wheres).length !== 0) {
        criteria.where = this._wheres
      }

      if (this._orders.length !== 0) {
        criteria.orderby = this._orders
      }

      criteria.limit = 1
      criteria.offset = undefined

      const _ = await _retrieve<ObjectLiteral, SObject, Extensions>({
        object_name,
        time_zone_offset,
        un_accessible_fields,
        hookExecute,
        extensions,
        criteria,
      }).catch((_: Error) => _)
      if (_ instanceof Error) {
        return Promise.reject(_)
      }

      return _.length === 0 ? undefined : _[0]
    },
    async all(options) {
      const criteria: Criteria<SObject> = {}
      if (Object.keys(this._wheres).length !== 0) {
        criteria.where = this._wheres
      }

      if (this._orders.length !== 0) {
        criteria.orderby = this._orders
      }

      criteria.limit = this._limit
      criteria.offset = this._offset

      return await _retrieves<ObjectLiteral, SObject, Extensions>({
        object_name,
        time_zone_offset,
        un_accessible_fields,
        hookExecute,
        extensions,
        criteria,
        size: this._size,
        options,
      })
    },
    async insert(props, options) {
      const ps = { object_name, time_zone_offset, un_accessible_fields, hookExecute, extensions, props, options }
      if (hookExecute == null) {
        return await _create<ObjectLiteral, SObject, Extensions>(ps)
      }

      let _!: TRORecord<ObjectLiteral, SObject, Extensions> | undefined
      await hookExecute('insert', async () => {
        _ = await _create<ObjectLiteral, SObject, Extensions>(ps)
      })
      return _
    },
    async update(id, props, options) {
      ;(props as SObject & { Id: string }).Id = id
      const ps = {
        object_name,
        time_zone_offset,
        un_accessible_fields,
        hookExecute,
        extensions,
        props,
        options,
      }

      if (hookExecute == null) {
        return await _update(ps)
      }

      let _!: TRORecord<ObjectLiteral, SObject, Extensions> | undefined
      await hookExecute('update', async () => {
        _ = await _update(ps)
      })
      return _
    },
    async delete(id) {
      const ps = { object_name, id, un_accessible_fields }
      if (hookExecute == null) {
        await _delete(ps)
        return
      }

      await hookExecute('delete', async () => {
        await _delete(ps)
      })
    },
  }
}

export default TypedRemoteObjects
