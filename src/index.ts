declare const SObjectModel: { [object_name: string]: new () => RemoteObject }

import Deepmerge from 'deepmerge'
import { CustomError } from 'ts-custom-error'

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

const troErrorFactory = (_: { object_name: string; message: string; attributes?: object }) => {
  return new TROError(_.object_name, _.message, _.attributes)
}

let time_zone_offset: number
const s_object_models: { [object_name: string]: RemoteObject | undefined } = {}

export function init(args: {
  time_zone_offset?: number
  un_accessible_fields: { object_name: string; fields: string[] }[]
}) {
  time_zone_offset = args.time_zone_offset ?? 9
  args.un_accessible_fields.forEach(_ => {
    const som = new SObjectModel[_.object_name]()
    _.fields.forEach(_ => delete som._fields[_ as string])
    s_object_models[_.object_name] = som
  })
}

const _create = <ObjectLiteral, SObject extends object, Extensions>({
  object_name,
  hookExecute,
  extensions,
  props,
  options,
}: {
  object_name: string
  hookExecute?: (type: 'insert' | 'update' | 'delete', execute: () => Promise<void>) => Promise<void>
  extensions: Extensions
  props: SObject
  options?: UpsertOptions<keyof FetchResultTypes<ObjectLiteral, SObject, Extensions>>
}) => {
  return new Promise<TRORecord<ObjectLiteral, SObject, Extensions> | undefined>((resolve: Function, reject) => {
    Object.keys(props).forEach(_ => {
      const p = props[_]
      if (p instanceof Date) {
        const adjust_date = new Date(p.getTime())
        adjust_date.setHours(adjust_date.getHours() - time_zone_offset)
        props[_] = adjust_date
      }
    })

    const throwError = ({ error }: { error: Error }) =>
      reject(troErrorFactory({ object_name, message: error!.message, attributes: { props } }))
    try {
      s_object_models[object_name]!.create(props, async (error, ids) => {
        if (ids.length === 0) {
          throwError({ error: error! })
          return
        }

        if (options != null && !options.fetch) {
          resolve()
          return
        }

        const _ = await _retrieve<ObjectLiteral, SObject, Extensions>({
          object_name,
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
    } catch (error) {
      throwError({ error })
    }
  })
}

const _update = <ObjectLiteral, SObject extends object, Extensions>({
  object_name,
  hookExecute,
  extensions,
  props,
  options,
}: {
  object_name: string
  hookExecute?: (type: 'insert' | 'update' | 'delete', execute: () => Promise<void>) => Promise<void>
  extensions: Extensions
  props: SObject
  options?: UpsertOptions<keyof FetchResultTypes<ObjectLiteral, SObject, Extensions>>
}) => {
  return new Promise<TRORecord<ObjectLiteral, SObject, Extensions> | undefined>((resolve: Function, reject) => {
    const id = props['Id']
    Object.keys(props).forEach(_ => {
      const p = props[_]
      if (p instanceof Date) {
        const adjust_date = new Date(p.getTime())
        adjust_date.setHours(adjust_date.getHours() - time_zone_offset)
        props[_] = adjust_date
      }
    })
    const throwError = ({ error }: { error: Error }) =>
      reject(troErrorFactory({ object_name, message: error!.message, attributes: { id, props } }))
    try {
      s_object_models[object_name]!.update([id], props, async error => {
        if (error != null) {
          throwError({ error })
          return
        }

        if (options != null && !options.fetch) {
          resolve()
          return
        }

        const _ = await _retrieve<ObjectLiteral, SObject, Extensions>({
          object_name,
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
    } catch (error) {
      throwError({ error })
    }
  })
}

const _delete = ({ object_name, id }: { object_name: string; id: string }) => {
  return new Promise<void>((resolve, reject) => {
    const throwError = ({ error }: { error: Error }) =>
      reject(troErrorFactory({ object_name, message: error!.message, attributes: { id } }))
    try {
      s_object_models[object_name]!.del(id, error => {
        if (error != null) {
          throwError({ error })
          return
        }

        resolve()
      })
    } catch (error) {
      throwError({ error })
    }
  })
}

const _retrieve = <ObjectLiteral, SObject extends object, Extensions>({
  object_name,
  hookExecute,
  extensions,
  criteria,
}: {
  object_name: string
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

    const throwError = ({ error }: { error: Error }) =>
      reject(
        troErrorFactory({
          object_name,
          message: error!.message,
          attributes: { criteria: criteria },
        }),
      )
    try {
      s_object_models[object_name]!.retrieve<SObject>(criteria, (error, records) => {
        if (error != null) {
          throwError({ error })
          return
        }

        resolve(
          records.map(record => {
            const tro_record: TRORecord<ObjectLiteral, SObject, Extensions> = ({
              type: (object_name as unknown) as ObjectLiteral,
              _update_fields: [] as (keyof SObject)[],
              set(fn, v) {
                const _ = Deepmerge<TRORecord<ObjectLiteral, SObject, Extensions>>(
                  {},
                  this as TRORecord<ObjectLiteral, SObject, Extensions>,
                )

                _[fn] = v
                _._update_fields.push(fn)
                return _
              },
              async update(options) {
                const self = this as TRORecord<ObjectLiteral, SObject, Extensions>

                const ops = ({ Id: self['Id'] } as unknown) as SObject
                self._update_fields.forEach(_ => {
                  ops[_ as string] = self[_]
                })

                const ps = {
                  object_name,
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
                const self = this as TRORecord<ObjectLiteral, SObject, Extensions>

                const ps = { object_name, id: self['Id'] }
                if (hookExecute == null) {
                  await _delete(ps)
                  return
                }

                hookExecute('delete', async () => {
                  await _delete(ps)
                })
              },
              toObject() {
                const _ = Deepmerge({}, this as TRORecord<ObjectLiteral, SObject, Extensions>) as Partial<
                  TRORecord<ObjectLiteral, SObject, Extensions>
                >
                delete _.type
                delete _._update_fields
                delete _.set
                delete _.update
                delete _.delete
                delete _.toObject
                return _ as SObject
              },
            } as unknown) as TRORecord<ObjectLiteral, SObject, Extensions>

            Object.keys(record._fields).forEach(key => {
              const field = record._fields[key]

              let field_name = key
              if (field.shorthand != null && field.shorthand !== '') {
                field_name = field.shorthand
              }

              tro_record[field_name] = record.get(key as keyof SObject)
            })

            return Deepmerge.all([{}, tro_record, extensions]) as TRORecord<ObjectLiteral, SObject, Extensions>
          }),
        )
      })
    } catch (error) {
      throwError({ error })
    }
  })
}

const _retrieves = <ObjectLiteral, SObject extends object, Extensions>({
  object_name,
  hookExecute,
  extensions,
  criteria,
  size,
  options,
}: {
  object_name: string
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
  extensions = {} as Extensions,
  hookExecute,
}: {
  object_name: string
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
        hookExecute,
        extensions,
        criteria,
        size: this._size,
        options,
      })
    },
    async insert<K extends keyof FetchResultTypes<ObjectLiteral, SObject, Extensions>>(
      props: SObject,
      options?: UpsertOptions<K>,
    ): Promise<any> {
      const ps = { object_name, hookExecute, extensions, props, options }
      if (hookExecute == null) {
        return await _create<ObjectLiteral, SObject, Extensions>(ps)
      }

      let _: unknown
      await hookExecute('insert', async () => {
        _ = await _create<ObjectLiteral, SObject, Extensions>(ps)
      })
      return _
    },
    async update<K extends keyof FetchResultTypes<ObjectLiteral, SObject, Extensions>>(
      id: string,
      props: SObject,
      options?: UpsertOptions<K>,
    ): Promise<any> {
      ;(props as SObject & { Id: string }).Id = id
      const ps = {
        object_name,
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
}

export default TypedRemoteObjects
