type OrderType = 'ASC NULLS FIRST' | 'ASC NULLS LAST' | 'ASC' | 'DESC NULLS FIRST' | 'DESC NULLS LAST' | 'DESC'

type Order<SObject> = { [Field in keyof SObject]: OrderType }[]

type WhereAndOr<SObject> = {
  and?: Where<SObject>
  or?: Where<SObject>
}

type WhereCondition<T> = {
  eq?: T
  ne?: T
  lt?: T
  lte?: T
  gt?: T
  gte?: T
  like?: string
  in?: T[]
  nin?: T[]
}

type Where<SObject> = WhereAndOr<SObject> & { [Field in keyof SObject]: WhereCondition<SObject[Field]> }

type Criteria<SObject> = {
  where?: Where<SObject>
  orderby?: Order<SObject>
  limit?: number
  offset?: number
}

type RemoteObjectModel<SObject> = {
  get: (field_name: keyof SObject) => any
  _fields: { [field_name: string]: any }
}

type RemotingEvent = {
  action: string
  method: string
  ref: boolean
  result: { [key: string]: any }
  status: boolean
  statusCode: number
  tid: number
  type: string
}

type RemoteObject = {
  retrieve: <SObject>(
    criteria: Criteria<SObject>,
    result: (error: Error | null, records: RemoteObjectModel<SObject>[]) => void,
  ) => void
  create: (
    props: { [field_name: string]: any },
    result: (error: Error | null, affected_ids: string[], event: RemotingEvent) => void,
  ) => void
  update: (
    ids: string[],
    props: { [field_name: string]: any },
    result: (error: Error | null, affected_ids: string[], event: RemotingEvent) => void,
  ) => void
  del: (id: string, result: (error: Error | null, affected_ids: string[], event: RemotingEvent) => void) => void
}

declare global {
  interface Window {
    SObjectModel: { [object_name: string]: new () => RemoteObject }
  }
}

const _s_object_models: { [object_name: string]: RemoteObject | null } = {}

const _getSObjectModel = ({ object_name }: { object_name: string }): RemoteObject => {
  const som = _s_object_models[object_name]
  if (som == null) {
    if (window.SObjectModel[object_name] == null) {
      throw `Object name \`${object_name}\` is unknown. Please check the remote object component definition on Visualforce.`
    }

    const som = new window.SObjectModel[object_name]()
    _s_object_models[object_name] = som
    return som
  }

  return _s_object_models[object_name]!
}

const _create = <SObject extends object, Extensions>({
  object_name,
  extensions,
  props,
}: {
  object_name: string
  extensions: Extensions
  props: SObject
}) => {
  return new Promise((resolve: (_: Record<SObject, Extensions>) => void, reject: (_: Error) => void) => {
    _getSObjectModel({ object_name }).create(props, async (error, ids) => {
      if (error != null) {
        reject(error)
        return
      }

      const _ = await _retrieve<SObject, Extensions>({
        object_name,
        extensions,
        criteria: { where: { Id: { eq: ids[0] } } as any },
      })
      resolve(_[0])
    })
  })
}

const _update = <SObject extends object, Extensions>({
  object_name,
  extensions,
  props,
}: {
  object_name: string
  extensions: Extensions
  props: SObject
}) => {
  return new Promise((resolve: (_: Record<SObject, Extensions>) => void, reject: (_: Error) => void) => {
    const id = props['Id']
    _getSObjectModel({ object_name }).update([id], props, async error => {
      if (error != null) {
        reject(error)
        return
      }

      const _ = await _retrieve<SObject, Extensions>({
        object_name,
        extensions,
        criteria: { where: { Id: { eq: id } } as any },
      })
      resolve(_[0])
    })
  })
}

const _delete = ({ object_name, id }: { object_name: string; id: string }) => {
  return new Promise<void>((resolve: () => void, reject: (_: Error) => void) => {
    _getSObjectModel({ object_name }).del(id, error => {
      if (error != null) {
        reject(error)
        return
      }

      resolve()
    })
  })
}

type UpdateModel<SObject, Extensions> = {
  _update_fields: (keyof SObject)[]
  set: <Field extends keyof SObject>(
    field_name_: Field,
    value_: SObject[Field],
  ) => Readonly<SObject> & UpdateModel<SObject, Extensions>
  update: () => Promise<Record<SObject, Extensions>>
  delete: () => Promise<void>
}

export type Record<SObject, Extensions = {}> = Readonly<SObject> & UpdateModel<SObject, Extensions> & Extensions

const _retrieve = <SObject extends object, Extensions>({
  object_name,
  extensions,
  criteria,
}: {
  object_name: string
  extensions: Extensions
  criteria: Criteria<SObject>
}) => {
  return new Promise((resolve: (_: Record<SObject, Extensions>[]) => void, reject: (_: Error) => void) => {
    _getSObjectModel({ object_name }).retrieve<SObject>(criteria, (error, records) => {
      if (error != null) {
        reject(error)
        return
      }

      resolve(
        records.map(_ => {
          const s_object_model: Readonly<SObject> & UpdateModel<SObject, Extensions> = {
            _update_fields: [] as (keyof SObject)[],
            set(fn_, v_) {
              const _ = Object.assign({}, this)
              _[fn_ as string] = v_
              _._update_fields.push(fn_)
              return _
            },
            async update() {
              const ops = { Id: this['Id'] } as SObject
              this._update_fields.forEach(_ => {
                ops[_ as string] = this[_]
              })
              return await _update({ object_name, extensions, props: ops })
            },
            async delete() {
              await _delete({ object_name, id: this['Id'] })
            },
          } as Readonly<SObject> & UpdateModel<SObject, Extensions>
          ;(Object.keys(_._fields) as (keyof SObject)[]).forEach(key => (s_object_model[key] = _.get(key)))
          return Object.assign({}, s_object_model, extensions)
        }),
      )
    })
  })
}

