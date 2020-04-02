import Deepmerge from 'deepmerge'
import { CustomError } from 'ts-custom-error'

declare const SObjectModel: { [object_name: string]: new () => RemoteObject }

import { RemoteObject, Criteria, Where, OrderType } from './s-object-model'
import { TRORecord, TROInstance, UpsertOptions, FetchAllOptions, FetchResultTypes } from './types'
export { TRORecord }

export class TROError extends CustomError {
  constructor(public object_name: string, message: string, public attributes?: object) {
    super(message)
  }

  toObject() {
    return { object_name: this.object_name, name: this.name, message: this.message, attributes: this.attributes }
  }
}

const _troErrorFactory = (_: { object_name: string; message: string; attributes?: object }) => {
  return new TROError(_.object_name, _.message, _.attributes)
}

const _s_object_models: { [object_name: string]: RemoteObject | undefined } = {}
const _getSObjectModel = ({ object_name }: { object_name: string }): RemoteObject => {
  const som = _s_object_models[object_name]
  if (som == null) {
    if (SObjectModel[object_name] == null) {
      throw _troErrorFactory({
        object_name,
        message: `Object name \`${object_name}\` is unknown. Please check the remote object component definition on Visualforce.`,
      })
    }

    const som = new SObjectModel[object_name]()
    _s_object_models[object_name] = som
    return som
  }

  return _s_object_models[object_name]!
}

const _create = <T, U>({
  object_name,
  time_zone_offset,
  hookExecute,
  extensions,
  props,
  options,
}: {
  object_name: string
  time_zone_offset: number
  hookExecute?: (type: 'insert' | 'update' | 'delete', execute: () => Promise<void>) => Promise<void>
  extensions?: (_: T) => U
  props: T
  options?: UpsertOptions<keyof FetchResultTypes<T, U>>
}) => {
  return new Promise<TRORecord<T, U> | undefined>((resolve, reject) => {
    const clone_props = Deepmerge<T>({}, props)

    Object.keys(clone_props).forEach(_ => {
      const p = clone_props[_]
      if (p instanceof Date) {
        const adjust_date = new Date(p)
        adjust_date.setHours(adjust_date.getHours() - time_zone_offset)
        clone_props[_] = adjust_date
      }
    })

    _getSObjectModel({ object_name }).create(clone_props, async (error, ids) => {
      if (ids.length === 0) {
        reject(_troErrorFactory({ object_name, message: error!.message, attributes: { props: clone_props } }))
        return
      }

      if (options != null && !options.fetch) {
        resolve()
        return
      }

      const _ = await _retrieve({
        object_name,
        time_zone_offset,
        hookExecute,
        extensions,
        criteria: { where: { Id: { eq: ids[0] } } as Where<T> },
      }).catch((_: Error) => _)
      if (_ instanceof Error) {
        reject(_)
        return
      }

      resolve(_[0])
    })
  })
}

const _update = <T, U>({
  object_name,
  time_zone_offset,
  hookExecute,
  extensions,
  props,
  options,
}: {
  object_name: string
  time_zone_offset: number
  hookExecute?: (type: 'insert' | 'update' | 'delete', execute: () => Promise<void>) => Promise<void>
  extensions?: (_: T) => U
  props: T
  options?: UpsertOptions<keyof FetchResultTypes<T, U>>
}) => {
  return new Promise<TRORecord<T, U> | undefined>((resolve, reject) => {
    const clone_props = Deepmerge<T>({}, props)

    Object.keys(clone_props).forEach(_ => {
      const p = clone_props[_]
      if (p instanceof Date) {
        const adjust_date = new Date(p)
        adjust_date.setHours(adjust_date.getHours() - time_zone_offset)
        clone_props[_] = adjust_date
      }
    })

    const id = clone_props['Id']
    _getSObjectModel({ object_name }).update([id], clone_props, async error => {
      if (error != null) {
        reject(_troErrorFactory({ object_name, message: error.message, attributes: { props: clone_props } }))
        return
      }

      if (options != null && !options.fetch) {
        resolve()
        return
      }

      const _ = await _retrieve({
        object_name,
        time_zone_offset,
        hookExecute,
        extensions,
        criteria: { where: { Id: { eq: id } } as Where<T> },
      }).catch((_: Error) => _)
      if (_ instanceof Error) {
        reject(_)
        return
      }

      resolve(_[0])
    })
  })
}

