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
  return new Promise(
    (resolve: (_: Readonly<SObject> & Model<SObject, Extensions> & Extensions) => void, reject: (_: Error) => void) => {
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
    },
  )
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
  return new Promise(
    (resolve: (_: Readonly<SObject> & Model<SObject, Extensions> & Extensions) => void, reject: (_: Error) => void) => {
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
    },
  )
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

type Model<SObject, Extensions> = {
  _update_fields: (keyof SObject)[]
  set: <Field extends keyof SObject>(
    field_name_: Field,
    value_: SObject[Field],
  ) => Readonly<SObject> & Model<SObject, Extensions>
  update: () => Promise<Readonly<SObject> & Model<SObject, Extensions> & Extensions>
  delete: () => Promise<void>
}

const _retrieve = <SObject extends object, Extensions>({
  object_name,
  extensions,
  criteria,
}: {
  object_name: string
  extensions: Extensions
  criteria: Criteria<SObject>
}) => {
  return new Promise(
    (
      resolve: (_: (Readonly<SObject> & Model<SObject, Extensions> & Extensions)[]) => void,
      reject: (_: Error) => void,
    ) => {
      _getSObjectModel({ object_name }).retrieve<SObject>(criteria, (error, records) => {
        if (error != null) {
          reject(error)
          return
        }

        resolve(
          records.map(_ => {
            const s_object_model: Readonly<SObject> & Model<SObject, Extensions> = {
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
            } as Readonly<SObject> & Model<SObject, Extensions>
            ;(Object.keys(_._fields) as (keyof SObject)[]).forEach(key => (s_object_model[key] = _.get(key)))
            return Object.assign({}, s_object_model, extensions)
          }),
        )
      })
    },
  )
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
  return new Promise(
    async (
      resolve: (_: (Readonly<SObject> & Model<SObject, Extensions> & Extensions)[]) => void,
      reject: (_: Error) => void,
    ) => {
      try {
        if (criteria.limit != null || criteria.offset != null) {
          resolve(await _retrieve({ object_name, extensions, criteria }))
          return
        }

        if (size == null) {
          size = 2000
        }

        let results: (Readonly<SObject> & Model<SObject, Extensions> & Extensions)[] = []
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
    },
  )
}

type Funcs<SObject, Extensions> = {
  _wheres: Where<SObject>
  _orders: Order<SObject>
  _limit: number | null
  _offset: number | null
  _size: number | null
  find: (
    this: Readonly<SObject> & Funcs<SObject, Extensions>,
    id: string,
  ) => Promise<Readonly<SObject> & Model<SObject, Extensions> & Extensions | null>
  findAll: (
    this: Readonly<SObject> & Funcs<SObject, Extensions>,
    ...ids: string[]
  ) => Promise<(Readonly<SObject> & Model<SObject, Extensions> & Extensions)[]>
  findAllBy: <Field extends keyof SObject>(
    this: Readonly<SObject> & Funcs<SObject, Extensions>,
    field: Field,
    condition: WhereCondition<SObject[Field]>,
  ) => Promise<(Readonly<SObject> & Model<SObject, Extensions> & Extensions)[]>
  where: <Field extends keyof SObject>(
    this: Readonly<SObject> & Funcs<SObject, Extensions>,
    field: Field,
    condition: WhereCondition<SObject[Field]>,
  ) => Readonly<SObject> & Funcs<SObject, Extensions>
  order: (
    this: Readonly<SObject> & Funcs<SObject, Extensions>,
    field: keyof SObject,
    order_type: OrderType,
  ) => Readonly<SObject> & Funcs<SObject, Extensions>
  limit: (
    this: Readonly<SObject> & Funcs<SObject, Extensions>,
    size: number,
  ) => Readonly<SObject> & Funcs<SObject, Extensions>
  offset: (
    this: Readonly<SObject> & Funcs<SObject, Extensions>,
    size: number,
  ) => Readonly<SObject> & Funcs<SObject, Extensions>
  size: (
    this: Readonly<SObject> & Funcs<SObject, Extensions>,
    size: number,
  ) => Readonly<SObject> & Funcs<SObject, Extensions>
  all: (
    this: Readonly<SObject> & Funcs<SObject, Extensions>,
  ) => Promise<(Readonly<SObject> & Model<SObject, Extensions> & Extensions)[]>
  set: <Field extends keyof SObject>(
    this: Readonly<SObject> & Funcs<SObject, Extensions>,
    f: Field,
    v: SObject[Field],
  ) => Readonly<SObject> & Funcs<SObject, Extensions>
  insert: (
    this: Readonly<SObject> & Funcs<SObject, Extensions>,
  ) => Promise<Readonly<SObject> & Model<SObject, Extensions> & Extensions>
  _clear: (this: Readonly<SObject> & Funcs<SObject, Extensions>) => void
}

export const init = <SObject extends object, Extensions = {}>({
  object_name,
  extensions = {} as Extensions,
}: {
  object_name: string
  extensions?: Extensions
}) => {
  const s_object = {} as Readonly<SObject>
  const funcs: Funcs<SObject, Extensions> = {
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
    set(f, v) {
      const _ = Object.assign({}, this)
      _[f as string] = v
      return _
    },
    async insert() {
      const props = {} as SObject
      Object.keys(this)
        .filter(_ => funcs[_] == null && extensions[_] == null)
        .forEach(_ => (props[_] = this[_]))

      this._clear()

      return await _create<SObject, Extensions>({ object_name, extensions, props })
    },
    _clear() {
      Object.keys(this)
        .filter(_ => funcs[_] == null && extensions[_] == null)
        .forEach(_ => delete this[_])

      this._wheres = {} as any
      this._orders = []
      this._limit = null
      this._offset = null
    },
  }

  return Object.assign(s_object, funcs)
}
