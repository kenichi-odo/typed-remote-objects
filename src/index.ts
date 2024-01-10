import { CustomError } from 'ts-custom-error'
import { Criteria, Operator, Props, RemoteObjectInstance, Where } from './s-object-model'
import { addHours } from 'date-fns'
import deepmerge from 'deepmerge'

export { Where }

export type Record<SObjectName, SObjectType> = {
  type: SObjectName
  Id: string
} & {
  [Field in keyof Props<SObjectType>]: NonNullable<Props<SObjectType>[Field]>
}

export class TroError extends CustomError {
  constructor(
    public message: string,
    public s_object_name: string,
    public attributes: object,
  ) {
    super()
  }

  toObject() {
    return {
      name: this.name,
      message: this.message,
      s_object_name: this.s_object_name,
      attributes: this.attributes,
    }
  }
}

const _getKeys = <T extends { [key: string]: unknown }>(obj: T): (keyof T)[] => Object.keys(obj)

declare const SObjectModel: {
  [s_object_name: string]: new <SObjectType>() => RemoteObjectInstance<SObjectType>
}

const _models: { [s_object_name: string]: RemoteObjectInstance<unknown> } = {}
const _getRemoteObject = <SObjectType>(s_object_name: string) =>
  _models[s_object_name] as RemoteObjectInstance<SObjectType>

let _time_zone_offset: number
export const init = (
  un_accessible_fields: {
    [s_object_name: string]: string[]
  },
  time_zone_offset?: number,
) => {
  _time_zone_offset = time_zone_offset ?? 9
  _getKeys(un_accessible_fields).forEach(s_object_name => {
    const instance = new SObjectModel[s_object_name]()
    un_accessible_fields[s_object_name].forEach(_ => delete instance._fields[_])
    _models[s_object_name] = instance
  })
}

/**
 * @param where The 'Date' within the object undergoes destructive modification to become UTC time.
 * @returns When the `IN` clause is an empty array, it returns true.
 */
const _validateAndDateToUtc = <SObjectType>(where: Criteria<SObjectType>['where']) => {
  if (where == null) {
    return false
  }

  return _getKeys(where).some(field_name => {
    if (field_name === 'and' || field_name === 'or') {
      return _validateAndDateToUtc(where[field_name as string])
    }

    const operator = where[field_name]!
    const operator_key = _getKeys(operator)[0] as keyof Operator<SObjectType>

    const value = operator[operator_key]
    if (value == null) {
      delete where[field_name]
      return false
    }

    if (value instanceof Date) {
      operator[operator_key as string] = addHours(value, -_time_zone_offset)
      return false
    }

    if (!Array.isArray(value)) {
      return false
    }

    if (operator_key === 'in' && value.length === 0) {
      return true
    }

    operator[operator_key as string] = [...new Set(value as any)].map(v =>
      v instanceof Date ? addHours(v, -_time_zone_offset) : v,
    )
    return false
  })
}

const BATCH_SIZE = 100
const MAX_SIZE = 2000

export const fetchAll = async <SObjectName extends string, SObjectType>(
  s_object_name: SObjectName,
  criteria: Criteria<SObjectType> | undefined = {},
) => {
  const clone_criteria = deepmerge<typeof criteria>({}, criteria)

  if (clone_criteria.limit == null && clone_criteria.offset == null) {
    let remaining_size = MAX_SIZE
    let offset = 0

    const result: Record<SObjectName, SObjectType>[] = []
    while (remaining_size > 0) {
      const limit = remaining_size > BATCH_SIZE ? BATCH_SIZE : remaining_size
      const records = await fetchAll<SObjectName, SObjectType>(s_object_name, {
        where: clone_criteria.where,
        limit,
        offset: offset === 0 ? undefined : offset,
        orderby: clone_criteria.orderby,
      })
      if (records.length === 0) {
        break
      }

      result.push(...records)
      remaining_size -= limit
      offset += BATCH_SIZE
    }

    return result
  }

  const is_no_result = _validateAndDateToUtc(clone_criteria.where)
  if (clone_criteria.where != null && _getKeys(clone_criteria.where).length === 0) {
    delete clone_criteria.where
  }

  return new Promise<Record<SObjectName, SObjectType>[]>((resolve, reject) => {
    if (is_no_result) {
      setTimeout(() => resolve([]))
      return
    }

    try {
      _getRemoteObject<SObjectType>(s_object_name).retrieve(clone_criteria, (error, records) => {
        if (error == null) {
          resolve(
            records.map(r => {
              const result = { type: s_object_name } as Record<SObjectName, SObjectType>
              _getKeys(r._fields).forEach(field_name => {
                result[r._fields[field_name].shorthand || field_name] = r.get(field_name)
              })
              return result
            }),
          )
          return
        }

        reject(new TroError(error.message, s_object_name, { criteria, clone_criteria }))
      })
    } catch (error) {
      reject(new TroError((error as Error).message, s_object_name, { criteria, clone_criteria }))
    }
  })
}