const _retrieves = <SObject extends object, Extensions>({
  object_name,
  extensions,
  criteria,
  size,
}: {
  object_name: string
  extensions: Extensions
  criteria: Criteria<SObject>
  size?: number
}) => {
  return new Promise(async (resolve: (_: Record<SObject, Extensions>[]) => void, reject: (_: Error) => void) => {
    try {
      if (criteria.limit != null || criteria.offset != null) {
        resolve(await _retrieve({ object_name, extensions, criteria }))
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
        const records = await _retrieve({ object_name, extensions, criteria })
        if (records.length === 0) break

        results = results.concat(records)
        offset += 100
      }

      resolve(results)
    } catch (_) {
      reject(new Error(_))
    }
  })
}

type InsertModel<SObject, Extensions> = Readonly<SObject> & {
  set: <Field extends keyof SObject>(
    this: InsertModel<SObject, Extensions>,
    field_name_: Field,
    value_: SObject[Field],
  ) => InsertModel<SObject, Extensions>
  insert: () => Promise<Record<SObject, Extensions>>
}

type Funcs<SObject, Extensions> = {
  _wheres: Where<SObject>
  _orders: Order<SObject>
  _limit: number | null
  _offset: number | null
  _size: number | null
  find: (this: Funcs<SObject, Extensions>, id: string) => Promise<Record<SObject, Extensions> | null>
  findAll: (this: Funcs<SObject, Extensions>, ...ids: string[]) => Promise<(Record<SObject, Extensions>)[]>
  findAllBy: <Field extends keyof SObject>(
    this: Funcs<SObject, Extensions>,
    field: Field,
    condition: WhereCondition<SObject[Field]>,
  ) => Promise<(Record<SObject, Extensions>)[]>
  where: <Field extends keyof SObject>(
    this: Funcs<SObject, Extensions>,
    field: Field,
    condition: WhereCondition<SObject[Field]>,
  ) => Funcs<SObject, Extensions>
  order: (this: Funcs<SObject, Extensions>, field: keyof SObject, order_type: OrderType) => Funcs<SObject, Extensions>
  limit: (this: Funcs<SObject, Extensions>, size: number) => Funcs<SObject, Extensions>
  offset: (this: Funcs<SObject, Extensions>, size: number) => Funcs<SObject, Extensions>
  size: (this: Funcs<SObject, Extensions>, size: number) => Funcs<SObject, Extensions>
  all: (this: Funcs<SObject, Extensions>) => Promise<(Record<SObject, Extensions>)[]>
  _clear: (this: Funcs<SObject, Extensions>) => void
  new: (_?: Readonly<SObject>) => InsertModel<SObject, Extensions>
}

export const init = <SObject extends object, Extensions = {}>({
  object_name,
  extensions = {} as Extensions,
}: {
  object_name: string
  extensions?: Extensions
}) => {
  const init_funcs: Funcs<SObject, Extensions> = {
    _wheres: {} as Where<SObject>,
    _orders: [],
    _limit: null,
    _offset: null,
    _size: null,
    async find(id) {
      const _ = await _retrieve<SObject, Extensions>({
        object_name,
        extensions,
        criteria: { where: { Id: { eq: id } } as any, limit: 1 },
      })

      this._clear()

      return _.length === 0 ? null : _[0]
    },
    async findAll(ids) {
      const criteria: Criteria<SObject> = { where: { Id: { in: ids } } as any }
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

      return await _retrieves<SObject, Extensions>({
        object_name,
        extensions,
        criteria,
        size,
      })
    },
    async findAllBy(field, condition) {
      const criteria: Criteria<SObject> = { where: { [field]: condition } as any }
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

      return await _retrieves({
        object_name,
        extensions,
        criteria,
        size,
      })
    },
    where(field, condition) {
      const _ = Object.assign({}, this)
      _._wheres[field as any] = condition
      return _
    },
    order(field, order_type) {
      const _ = Object.assign({}, this)
      _._orders.push({ [field]: order_type } as any)
      return _
    },
    limit(size) {
      if (size > 100) {
        throw 'Please specify it within 100.'
      }

      const _ = Object.assign({}, this)
      _._limit = size
      return _
    },
    offset(size) {
      if (size > 2000) {
        throw 'Please specify it within 2000.'
      }

      const _ = Object.assign({}, this)
      _._offset = size
      return _
    },
    size(size) {
      if (size > 2000) {
        throw 'Please specify it within 2000.'
      }

      const _ = Object.assign({}, this)
      _._size = size
      return _
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

      return await _retrieves<SObject, Extensions>({
        object_name,
        extensions,
        criteria,
        size,
      })
    },
    _clear() {
      this._wheres = {} as any
      this._orders = []
      this._limit = null
      this._offset = null
    },
    new(s_object) {
      if (s_object == null) {
        s_object = {} as Readonly<SObject>
      }

      const insert_model_funcs: InsertModel<SObject, Extensions> = {
        set(f, v) {
          const _ = Object.assign({}, this)
          _[f as string] = v
          return _
        },
        async insert() {
          const props = {} as SObject
          Object.keys(this)
            .filter(_ => insert_model_funcs[_] == null)
            .forEach(_ => (props[_] = this[_]))

          return await _create<SObject, Extensions>({ object_name, extensions, props })
        },
      } as InsertModel<SObject, Extensions>

      return Object.assign(s_object, insert_model_funcs)
    },
  }

  return init_funcs
}
