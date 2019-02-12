declare const SObjectModel: { [object_name: string]: new () => RemoteObject }

const Deepmerge: {
  <T1, T2>(x: Partial<T1>, y: Partial<T2>): T1 & T2
  all
} = require('deepmerge')

import { TROInstance, TRORecord, TRORecordInstance, TROError } from './types'
import { RemoteObject, Criteria, Where, OrderType } from './s-object-model'

const isTROError = (_): _ is TROError => {
  return typeof _.name === 'string' && typeof _.message === 'string'
}

const _s_object_models: { [object_name: string]: RemoteObject | null } = {}
const _getSObjectModel = ({ object_name }: { object_name: string }): RemoteObject | TROError => {
  const som = _s_object_models[object_name]
  if (som == null) {
    if (SObjectModel[object_name] == null) {
      return {
        name: '',
        message: `Object name \`${object_name}\` is unknown. Please check the remote object component definition on Visualforce.`,
      }
    }

    const som = new SObjectModel[object_name]()
    _s_object_models[object_name] = som
    return som
  }

  return _s_object_models[object_name]!
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
  return new Promise<TRORecord<SObject, Extensions> | TROError>(resolve => {
    Object.keys(props).forEach(_ => {
      const p = props[_]
      if (p instanceof Date) {
        const adjust_date = new Date(p.getTime())
        adjust_date.setHours(adjust_date.getHours() - time_zone_offset)
        props[_] = adjust_date
      }
    })

    const som = _getSObjectModel({ object_name })
    if (isTROError(som)) {
      resolve(som)
      return
    }

    som.create(props, async (error, ids) => {
      if (ids.length === 0) {
        resolve({ name: error!.name, message: error!.message, attributes: { props } })
        return
      }

      const _ = await _retrieve<SObject, Extensions>({
        object_name,
        time_zone_offset,
        extensions,
        criteria: { where: { Id: { eq: ids[0] } } as Where<SObject> },
      })
      if (isTROError(_)) {
        resolve(_)
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
  return new Promise<TRORecord<SObject, Extensions> | TROError>(resolve => {
    const id = props['Id']
    Object.keys(props).forEach(_ => {
      const p = props[_]
      if (p instanceof Date) {
        const adjust_date = new Date(p.getTime())
        adjust_date.setHours(adjust_date.getHours() - time_zone_offset)
        props[_] = adjust_date
      }
    })

    const som = _getSObjectModel({ object_name })
    if (isTROError(som)) {
      resolve(som)
      return
    }

    som.update([id], props, async error => {
      if (error != null) {
        resolve({ name: error.name, message: error.message, attributes: { props } })
        return
      }

      const _ = await _retrieve<SObject, Extensions>({
        object_name,
        time_zone_offset,
        extensions,
        criteria: { where: { Id: { eq: id } } as Where<SObject> },
      })
      if (isTROError(_)) {
        resolve(_)
        return
      }

      resolve(_[0])
    })
  })
}

const _delete = ({ object_name, id }: { object_name: string; id: string }) => {
  return new Promise<void | TROError>(resolve => {
    const som = _getSObjectModel({ object_name })
    if (isTROError(som)) {
      resolve(som)
      return
    }

    som.del(id, error => {
      if (error != null) {
        resolve({ name: error.name, message: error.message, attributes: { id } })
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
  return new Promise<TRORecord<SObject, Extensions>[] | TROError>(resolve => {
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

    const som = _getSObjectModel({ object_name })
    if (isTROError(som)) {
      resolve(som)
      return
    }

    som.retrieve<SObject>(criteria, (error, records) => {
      if (error != null) {
        resolve({ name: error.name, message: error.message, attributes: { criteria } })
        return
      }

      resolve(
        records.map(_ => {
          const tro_record_instance: Readonly<SObject> & TRORecordInstance<SObject, Extensions> = {
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

              return await _update({ object_name, time_zone_offset, extensions, props: ops })
            },
            async delete() {
              return await _delete({ object_name, id: this['Id'] })
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
          } as Readonly<SObject> & TRORecordInstance<SObject, Extensions>

          Object.keys(_._fields).forEach(key => {
            const field = _._fields[key]

            let field_name = key
            if (field.shorthand != null && field.shorthand !== '') {
              field_name = field.shorthand
            }

            tro_record_instance[field_name] = _.get(key as keyof SObject)
          })

          return Deepmerge.all([{}, tro_record_instance, extensions])
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
  return new Promise<TRORecord<SObject, Extensions>[] | TROError>(async resolve => {
    if (criteria.limit != null || criteria.offset != null) {
      const _ = await _retrieve({ object_name, time_zone_offset, extensions, criteria })
      if (isTROError(_)) {
        resolve(_)
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

      if (offset !== 0) {
        criteria.offset = offset
      }

      const records = await _retrieve({ object_name, time_zone_offset, extensions, criteria })
      if (isTROError(records)) {
        resolve(records)
        return
      }

      if (records.length === 0) {
        break
      }

      results = results.concat(records)
      offset += 100
    }

    resolve(results)
  })
}

const TypedRemoteObjects = <SObject extends object, Extensions = {}>({
  object_name,
  time_zone_offset,
  extensions = {} as Extensions,
}: {
  object_name: string
  time_zone_offset: number
  extensions?: Extensions
}): TROInstance<SObject, Extensions> => {
  return {
    _wheres: {} as Where<SObject>,
    _orders: [],
    _limit: null,
    _offset: null,
    _size: null,
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

      const _ = await _retrieve<SObject, Extensions>({
        object_name,
        time_zone_offset,
        extensions,
        criteria,
      })
      if (isTROError(_)) {
        return _
      }

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

      return await _retrieves<SObject, Extensions>({
        object_name,
        time_zone_offset,
        extensions,
        criteria,
        size,
      })
    },
    async insert(props) {
      return await _create({ object_name, time_zone_offset, extensions, props })
    },
    async update(id, props) {
      ;(props as SObject & { Id: string }).Id = id
      return await _update({ object_name, time_zone_offset, extensions, props })
    },
    async delete(id) {
      return await _delete({ object_name, id })
    },
  }
}

export default TypedRemoteObjects
export { TRORecord, isTROError }
