declare const SObjectModel: { [object_name: string]: new () => RemoteObject }

const Deepmerge = require('deepmerge')

import { Funcs, InsertModel, Record, UpdateModel } from './types'
import { RemoteObject, Criteria, Where } from './s-object-model'

const _s_object_models: { [object_name: string]: RemoteObject | null } = {}

const _getSObjectModel = ({ object_name }: { object_name: string }): RemoteObject => {
  const som = _s_object_models[object_name]
  if (som == null) {
    if (SObjectModel[object_name] == null) {
      throw `Object name \`${object_name}\` is unknown. Please check the remote object component definition on Visualforce.`
    }

    const som = new SObjectModel[object_name]()
    _s_object_models[object_name] = som
    return som
  }

  return _s_object_models[object_name]!
}

export class RemoteObjectError extends Error {
  public attr

  constructor(error: Error, attr) {
    super(error.message)

    this.name = error.name
    this.attr = attr

    Object.setPrototypeOf(this, RemoteObjectError.prototype)
  }
}

const _create = <SObject extends object, Extensions>({
  object_name,
  time_zone_offset,
  extensions,
  props,
}: {
  object_name: string
  time_zone_offset: number
  extensions: Extensions
  props: SObject
}) => {
  return new Promise((resolve: (_: Record<SObject, Extensions>) => void, reject: (_: RemoteObjectError) => void) => {
    Object.keys(props).forEach(_ => {
      const p = props[_]
      if (p instanceof Date) {
        const adjust_date = new Date(p.getTime())
        adjust_date.setHours(adjust_date.getHours() - time_zone_offset)
        props[_] = adjust_date
      }
    })
    _getSObjectModel({ object_name }).create(props, async (error, ids) => {
      if (ids.length === 0) {
        reject(new RemoteObjectError(error!, { props }))
        return
      }

      const _ = await _retrieve<SObject, Extensions>({
        object_name,
        time_zone_offset,
        extensions,
        criteria: { where: { Id: { eq: ids[0] } } as any },
      }).catch((_: RemoteObjectError) => _)
      if (_ instanceof RemoteObjectError) {
        reject(_)
        return
      }

      resolve(_[0])
    })
  })
}

const _update = <SObject extends object, Extensions>({
  object_name,
  time_zone_offset,
  extensions,
  props,
}: {
  object_name: string
  time_zone_offset: number
  extensions: Extensions
  props: SObject
}) => {
  return new Promise((resolve: (_: Record<SObject, Extensions>) => void, reject: (_: RemoteObjectError) => void) => {
    const id = props['Id']
    Object.keys(props).forEach(_ => {
      const p = props[_]
      if (p instanceof Date) {
        const adjust_date = new Date(p.getTime())
        adjust_date.setHours(adjust_date.getHours() - time_zone_offset)
        props[_] = adjust_date
      }
    })
    _getSObjectModel({ object_name }).update([id], props, async error => {
      if (error != null) {
        reject(new RemoteObjectError(error, { props }))
        return
      }

      const _ = await _retrieve<SObject, Extensions>({
        object_name,
        time_zone_offset,
        extensions,
        criteria: { where: { Id: { eq: id } } as any },
      }).catch((_: RemoteObjectError) => _)
      if (_ instanceof RemoteObjectError) {
        reject(_)
        return
      }

      resolve(_[0])
    })
  })
}

const _delete = ({ object_name, id }: { object_name: string; id: string }) => {
  return new Promise<void>((resolve: () => void, reject: (_: RemoteObjectError) => void) => {
    _getSObjectModel({ object_name }).del(id, error => {
      if (error != null) {
        reject(new RemoteObjectError(error, { id }))
        return
      }

      resolve()
    })
  })
}