const _delete = ({ object_name, id }: { object_name: string; id: string }) => {
  return new Promise<void>((resolve, reject) => {
    _getSObjectModel({ object_name }).del(id, error => {
      if (error != null) {
        reject(_troErrorFactory({ object_name, message: error.message, attributes: { id } }))
        return
      }

      resolve()
    })
  })
}

const _retrieve = <T, U>({
  object_name,
  time_zone_offset,
  hookExecute,
  extensions = (() => ({})) as (_?: T) => U,
  criteria,
}: {
  object_name: string
  time_zone_offset: number
  hookExecute?: (type: 'insert' | 'update' | 'delete', execute: () => Promise<void>) => Promise<void>
  extensions?: (_: T) => U
  criteria: Criteria<T>
}) => {
  return new Promise<TRORecord<T, U>[]>((resolve, reject) => {
    if (criteria.where != null) {
      console.log('criteria.where', criteria.where)
      Object.keys(criteria.where).forEach(field_name => {
        console.log('field_name', field_name)
        const w: Where<T> = criteria.where![field_name]
        // if (_ === 'and' || _ === 'or') {
        //   Object.keys(w).forEach(ao_key_ => {
        //     const aow = w[ao_key_]
        //     const aov = aow[Object.keys(aow)[0]]
        //     if (aov instanceof Date) {
        //       const adjust_date = new Date(aov)
        //       adjust_date.setHours(adjust_date.getHours() - time_zone_offset)
        //       aow[Object.keys(aow)[0]] = adjust_date
        //     }
        //   })
        //   return
        // }

        const v = w[Object.keys(w)[0]]
        if (v instanceof Date) {
          const adjust_date = new Date(v)
          adjust_date.setHours(adjust_date.getHours() - time_zone_offset)
          w[Object.keys(w)[0]] = adjust_date
        }
      })
    }

    _getSObjectModel({ object_name }).retrieve<T>(criteria, (error, records) => {
      if (error != null) {
        reject(_troErrorFactory({ object_name, message: error.message, attributes: { criteria } }))
        return
      }

      console.log('records', records)

      resolve(
        records.map(record => {
          const tro_record: TRORecord<T, U> = ({
            _update_fields: [],
            set(fn, v) {
              const _ = Deepmerge({}, tro_record)
              _[fn] = v
              _._update_fields.push(fn)
              return _
            },
            async update(options) {
              const ops = ({ Id: tro_record['Id'] } as unknown) as T
              tro_record._update_fields.forEach(_ => {
                ops[_] = tro_record[_]
              })

              const ps = {
                object_name,
                time_zone_offset,
                hookExecute,
                extensions,
                props: ops,
                options,
              }
              if (hookExecute == null) {
                return await _update(ps)
              }

              let _: TRORecord<T, U> | undefined
              hookExecute('update', async () => {
                _ = await _update(ps)
              })
              return _
            },
            async delete() {
              const ps = { object_name, id: tro_record['Id'] }
              if (hookExecute == null) {
                await _delete(ps)
                return
              }

              hookExecute('delete', async () => {
                await _delete(ps)
              })
            },
            toObject() {
              const _ = Deepmerge({}, tro_record)
              delete _._update_fields
              delete _.set
              delete _.update
              delete _.delete
              delete _.toObject
              return _
            },
          } as unknown) as TRORecord<T, U>

          Object.keys(record._fields).forEach(key => {
            const field = record._fields[key]

            let field_name = key
            if (field.shorthand != null && field.shorthand !== '') {
              field_name = field.shorthand
            }

            tro_record[field_name] = record.get(key as keyof T)
          })

          return Deepmerge.all<TRORecord<T, U>>([{}, tro_record, extensions(tro_record)])
        }),
      )
    })
  })
}

