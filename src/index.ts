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

const _GetSObjectModel = ({ object_name }: { object_name: string }): RemoteObject => {
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

const _Create = <SObject extends object, Extensions>({
  object_name,
  extensions,
  props,
}: {
  object_name: string
  extensions: Extensions
  props: SObject
}) => {
  return new Promise(
    (Resolve: (_: Readonly<SObject> & Model<SObject, Extensions> & Extensions) => void, Reject: (_: Error) => void) => {
      _GetSObjectModel({ object_name }).create(props, async (error, ids) => {
        if (error != null) {
          Reject(error)
          return
        }

        const _ = await _Retrieve<SObject, Extensions>({
          object_name,
          extensions,
          criteria: { where: { Id: { eq: ids[0] } } as any },
        })
        Resolve(_[0])
      })
    },
  )
}

const _Update = <SObject extends object, Extensions>({
  object_name,
  extensions,
  props,
}: {
  object_name: string
  extensions: Extensions
  props: SObject
}) => {
  return new Promise(
    (Resolve: (_: Readonly<SObject> & Model<SObject, Extensions> & Extensions) => void, Reject: (_: Error) => void) => {
      const id = props['Id']
      _GetSObjectModel({ object_name }).update([id], props, async error => {
        if (error != null) {
          Reject(error)
          return
        }

        const _ = await _Retrieve<SObject, Extensions>({
          object_name,
          extensions,
          criteria: { where: { Id: { eq: id } } as any },
        })
        Resolve(_[0])
      })
    },
  )
}

const _Delete = ({ object_name, id }: { object_name: string; id: string }) => {
  return new Promise<void>((Resolve: () => void, Reject: (_: Error) => void) => {
    _GetSObjectModel({ object_name }).del(id, error => {
      if (error != null) {
        Reject(error)
        return
      }

      Resolve()
    })
  })
}

type Model<SObject, Extensions> = {
  _update_fields: (keyof SObject)[]
  Set: <Field extends keyof SObject>(
    field_name_: Field,
    value_: SObject[Field],
  ) => Readonly<SObject> & Model<SObject, Extensions>
  Update: () => Promise<Readonly<SObject> & Model<SObject, Extensions> & Extensions>
  Delete: () => Promise<void>
}

const _Retrieve = <SObject extends object, Extensions>({
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
      Resolve: (_: (Readonly<SObject> & Model<SObject, Extensions> & Extensions)[]) => void,
      Reject: (_: Error) => void,
    ) => {
      _GetSObjectModel({ object_name }).retrieve<SObject>(criteria, (error, records) => {
        if (error != null) {
          Reject(error)
          return
        }

        Resolve(
          records.map(_ => {
            const s_object_model: Readonly<SObject> & Model<SObject, Extensions> = {
              _update_fields: [] as (keyof SObject)[],
              Set(fn_, v_) {
                const _ = Object.assign({}, this)
                _[fn_ as string] = v_
                _._update_fields.push(fn_)
                return _
              },
              async Update() {
                const ops = { Id: this['Id'] } as SObject
                this._update_fields.forEach(_ => {
                  ops[_ as string] = this[_]
                })
                return await _Update({ object_name, extensions, props: ops })
              },
              async Delete() {
                await _Delete({ object_name, id: this['Id'] })
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

const _Retrieves = <SObject extends object, Extensions>({
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
      Resolve: (_: (Readonly<SObject> & Model<SObject, Extensions> & Extensions)[]) => void,
      Reject: (_: Error) => void,
    ) => {
      try {
        if (criteria.limit != null || criteria.offset != null) {
          Resolve(await _Retrieve({ object_name, extensions, criteria }))
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
          const records = await _Retrieve({ object_name, extensions, criteria })
          if (records.length === 0) break

          results = results.concat(records)
          offset += 100
        }

        Resolve(results)
      } catch (_) {
        Reject(new Error(_))
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
  Find: (
    this: Readonly<SObject> & Funcs<SObject, Extensions>,
    id: string,
  ) => Promise<Readonly<SObject> & Model<SObject, Extensions> & Extensions | null>
  FindAll: (
    this: Readonly<SObject> & Funcs<SObject, Extensions>,
    ...ids: string[]
  ) => Promise<(Readonly<SObject> & Model<SObject, Extensions> & Extensions)[]>
  FindAllBy: <Field extends keyof SObject>(
    this: Readonly<SObject> & Funcs<SObject, Extensions>,
    field: Field,
    condition: WhereCondition<SObject[Field]>,
  ) => Promise<(Readonly<SObject> & Model<SObject, Extensions> & Extensions)[]>
  Where: <Field extends keyof SObject>(
    this: Readonly<SObject> & Funcs<SObject, Extensions>,
    field: Field,
    condition: WhereCondition<SObject[Field]>,
  ) => Readonly<SObject> & Funcs<SObject, Extensions>
  Order: (
    this: Readonly<SObject> & Funcs<SObject, Extensions>,
    field: keyof SObject,
    order_type: OrderType,
  ) => Readonly<SObject> & Funcs<SObject, Extensions>
  Limit: (
    this: Readonly<SObject> & Funcs<SObject, Extensions>,
    size: number,
  ) => Readonly<SObject> & Funcs<SObject, Extensions>
  Offset: (
    this: Readonly<SObject> & Funcs<SObject, Extensions>,
    size: number,
  ) => Readonly<SObject> & Funcs<SObject, Extensions>
  Size: (
    this: Readonly<SObject> & Funcs<SObject, Extensions>,
    size: number,
  ) => Readonly<SObject> & Funcs<SObject, Extensions>
  All: (
    this: Readonly<SObject> & Funcs<SObject, Extensions>,
  ) => Promise<(Readonly<SObject> & Model<SObject, Extensions> & Extensions)[]>
  Set: <Field extends keyof SObject>(
    this: Readonly<SObject> & Funcs<SObject, Extensions>,
    f: Field,
    v: SObject[Field],
  ) => Readonly<SObject> & Funcs<SObject, Extensions>
  Insert: (
    this: Readonly<SObject> & Funcs<SObject, Extensions>,
  ) => Promise<Readonly<SObject> & Model<SObject, Extensions> & Extensions>
  _Clear: (this: Readonly<SObject> & Funcs<SObject, Extensions>) => void
}

export const TypedRemoteObjects = <SObject extends object, Extensions = {}>({
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
    async Find(id) {
      const _ = await _Retrieve<SObject, Extensions>({
        object_name,
        extensions,
        criteria: { where: { Id: { eq: id } } as any, limit: 1 },
      })

      this._Clear()

      return _.length === 0 ? null : _[0]
    },
    async FindAll(ids) {
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

      this._Clear()

      return await _Retrieves<SObject, Extensions>({
        object_name,
        extensions,
        criteria,
        size,
      })
    },
    async FindAllBy(field, condition) {
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

      this._Clear()

      return await _Retrieves({
        object_name,
        extensions,
        criteria,
        size,
      })
    },
    Where(field, condition) {
      const _ = Object.assign({}, this)
      _._wheres[field as any] = condition
      return _
    },
    Order(field, order_type) {
      const _ = Object.assign({}, this)
      _._orders.push({ [field]: order_type } as any)
      return _
    },
    Limit(size) {
      if (size > 100) {
        throw 'Please specify it within 100.'
      }

      const _ = Object.assign({}, this)
      _._limit = size
      return _
    },
    Offset(size) {
      if (size > 2000) {
        throw 'Please specify it within 2000.'
      }

      const _ = Object.assign({}, this)
      _._offset = size
      return _
    },
    Size(size) {
      if (size > 2000) {
        throw 'Please specify it within 2000.'
      }

      const _ = Object.assign({}, this)
      _._size = size
      return _
    },
    async All() {
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

      this._Clear()

      return await _Retrieves<SObject, Extensions>({
        object_name,
        extensions,
        criteria,
        size,
      })
    },
    Set(f, v) {
      const _ = Object.assign({}, this)
      _[f as string] = v
      return _
    },
    async Insert() {
      const props = {} as SObject
      Object.keys(this)
        .filter(_ => funcs[_] == null && extensions[_] == null)
        .forEach(_ => (props[_] = this[_]))

      this._Clear()

      return await _Create<SObject, Extensions>({ object_name, extensions, props })
    },
    _Clear() {
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