const _retrieve = <SObject extends object, Extensions>({
  object_name,
  time_zone_offset,
  extensions,
  criteria,
}: {
  object_name: string
  time_zone_offset: number
  extensions: Extensions
  criteria: Criteria<SObject>
}) => {
  return new Promise((resolve: (_: Record<SObject, Extensions>[]) => void, reject: (_: RemoteObjectError) => void) => {
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

    _getSObjectModel({ object_name }).retrieve<SObject>(criteria, (error, records) => {
      if (error != null) {
        reject(new RemoteObjectError(error, { criteria }))
        return
      }

      resolve(
        records.map(_ => {
          const s_object_model: Readonly<SObject> & UpdateModel<SObject, Extensions> = {
            _update_fields: [] as (keyof SObject)[],
            set(fn_, v_) {
              const _ = Deepmerge({}, this)
              _[fn_ as string] = v_
              _._update_fields.push(fn_)
              return _
            },
            async update() {
              const ops = { Id: this['Id'] } as SObject
              this._update_fields.forEach(_ => {
                ops[_ as string] = this[_]
              })

              const _ = await _update({ object_name, time_zone_offset, extensions, props: ops }).catch(
                (_: RemoteObjectError) => _,
              )
              if (_ instanceof RemoteObjectError) {
                return Promise.reject(_)
              }

              return _
            },
            async delete() {
              const _ = await _delete({ object_name, id: this['Id'] }).catch((_: RemoteObjectError) => _)
              if (_ instanceof RemoteObjectError) {
                throw _
              }
            },
            toObject() {
              const _ = Deepmerge({}, this)
              delete _._update_fields
              delete _.set
              delete _.update
              delete _.delete
              delete _.toObject
              return _
            },
          } as any
          ;(Object.keys(_._fields) as (keyof SObject)[]).forEach(key => (s_object_model[key] = _.get(key)))
          return Deepmerge.all([{}, s_object_model, extensions])
        }),
      )
    })
  })
}

const _retrieves = <SObject extends object, Extensions>({
  object_name,
  time_zone_offset,
  extensions,
  criteria,
  size,
}: {
  object_name: string
  time_zone_offset: number
  extensions: Extensions
  criteria: Criteria<SObject>
  size?: number
}) => {
  return new Promise(
    async (resolve: (_: Record<SObject, Extensions>[]) => void, reject: (_: RemoteObjectError) => void) => {
      if (criteria.limit != null || criteria.offset != null) {
        const _ = await _retrieve({ object_name, time_zone_offset, extensions, criteria }).catch(
          (_: RemoteObjectError) => _,
        )
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

      let results: Record<SObject, Extensions>[] = []
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
        const records = await _retrieve({ object_name, time_zone_offset, extensions, criteria }).catch(
          (_: RemoteObjectError) => _,
        )
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

export const init = <SObject extends object, Extensions = {}>({
  object_name,
  time_zone_offset,
  extensions = {} as Extensions,
}: {
  object_name: string
  time_zone_offset: number
  extensions?: Extensions
}) => {
  const init_funcs: Funcs<SObject, Extensions> = {
    _wheres: {} as Where<SObject>,
    _orders: [],
    _limit: null,
    _offset: null,
    _size: null,
    where(field, condition) {
      const _ = Deepmerge({}, this)
      _._wheres[field as any] = condition
      return _
    },
    and(...wheres) {
      const _ = Deepmerge({}, this)

      const ws = {} as Where<SObject>
      wheres.forEach(w_ => {
        w_({
          where(field, condition) {
            ws[field as any] = condition
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
            ws[field as any] = condition
          },
        })
      })

      _._wheres.or = ws
      return _
    },
    order(field, order_type) {
      const _ = Deepmerge({}, this)
      _._orders.push({ [field]: order_type } as any)
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

      this._clear()

      const _ = await _retrieve<SObject, Extensions>({
        object_name,
        time_zone_offset,
        extensions,
        criteria,
      }).catch((_: RemoteObjectError) => _)
      if (_ instanceof RemoteObjectError) {
        return Promise.reject(_)
      }

      this._clear()

      return _.length === 0 ? null : _[0]
    },
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

      this._clear()

      const _ = await _retrieves<SObject, Extensions>({
        object_name,
        time_zone_offset,
        extensions,
        criteria,
        size,
      }).catch((_: RemoteObjectError) => _)
      if (_ instanceof RemoteObjectError) {
        return Promise.reject(_)
      }

      return _
    },
    _clear() {
      this._wheres = {} as any
      this._orders = []
      this._limit = null
      this._offset = null
    },
    record(s_object) {
      if (s_object == null) {
        s_object = {} as Readonly<SObject>
      }

      const insert_model_funcs: InsertModel<SObject, Extensions> = {
        set(f, v) {
          const _ = Deepmerge({}, this)
          _[f as string] = v
          return _
        },
        async insert() {
          const props = {} as SObject
          Object.keys(this)
            .filter(_ => insert_model_funcs[_] == null)
            .forEach(_ => (props[_] = this[_]))

          const _ = await _create<SObject, Extensions>({ object_name, time_zone_offset, extensions, props }).catch(
            (_: RemoteObjectError) => _,
          )
          if (_ instanceof RemoteObjectError) {
            return Promise.reject(_)
          }

          return _
        },
      } as InsertModel<SObject, Extensions>

      return Deepmerge.all([{}, s_object, insert_model_funcs])
    },
  }

  return init_funcs
}

export { Record }