const _retrieves = <T, U>({
  object_name,
  time_zone_offset,
  hookExecute,
  extensions,
  criteria,
  size,
  options,
}: {
  object_name: string
  time_zone_offset: number
  hookExecute?: (type: 'insert' | 'update' | 'delete', execute: () => Promise<void>) => Promise<void>
  extensions?: (_: T) => U
  criteria: Criteria<T>
  size?: number
  options?: FetchAllOptions
}) => {
  return new Promise<TRORecord<T, U>[]>(async (resolve, reject) => {
    if (criteria.limit != null || criteria.offset != null) {
      const _ = await _retrieve({
        object_name,
        time_zone_offset,
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
      let results: TRORecord<T, U>[] = []
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

        const records = await _retrieve({
          object_name,
          time_zone_offset,
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

    const promises: Promise<TRORecord<T, U>[]>[] = []
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
        _retrieve({
          object_name,
          time_zone_offset,
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

const TypedRemoteObjects = <T, U = {}>({
  object_name,
  time_zone_offset,
  hookExecute,
  extensions,
}: {
  object_name: string
  time_zone_offset: number
  hookExecute?: (type: 'insert' | 'update' | 'delete', execute: () => Promise<void>) => Promise<void>
  extensions?: (_: T) => U
}) => {
  const instance: TROInstance<T, U> = {
    _wheres: {} as Where<T>,
    _orders: [],
    _limit: undefined,
    _offset: undefined,
    _size: undefined,
    where(field, condition) {
      const _ = Deepmerge({}, instance)
      _._wheres[field as string] = condition
      return _
    },
    wheres(wheres) {
      const _ = Deepmerge({}, instance)
      _._wheres = wheres
      return _
    },
    order(field, order_type) {
      const _ = Deepmerge({}, instance)
      _._orders.push({ [field]: order_type } as { [K in keyof T]: OrderType })
      return _
    },
    limit(size) {
      if (size > 100) {
        throw 'Please specify it within 100.'
      }

      const _ = Deepmerge({}, instance)
      _._limit = size
      return _
    },
    offset(size) {
      if (size > 2000) {
        throw 'Please specify it within 2000.'
      }

      const _ = Deepmerge({}, instance)
      _._offset = size
      return _
    },
    size(size) {
      if (size > 2000) {
        throw 'Please specify it within 2000.'
      }

      const _ = Deepmerge({}, instance)
      _._size = size
      return _
    },
    async one(): Promise<any> {
      const criteria: Criteria<T> = {}
      if (Object.keys(instance._wheres).length !== 0) {
        criteria.where = instance._wheres
      }

      if (instance._orders.length !== 0) {
        criteria.orderby = instance._orders
      }

      criteria.limit = 1
      criteria.offset = undefined

      const _ = await _retrieve({
        object_name,
        time_zone_offset,
        hookExecute,
        extensions,
        criteria,
      })

      return _.length === 0 ? undefined : _[0]
    },
    async all(options): Promise<any> {
      const criteria: Criteria<T> = {}
      if (Object.keys(instance._wheres).length !== 0) {
        criteria.where = instance._wheres
      }

      if (instance._orders.length !== 0) {
        criteria.orderby = instance._orders
      }

      criteria.limit = instance._limit
      criteria.offset = instance._offset

      return await _retrieves({
        object_name,
        time_zone_offset,
        hookExecute,
        extensions,
        criteria,
        size: instance._size,
        options,
      })
    },
    async insert<K extends keyof FetchResultTypes<T, U>>(props: T, options?: UpsertOptions<K>): Promise<any> {
      const ps = { object_name, time_zone_offset, hookExecute, extensions, props, options }
      if (hookExecute == null) {
        return await _create(ps)
      }

      let _: unknown
      await hookExecute('insert', async () => {
        _ = await _create(ps)
      })

      return _
    },
    async update<K extends keyof FetchResultTypes<T, U>>(
      id: string,
      props: T,
      options?: UpsertOptions<K>,
    ): Promise<any> {
      props['Id'] = id

      const ps = {
        object_name,
        time_zone_offset,
        hookExecute,
        extensions,
        props,
        options,
      }

      if (hookExecute == null) {
        return await _update(ps)
      }

      let _: unknown
      await hookExecute('update', async () => {
        _ = await _update(ps)
      })

      return _
    },
    async delete(id) {
      const ps = { object_name, id }
      if (hookExecute == null) {
        await _delete(ps)
        return
      }

      await hookExecute('delete', async () => {
        await _delete(ps)
      })
    },
  }
  return instance
}

// type Test__cType = Partial<{
//   Id: string | null
//   Name: string | null
// }>

// const extensions = (_: Test__cType) => {
//   return {
//     getHoge() {
//       return _.Id!
//     },
//   }
// }

// type aaa = ReturnType<typeof extensions>

// const hoge = TypedRemoteObjects<Test__cType, ReturnType<typeof extensions>>({
//   object_name: 'Test__c',
//   time_zone_offset: 9,
//   extensions,
// })

// // const result = await hoge.all()
// // const aa = result[0]
// // const aaa = await result[0].set('Id', '').update()

export default TypedRemoteObjects
