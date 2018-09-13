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

export const TypedRemoteObjects = <SObject extends object, Extensions = {}>({
  object_name,
  extensions = {} as Extensions,
}: {
  object_name: string
  extensions?: Extensions
}) => {
  const s_object = {} as Readonly<SObject>
  const funcs = {
    _wheres: {} as Where<SObject>,
    _orders: [] as Order<SObject>,
    _limit: null as number | null,
    _offset: null as number | null,
    _size: null as number | null,
    async Find(id: string) {
      const _ = await _Retrieve<SObject, Extensions>({
        object_name,
        extensions,
        criteria: { where: { Id: { eq: id } } as any, limit: 1 },
      })

      this._Clear()

      return _.length === 0 ? null : _[0]
    },
    async FindAll(...ids: string[]) {
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
    async FindAllBy<Field extends keyof SObject>(field: Field, condition: WhereCondition<SObject[Field]>) {
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

      return await _Retrieves<SObject, Extensions>({
        object_name,
        extensions,
        criteria,
        size,
      })
    },
    Where<Field extends keyof SObject>(field: Field, condition: WhereCondition<SObject[Field]>) {
      const _ = Object.assign({}, this)
      _._wheres[field] = condition as any
      return _
    },
    Order(field: keyof SObject, order_type: OrderType) {
      const _ = Object.assign({}, this)
      _._orders.push({ [field]: order_type } as any)
      return _
    },
    Limit(size: number) {
      if (size > 100) {
        throw 'Please specify it within 100.'
      }

      const _ = Object.assign({}, this)
      _._limit = size
      return _
    },
    Offset(size: number) {
      if (size > 2000) {
        throw 'Please specify it within 2000.'
      }

      const _ = Object.assign({}, this)
      _._offset = size
      return _
    },
    Size(size: number) {
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
    Set<Field extends keyof SObject>(f: Field, v: SObject[Field]) {
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

  return Object.assign({}, s_object, funcs)
}