export const fetchOne = async <SObjectName extends string, SObjectType>(
  s_object_name: SObjectName,
  criteria: Omit<Criteria<SObjectType>, 'limit'> | undefined = {},
): Promise<Record<SObjectName, SObjectType> | undefined> => {
  const result = await fetchAll<SObjectName, SObjectType>(s_object_name, deepmerge(criteria, { limit: 1 }))
  return result[0]
}

const _propsDateToUtc = <SObjectType>(props: Props<SObjectType>) => {
  const clone_props = deepmerge<typeof props>({}, props)
  _getKeys(clone_props).forEach(_ => {
    const p = clone_props[_]
    if (p instanceof Date) {
      clone_props[_ as string] = addHours(p, -_time_zone_offset)
    }
  })
  return clone_props
}

const _manipulateCallback =
  <SObjectName extends string, SObjectType>(
    s_object_name: SObjectName,
    props: Props<SObjectType>,
    is_fetch: boolean,
    resolve: (_?) => void,
    reject,
  ) =>
  async (error: Error | null, ids: string[]) => {
    if (error != null) {
      reject(new TroError(error!.message, s_object_name, { props }))
      return
    }

    if (!is_fetch) {
      resolve()
      return
    }

    const result = await fetchOne<SObjectName, { Id: string }>(s_object_name, {
      where: {
        Id: { eq: ids[0] },
      },
    }).catch((_: Error) => _)
    if (result instanceof Error) {
      reject(result)
      return
    }

    resolve(result)
  }

export const ins = <SObjectName extends string, SObjectType, Fetch extends true | false = false>(
  s_object_name: SObjectName,
  props: Props<SObjectType>,
  is_fetch: Fetch = false as Fetch,
) => {
  return new Promise<Fetch extends true ? Record<SObjectName, SObjectType> : void>((resolve, reject) => {
    try {
      _getRemoteObject(s_object_name).create(
        _propsDateToUtc(props),
        _manipulateCallback(s_object_name, props, is_fetch, resolve, reject),
      )
    } catch (error) {
      reject(new TroError((error as Error).message, s_object_name, { props }))
    }
  })
}

export const upd = <SObjectName extends string, SObjectType, Fetch extends true | false = false>(
  s_object_name: SObjectName,
  id: string,
  props: Props<SObjectType>,
  is_fetch: Fetch = false as Fetch,
) => {
  return new Promise<Fetch extends true ? Record<SObjectName, SObjectType> : void>((resolve: (_?) => void, reject) => {
    try {
      _getRemoteObject(s_object_name).update(
        [id],
        _propsDateToUtc(props),
        _manipulateCallback(s_object_name, props, is_fetch, resolve, reject),
      )
    } catch (error) {
      reject(new TroError((error as Error).message, s_object_name, { props }))
    }
  })
}

export const del = (s_object_name: string, id: string) =>
  new Promise<void>((resolve, reject) => {
    try {
      _getRemoteObject(s_object_name).del(id, error => {
        if (error == null) {
          resolve()
          return
        }

        reject(new TroError(error.message, s_object_name, { id }))
      })
    } catch (error) {
      reject(new TroError((error as Error).message, s_object_name, { id }))
    }
  })

export const criteria = <SObjectType>(_: Criteria<SObjectType> = {}) => _

export const props = <SObjectType>(_: Props<SObjectType>) => _
