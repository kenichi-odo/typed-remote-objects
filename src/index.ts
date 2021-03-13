declare const SObjectModel: { [object_name: string]: new () => RemoteObject }

import Deepmerge from 'deepmerge'
import { CustomError } from 'ts-custom-error'

import { RemoteObject, Criteria, Where, OrderType } from './s-object-model'
import { TRORecord, TROInstance, UpsertOptions, FetchAllOptions, FetchResultTypes } from './types'
export { TRORecord }

export class TROError extends CustomError {
  constructor(message: string, public object_name: string, public attributes?: object) {
    super(message)
  }

  toObject() {
    return {
      attributes: this.attributes,
      message: this.message,
      name: this.name,
      object_name: this.object_name,
    }
  }
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
  extensions,
  props,
  options,
}: {
  object_name: string
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

    try {
      s_object_models[object_name]!.create(props, async (error, ids) => {
        if (ids.length === 0) {
          reject(new TROError(error!.message, object_name, { props }))
          return
        }

        if (options != null && !options.fetch) {
          resolve()
          return
        }

        const _ = await _retrieve<ObjectLiteral, SObject, Extensions>({
          object_name,
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
      reject(new TROError(error.message, object_name, { props }))
    }
  })
}

const _update = <ObjectLiteral, SObject extends object, Extensions>({
  object_name,
  extensions,
  props,
  options,
}: {
  object_name: string
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

    try {
      s_object_models[object_name]!.update([id], props, async error => {
        if (error != null) {
          reject(new TROError(error.message, object_name, { id, props }))
          return
        }

        if (options != null && !options.fetch) {
          resolve()
          return
        }

        const _ = await _retrieve<ObjectLiteral, SObject, Extensions>({
          object_name,
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
      reject(new TROError(error.message, object_name, { id, props }))
    }
  })
}

const _delete = ({ object_name, id }: { object_name: string; id: string }) => {
  return new Promise<void>((resolve, reject) => {
    try {
      s_object_models[object_name]!.del(id, error => {
        if (error != null) {
          reject(new TROError(error.message, object_name, { id }))
          return
        }

        resolve()
      })
    } catch (error) {
      reject(new TROError(error.message, object_name, { id }))
    }
  })
}

const _retrieve = <ObjectLiteral, SObject extends object, Extensions>({
  object_name,
  extensions,
  criteria,
}: {
  object_name: string
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

    try {
      s_object_models[object_name]!.retrieve<SObject>(criteria, (error, records) => {
        if (error != null) {
          reject(new TROError(error!.message, object_name, { criteria: criteria }))
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

                return await _update({
                  object_name,
                  extensions,
                  props: ops,
                  options,
                })
              },
              async delete() {
                const self = this as TRORecord<ObjectLiteral, SObject, Extensions>
                await _delete({ object_name, id: self['Id'] })
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
      reject(new TROError(error!.message, object_name, { criteria: criteria }))
    }
  })
}

const _retrieves = <ObjectLiteral, SObject extends object, Extensions>({
  object_name,
  extensions,
  criteria,
  size,
  options,
}: {
  object_name: string
  extensions: Extensions
  criteria: Criteria<SObject>
  size?: number
  options?: FetchAllOptions
}) => {
  return new Promise<TRORecord<ObjectLiteral, SObject, Extensions>[]>(async (resolve, reject) => {
    if (criteria.limit != null || criteria.offset != null) {
      const _ = await _retrieve<ObjectLiteral, SObject, Extensions>({
        object_name,
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
}: {
  object_name: string
  extensions?: Extensions
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
        extensions,
        criteria,
      })

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
      return await _create<ObjectLiteral, SObject, Extensions>({ object_name, extensions, props, options })
    },
    async update<K extends keyof FetchResultTypes<ObjectLiteral, SObject, Extensions>>(
      id: string,
      props: SObject,
      options?: UpsertOptions<K>,
    ): Promise<any> {
      ;(props as SObject & { Id: string }).Id = id

      return await _update({
        object_name,
        extensions,
        props,
        options,
      })
    },
    async delete(id) {
      await _delete({ object_name, id })
    },
  }
}

export default TypedRemoteObjects
